import { parseAcceptedEvidenceFirstEvaluatorRun } from "@/features/evaluation-v2/evidence-first-evaluator-runtime";

import {
    resolveCandidateAnswerAnalysisRecovery,
    type CandidateAnswerAnalysisRecoveryState,
} from "./candidate-answer-analysis-recovery";
import type {
    CandidateAnswerAttemptRecord,
    CandidateAnswerEvaluationRunRecord,
} from "./candidate-answer-history";
import type { CandidatePracticeSessionRecord } from "./candidate-practice-session-repository";

export const CANDIDATE_COMPLETED_ROUND_REPAIR_LIMIT = 2;

export type CandidateCompletedRoundAnalysisRepairEvidence = {
    session: CandidatePracticeSessionRecord;
    answerAttempts: CandidateAnswerAttemptRecord[];
    evaluationRuns: CandidateAnswerEvaluationRunRecord[];
};

export type CandidateCompletedRoundAnalysisRepairResult = {
    status:
        | "not_applicable"
        | "ready"
        | "repaired"
        | "pending"
        | "partial"
        | "unavailable";
    answeredCount: number;
    acceptedCount: number;
    attemptedCount: number;
    repairedCount: number;
    pendingCount: number;
    retryableCount: number;
    unavailableCount: number;
    invalidLineageCount: number;
    allAnsweredOccurrencesAccepted: boolean;
};

type CandidateCompletedRoundAnalysisRepairItem = {
    slotId: string;
    accepted: boolean;
    state: "accepted" | CandidateAnswerAnalysisRecoveryState | "invalid_lineage";
};

export async function repairCandidateCompletedRoundAnalysis({
    loadEvidence,
    repairSlot,
    runtimeAvailable,
    now = new Date(),
    repairLimit = CANDIDATE_COMPLETED_ROUND_REPAIR_LIMIT,
}: {
    loadEvidence: () => Promise<CandidateCompletedRoundAnalysisRepairEvidence | null>;
    repairSlot: (slotId: string) => Promise<unknown>;
    runtimeAvailable: boolean;
    now?: Date;
    repairLimit?: number;
}): Promise<CandidateCompletedRoundAnalysisRepairResult> {
    const initialEvidence = await loadEvidence();
    const initialPlan = initialEvidence
        ? createCandidateCompletedRoundAnalysisRepairPlan({
            evidence: initialEvidence,
            runtimeAvailable,
            now,
        })
        : null;
    if (!initialPlan) {
        return createNotApplicableResult();
    }

    const boundedLimit = Number.isInteger(repairLimit) && repairLimit > 0
        ? Math.min(repairLimit, CANDIDATE_COMPLETED_ROUND_REPAIR_LIMIT)
        : CANDIDATE_COMPLETED_ROUND_REPAIR_LIMIT;
    const eligibleItems = initialPlan.items
        .filter((item) => (
            item.state === "recoverable"
            || (item.state === "retryable" && runtimeAvailable)
        ))
        .sort((left, right) => Number(left.accepted) - Number(right.accepted))
        .slice(0, boundedLimit);

    await Promise.allSettled(eligibleItems.map((item) => repairSlot(item.slotId)));

    const finalEvidence = eligibleItems.length > 0 ? await loadEvidence() : initialEvidence;
    const finalPlan = finalEvidence
        ? createCandidateCompletedRoundAnalysisRepairPlan({
            evidence: finalEvidence,
            runtimeAvailable,
            now,
        })
        : null;
    if (!finalPlan) {
        return createNotApplicableResult();
    }

    const initialAcceptedCount = initialPlan.items.filter((item) => item.accepted).length;
    const acceptedCount = finalPlan.items.filter((item) => item.accepted).length;
    const attemptedCount = eligibleItems.length;
    const allAnsweredOccurrencesAccepted = finalPlan.items.length > 0
        && acceptedCount === finalPlan.items.length;
    const counts = countRepairStates(finalPlan.items, runtimeAvailable);

    return {
        status: resolveRepairStatus({
            attemptedCount,
            repairedCount: Math.max(0, acceptedCount - initialAcceptedCount),
            allAnsweredOccurrencesAccepted,
            counts,
        }),
        answeredCount: finalPlan.items.length,
        acceptedCount,
        attemptedCount,
        repairedCount: Math.max(0, acceptedCount - initialAcceptedCount),
        ...counts,
        allAnsweredOccurrencesAccepted,
    };
}

