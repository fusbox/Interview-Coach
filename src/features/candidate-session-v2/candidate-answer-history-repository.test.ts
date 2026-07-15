import { describe, expect, it, vi } from "vitest";

import { createCandidateAnswerHistoryRepository } from "./candidate-answer-history-repository";

const attemptRow = {
    candidate_answer_attempt_id: "11111111-1111-4111-8111-111111111111",
    candidate_practice_session_id: "22222222-2222-4222-8222-222222222222",
    candidate_profile_id: "33333333-3333-4333-8333-333333333333",
    question_slot_id: "slot-1",
    question_index: 0,
    attempt_number: 1,
    trigger: "initial_submit",
    supersedes_candidate_answer_attempt_id: null,
    mode: "text",
    answer_text: "I clarified the customer's concern before proposing a solution.",
    submitted_at: "2026-07-14T18:00:00.000Z",
    idempotency_key: "submit-key-1",
    payload_fingerprint: "fingerprint-1",
    created_at: "2026-07-14T18:00:00.000Z",
};

const evaluationRunRow = {
    candidate_answer_evaluation_run_id: "44444444-4444-4444-8444-444444444444",
    candidate_answer_attempt_id: attemptRow.candidate_answer_attempt_id,
    purpose: "candidate_coaching",
    provider: "fixture",
    model_name: "fixture-v1",
    prompt_version: "prompt-v1",
    evaluator_version: "evaluator-v1",
    input_fingerprint: "input-1",
    idempotency_key: "analysis-key-1",
    lifecycle_state: "requested",
    result_json: null,
    validation_json: null,
    error_code: null,
    requested_at: "2026-07-14T18:01:00.000Z",
    completed_at: null,
    created_at: "2026-07-14T18:01:00.000Z",
    updated_at: "2026-07-14T18:01:00.000Z",
};

