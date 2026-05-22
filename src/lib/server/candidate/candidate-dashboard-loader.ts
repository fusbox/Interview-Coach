import type { QueryResultRow } from "pg";

import { queryPostgres } from "@/lib/server/db/postgres";

import { resolveLocalCandidateAuthHandoff } from "./candidate-dev-auth-resolver";
import { withCandidateRouteMetrics } from "./candidate-observability";
import { resolveCandidateProfileFromIdentity } from "./candidate-profile-repository";

export type CandidateDashboardItem = {
    practiceDraftId: string;
    title: string;
    statusLabel: string;
    progressLabel: string;
    href: string;
    repeatHref?: string;
    lastActivityLabel: string;
    summarySnippet?: string;
    coachingSnippet?: string;
    coachingSnippetLabel?: string;
};

export type CandidateDashboardNextBestAction = {
    title: string;
    body: string;
    href: string;
    actionLabel: string;
};

export type CandidateDashboardModel = {
    candidate: {
        candidateProfileId: string;
        displayName: string;
        email: string;
    };
    stats: {
        activeCount: number;
        completedCount: number;
        totalPracticeCount: number;
    };
    activeItems: CandidateDashboardItem[];
    completedItems: CandidateDashboardItem[];
    nextBestAction: CandidateDashboardNextBestAction;
};

type DashboardDraftRow = QueryResultRow & {
    practice_draft_id: string;
    target_role: string;
    status: string;
    resume_target_screen: string;
    session_id: string | null;
    session_status: string | null;
    current_question_index: number | null;
    question_count: number | string | null;
    submitted_count: number | string | null;
    summary_narrative: string | null;
    latest_recommendation: string | null;
    latest_one_big_upgrade: unknown;
    last_activity_at: string | Date;
};

type DashboardOneBigUpgrade = {
    focus: string;
    rationale?: string;
    targetMoment?: string;
    trySayingThis: string;
};

export async function loadCandidateDashboardForCurrentCandidate(): Promise<CandidateDashboardModel | null> {
    return withCandidateRouteMetrics({
        route: "/dashboard",
        operation: "load_dashboard",
        load: async () => {
            const handoff = await resolveLocalCandidateAuthHandoff();
            if (!handoff) {
                return null;
            }

            const profile = await resolveCandidateProfileFromIdentity(handoff);
            const result = await queryPostgres<DashboardDraftRow>(
                `
                    select
                        d.practice_draft_id,
                        d.target_role,
                        d.status,
                        d.resume_target_screen,
                        d.session_id,
                        s.status as session_status,
                        s.current_question_index,
                        s.summary_narrative,
                        f.latest_recommendation,
                        f.latest_one_big_upgrade,
                        coalesce(q.question_count, 0)::int as question_count,
                        coalesce(a.submitted_count, 0)::int as submitted_count,
                        d.last_activity_at
                    from public.candidate_practice_drafts d
                    left join public.sessions s on s.session_id = d.session_id
                    left join (
                        select session_id, count(*)::int as question_count
                        from public.questions
                        group by session_id
                    ) q on q.session_id = d.session_id
                    left join (
                        select session_id, count(*) filter (where submitted_at is not null)::int as submitted_count
                        from public.answers
                        group by session_id
                    ) a on a.session_id = d.session_id
                    left join lateral (
                        select
                            er.feedback_json ->> 'recommendation' as latest_recommendation,
                            er.feedback_json -> 'oneBigUpgrade' as latest_one_big_upgrade
                        from public.eval_results er
                        where er.session_id = d.session_id
                          and (er.feedback_json ? 'recommendation' or er.feedback_json ? 'oneBigUpgrade')
                        order by er.updated_at desc
                        limit 1
                    ) f on true
                    where d.candidate_profile_id = $1
                    order by d.last_activity_at desc
                    limit 20
                `,
                [profile.candidateProfileId],
            );

            const items = result.rows.map(mapDashboardItem);
            const completedItems = items
                .filter((item) => item.kind === "completed")
                .map((item) => toDashboardItem(item));
            const activeItems = items
                .filter((item) => item.kind === "active")
                .map((item) => toDashboardItem(item));

            return {
                candidate: {
                    candidateProfileId: profile.candidateProfileId,
                    displayName: profile.displayName || profile.email,
                    email: profile.email,
                },
                stats: {
                    activeCount: activeItems.length,
                    completedCount: completedItems.length,
                    totalPracticeCount: items.length,
                },
                activeItems,
                completedItems,
                nextBestAction: buildNextBestAction(activeItems, completedItems),
            };
        },
    });
}

