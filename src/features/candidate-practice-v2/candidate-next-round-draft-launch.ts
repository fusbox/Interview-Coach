import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    createCandidateFollowUpPracticeIntentRecord,
    resolveCandidateFollowUpPracticeIntent,
    type CandidateFollowUpPracticeIntent,
    type CandidatePracticeIntentRecord,
} from "./candidate-follow-up-practice-intent";
import {
    createCandidateNextRoundDraftAssembly,
    type CandidateNextRoundDraftRecord,
} from "./candidate-next-round-draft";
import type {
    CandidateNextRoundDraftSnapshotInput,
    CandidateNextRoundDraftSnapshotResult,
} from "./candidate-next-round-draft-launch-repository";
import { resolveCandidateFollowUpQuestionRoot } from "./candidate-follow-up-session-creation";
import { hasCandidateActivePracticeSessionForContext } from "./candidate-active-practice-session";

export type CandidateNextRoundDraftLaunchResult =
    | {
        status: "candidate_next_round_draft_launched";
        outcome: "created" | "replayed";
        candidatePracticeIntentId: string;
        redirectTo: string;
    }
    | {
        status: "candidate_next_round_draft_not_launched";
        reason:
            | "not_found"
            | "version_conflict"
            | "invalid_items"
            | "launched_intent_unavailable";
        currentVersion?: number;
    };

export type CandidateNextRoundDraftLaunchRepository = {
    findIntentForDraftVersion: (input: {
        candidateNextRoundDraftId: string;
        candidateProfileId: string;
        roleProfileId: string;
        sourceDraftVersion: number;
    }) => Promise<CandidatePracticeIntentRecord | null>;
    snapshotDraftToIntent: (
        input: CandidateNextRoundDraftSnapshotInput,
    ) => Promise<CandidateNextRoundDraftSnapshotResult>;
};

export type CandidateNextRoundDraftReadRepository = {
    findDraft: (input: {
        candidateNextRoundDraftId: string;
        candidateProfileId: string;
        roleProfileId: string;
    }) => Promise<CandidateNextRoundDraftRecord | null>;
};

export async function launchCandidateNextRoundDraft({
    candidateNextRoundDraftId,
    candidateProfileId,
    roleProfileId,
    expectedVersion,
    practiceSessions,
    draftRepository,
    launchRepository,
}: {
    candidateNextRoundDraftId: string;
    candidateProfileId: string;
    roleProfileId: string;
    expectedVersion: number;
    practiceSessions: CandidatePracticeSessionRecord[];
    draftRepository: CandidateNextRoundDraftReadRepository;
    launchRepository: CandidateNextRoundDraftLaunchRepository;
}): Promise<CandidateNextRoundDraftLaunchResult> {
    const existingIntent = await launchRepository.findIntentForDraftVersion({
        candidateNextRoundDraftId,
        candidateProfileId,
        roleProfileId,
        sourceDraftVersion: expectedVersion,
    });
    if (existingIntent) {
        return toRecoveredLaunchResult(existingIntent, practiceSessions);
    }

    const draft = await draftRepository.findDraft({
        candidateNextRoundDraftId,
        candidateProfileId,
        roleProfileId,
    });
    if (!draft) {
        return notLaunched("not_found");
    }
    if (draft.version !== expectedVersion) {
        const racedIntent = await launchRepository.findIntentForDraftVersion({
            candidateNextRoundDraftId,
            candidateProfileId,
            roleProfileId,
            sourceDraftVersion: expectedVersion,
        });
        return racedIntent
            ? toRecoveredLaunchResult(racedIntent, practiceSessions)
            : notLaunched("version_conflict", draft.version);
    }
    if (draft.items.length < 1) {
        return notLaunched("invalid_items", draft.version);
    }

    const rootQuestionKeys = draft.items.map((item) => {
        const root = resolveCandidateFollowUpQuestionRoot({
            candidatePracticeSessionId: item.sourceCandidatePracticeSessionId,
            questionKey: item.sourceQuestionKey,
            existingPracticeSessions: practiceSessions,
        });
        return root ? `${root.candidatePracticeSessionId}:${root.questionKey}` : null;
    });
    if (
        rootQuestionKeys.some((key) => !key)
        || new Set(rootQuestionKeys).size !== rootQuestionKeys.length
    ) {
        return notLaunched("invalid_items", draft.version);
    }

    const resolvedItems = draft.items.map((item) => resolveCandidateFollowUpPracticeIntent({
        intent: createQueueIntentPointer(item.practiceKind, item.sourceCandidatePracticeSessionId, item.sourceQuestionKey),
        candidateProfileId,
        practiceSessions,
        selectedRoleProfileId: roleProfileId,
    }));
    if (resolvedItems.some((item) => !item)) {
        return notLaunched("invalid_items", draft.version);
    }

    const now = new Date().toISOString();
    const intentRecord = createCandidateFollowUpPracticeIntentRecord({
        candidatePracticeIntentId: "00000000-0000-4000-8000-000000000000",
        candidateProfileId,
        source: "practice_builder",
        items: resolvedItems as NonNullable<(typeof resolvedItems)[number]>[],
        createdAt: now,
    });
    if (!intentRecord || intentRecord.roleProfileId !== roleProfileId) {
        return notLaunched("invalid_items", draft.version);
    }

    const items = intentRecord.items.map((item, index) => ({
        ...item,
        assembly: createCandidateNextRoundDraftAssembly(draft.items[index]),
    }));
    const snapshot = await launchRepository.snapshotDraftToIntent({
        candidateNextRoundDraftId,
        candidateProfileId,
        roleProfileId,
        expectedVersion,
        targetInterviewId: intentRecord.targetInterviewId,
        targetRole: intentRecord.targetRole,
        setupContext: intentRecord.setupContext,
        items,
    });

    if (
        (snapshot.outcome === "created" || snapshot.outcome === "replayed")
        && snapshot.candidatePracticeIntentId
    ) {
        return launched(snapshot.outcome, snapshot.candidatePracticeIntentId);
    }

    return notLaunched(
        snapshot.outcome === "version_conflict" ? "version_conflict"
            : snapshot.outcome === "invalid_items" ? "invalid_items"
                : "not_found",
        snapshot.currentVersion,
    );
}

