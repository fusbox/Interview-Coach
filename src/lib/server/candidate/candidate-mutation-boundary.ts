import { consumeRateLimit } from "@/lib/server/rate-limit";

export type CandidateMutationOperation =
    | "practice_generation"
    | "session_progress"
    | "session_answer_submit"
    | "session_answer_analyze"
    | "session_question_retry"
    | "session_summary_finalize";

export type CandidateMutationFailure = {
    ok: false;
    error: string;
};

export type CandidateMutationPolicy = {
    operation: CandidateMutationOperation;
    maxRequests: number;
    windowMs: number;
    idempotencyStrategy: "state";
    idempotencyNote: string;
};

const RATE_LIMITED_MUTATION_ERROR = "Too many candidate updates. Please wait and try again.";

const CANDIDATE_MUTATION_POLICIES: Record<CandidateMutationOperation, CandidateMutationPolicy> = {
    practice_generation: {
        operation: "practice_generation",
        maxRequests: 5,
        windowMs: 60_000,
        idempotencyStrategy: "state",
        idempotencyNote: "Only a candidate-owned generating draft can create and attach a session.",
    },
    session_progress: {
        operation: "session_progress",
        maxRequests: 60,
        windowMs: 60_000,
        idempotencyStrategy: "state",
        idempotencyNote: "Repeated calls set the same target session state and draft progress target.",
    },
    session_answer_submit: {
        operation: "session_answer_submit",
        maxRequests: 30,
        windowMs: 60_000,
        idempotencyStrategy: "state",
        idempotencyNote: "A submitted answer is treated as already complete on replay.",
    },
    session_answer_analyze: {
        operation: "session_answer_analyze",
        maxRequests: 20,
        windowMs: 60_000,
        idempotencyStrategy: "state",
        idempotencyNote: "An answer with persisted analysis is treated as already complete on replay.",
    },
    session_question_retry: {
        operation: "session_question_retry",
        maxRequests: 20,
        windowMs: 60_000,
        idempotencyStrategy: "state",
        idempotencyNote: "A retry clears existing answer analysis state and is a no-op when no answer exists.",
    },
    session_summary_finalize: {
        operation: "session_summary_finalize",
        maxRequests: 5,
        windowMs: 60_000,
        idempotencyStrategy: "state",
        idempotencyNote: "A completed session with a persisted summary is treated as already finalized.",
    },
};

export function getCandidateMutationPolicy(operation: CandidateMutationOperation): CandidateMutationPolicy {
    return CANDIDATE_MUTATION_POLICIES[operation];
}

export async function withCandidateMutationBoundary<T extends { ok: boolean }>(_params: {
    candidateProfileId: string;
    operation: CandidateMutationOperation;
    subjectId: string;
    mutate: () => Promise<T>;
}): Promise<T | CandidateMutationFailure> {
    const policy = getCandidateMutationPolicy(_params.operation);
    const decision = await consumeRateLimit(
        buildCandidateMutationRateLimitKey({
            candidateProfileId: _params.candidateProfileId,
            operation: _params.operation,
            subjectId: _params.subjectId,
        }),
        policy.maxRequests,
        policy.windowMs,
    );

    if (!decision.allowed) {
        return {
            ok: false,
            error: RATE_LIMITED_MUTATION_ERROR,
        };
    }

    return _params.mutate();
}

function buildCandidateMutationRateLimitKey(params: {
    candidateProfileId: string;
    operation: CandidateMutationOperation;
    subjectId: string;
}): string {
    return [
        "candidate",
        params.candidateProfileId,
        params.operation,
        params.subjectId,
    ].join(":");
}
