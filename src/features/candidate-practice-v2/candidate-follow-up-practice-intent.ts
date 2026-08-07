import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type { CandidateQuestionPlanCategory } from "@/features/candidate-session-v2/candidate-question-plan";
import type { CandidateSetupResumeArtifactReference } from "@/features/candidate-setup-v2/candidate-setup-contract";
import { resolveCandidateFollowUpPlanQuestionNumber } from "./candidate-follow-up-session-creation";
import { hasCandidateActivePracticeSessionForContext } from "./candidate-active-practice-session";

export type CandidateFollowUpPracticeIntentKind =
    | "practice_from_feedback"
    | "practice_missing_evidence";

export type CandidatePracticeIntentSource =
    | "coach_update_detail"
    | "practice_builder"
    | "plan_aware_queue"
    | "coach_bundle";

export type CandidatePracticeIntentLifecycleState =
    | "ready"
    | "consumed"
    | "cancelled"
    | "expired";

export type CandidatePracticeIntentItemProvenance =
    | "coach_update"
    | "coach_plan"
    | "practice_next"
    | "candidate_selection"
    | "coach_bundle";

export type CandidateFollowUpPracticeIntent = {
    status: "candidate_follow_up_practice_intent_ready";
    kind: CandidateFollowUpPracticeIntentKind;
    source: {
        kind: "coach_update_detail";
        candidatePracticeSessionId: string;
        questionKey: string;
    };
    display: {
        label: "Practice from coach feedback" | "Practice missing evidence";
        body: string;
    };
};

export type CandidateResolvedFollowUpPracticeIntent = {
    status: "candidate_follow_up_practice_intent_resolved";
    roleProfileId: string | null;
    kind: CandidateFollowUpPracticeIntentKind;
    source: {
        kind: "coach_update_detail";
        candidatePracticeSessionId: string;
        questionKey: string;
        targetInterviewId: string;
        targetRole: string;
        questionNumber: number;
        category: string;
        questionText: string;
        evidenceStatus: "practiced_with_coaching" | "missing_practice_evidence";
    };
    setupContext: {
        targetRole: string;
        jobDescription: string;
        interviewStage: CandidatePracticeSessionRecord["setupSnapshot"]["interviewStage"];
        questionCount: number;
        resumeIncluded: boolean;
        resumeArtifact?: CandidateSetupResumeArtifactReference | null;
    };
    display: CandidateFollowUpPracticeIntent["display"];
};

export type CandidatePracticeIntentItem = {
    kind: CandidateFollowUpPracticeIntentKind;
    source: CandidateResolvedFollowUpPracticeIntent["source"];
    display: CandidateResolvedFollowUpPracticeIntent["display"];
    assembly?: {
        source: "next_round_draft";
        candidateNextRoundDraftItemId: string;
        provenance: CandidatePracticeIntentItemProvenance;
        displayPosition: number;
    };
};

export type CandidatePracticeIntentRecord = {
    status: "candidate_practice_intent_record";
    candidatePracticeIntentId: string;
    candidateProfileId: string;
    source: CandidatePracticeIntentSource;
    lifecycleState: CandidatePracticeIntentLifecycleState;
    launchVersion: number;
    consumedCandidatePracticeSessionId?: string | null;
    consumedAt?: string | null;
    sourceNextRoundDraftId?: string | null;
    sourceNextRoundDraftVersion?: number | null;
    roleProfileId: string | null;
    targetInterviewId: string;
    targetRole: string;
    itemCount: number;
    setupContext: CandidateResolvedFollowUpPracticeIntent["setupContext"];
    items: CandidatePracticeIntentItem[];
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
};

export type CreateCandidateFollowUpPracticeIntentRecordInput = {
    candidatePracticeIntentId: string;
    candidateProfileId: string;
    source: CandidatePracticeIntentSource;
    lifecycleState?: CandidatePracticeIntentLifecycleState;
    items: CandidateResolvedFollowUpPracticeIntent[];
    createdAt: string;
    updatedAt?: string;
    expiresAt?: string;
};

export const CANDIDATE_PRACTICE_INTENT_READY_WINDOW_MS = 24 * 60 * 60 * 1_000;

export type CandidateFollowUpPracticeIntentState =
    | CandidateFollowUpPracticeIntent
    | CandidateResolvedFollowUpPracticeIntent;

export type CandidatePracticeReadySearchParams = Record<string, string | string[] | undefined>;

const intentKinds = {
    "coach-update-feedback-focus": "practice_from_feedback",
    "coach-update-missing-evidence": "practice_missing_evidence",
} as const satisfies Record<string, CandidateFollowUpPracticeIntentKind>;