function mapDashboardItem(row: DashboardDraftRow): CandidateDashboardItem & { kind: "active" | "completed" } {
    const questionCount = toNumber(row.question_count);
    const submittedCount = toNumber(row.submitted_count);
    const isCompleted = row.status === "completed" || row.session_status === "COMPLETED";
    const sessionHref = row.session_id ? `/session/${row.session_id}` : "/practice";
    const summaryHref = row.session_id ? `/summary/${row.session_id}` : sessionHref;
    const oneBigUpgrade = parseOneBigUpgrade(row.latest_one_big_upgrade);

    return {
        kind: isCompleted ? "completed" : "active",
        practiceDraftId: row.practice_draft_id,
        title: row.target_role,
        statusLabel: isCompleted ? "Completed" : formatStatus(row.status, row.session_status),
        progressLabel: `${submittedCount} of ${questionCount} answered`,
        href: isCompleted ? summaryHref : sessionHref,
        repeatHref: isCompleted ? "/practice" : undefined,
        lastActivityLabel: formatDate(row.last_activity_at),
        summarySnippet: row.summary_narrative || undefined,
        coachingSnippet: oneBigUpgrade
            ? `${oneBigUpgrade.focus}: ${oneBigUpgrade.trySayingThis}`
            : row.latest_recommendation || undefined,
        coachingSnippetLabel: oneBigUpgrade ? "One big upgrade" : undefined,
    };
}

function toDashboardItem(item: CandidateDashboardItem & { kind: "active" | "completed" }): CandidateDashboardItem {
    return {
        practiceDraftId: item.practiceDraftId,
        title: item.title,
        statusLabel: item.statusLabel,
        progressLabel: item.progressLabel,
        href: item.href,
        repeatHref: item.repeatHref,
        lastActivityLabel: item.lastActivityLabel,
        summarySnippet: item.summarySnippet,
        coachingSnippet: item.coachingSnippet,
        coachingSnippetLabel: item.coachingSnippetLabel,
    };
}

function buildNextBestAction(
    activeItems: CandidateDashboardItem[],
    completedItems: CandidateDashboardItem[],
): CandidateDashboardNextBestAction {
    const activeItem = activeItems[0];
    if (activeItem) {
        return {
            title: `Resume ${activeItem.title}`,
            body: `You have ${activeItem.progressLabel}. Pick up this active practice before starting another round.`,
            href: activeItem.href,
            actionLabel: "Resume practice",
        };
    }

    const completedItem = completedItems[0];
    if (completedItem) {
        const signal = completedItem.coachingSnippet || completedItem.summarySnippet;
        const hasOneBigUpgrade = completedItem.coachingSnippetLabel === "One big upgrade";
        return {
            title: hasOneBigUpgrade ? "Practice one focused upgrade" : "Practice one focused improvement",
            body: signal
                ? hasOneBigUpgrade
                    ? `From your ${completedItem.title} feedback: ${signal.replace(": ", ". Try: ")}`
                    : `From your ${completedItem.title} summary: ${signal}`
                : `Use your ${completedItem.title} summary to choose one answer pattern and practice it again.`,
            href: completedItem.repeatHref || "/practice",
            actionLabel: "Practice again",
        };
    }

    return {
        title: "Start with a target role",
        body: "Create a lightweight practice setup when you know what role you want to prepare for.",
        href: "/practice",
        actionLabel: "Start practice",
    };
}

function formatStatus(draftStatus: string, sessionStatus: string | null): string {
    if (sessionStatus === "IN_SESSION" || draftStatus === "in_session") {
        return "In progress";
    }
    if (draftStatus === "ready") {
        return "Ready to start";
    }
    if (draftStatus === "generating") {
        return "Generating";
    }
    if (draftStatus === "generation_failed") {
        return "Needs attention";
    }

    return "Draft";
}

function formatDate(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Recently";
    }

    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}

function toNumber(value: number | string | null): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function parseOneBigUpgrade(value: unknown): DashboardOneBigUpgrade | null {
    const parsed = typeof value === "string" ? safeParseJson(value) : value;
    if (!parsed || typeof parsed !== "object") {
        return null;
    }

    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.focus !== "string" || typeof candidate.trySayingThis !== "string") {
        return null;
    }

    return {
        focus: candidate.focus,
        rationale: typeof candidate.rationale === "string" ? candidate.rationale : undefined,
        targetMoment: typeof candidate.targetMoment === "string" ? candidate.targetMoment : undefined,
        trySayingThis: candidate.trySayingThis,
    };
}

function safeParseJson(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}
