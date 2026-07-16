import type { CandidateAnswerEvaluationRunRecord } from "./candidate-answer-history";

export const CANDIDATE_ANSWER_ANALYSIS_GENERATION_LIMIT = 3;
export const CANDIDATE_ANSWER_ANALYSIS_GENERATION_WINDOW_MS = 10 * 60 * 1_000;

export type CandidateAnswerAnalysisRecoveryState =
    | "pending"
    | "recoverable"
    | "retryable"
    | "unavailable";

export type CandidateAnswerAnalysisRecovery = {
    status: "answer_analysis_recovery";
    state: CandidateAnswerAnalysisRecoveryState;
    canRetryAnalysis: boolean;
    canContinueWithoutCoaching: boolean;
};

export type CandidateAnswerAnalysisRecoveries = Record<string, CandidateAnswerAnalysisRecovery>;

export function createCandidateAnswerAnalysisRecovery(
    state: CandidateAnswerAnalysisRecoveryState,
): CandidateAnswerAnalysisRecovery {
    return {
        status: "answer_analysis_recovery",
        state,
        canRetryAnalysis: state === "recoverable" || state === "retryable",
        canContinueWithoutCoaching: state !== "pending",
    };
}

export function parseCandidateAnswerAnalysisRecovery(value: unknown): CandidateAnswerAnalysisRecovery | null {
    if (!isRecord(value) || value.status !== "answer_analysis_recovery") return null;
    if (
        value.state !== "pending"
        && value.state !== "recoverable"
        && value.state !== "retryable"
        && value.state !== "unavailable"
    ) {
        return null;
    }

    const expected = createCandidateAnswerAnalysisRecovery(value.state);
    return value.canRetryAnalysis === expected.canRetryAnalysis
        && value.canContinueWithoutCoaching === expected.canContinueWithoutCoaching
        ? expected
        : null;
}

export function resolveCandidateAnswerAnalysisRecovery(input: {
    runs: CandidateAnswerEvaluationRunRecord[];
    now: Date;
    runtimeAvailable?: boolean;
}): CandidateAnswerAnalysisRecovery {
    const candidateRuns = input.runs
        .filter((run) => run.purpose === "candidate_coaching")
        .sort((left, right) => right.generationAttempt - left.generationAttempt);
    const latestRun = candidateRuns[0];
    if (!latestRun) {
        return createCandidateAnswerAnalysisRecovery(
            input.runtimeAvailable === false ? "unavailable" : "retryable",
        );
    }

    if (latestRun.lifecycleState === "completed") {
        const hasAcceptedCandidateSafeResult = Boolean(latestRun.result)
            && latestRun.validation?.disposition === "accepted"
            && latestRun.validation?.candidateSafeProjection === true;
        return createCandidateAnswerAnalysisRecovery(
            hasAcceptedCandidateSafeResult ? "recoverable" : "unavailable",
        );
    }

    const nowTime = input.now.getTime();
    const recentGenerationCount = candidateRuns.filter((run) => {
        const requestedAt = Date.parse(run.requestedAt);
        return Number.isFinite(requestedAt)
            && requestedAt >= nowTime - CANDIDATE_ANSWER_ANALYSIS_GENERATION_WINDOW_MS;
    }).length;

    if (latestRun.lifecycleState === "requested") {
        const claimExpiresAt = Date.parse(latestRun.claimExpiresAt);
        if (Number.isFinite(claimExpiresAt) && claimExpiresAt > nowTime) {
            return createCandidateAnswerAnalysisRecovery("pending");
        }
        return createCandidateAnswerAnalysisRecovery(
            recentGenerationCount >= CANDIDATE_ANSWER_ANALYSIS_GENERATION_LIMIT
                ? "unavailable"
                : "retryable",
        );
    }

    const retryableByNewRun = latestRun.errorCode === "STALE_EVALUATION_CLAIM"
        || latestRun.validation?.retryableByNewRun === true;
    return createCandidateAnswerAnalysisRecovery(
        retryableByNewRun
            && recentGenerationCount < CANDIDATE_ANSWER_ANALYSIS_GENERATION_LIMIT
            ? "retryable"
            : "unavailable",
    );
}

export function normalizeCandidateAnswerAnalysisRecoveries(
    value: unknown,
): CandidateAnswerAnalysisRecoveries {
    if (!isRecord(value)) return {};

    return Object.fromEntries(
        Object.entries(value).flatMap(([slotId, recovery]) => {
            const parsed = parseCandidateAnswerAnalysisRecovery(recovery);
            return slotId.trim() && parsed ? [[slotId, parsed]] : [];
        }),
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