function createQueueIntentPointer(
    kind: CandidateFollowUpPracticeIntent["kind"],
    candidatePracticeSessionId: string,
    questionKey: string,
): CandidateFollowUpPracticeIntent {
    return {
        status: "candidate_follow_up_practice_intent_ready",
        kind,
        source: {
            kind: "coach_update_detail",
            candidatePracticeSessionId,
            questionKey,
        },
        display: kind === "practice_from_feedback"
            ? {
                label: "Practice from coach feedback",
                body: "Use this coach feedback in the next round.",
            }
            : {
                label: "Practice missing evidence",
                body: "Include this planned question in the next round.",
            },
    };
}

function toRecoveredLaunchResult(
    intent: CandidatePracticeIntentRecord,
    practiceSessions: CandidatePracticeSessionRecord[],
): CandidateNextRoundDraftLaunchResult {
    if (intent.lifecycleState === "ready") {
        if (hasCandidateActivePracticeSessionForContext({
            candidateProfileId: intent.candidateProfileId,
            roleProfileId: intent.roleProfileId,
            legacyTargetRole: intent.targetRole,
            practiceSessions,
        })) {
            return notLaunched("invalid_items");
        }
        return launched("replayed", intent.candidatePracticeIntentId);
    }
    if (intent.lifecycleState === "consumed" && intent.consumedCandidatePracticeSessionId) {
        return {
            status: "candidate_next_round_draft_launched",
            outcome: "replayed",
            candidatePracticeIntentId: intent.candidatePracticeIntentId,
            redirectTo: `/candidate/session/${intent.consumedCandidatePracticeSessionId}`,
        };
    }
    return notLaunched("launched_intent_unavailable");
}

function launched(
    outcome: "created" | "replayed",
    candidatePracticeIntentId: string,
): CandidateNextRoundDraftLaunchResult {
    return {
        status: "candidate_next_round_draft_launched",
        outcome,
        candidatePracticeIntentId,
        redirectTo: `/candidate/practice/ready/${candidatePracticeIntentId}`,
    };
}

function notLaunched(
    reason: Extract<CandidateNextRoundDraftLaunchResult, { status: "candidate_next_round_draft_not_launched" }>["reason"],
    currentVersion?: number,
): CandidateNextRoundDraftLaunchResult {
    return {
        status: "candidate_next_round_draft_not_launched",
        reason,
        ...(currentVersion ? { currentVersion } : {}),
    };
}