export function parseCandidateFollowUpPracticeIntent(
    searchParams: CandidatePracticeReadySearchParams | null | undefined,
): CandidateFollowUpPracticeIntent | null {
    const intent = readSingleSearchParam(searchParams, "intent");
    const candidatePracticeSessionId = readStableSourceParam(searchParams, "fromSession");
    const questionKey = readStableSourceParam(searchParams, "questionKey");

    if (!intent || !candidatePracticeSessionId || !questionKey || !(intent in intentKinds)) {
        return null;
    }

    const kind = intentKinds[intent as keyof typeof intentKinds];

    return {
        status: "candidate_follow_up_practice_intent_ready",
        kind,
        source: {
            kind: "coach_update_detail",
            candidatePracticeSessionId,
            questionKey,
        },
        display: getIntentDisplay(kind),
    };
}

export function resolveCandidateFollowUpPracticeIntent({
    intent,
    candidateProfileId,
    practiceSessions,
    selectedRoleProfileId,
    selectedLegacyTargetRole,
}: {
    intent: CandidateFollowUpPracticeIntent | null;
    candidateProfileId: string;
    practiceSessions: CandidatePracticeSessionRecord[];
    selectedRoleProfileId?: string | null;
    selectedLegacyTargetRole?: string | null;
}): CandidateResolvedFollowUpPracticeIntent | null {
    if (!intent) {
        return null;
    }

    const sourceSession = practiceSessions.find((session) => (
        session.candidatePracticeSessionId === intent.source.candidatePracticeSessionId
        && session.candidateProfileId === candidateProfileId
    ));
    if (!sourceSession?.questionWordingSnapshot) {
        return null;
    }

    const targetInterviewId = normalizeTargetInterviewId(sourceSession.setupSnapshot.targetRole);
    const roleProfileId = readNullableString(sourceSession.roleProfileId);
    const requestedRoleProfileId = readNullableString(selectedRoleProfileId);
    const requestedLegacyTargetRole = normalizeTargetInterviewId(selectedLegacyTargetRole);
    if (requestedRoleProfileId && requestedRoleProfileId !== roleProfileId) {
        return null;
    }
    if (requestedLegacyTargetRole && (roleProfileId || requestedLegacyTargetRole !== targetInterviewId)) {
        return null;
    }
    if (hasCandidateActivePracticeSessionForContext({
        candidateProfileId,
        roleProfileId,
        legacyTargetRole: sourceSession.setupSnapshot.targetRole,
        practiceSessions,
    })) {
        return null;
    }

    const sourceQuestion = sourceSession.questionWordingSnapshot.questions.find((question) => (
        question.slotId === intent.source.questionKey
    ));
    if (!sourceQuestion) {
        return null;
    }

    const hasAnswer = Boolean(sourceSession.answerSubmissions[sourceQuestion.slotId]);
    const hasCoaching = Boolean(sourceSession.answerAnalysisSnapshots[sourceQuestion.slotId]);

    if (intent.kind === "practice_from_feedback" && (!hasAnswer || !hasCoaching)) {
        return null;
    }
    if (intent.kind === "practice_missing_evidence" && hasAnswer) {
        return null;
    }
    const planQuestionNumber = resolveCandidateFollowUpPlanQuestionNumber({
        session: sourceSession,
        questionKey: sourceQuestion.slotId,
    }) ?? sourceQuestion.index + 1;

    return {
        status: "candidate_follow_up_practice_intent_resolved",
        roleProfileId,
        kind: intent.kind,
        source: {
            kind: "coach_update_detail",
            candidatePracticeSessionId: sourceSession.candidatePracticeSessionId,
            questionKey: sourceQuestion.slotId,
            targetInterviewId,
            targetRole: sourceSession.setupSnapshot.targetRole,
            questionNumber: planQuestionNumber,
            category: labelForCategory(sourceQuestion.category),
            questionText: sourceQuestion.questionText,
            evidenceStatus: intent.kind === "practice_from_feedback"
                ? "practiced_with_coaching"
                : "missing_practice_evidence",
        },
        setupContext: {
            targetRole: sourceSession.setupSnapshot.targetRole,
            jobDescription: sourceSession.setupSnapshot.jobDescription,
            interviewStage: sourceSession.setupSnapshot.interviewStage,
            questionCount: sourceSession.setupSnapshot.questionCount,
            resumeIncluded: Boolean(sourceSession.setupSnapshot.resumeText),
            resumeArtifact: sourceSession.setupSnapshot.resumeArtifact ?? null,
        },
        display: getResolvedIntentDisplay(intent.kind, sourceSession.setupSnapshot.targetRole, planQuestionNumber),
    };
}

