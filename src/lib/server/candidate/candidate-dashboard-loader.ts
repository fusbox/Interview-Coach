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
    last_activity_at: string | Date;
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
