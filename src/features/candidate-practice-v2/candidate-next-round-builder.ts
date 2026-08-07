import type { CandidateCoachPlanReference } from "@/features/candidate-dashboard-v2/candidate-coach-plan-reference";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";

import {
    resolveCandidateFollowUpPracticeIntent,
    type CandidateFollowUpPracticeIntent,
    type CandidateFollowUpPracticeIntentKind,
    type CandidatePracticeIntentItemProvenance,
} from "./candidate-follow-up-practice-intent";
import { hasCandidateActivePracticeSessionForContext } from "./candidate-active-practice-session";
import { resolveCandidateFollowUpQuestionRoot } from "./candidate-follow-up-session-creation";
import {
    candidateNextRoundDraftItemLimit,
    type CandidateNextRoundDraftRecord,
} from "./candidate-next-round-draft";

export type CandidateNextRoundBuilderItem = {
    candidateNextRoundDraftItemId: string;
    sourceCandidatePracticeSessionId: string;
    sourceQuestionKey: string;
    rootCandidatePracticeSessionId: string;
    rootQuestionKey: string;
    practiceKind: CandidateFollowUpPracticeIntentKind;
    provenance: CandidatePracticeIntentItemProvenance;
    displayPosition: number;
    questionNumber: number;
    category: string;
    questionText: string;
    evidenceLabel: "Coach feedback" | "Plan coverage";
};

export type CandidateNextRoundBuilderChoice = {
    sourceCandidatePracticeSessionId: string;
    sourceQuestionKey: string;
    rootCandidatePracticeSessionId: string;
    rootQuestionKey: string;
    practiceKind: CandidateFollowUpPracticeIntentKind;
    provenance: "coach_plan";
    questionNumber: number;
    category: string;
    questionText: string;
    evidenceLabel: "Coach feedback" | "Plan coverage";
    isQueued: boolean;
};

export type CandidateNextRoundBuilderModel = {
    status: "candidate_next_round_builder_ready";
    candidateProfileId: string;
    roleProfileId: string;
    targetRole: string;
    candidateNextRoundDraftId: string;
    version: number;
    itemCount: number;
    capacity: number;
    items: CandidateNextRoundBuilderItem[];
    choices: CandidateNextRoundBuilderChoice[];
};

