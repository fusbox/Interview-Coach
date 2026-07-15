import { createHash } from "node:crypto";

import type { CandidateAnswerSubmission } from "./candidate-answer-lifecycle";

export type CandidateAnswerAttemptMode = "text" | "voice" | "photo";
export type CandidateAnswerAttemptTrigger = "initial_submit" | "feedback_retry";

export type CandidateAnswerAttemptRecord = {
    candidateAnswerAttemptId: string;
    candidatePracticeSessionId: string;
    candidateProfileId: string;
    questionSlotId: string;
    questionIndex: number;
    attemptNumber: number;
    trigger: CandidateAnswerAttemptTrigger;
    supersedesCandidateAnswerAttemptId: string | null;
    mode: CandidateAnswerAttemptMode;
    answerText: string;
    submittedAt: string;
    idempotencyKey: string;
    payloadFingerprint: string;
    createdAt: string;
};

export type CandidateAnswerAttemptWriteResult = {
    outcome: "created" | "replayed" | "idempotency_conflict";
    attempt: CandidateAnswerAttemptRecord;
};

export type CandidateAnswerEvaluationPurpose = "candidate_coaching" | "qa_comparison";
export type CandidateAnswerEvaluationLifecycleState = "requested" | "completed" | "failed" | "rejected";

