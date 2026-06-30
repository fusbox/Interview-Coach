import type { QueryResultRow } from "pg";

import type { AnalysisResult, Answer, Question } from "@/lib/domain/types";
import { AnalysisResultSchema } from "@/lib/domain/schemas";
import { buildPracticeCoverageBaselineFromQuestionPlan, parseQuestionPlanSnapshot, type PracticeCoverageBaseline } from "@/lib/server/services/question-plan-service";
import { queryPostgres } from "@/lib/server/db/postgres";

import { buildPrepProfileReadModel, type PrepEvidenceState, type PrepProfileReadModel, type PrepQuestionCategoryCard, type PrepSignal } from "./prep-profile-read-model";
import { resolveLocalCandidateAuthHandoff } from "./candidate-dev-auth-resolver";
import { withCandidateRouteMetrics } from "./candidate-observability";
import { resolveCandidateProfileFromIdentity } from "./candidate-profile-repository";

export type CandidateDashboardPrepProfileSummary = {
    prepProfileId: string;
    primarySignal: {
        label: string;
        state: PrepEvidenceState;
    } | null;
    signals: PrepSignal[];
    categoryCards?: PrepQuestionCategoryCard[];
    signalCounts: Record<PrepEvidenceState, number>;
    recommendation: {
        label: string;
        reason: string;
        source: PrepProfileReadModel["recommendation"]["source"];
        href: string;
    };
};

export type CandidateDashboardPracticeCoverageBaseline = PracticeCoverageBaseline;

export type CandidateDashboardItem = {
    practiceDraftId: string;
    roleProfileId: string | null;
    roleContextLabel: string;
    title: string;
    statusLabel: string;
    progressLabel: string;
    href: string;
    repeatHref?: string;
    lastActivityLabel: string;
    lastActivityAt: number;
    summarySnippet?: string;
    coachingSnippet?: string;
    coachingSnippetLabel?: string;
    practiceCoverageBaseline?: CandidateDashboardPracticeCoverageBaseline;
    prepProfile?: CandidateDashboardPrepProfileSummary;
};

export type CandidateDashboardNextBestAction = {
    title: string;
    body: string;
    href: string;
    actionLabel: string;
};

export type CandidateDashboardTargetInterview = {
    id: string;
    label: string;
    href: string;
    isSelected: boolean;
    activeCount: number;
    completedCount: number;
    practicedQuestionCount: number;
    plannedQuestionCount: number;
    lastPracticedAt: number | null;
    prepState: PrepEvidenceState;
};

export type CandidateDashboardModel = {
    candidate: {
        candidateProfileId: string;
        displayName: string;
        email: string;
    };
    selectedTargetInterviewId: string | null;
    targetInterviews: CandidateDashboardTargetInterview[];
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
    role_profile_id: string | null;
    role_profile_source: string | null;
    target_role: string;
    job_description: string | null;
    resume_context_json: unknown;
    status: string;
    resume_target_screen: string;
    session_id: string | null;
    session_status: string | null;
    current_question_index: number | null;
    question_plan_snapshot: unknown;
    rigor_baseline_snapshot: unknown;
    question_count: number | string | null;
    submitted_count: number | string | null;
    summary_narrative: string | null;
    latest_recommendation: string | null;
    latest_coach_signal: unknown;
    last_activity_at: string | Date;
};

type DashboardSessionEvidenceRow = QueryResultRow & {
    session_id: string;
    question_id: string | null;
    question_index: number | string | null;
    question_text: string | null;
    category: string | null;
    answer_id: string | null;
    modality: "text" | "voice" | null;
    final_text: string | null;
    submitted_at: string | Date | null;
    feedback_json: unknown;
};

type DashboardCoachSignal = {
    focus: string;
    rationale?: string;
    targetMoment?: string;
    trySayingThis: string;
};

