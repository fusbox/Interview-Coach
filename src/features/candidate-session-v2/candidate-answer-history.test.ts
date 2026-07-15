import { describe, expect, it } from "vitest";

import {
    createCandidateAnswerAttemptPayloadFingerprint,
    normalizeCandidateAnswerAttemptRecord,
    normalizeCandidateAnswerEvaluationRunRecord,
    toLatestCandidateAnswerSubmission,
} from "./candidate-answer-history";

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
    submitted_at: new Date("2026-07-14T18:00:00.000Z"),
    idempotency_key: "submit-key-1",
    payload_fingerprint: "fingerprint-1",
    created_at: new Date("2026-07-14T18:00:00.000Z"),
};

describe("candidate answer history", () => {
    it("creates a stable payload fingerprint that changes with the answer", () => {
        const input = {
            candidatePracticeSessionId: "session-1",
            questionSlotId: "slot-1",
            questionIndex: 0,
            mode: "text" as const,
            answerText: "First answer",
            trigger: "initial_submit" as const,
        };

        const fingerprint = createCandidateAnswerAttemptPayloadFingerprint(input);
        expect(fingerprint).toHaveLength(64);
        expect(createCandidateAnswerAttemptPayloadFingerprint(input)).toBe(fingerprint);
        expect(createCandidateAnswerAttemptPayloadFingerprint({
            ...input,
            answerText: "Revised answer",
        })).not.toBe(fingerprint);
        expect(createCandidateAnswerAttemptPayloadFingerprint({
            ...input,
            trigger: "feedback_retry",
            supersedesCandidateAnswerAttemptId: "11111111-1111-4111-8111-111111111111",
        })).not.toBe(fingerprint);
    });

    it("normalizes attempt one and projects it into the latest-answer compatibility shape", () => {
        const attempt = normalizeCandidateAnswerAttemptRecord(attemptRow);
        expect(attempt).toMatchObject({
            candidateAnswerAttemptId: "11111111-1111-4111-8111-111111111111",
            attemptNumber: 1,
            trigger: "initial_submit",
            supersedesCandidateAnswerAttemptId: null,
            submittedAt: "2026-07-14T18:00:00.000Z",
            createdAt: "2026-07-14T18:00:00.000Z",
        });

        expect(toLatestCandidateAnswerSubmission(attempt!)).toEqual({
            slotId: "slot-1",
            questionIndex: 0,
            mode: "text",
            text: "I clarified the customer's concern before proposing a solution.",
            submittedAt: "2026-07-14T18:00:00.000Z",
            status: "pending_analysis",
            answerAttemptId: "11111111-1111-4111-8111-111111111111",
            attemptNumber: 1,
            trigger: "initial_submit",
            supersedesAnswerAttemptId: null,
        });
    });

    it("rejects retry attempts without a superseded attempt", () => {
        expect(normalizeCandidateAnswerAttemptRecord({
            ...attemptRow,
            attempt_number: 2,
            trigger: "feedback_retry",
            supersedes_candidate_answer_attempt_id: null,
        })).toBeNull();
    });

    it("keeps evaluator-run lifecycle separate from answer attempts", () => {
        expect(normalizeCandidateAnswerEvaluationRunRecord({
            candidate_answer_evaluation_run_id: "44444444-4444-4444-8444-444444444444",
            candidate_answer_attempt_id: attemptRow.candidate_answer_attempt_id,
            purpose: "qa_comparison",
            provider: "openai",
            model_name: "model-a",
            prompt_version: "prompt-v1",
            evaluator_version: "evaluator-v2",
            input_fingerprint: "input-1",
            idempotency_key: "run-key-1",
            lifecycle_state: "requested",
            result_json: null,
            validation_json: null,
            error_code: null,
            requested_at: new Date("2026-07-14T18:01:00.000Z"),
            completed_at: null,
            created_at: new Date("2026-07-14T18:01:00.000Z"),
            updated_at: new Date("2026-07-14T18:01:00.000Z"),
        })).toMatchObject({
            candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            purpose: "qa_comparison",
            lifecycleState: "requested",
            requestedAt: "2026-07-14T18:01:00.000Z",
            createdAt: "2026-07-14T18:01:00.000Z",
            updatedAt: "2026-07-14T18:01:00.000Z",
        });
    });
});