describe("candidate answer history repository", () => {
    it("atomically appends attempt one behind an ownership check and slot lock", async () => {
        const query = vi.fn(async () => ({ rows: [{ write_outcome: "created", ...attemptRow }] }));
        const repository = createCandidateAnswerHistoryRepository({ query });

        await expect(repository.appendAnswerAttempt({
            candidatePracticeSessionId: attemptRow.candidate_practice_session_id,
            candidateProfileId: attemptRow.candidate_profile_id,
            questionSlotId: "slot-1",
            questionIndex: 0,
            mode: "text",
            answerText: attemptRow.answer_text,
            submittedAt: attemptRow.submitted_at,
            trigger: "initial_submit",
            idempotencyKey: "submit-key-1",
            payloadFingerprint: "fingerprint-1",
        })).resolves.toMatchObject({
            outcome: "created",
            attempt: {
                attemptNumber: 1,
                trigger: "initial_submit",
            },
        });

        expect(query).toHaveBeenCalledWith(
            expect.stringMatching(/pg_advisory_xact_lock[\s\S]+insert into public\.candidate_answer_attempts/),
            [
                attemptRow.candidate_practice_session_id,
                attemptRow.candidate_profile_id,
                "slot-1",
                0,
                "text",
                attemptRow.answer_text,
                attemptRow.submitted_at,
                "initial_submit",
                "submit-key-1",
                "fingerprint-1",
                null,
            ],
        );
    });

    it("returns an idempotency conflict without changing the existing attempt", async () => {
        const query = vi.fn(async () => ({ rows: [{ write_outcome: "idempotency_conflict", ...attemptRow }] }));
        const repository = createCandidateAnswerHistoryRepository({ query });

        await expect(repository.appendAnswerAttempt({
            candidatePracticeSessionId: attemptRow.candidate_practice_session_id,
            candidateProfileId: attemptRow.candidate_profile_id,
            questionSlotId: "slot-1",
            questionIndex: 0,
            mode: "text",
            answerText: "Different answer",
            submittedAt: attemptRow.submitted_at,
            trigger: "initial_submit",
            idempotencyKey: "submit-key-1",
            payloadFingerprint: "different-fingerprint",
        })).resolves.toMatchObject({
            outcome: "idempotency_conflict",
            attempt: {
                candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            },
        });
    });

    it("binds a feedback retry append to the exact latest source attempt", async () => {
        const retryRow = {
            ...attemptRow,
            candidate_answer_attempt_id: "55555555-5555-4555-8555-555555555555",
            attempt_number: 2,
            trigger: "feedback_retry",
            supersedes_candidate_answer_attempt_id: attemptRow.candidate_answer_attempt_id,
            idempotency_key: "retry-key-1",
            payload_fingerprint: "fingerprint-2",
        };
        const query = vi.fn(async () => ({ rows: [{ write_outcome: "created", ...retryRow }] }));
        const repository = createCandidateAnswerHistoryRepository({ query });

        await expect(repository.appendAnswerAttempt({
            candidatePracticeSessionId: attemptRow.candidate_practice_session_id,
            candidateProfileId: attemptRow.candidate_profile_id,
            questionSlotId: "slot-1",
            questionIndex: 0,
            mode: "text",
            answerText: retryRow.answer_text,
            submittedAt: retryRow.submitted_at,
            trigger: "feedback_retry",
            supersedesCandidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            idempotencyKey: "retry-key-1",
            payloadFingerprint: "fingerprint-2",
        })).resolves.toMatchObject({
            outcome: "created",
            attempt: {
                attemptNumber: 2,
                supersedesCandidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            },
        });

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("latest.candidate_answer_attempt_id = $11"),
            expect.arrayContaining([attemptRow.candidate_answer_attempt_id]),
        );
    });

    it("starts an evaluator run only for a candidate-owned answer attempt", async () => {
        const query = vi.fn(async () => ({ rows: [{ write_outcome: "created", ...evaluationRunRow }] }));
        const repository = createCandidateAnswerHistoryRepository({ query });

        await expect(repository.startEvaluationRun({
            candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            candidatePracticeSessionId: attemptRow.candidate_practice_session_id,
            candidateProfileId: attemptRow.candidate_profile_id,
            purpose: "candidate_coaching",
            provider: "fixture",
            modelName: "fixture-v1",
            promptVersion: "prompt-v1",
            evaluatorVersion: "evaluator-v1",
            inputFingerprint: "input-1",
            idempotencyKey: "analysis-key-1",
            requestedAt: "2026-07-14T18:01:00.000Z",
        })).resolves.toMatchObject({
            outcome: "created",
            run: {
                candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
                lifecycleState: "requested",
            },
        });

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("from public.candidate_answer_attempts attempt"),
            [
                attemptRow.candidate_answer_attempt_id,
                attemptRow.candidate_practice_session_id,
                attemptRow.candidate_profile_id,
                "candidate_coaching",
                "fixture",
                "fixture-v1",
                "prompt-v1",
                "evaluator-v1",
                "input-1",
                "analysis-key-1",
                "2026-07-14T18:01:00.000Z",
            ],
        );
    });

    it("completes an evaluator run without mutating its answer attempt", async () => {
        const completedRow = {
            ...evaluationRunRow,
            lifecycle_state: "completed",
            result_json: { status: "answer_analysis_provider_result" },
            validation_json: { mapsToInput: true },
            completed_at: "2026-07-14T18:01:02.000Z",
            updated_at: "2026-07-14T18:01:02.000Z",
        };
        const query = vi.fn(async () => ({ rows: [completedRow] }));
        const repository = createCandidateAnswerHistoryRepository({ query });

        await expect(repository.completeEvaluationRun({
            candidateAnswerEvaluationRunId: evaluationRunRow.candidate_answer_evaluation_run_id,
            candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            completedAt: "2026-07-14T18:01:02.000Z",
            result: { status: "answer_analysis_provider_result" },
            validation: { mapsToInput: true },
        })).resolves.toMatchObject({
            lifecycleState: "completed",
            result: { status: "answer_analysis_provider_result" },
        });

        expect(query).toHaveBeenCalledWith(
            expect.stringMatching(/with completed as[\s\S]+run\.lifecycle_state = 'completed'/),
            [
                evaluationRunRow.candidate_answer_evaluation_run_id,
                attemptRow.candidate_answer_attempt_id,
                JSON.stringify({ status: "answer_analysis_provider_result" }),
                JSON.stringify({ mapsToInput: true }),
                "2026-07-14T18:01:02.000Z",
            ],
        );
    });

    it("makes terminal evaluator-run writes replay-safe", async () => {
        const failedRow = {
            ...evaluationRunRow,
            lifecycle_state: "failed",
            validation_json: { outputAccepted: false },
            error_code: "provider_timeout",
            completed_at: "2026-07-14T18:02:00.000Z",
            updated_at: "2026-07-14T18:02:00.000Z",
        };
        const query = vi.fn(async () => ({ rows: [failedRow] }));
        const repository = createCandidateAnswerHistoryRepository({ query });

        await expect(repository.failEvaluationRun({
            candidateAnswerEvaluationRunId: evaluationRunRow.candidate_answer_evaluation_run_id,
            candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            lifecycleState: "failed",
            completedAt: "2026-07-14T18:02:00.000Z",
            errorCode: "provider_timeout",
            validation: { outputAccepted: false },
        })).resolves.toMatchObject({
            lifecycleState: "failed",
            errorCode: "provider_timeout",
        });

        expect(query).toHaveBeenCalledWith(
            expect.stringMatching(/with failed as[\s\S]+is not distinct from/),
            expect.any(Array),
        );
    });
});