export function createCandidateFollowUpPracticeIntentRecord({
    candidatePracticeIntentId,
    candidateProfileId,
    source,
    lifecycleState = "ready",
    items,
    createdAt,
    updatedAt,
    expiresAt,
}: CreateCandidateFollowUpPracticeIntentRecordInput): CandidatePracticeIntentRecord | null {
    const firstItem = items[0];
    if (!readString(candidatePracticeIntentId) || !readString(candidateProfileId) || !firstItem) {
        return null;
    }
    if (
        !isCandidatePracticeIntentSource(source)
        || !isCandidatePracticeIntentLifecycleState(lifecycleState)
        || lifecycleState === "consumed"
    ) {
        return null;
    }
    const createdAtTime = Date.parse(createdAt);
    if (!Number.isFinite(createdAtTime)) {
        return null;
    }
    const resolvedExpiresAt = expiresAt ?? new Date(createdAtTime + CANDIDATE_PRACTICE_INTENT_READY_WINDOW_MS).toISOString();
    const expiresAtTime = Date.parse(resolvedExpiresAt);
    if (!Number.isFinite(expiresAtTime) || expiresAtTime <= createdAtTime) {
        return null;
    }
    if (items.length > 20) {
        return null;
    }

    const targetInterviewId = firstItem.source.targetInterviewId;
    const targetRole = firstItem.source.targetRole;
    const roleProfileId = firstItem.roleProfileId;
    const setupContext = firstItem.setupContext;
    const sourceKeys = new Set<string>();
    const normalizedItems: CandidatePracticeIntentItem[] = [];

    for (const item of items) {
        if (
            item.roleProfileId !== roleProfileId
            || item.source.targetInterviewId !== targetInterviewId
            || item.source.targetRole !== targetRole
            || item.setupContext.targetRole !== setupContext.targetRole
            || item.setupContext.jobDescription !== setupContext.jobDescription
            || item.setupContext.interviewStage !== setupContext.interviewStage
            || item.setupContext.resumeIncluded !== setupContext.resumeIncluded
            || JSON.stringify(item.setupContext.resumeArtifact ?? null)
                !== JSON.stringify(setupContext.resumeArtifact ?? null)
        ) {
            return null;
        }

        const sourceKey = `${item.source.kind}:${item.source.candidatePracticeSessionId}:${item.source.questionKey}`;
        if (sourceKeys.has(sourceKey)) {
            return null;
        }
        sourceKeys.add(sourceKey);

        normalizedItems.push({
            kind: item.kind,
            source: item.source,
            display: item.display,
        });
    }

    return {
        status: "candidate_practice_intent_record",
        candidatePracticeIntentId,
        candidateProfileId,
        source,
        lifecycleState,
        launchVersion: 1,
        consumedCandidatePracticeSessionId: null,
        consumedAt: null,
        roleProfileId,
        targetInterviewId,
        targetRole,
        itemCount: normalizedItems.length,
        setupContext,
        items: normalizedItems,
        createdAt,
        updatedAt: updatedAt ?? createdAt,
        expiresAt: resolvedExpiresAt,
    };
}

export function isCandidatePracticeIntentLaunchable(
    intent: CandidatePracticeIntentRecord,
    now: Date,
) {
    const expiresAt = Date.parse(intent.expiresAt);
    return intent.lifecycleState === "ready"
        && Number.isFinite(expiresAt)
        && expiresAt > now.getTime();
}

function readSingleSearchParam(searchParams: CandidatePracticeReadySearchParams | null | undefined, key: string) {
    const value = searchParams?.[key];

    if (Array.isArray(value)) {
        return null;
    }

    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNullableString(value: unknown) {
    return value === null || value === undefined ? null : readString(value);
}

export function isCandidatePracticeIntentSource(value: unknown): value is CandidatePracticeIntentSource {
    return value === "coach_update_detail"
        || value === "practice_builder"
        || value === "plan_aware_queue"
        || value === "coach_bundle";
}

export function isCandidatePracticeIntentLifecycleState(
    value: unknown,
): value is CandidatePracticeIntentLifecycleState {
    return value === "ready"
        || value === "consumed"
        || value === "cancelled"
        || value === "expired";
}

function readStableSourceParam(searchParams: CandidatePracticeReadySearchParams | null | undefined, key: string) {
    const value = readSingleSearchParam(searchParams, key);

    if (!value || value.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
        return null;
    }

    return value;
}

function getIntentDisplay(kind: CandidateFollowUpPracticeIntentKind): CandidateFollowUpPracticeIntent["display"] {
    if (kind === "practice_from_feedback") {
        return {
            label: "Practice from coach feedback",
            body: "I will keep this focused on what your latest coach read surfaced.",
        };
    }

    return {
        label: "Practice missing evidence",
        body: "This planned question still needs practice evidence.",
    };
}

function getResolvedIntentDisplay(
    kind: CandidateFollowUpPracticeIntentKind,
    targetRole: string,
    questionNumber: number,
): CandidateFollowUpPracticeIntent["display"] {
    if (kind === "practice_from_feedback") {
        return {
            label: "Practice from coach feedback",
            body: `I found the source coach read for ${targetRole}, question ${questionNumber}.`,
        };
    }

    return {
        label: "Practice missing evidence",
        body: `I found the planned ${targetRole} question that still needs practice evidence.`,
    };
}

function normalizeTargetInterviewId(value: string | null | undefined) {
    return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function labelForCategory(category: CandidateQuestionPlanCategory) {
    switch (category) {
        case "screening":
            return "Screening";
        case "behavioral":
            return "Behavioral";
        case "culture_fit":
            return "Culture / Fit";
        case "case_scenario":
            return "Scenario";
        case "technical_role_specific":
            return "Technical / Role-Specific";
        default:
            return "Practice";
    }
}