export async function loadCandidateDashboardForCurrentCandidate(input: {
    targetRole?: string | null;
} = {}): Promise<CandidateDashboardModel | null> {
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
                        d.role_profile_id,
                        rp.source as role_profile_source,
                        d.target_role,
                        d.job_description,
                        d.resume_context_json,
                        d.status,
                        d.resume_target_screen,
                        d.session_id,
                        s.status as session_status,
                        s.current_question_index,
                        s.intake_json -> 'questionPlanSnapshot' as question_plan_snapshot,
                        s.intake_json -> 'rigorBaselineSnapshot' as rigor_baseline_snapshot,
                        s.summary_narrative,
                        f.latest_recommendation,
                            f.latest_coach_signal,
                        coalesce(q.question_count, 0)::int as question_count,
                        coalesce(a.submitted_count, 0)::int as submitted_count,
                        d.last_activity_at
                    from public.candidate_practice_drafts d
                    left join public.candidate_role_preparation_profiles rp on rp.role_profile_id = d.role_profile_id
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
                            coalesce(er.feedback_json -> 'coachSignal', er.feedback_json -> 'oneBigUpgrade') as latest_coach_signal
                        from public.eval_results er
                        where er.session_id = d.session_id
                          and (er.feedback_json ? 'recommendation' or er.feedback_json ? 'coachSignal' or er.feedback_json ? 'oneBigUpgrade')
                        order by er.updated_at desc
                        limit 1
                    ) f on true
                    where d.candidate_profile_id = $1
                    order by d.last_activity_at desc
                    limit 20
                `,
                [profile.candidateProfileId],
            );

            const selectedTargetInterviewId = selectTargetInterviewId(result.rows, input.targetRole);
            const allSessionEvidenceBySessionId = await loadSessionEvidenceBySessionId(result.rows);
            const targetInterviews = buildTargetInterviewOptions(result.rows, selectedTargetInterviewId, allSessionEvidenceBySessionId);
            const scopedRows = selectCurrentTargetInterviewRows(result.rows, selectedTargetInterviewId);
            const items = scopedRows.map((row) => mapDashboardItem(row, allSessionEvidenceBySessionId.get(row.session_id ?? "")));
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
                selectedTargetInterviewId,
                targetInterviews,
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

function toDashboardItem(item: CandidateDashboardItem & { kind: "active" | "completed" }): CandidateDashboardItem {
    return {
        practiceDraftId: item.practiceDraftId,
        roleProfileId: item.roleProfileId,
        roleContextLabel: item.roleContextLabel,
        title: item.title,
        statusLabel: item.statusLabel,
        progressLabel: item.progressLabel,
        href: item.href,
        repeatHref: item.repeatHref,
        lastActivityLabel: item.lastActivityLabel,
        lastActivityAt: item.lastActivityAt,
        summarySnippet: item.summarySnippet,
        coachingSnippet: item.coachingSnippet,
        coachingSnippetLabel: item.coachingSnippetLabel,
        practiceCoverageBaseline: item.practiceCoverageBaseline,
        prepProfile: item.prepProfile,
    };
}

function selectTargetInterviewId(rows: DashboardDraftRow[], requestedTargetRole: string | null | undefined): string | null {
    if (rows.length === 0) {
        return null;
    }

    const requestedId = normalizeTargetRole(requestedTargetRole);
    if (requestedId && rows.some((row) => getTargetInterviewId(row) === requestedId)) {
        return requestedId;
    }

    const selectedRow = rows.find((row) => !isCompletedRow(row)) ?? rows[0];
    return selectedRow ? getTargetInterviewId(selectedRow) : null;
}

function selectCurrentTargetInterviewRows(rows: DashboardDraftRow[], selectedTargetInterviewId: string | null): DashboardDraftRow[] {
    if (!selectedTargetInterviewId) {
        return [];
    }

    return rows.filter((row) => getTargetInterviewId(row) === selectedTargetInterviewId);
}

function buildTargetInterviewOptions(
    rows: DashboardDraftRow[],
    selectedTargetInterviewId: string | null,
    sessionEvidenceBySessionId: Map<string, DashboardSessionEvidenceRow[]> = new Map(),
): CandidateDashboardTargetInterview[] {
    const options = new Map<string, CandidateDashboardTargetInterview>();
    for (const row of rows) {
        const id = getTargetInterviewId(row);
        const current = options.get(id) ?? {
            id,
            label: row.target_role,
            href: `/dashboard?targetRole=${encodeURIComponent(id)}`,
            isSelected: id === selectedTargetInterviewId,
            activeCount: 0,
            completedCount: 0,
            practicedQuestionCount: 0,
            plannedQuestionCount: 0,
            lastPracticedAt: null,
            prepState: "not_practiced",
        };

        if (isCompletedRow(row)) {
            current.completedCount += 1;
        } else {
            current.activeCount += 1;
        }
        current.practicedQuestionCount += Number(row.submitted_count ?? 0);
        current.plannedQuestionCount += Number(row.question_count ?? 0);
        const lastActivityAt = toTimestamp(row.last_activity_at);
        if (lastActivityAt && (!current.lastPracticedAt || lastActivityAt > current.lastPracticedAt)) {
            current.lastPracticedAt = lastActivityAt;
            current.prepState = buildDashboardPrepProfileSummary(row, sessionEvidenceBySessionId.get(row.session_id ?? "") ?? [], null).primarySignal?.state ?? "not_practiced";
        }

        options.set(id, current);
    }

    return Array.from(options.values()).map((option) => ({
        ...option,
        isSelected: option.id === selectedTargetInterviewId,
    }));
}

function getTargetInterviewId(row: DashboardDraftRow): string {
    return normalizeTargetRole(row.target_role);
}

function normalizeTargetRole(value: string | null | undefined): string {
    return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function loadSessionEvidenceBySessionId(
    rows: DashboardDraftRow[],
): Promise<Map<string, DashboardSessionEvidenceRow[]>> {
    const sessionIds = Array.from(new Set(rows.map((row) => row.session_id).filter(Boolean))) as string[];
    if (sessionIds.length === 0) {
        return new Map();
    }

    const result = await queryPostgres<DashboardSessionEvidenceRow>(
        `
            select
                q.session_id,
                q.question_id,
                q.question_index,
                q.question_text,
                q.category,
                a.answer_id,
                a.modality,
                a.final_text,
                a.submitted_at,
                er.feedback_json
            from public.questions q
            left join lateral (
                select *
                from public.answers a
                where a.question_id = q.question_id
                order by a.attempt_number desc
                limit 1
            ) a on true
            left join lateral (
                select *
                from public.eval_results er
                where er.question_id = q.question_id
                  and er.attempt_number = coalesce(a.attempt_number, 1)
                order by er.updated_at desc
                limit 1
            ) er on true
            where q.session_id = any($1::uuid[])
            order by q.session_id, q.question_index
        `,
        [sessionIds],
    );

    return groupSessionEvidenceRows(result.rows);
}

function groupSessionEvidenceRows(rows: DashboardSessionEvidenceRow[]): Map<string, DashboardSessionEvidenceRow[]> {
    const grouped = new Map<string, DashboardSessionEvidenceRow[]>();
    for (const row of rows) {
        if (!row.session_id || !row.question_id) {
            continue;
        }
        const current = grouped.get(row.session_id) ?? [];
        current.push(row);
        grouped.set(row.session_id, current);
    }
    return grouped;
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
        const hasBiggestLift = completedItem.coachingSnippetLabel === "For the biggest lift";
        return {
            title: hasBiggestLift ? "Practice the biggest lift" : "Practice one focused improvement",
            body: signal
                ? hasBiggestLift
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

function isCompletedRow(row: DashboardDraftRow): boolean {
    return row.status === "completed" || row.session_status === "COMPLETED";
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

function parseCoachSignal(value: unknown): DashboardCoachSignal | null {
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

function mapDashboardItem(
    row: DashboardDraftRow,
    evidenceRows: DashboardSessionEvidenceRow[] = [],
): CandidateDashboardItem & { kind: "active" | "completed" } {
    const questionCount = toNumber(row.question_count);
    const submittedCount = toNumber(row.submitted_count);
    const isCompleted = isCompletedRow(row);
    const sessionHref = row.session_id ? `/session/${row.session_id}` : "/practice";
    const summaryHref = row.session_id ? `/summary/${row.session_id}` : sessionHref;
    const coachSignal = parseCoachSignal(row.latest_coach_signal);
    const prepProfile = buildDashboardPrepProfileSummary(row, evidenceRows, isCompleted ? null : sessionHref);
    const practiceCoverageBaseline = buildDashboardPracticeCoverageBaseline(row.rigor_baseline_snapshot, row.question_plan_snapshot);

    return {
        kind: isCompleted ? "completed" : "active",
        practiceDraftId: row.practice_draft_id,
        roleProfileId: row.role_profile_id ?? null,
        roleContextLabel: row.role_profile_id ? "Role context saved" : "Role context from practice history",
        title: row.target_role,
        statusLabel: isCompleted ? "Completed" : formatStatus(row.status, row.session_status),
        progressLabel: `${submittedCount} of ${questionCount} answered`,
        href: isCompleted ? summaryHref : sessionHref,
        repeatHref: isCompleted ? "/practice" : undefined,
        lastActivityLabel: formatDate(row.last_activity_at),
        lastActivityAt: toTimestamp(row.last_activity_at) ?? 0,
        summarySnippet: row.summary_narrative || undefined,
        coachingSnippet: coachSignal
            ? `${coachSignal.focus}: ${coachSignal.trySayingThis}`
            : row.latest_recommendation || undefined,
        coachingSnippetLabel: coachSignal ? "For the biggest lift" : undefined,
        practiceCoverageBaseline,
        prepProfile,
    };
}

function buildDashboardPracticeCoverageBaseline(
    rigorBaselineSnapshot: unknown,
    questionPlanSnapshot: unknown,
): CandidateDashboardPracticeCoverageBaseline | undefined {
    const snapshot = parseQuestionPlanSnapshot(rigorBaselineSnapshot) ?? parseQuestionPlanSnapshot(questionPlanSnapshot);
    if (!snapshot) {
        return undefined;
    }

    return buildPracticeCoverageBaselineFromQuestionPlan(snapshot);
}

function buildDashboardPrepProfileSummary(
    row: DashboardDraftRow,
    evidenceRows: DashboardSessionEvidenceRow[],
    activeSessionHref: string | null,
): CandidateDashboardPrepProfileSummary {
    const prepProfileId = row.role_profile_id ?? row.practice_draft_id;
    const readModel = buildPrepProfileReadModel({
        prepProfileId,
        targetRole: row.target_role,
        jobDescription: row.job_description,
        resumeContextState: resolveResumeContextState(row.resume_context_json),
        sessionId: row.session_id ?? undefined,
        questions: evidenceRows.map(mapEvidenceQuestion),
        answers: evidenceRows.map(mapEvidenceAnswer).filter((answer): answer is Answer => Boolean(answer)),
        summaryNarrative: row.summary_narrative,
        activeSessionHref,
    });
    const primarySignal = readModel.signals.find((signal) => signal.priority === "primary") ?? readModel.signals[0] ?? null;

    return {
        prepProfileId: readModel.prepProfileId,
        primarySignal: primarySignal
            ? {
                label: primarySignal.label,
                state: primarySignal.evidenceState,
            }
            : null,
        signals: readModel.signals,
        categoryCards: readModel.categoryCards,
        signalCounts: countSignals(readModel),
        recommendation: {
            label: readModel.recommendation.label,
            reason: readModel.recommendation.reason,
            source: readModel.recommendation.source,
            href: readModel.recommendation.href,
        },
    };
}

function mapEvidenceQuestion(row: DashboardSessionEvidenceRow): Question {
    return {
        id: row.question_id ?? "",
        text: row.question_text ?? "",
        category: row.category ?? "General",
        index: toNumber(row.question_index),
    };
}

function mapEvidenceAnswer(row: DashboardSessionEvidenceRow): Answer | null {
    if (!row.answer_id && !row.final_text && !row.submitted_at && !row.feedback_json) {
        return null;
    }

    const parsedAnalysis = AnalysisResultSchema.safeParse(row.feedback_json);
    const analysis = parsedAnalysis.success ? parsedAnalysis.data as AnalysisResult : undefined;
    const answer: Answer = {
        questionId: row.question_id ?? "",
        transcript: row.final_text ?? "",
        modality: row.modality ?? analysis?.meta?.modality ?? undefined,
        submittedAt: toTimestamp(row.submitted_at),
        analysis,
    };

    return answer;
}

function resolveResumeContextState(value: unknown): "none" | "present" | "processed" {
    if (!value || typeof value !== "object") {
        return "none";
    }

    const context = value as Record<string, unknown>;
    const processedArtifact = context.processedArtifact;
    if (processedArtifact && typeof processedArtifact === "object") {
        const text = (processedArtifact as Record<string, unknown>).text;
        if (typeof text === "string" && text.trim()) {
            return "processed";
        }
    }

    for (const key of ["extractedText", "pastedText"]) {
        const text = context[key];
        if (typeof text === "string" && text.trim()) {
            return "present";
        }
    }

    return "none";
}

function countSignals(readModel: PrepProfileReadModel): Record<PrepEvidenceState, number> {
    const counts: Record<PrepEvidenceState, number> = {
        not_practiced: 0,
        emerging: 0,
        clear: 0,
        strong: 0,
    };

    for (const signal of readModel.signals) {
        counts[signal.evidenceState] += 1;
    }

    return counts;
}

function toTimestamp(value: string | Date | null): number | undefined {
    if (!value) {
        return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    const timestamp = date.getTime();
    return Number.isFinite(timestamp) ? timestamp : undefined;
}