export type CandidateAnswerEvaluationRunRecord = {
    candidateAnswerEvaluationRunId: string;
    candidateAnswerAttemptId: string;
    purpose: CandidateAnswerEvaluationPurpose;
    provider: string;
    modelName: string;
    promptVersion: string;
    evaluatorVersion: string;
    inputFingerprint: string;
    idempotencyKey: string;
    lifecycleState: CandidateAnswerEvaluationLifecycleState;
    result: Record<string, unknown> | null;
    validation: Record<string, unknown> | null;
    errorCode: string | null;
    requestedAt: string;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type CandidateAnswerEvaluationRunWriteResult = {
    outcome: "created" | "replayed" | "idempotency_conflict";
    run: CandidateAnswerEvaluationRunRecord;
};

export function createCandidateAnswerAttemptPayloadFingerprint(input: {
    candidatePracticeSessionId: string;
    questionSlotId: string;
    questionIndex: number;
    mode: CandidateAnswerAttemptMode;
    answerText: string;
    trigger: CandidateAnswerAttemptTrigger;
    supersedesCandidateAnswerAttemptId?: string | null;
}) {
    return createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex");
}

export function toLatestCandidateAnswerSubmission(
    attempt: CandidateAnswerAttemptRecord,
): CandidateAnswerSubmission {
    if (attempt.mode !== "text") {
        throw new Error("The current candidate session compatibility projection supports typed answers only.");
    }

    return {
        slotId: attempt.questionSlotId,
        questionIndex: attempt.questionIndex,
        mode: "text",
        text: attempt.answerText,
        submittedAt: attempt.submittedAt,
        status: "pending_analysis",
        answerAttemptId: attempt.candidateAnswerAttemptId,
        attemptNumber: attempt.attemptNumber,
        trigger: attempt.trigger,
        supersedesAnswerAttemptId: attempt.supersedesCandidateAnswerAttemptId,
    };
}

export function normalizeCandidateAnswerAttemptRecord(value: unknown): CandidateAnswerAttemptRecord | null {
    if (!isRecord(value)) return null;

    const candidateAnswerAttemptId = readString(value.candidate_answer_attempt_id ?? value.candidateAnswerAttemptId);
    const candidatePracticeSessionId = readString(value.candidate_practice_session_id ?? value.candidatePracticeSessionId);
    const candidateProfileId = readString(value.candidate_profile_id ?? value.candidateProfileId);
    const questionSlotId = readString(value.question_slot_id ?? value.questionSlotId);
    const questionIndex = readNonNegativeInteger(value.question_index ?? value.questionIndex);
    const attemptNumber = readPositiveInteger(value.attempt_number ?? value.attemptNumber);
    const trigger = readAnswerAttemptTrigger(value.trigger);
    const mode = readAnswerAttemptMode(value.mode);
    const answerText = readString(value.answer_text ?? value.answerText);
    const submittedAt = readTimestamp(value.submitted_at ?? value.submittedAt);
    const idempotencyKey = readString(value.idempotency_key ?? value.idempotencyKey);
    const payloadFingerprint = readString(value.payload_fingerprint ?? value.payloadFingerprint);
    const createdAt = readTimestamp(value.created_at ?? value.createdAt);

    if (
        !candidateAnswerAttemptId
        || !candidatePracticeSessionId
        || !candidateProfileId
        || !questionSlotId
        || questionIndex === null
        || attemptNumber === null
        || !trigger
        || !mode
        || !answerText
        || !submittedAt
        || !idempotencyKey
        || !payloadFingerprint
        || !createdAt
    ) {
        return null;
    }

    const supersedesCandidateAnswerAttemptId = readNullableString(
        value.supersedes_candidate_answer_attempt_id ?? value.supersedesCandidateAnswerAttemptId,
    );
    if (
        (attemptNumber === 1 && (trigger !== "initial_submit" || supersedesCandidateAnswerAttemptId !== null))
        || (attemptNumber > 1 && (trigger !== "feedback_retry" || supersedesCandidateAnswerAttemptId === null))
    ) {
        return null;
    }

    return {
        candidateAnswerAttemptId,
        candidatePracticeSessionId,
        candidateProfileId,
        questionSlotId,
        questionIndex,
        attemptNumber,
        trigger,
        supersedesCandidateAnswerAttemptId,
        mode,
        answerText,
        submittedAt,
        idempotencyKey,
        payloadFingerprint,
        createdAt,
    };
}

export function normalizeCandidateAnswerEvaluationRunRecord(
    value: unknown,
): CandidateAnswerEvaluationRunRecord | null {
    if (!isRecord(value)) return null;

    const candidateAnswerEvaluationRunId = readString(
        value.candidate_answer_evaluation_run_id ?? value.candidateAnswerEvaluationRunId,
    );
    const candidateAnswerAttemptId = readString(value.candidate_answer_attempt_id ?? value.candidateAnswerAttemptId);
    const purpose = readEvaluationPurpose(value.purpose);
    const provider = readString(value.provider);
    const modelName = readString(value.model_name ?? value.modelName);
    const promptVersion = readString(value.prompt_version ?? value.promptVersion);
    const evaluatorVersion = readString(value.evaluator_version ?? value.evaluatorVersion);
    const inputFingerprint = readString(value.input_fingerprint ?? value.inputFingerprint);
    const idempotencyKey = readString(value.idempotency_key ?? value.idempotencyKey);
    const lifecycleState = readEvaluationLifecycleState(value.lifecycle_state ?? value.lifecycleState);
    const requestedAt = readTimestamp(value.requested_at ?? value.requestedAt);
    const createdAt = readTimestamp(value.created_at ?? value.createdAt);
    const updatedAt = readTimestamp(value.updated_at ?? value.updatedAt);

    if (
        !candidateAnswerEvaluationRunId
        || !candidateAnswerAttemptId
        || !purpose
        || !provider
        || !modelName
        || !promptVersion
        || !evaluatorVersion
        || !inputFingerprint
        || !idempotencyKey
        || !lifecycleState
        || !requestedAt
        || !createdAt
        || !updatedAt
    ) {
        return null;
    }

    const result = readNullableRecord(value.result_json ?? value.result);
    const validation = readNullableRecord(value.validation_json ?? value.validation);
    const errorCode = readNullableString(value.error_code ?? value.errorCode);
    const completedAt = readNullableTimestamp(value.completed_at ?? value.completedAt);

    if (
        (lifecycleState === "requested" && (completedAt || result || errorCode))
        || (lifecycleState === "completed" && (!completedAt || !result || errorCode))
        || (["failed", "rejected"] as const).includes(lifecycleState as "failed" | "rejected")
            && (!completedAt || result || !errorCode)
    ) {
        return null;
    }

    return {
        candidateAnswerEvaluationRunId,
        candidateAnswerAttemptId,
        purpose,
        provider,
        modelName,
        promptVersion,
        evaluatorVersion,
        inputFingerprint,
        idempotencyKey,
        lifecycleState,
        result,
        validation,
        errorCode,
        requestedAt,
        completedAt,
        createdAt,
        updatedAt,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readTimestamp(value: unknown) {
    return value instanceof Date && !Number.isNaN(value.getTime())
        ? value.toISOString()
        : readString(value);
}

function readNullableString(value: unknown) {
    return value === null || typeof value === "undefined" ? null : readString(value);
}

function readNullableTimestamp(value: unknown) {
    return value === null || typeof value === "undefined" ? null : readTimestamp(value);
}

function readNullableRecord(value: unknown) {
    return value === null || typeof value === "undefined" ? null : isRecord(value) ? value : null;
}

function readNonNegativeInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readPositiveInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function readAnswerAttemptTrigger(value: unknown): CandidateAnswerAttemptTrigger | null {
    return value === "initial_submit" || value === "feedback_retry" ? value : null;
}

function readAnswerAttemptMode(value: unknown): CandidateAnswerAttemptMode | null {
    return value === "text" || value === "voice" || value === "photo" ? value : null;
}

function readEvaluationPurpose(value: unknown): CandidateAnswerEvaluationPurpose | null {
    return value === "candidate_coaching" || value === "qa_comparison" ? value : null;
}

function readEvaluationLifecycleState(value: unknown): CandidateAnswerEvaluationLifecycleState | null {
    return value === "requested" || value === "completed" || value === "failed" || value === "rejected"
        ? value
        : null;
}