export function createCandidateNextRoundBuilderModel({
    candidateProfileId,
    roleProfileId,
    coachPlan,
    practiceSessions,
    draft,
}: {
    candidateProfileId: string;
    roleProfileId: string;
    coachPlan: CandidateCoachPlanReference | null;
    practiceSessions: CandidatePracticeSessionRecord[];
    draft: CandidateNextRoundDraftRecord | null;
}): CandidateNextRoundBuilderModel | null {
    if (
        !coachPlan
        || !draft
        || coachPlan.source.roleProfileId !== roleProfileId
        || draft.candidateProfileId !== candidateProfileId
        || draft.roleProfileId !== roleProfileId
    ) {
        return null;
    }

    const ownedSessions = practiceSessions.filter((session) => (
        session.candidateProfileId === candidateProfileId
        && session.roleProfileId === roleProfileId
    ));
    const hasActivePracticeSession = hasCandidateActivePracticeSessionForContext({
        candidateProfileId,
        roleProfileId,
        legacyTargetRole: coachPlan.targetRole,
        practiceSessions: ownedSessions,
    });
    const planQuestionsByRoot = new Map(coachPlan.questions.map((question) => [
        createRootKey(coachPlan.source.baselineCandidatePracticeSessionId, question.questionKey),
        question,
    ]));
    const items = draft.items.map((item) => {
        const resolved = resolveCandidateFollowUpPracticeIntent({
            intent: createIntent(item.practiceKind, item.sourceCandidatePracticeSessionId, item.sourceQuestionKey),
            candidateProfileId,
            practiceSessions: ownedSessions,
            selectedRoleProfileId: roleProfileId,
        });
        const root = resolveCandidateFollowUpQuestionRoot({
            candidatePracticeSessionId: item.sourceCandidatePracticeSessionId,
            questionKey: item.sourceQuestionKey,
            existingPracticeSessions: ownedSessions,
        });
        if (!resolved || !root) {
            return null;
        }

        const planQuestion = planQuestionsByRoot.get(createRootKey(root.candidatePracticeSessionId, root.questionKey));
        return {
            candidateNextRoundDraftItemId: item.candidateNextRoundDraftItemId,
            sourceCandidatePracticeSessionId: item.sourceCandidatePracticeSessionId,
            sourceQuestionKey: item.sourceQuestionKey,
            rootCandidatePracticeSessionId: root.candidatePracticeSessionId,
            rootQuestionKey: root.questionKey,
            practiceKind: item.practiceKind,
            provenance: item.provenance,
            displayPosition: item.displayPosition,
            questionNumber: planQuestion?.questionNumber ?? resolved.source.questionNumber,
            category: planQuestion?.categoryLabel ?? resolved.source.category,
            questionText: planQuestion?.questionText ?? resolved.source.questionText,
            evidenceLabel: getEvidenceLabel(item.practiceKind),
        } satisfies CandidateNextRoundBuilderItem;
    });
    if (items.some((item) => !item)) {
        return null;
    }

    const normalizedItems = items as CandidateNextRoundBuilderItem[];
    const queuedRoots = new Set(normalizedItems.map((item) => (
        createRootKey(item.rootCandidatePracticeSessionId, item.rootQuestionKey)
    )));
    const choices = hasActivePracticeSession ? [] : coachPlan.questions.flatMap((question) => {
        if (!question.questionText) {
            return [];
        }

        const rootKey = createRootKey(
            coachPlan.source.baselineCandidatePracticeSessionId,
            question.questionKey,
        );
        const coachedSource = findLatestCoachedSource({
            candidatePracticeSessionId: coachPlan.source.baselineCandidatePracticeSessionId,
            questionKey: question.questionKey,
            practiceSessions: ownedSessions,
        });
        const source = coachedSource ?? (question.evidenceStatus === "missing_evidence" ? {
            candidatePracticeSessionId: coachPlan.source.baselineCandidatePracticeSessionId,
            questionKey: question.questionKey,
            practiceKind: "practice_missing_evidence" as const,
        } : null);
        if (!source) {
            return [];
        }

        return [{
            sourceCandidatePracticeSessionId: source.candidatePracticeSessionId,
            sourceQuestionKey: source.questionKey,
            rootCandidatePracticeSessionId: coachPlan.source.baselineCandidatePracticeSessionId,
            rootQuestionKey: question.questionKey,
            practiceKind: source.practiceKind,
            provenance: "coach_plan" as const,
            questionNumber: question.questionNumber,
            category: question.categoryLabel,
            questionText: question.questionText,
            evidenceLabel: getEvidenceLabel(source.practiceKind),
            isQueued: queuedRoots.has(rootKey),
        } satisfies CandidateNextRoundBuilderChoice];
    });

    return {
        status: "candidate_next_round_builder_ready",
        candidateProfileId,
        roleProfileId,
        targetRole: coachPlan.targetRole,
        candidateNextRoundDraftId: draft.candidateNextRoundDraftId,
        version: draft.version,
        itemCount: normalizedItems.length,
        capacity: candidateNextRoundDraftItemLimit,
        items: normalizedItems,
        choices,
    };
}

function findLatestCoachedSource({
    candidatePracticeSessionId,
    questionKey,
    practiceSessions,
}: {
    candidatePracticeSessionId: string;
    questionKey: string;
    practiceSessions: CandidatePracticeSessionRecord[];
}) {
    const matches = practiceSessions.flatMap((session) => (
        session.questionWordingSnapshot?.questions.flatMap((question) => {
            const root = resolveCandidateFollowUpQuestionRoot({
                candidatePracticeSessionId: session.candidatePracticeSessionId,
                questionKey: question.slotId,
                existingPracticeSessions: practiceSessions,
            });
            if (
                root?.candidatePracticeSessionId !== candidatePracticeSessionId
                || root.questionKey !== questionKey
            ) {
                return [];
            }

            const submission = session.answerSubmissions[question.slotId];
            const analysis = session.answerAnalysisSnapshots[question.slotId];
            if (
                !submission
                || !analysis
                || analysis.answer.slotId !== question.slotId
                || (analysis.answer.answerAttemptId ?? null) !== (submission.answerAttemptId ?? null)
            ) {
                return [];
            }

            return [{
                candidatePracticeSessionId: session.candidatePracticeSessionId,
                questionKey: question.slotId,
                practiceKind: "practice_from_feedback" as const,
                activityAt: submission.submittedAt || session.setupSnapshot.createdAt,
            }];
        }) ?? []
    ));

    return matches.sort((left, right) => (
        right.activityAt.localeCompare(left.activityAt)
        || right.candidatePracticeSessionId.localeCompare(left.candidatePracticeSessionId)
    ))[0] ?? null;
}

function createIntent(
    kind: CandidateFollowUpPracticeIntentKind,
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

function getEvidenceLabel(kind: CandidateFollowUpPracticeIntentKind) {
    return kind === "practice_from_feedback" ? "Coach feedback" as const : "Plan coverage" as const;
}

function createRootKey(candidatePracticeSessionId: string, questionKey: string) {
    return `${candidatePracticeSessionId}:${questionKey}`;
}