function createCandidateCompletedRoundAnalysisRepairPlan({
    evidence,
    runtimeAvailable,
    now,
}: {
    evidence: CandidateCompletedRoundAnalysisRepairEvidence;
    runtimeAvailable: boolean;
    now: Date;
}) {
    const { session } = evidence;
    if (
        session.status !== "completed"
        || !session.completionSnapshot
        || session.completionSnapshot.answeredQuestionKeys.length === 0
        || !session.questionWordingSnapshot
    ) {
        return null;
    }

    const wordedSlots = new Set(session.questionWordingSnapshot.questions.map((question) => question.slotId));
    const answeredQuestionKeys = session.completionSnapshot.answeredQuestionKeys;
    if (new Set(answeredQuestionKeys).size !== answeredQuestionKeys.length) {
        return {
            items: answeredQuestionKeys.map((slotId) => ({
                slotId,
                accepted: false,
                state: "invalid_lineage" as const,
            })),
        };
    }

    const items = answeredQuestionKeys.map((slotId): CandidateCompletedRoundAnalysisRepairItem => {
        const submission = session.answerSubmissions[slotId];
        const latestAttempt = evidence.answerAttempts
            .filter((attempt) => attempt.questionSlotId === slotId)
            .sort((left, right) => right.attemptNumber - left.attemptNumber)[0];
        if (
            !wordedSlots.has(slotId)
            || !submission?.answerAttemptId
            || !latestAttempt
            || latestAttempt.candidateAnswerAttemptId !== submission.answerAttemptId
            || latestAttempt.candidatePracticeSessionId !== session.candidatePracticeSessionId
            || latestAttempt.candidateProfileId !== session.candidateProfileId
        ) {
            return { slotId, accepted: false, state: "invalid_lineage" };
        }

        const runs = evidence.evaluationRuns.filter((run) => (
            run.candidateAnswerAttemptId === latestAttempt.candidateAnswerAttemptId
            && run.purpose === "candidate_coaching"
        ));
        const acceptedRun = runs.find(isAcceptedCandidateCoachingRun);
        if (acceptedRun) {
            return {
                slotId,
                accepted: true,
                state: hasMatchingCandidateSafeProjection(session, slotId, latestAttempt.candidateAnswerAttemptId)
                    ? "accepted"
                    : "recoverable",
            };
        }

        const latestRun = [...runs].sort((left, right) => (
            right.generationAttempt - left.generationAttempt
        ))[0];
        if (latestRun?.lifecycleState === "completed") {
            return { slotId, accepted: false, state: "unavailable" };
        }

        return {
            slotId,
            accepted: false,
            state: resolveCandidateAnswerAnalysisRecovery({
                runs,
                now,
                runtimeAvailable,
            }).state,
        };
    });

    return { items };
}

function isAcceptedCandidateCoachingRun(run: CandidateAnswerEvaluationRunRecord) {
    if (
        run.lifecycleState !== "completed"
        || run.purpose !== "candidate_coaching"
        || run.validation?.disposition !== "accepted"
        || run.validation?.candidateSafeProjection !== true
        || run.validation?.inputFingerprint !== run.inputFingerprint
    ) {
        return false;
    }

    const accepted = parseAcceptedEvidenceFirstEvaluatorRun(run.result);
    return Boolean(
        accepted
        && accepted.evaluationRunId === run.candidateAnswerEvaluationRunId
        && accepted.inputFingerprint === run.inputFingerprint,
    );
}

function hasMatchingCandidateSafeProjection(
    session: CandidatePracticeSessionRecord,
    slotId: string,
    candidateAnswerAttemptId: string,
) {
    return session.answerAnalysisSnapshots[slotId]?.answer.answerAttemptId === candidateAnswerAttemptId;
}

function countRepairStates(
    items: CandidateCompletedRoundAnalysisRepairItem[],
    runtimeAvailable: boolean,
) {
    let pendingCount = 0;
    let retryableCount = 0;
    let unavailableCount = 0;
    let invalidLineageCount = 0;

    for (const item of items) {
        if (!item.accepted && item.state === "pending") pendingCount += 1;
        if (!item.accepted && item.state === "retryable" && runtimeAvailable) retryableCount += 1;
        if (
            !item.accepted
            && (
                item.state === "unavailable"
                || (item.state === "retryable" && !runtimeAvailable)
            )
        ) unavailableCount += 1;
        if (item.state === "invalid_lineage") invalidLineageCount += 1;
    }

    return { pendingCount, retryableCount, unavailableCount, invalidLineageCount };
}

function resolveRepairStatus({
    attemptedCount,
    repairedCount,
    allAnsweredOccurrencesAccepted,
    counts,
}: {
    attemptedCount: number;
    repairedCount: number;
    allAnsweredOccurrencesAccepted: boolean;
    counts: ReturnType<typeof countRepairStates>;
}): CandidateCompletedRoundAnalysisRepairResult["status"] {
    if (allAnsweredOccurrencesAccepted) {
        return attemptedCount > 0 || repairedCount > 0 ? "repaired" : "ready";
    }
    if (counts.pendingCount > 0) return "pending";
    if (counts.retryableCount > 0) return "partial";
    return "unavailable";
}

function createNotApplicableResult(): CandidateCompletedRoundAnalysisRepairResult {
    return {
        status: "not_applicable",
        answeredCount: 0,
        acceptedCount: 0,
        attemptedCount: 0,
        repairedCount: 0,
        pendingCount: 0,
        retryableCount: 0,
        unavailableCount: 0,
        invalidLineageCount: 0,
        allAnsweredOccurrencesAccepted: false,
    };
}

export function createCandidateCompletedRoundAnalysisRepairUnavailableResult(): CandidateCompletedRoundAnalysisRepairResult {
    return {
        ...createNotApplicableResult(),
        status: "unavailable",
    };
}
