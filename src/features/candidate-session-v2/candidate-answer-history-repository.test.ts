import { describe, expect, it, vi } from "vitest";

import { createEvaluatorFingerprint } from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import {
    CANDIDATE_ANSWER_ANALYSIS_GENERATION_LIMIT,
    CANDIDATE_ANSWER_ANALYSIS_GENERATION_WINDOW_MS,
} from "./candidate-answer-analysis-recovery";
import { candidateAnswerAnalysisFixtureRunMetadata } from "./candidate-answer-analysis-fixture";
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
    provider: candidateAnswerAnalysisFixtureRunMetadata.provider,
    model_name: candidateAnswerAnalysisFixtureRunMetadata.modelName,
    prompt_version: candidateAnswerAnalysisFixtureRunMetadata.promptVersion,
    evaluator_version: candidateAnswerAnalysisFixtureRunMetadata.evaluatorVersion,
    configuration_manifest_json: candidateAnswerAnalysisFixtureRunMetadata.configurationManifest,
    configuration_fingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
    input_fingerprint: "input-1",
    idempotency_key: "analysis-key-1",
    generation_attempt: 1,
    lifecycle_state: "requested",
    result_json: null,
    validation_json: null,
    error_code: null,
    requested_at: "2026-07-14T18:01:00.000Z",
    claim_expires_at: "2026-07-14T18:02:00.000Z",
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

    it("claims an evaluator generation only for a candidate-owned answer attempt", async () => {
        const query = vi.fn(async () => ({ rows: [{ write_outcome: "created", ...evaluationRunRow }] }));
        const repository = createCandidateAnswerHistoryRepository({ query });

        await expect(repository.claimEvaluationRun({
            candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            candidatePracticeSessionId: attemptRow.candidate_practice_session_id,
            candidateProfileId: attemptRow.candidate_profile_id,
            purpose: "candidate_coaching",
            provider: candidateAnswerAnalysisFixtureRunMetadata.provider,
            modelName: candidateAnswerAnalysisFixtureRunMetadata.modelName,
            promptVersion: candidateAnswerAnalysisFixtureRunMetadata.promptVersion,
            evaluatorVersion: candidateAnswerAnalysisFixtureRunMetadata.evaluatorVersion,
            configurationManifest: candidateAnswerAnalysisFixtureRunMetadata.configurationManifest,
            configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
            inputFingerprint: "input-1",
            idempotencyKey: "analysis-key-1",
            requestedAt: "2026-07-14T18:01:00.000Z",
            claimExpiresAt: "2026-07-14T18:02:00.000Z",
        })).resolves.toMatchObject({
            outcome: "created",
            run: {
                candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
                generationAttempt: 1,
                lifecycleState: "requested",
            },
        });

        expect(query).toHaveBeenCalledWith(
            expect.stringMatching(/from public\.candidate_answer_attempts attempt[\s\S]+pg_advisory_xact_lock[\s\S]+expired_requested as[\s\S]+next_generation as/),
            [
                attemptRow.candidate_answer_attempt_id,
                attemptRow.candidate_practice_session_id,
                attemptRow.candidate_profile_id,
                "candidate_coaching",
                candidateAnswerAnalysisFixtureRunMetadata.provider,
                candidateAnswerAnalysisFixtureRunMetadata.modelName,
                candidateAnswerAnalysisFixtureRunMetadata.promptVersion,
                candidateAnswerAnalysisFixtureRunMetadata.evaluatorVersion,
                candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
                JSON.stringify(candidateAnswerAnalysisFixtureRunMetadata.configurationManifest),
                "input-1",
                "analysis-key-1",
                "2026-07-14T18:01:00.000Z",
                "2026-07-14T18:02:00.000Z",
                CANDIDATE_ANSWER_ANALYSIS_GENERATION_WINDOW_MS,
                CANDIDATE_ANSWER_ANALYSIS_GENERATION_LIMIT,
            ],
        );
    });

    it("expires stale claims before allocating a later generation with the same logical key", async () => {
        const generationTwo = {
            ...evaluationRunRow,
            candidate_answer_evaluation_run_id: "55555555-5555-4555-8555-555555555555",
            generation_attempt: 2,
            requested_at: "2026-07-14T18:03:00.000Z",
            claim_expires_at: "2026-07-14T18:04:00.000Z",
            created_at: "2026-07-14T18:03:00.000Z",
            updated_at: "2026-07-14T18:03:00.000Z",
        };
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return { rows: [{ write_outcome: "created", ...generationTwo }] };
        });
        const repository = createCandidateAnswerHistoryRepository({ query });

        await expect(repository.claimEvaluationRun({
            candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            candidatePracticeSessionId: attemptRow.candidate_practice_session_id,
            candidateProfileId: attemptRow.candidate_profile_id,
            purpose: "candidate_coaching",
            provider: candidateAnswerAnalysisFixtureRunMetadata.provider,
            modelName: candidateAnswerAnalysisFixtureRunMetadata.modelName,
            promptVersion: candidateAnswerAnalysisFixtureRunMetadata.promptVersion,
            evaluatorVersion: candidateAnswerAnalysisFixtureRunMetadata.evaluatorVersion,
            configurationManifest: candidateAnswerAnalysisFixtureRunMetadata.configurationManifest,
            configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
            inputFingerprint: "input-1",
            idempotencyKey: "analysis-key-1",
            requestedAt: "2026-07-14T18:03:00.000Z",
            claimExpiresAt: "2026-07-14T18:04:00.000Z",
        })).resolves.toMatchObject({
            outcome: "created",
            run: { generationAttempt: 2 },
        });

        const sql = query.mock.calls[0]?.[0] ?? "";
        expect(sql).toContain("error_code = 'STALE_EVALUATION_CLAIM'");
        expect(sql).toContain("run.claim_expires_at <= $13");
        expect(sql).toContain("coalesce(max(run.generation_attempt), 0) + 1");
    });

    it("returns the latest terminal run instead of creating a fourth candidate-coaching generation in ten minutes", async () => {
        const latestFailedRun = {
            ...evaluationRunRow,
            candidate_answer_evaluation_run_id: "66666666-6666-4666-8666-666666666666",
            generation_attempt: 3,
            lifecycle_state: "failed",
            validation_json: { retryableByNewRun: true },
            error_code: "GOOGLE_PROVIDER_UNAVAILABLE",
            completed_at: "2026-07-14T18:03:10.000Z",
            updated_at: "2026-07-14T18:03:10.000Z",
        };
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return {
                rows: [{
                    write_outcome: "generation_limit",
                    generation_window_count: 3,
                    ...latestFailedRun,
                }],
            };
        });
        const repository = createCandidateAnswerHistoryRepository({ query });

        await expect(repository.claimEvaluationRun({
            candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            candidatePracticeSessionId: attemptRow.candidate_practice_session_id,
            candidateProfileId: attemptRow.candidate_profile_id,
            purpose: "candidate_coaching",
            provider: candidateAnswerAnalysisFixtureRunMetadata.provider,
            modelName: candidateAnswerAnalysisFixtureRunMetadata.modelName,
            promptVersion: candidateAnswerAnalysisFixtureRunMetadata.promptVersion,
            evaluatorVersion: candidateAnswerAnalysisFixtureRunMetadata.evaluatorVersion,
            configurationManifest: candidateAnswerAnalysisFixtureRunMetadata.configurationManifest,
            configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
            inputFingerprint: "input-1",
            idempotencyKey: "analysis-key-1",
            requestedAt: "2026-07-14T18:04:00.000Z",
            claimExpiresAt: "2026-07-14T18:05:00.000Z",
        })).resolves.toMatchObject({
            outcome: "generation_limit",
            recentGenerationCount: 3,
            run: { generationAttempt: 3, lifecycleState: "failed" },
        });

        const sql = query.mock.calls[0]?.[0] ?? "";
        expect(sql).toContain("recent_generation_count as materialized");
        expect(sql).toContain("recent_generation_count.generation_window_count < $16");
        expect(sql).toContain("'generation_limit'::text as write_outcome");
    });

    it("blocks a new generation after a terminal nonretryable result", async () => {
        const latestRejectedRun = {
            ...evaluationRunRow,
            lifecycle_state: "rejected",
            validation_json: { retryableByNewRun: false },
            error_code: "PROVIDER_SAFETY_BLOCKED",
            completed_at: "2026-07-14T18:01:10.000Z",
        };
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return {
                rows: [{
                    write_outcome: "generation_unavailable",
                    generation_window_count: 1,
                    ...latestRejectedRun,
                }],
            };
        });
        const repository = createCandidateAnswerHistoryRepository({ query });

        await expect(repository.claimEvaluationRun({
            candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            candidatePracticeSessionId: attemptRow.candidate_practice_session_id,
            candidateProfileId: attemptRow.candidate_profile_id,
            purpose: "candidate_coaching",
            provider: candidateAnswerAnalysisFixtureRunMetadata.provider,
            modelName: candidateAnswerAnalysisFixtureRunMetadata.modelName,
            promptVersion: candidateAnswerAnalysisFixtureRunMetadata.promptVersion,
            evaluatorVersion: candidateAnswerAnalysisFixtureRunMetadata.evaluatorVersion,
            configurationManifest: candidateAnswerAnalysisFixtureRunMetadata.configurationManifest,
            configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
            inputFingerprint: "input-1",
            idempotencyKey: "analysis-key-2",
            requestedAt: "2026-07-14T18:02:00.000Z",
            claimExpiresAt: "2026-07-14T18:03:00.000Z",
        })).resolves.toMatchObject({
            outcome: "generation_unavailable",
            recentGenerationCount: 1,
            run: { lifecycleState: "rejected" },
        });

        const sql = query.mock.calls[0]?.[0] ?? "";
        expect(sql).toContain("terminal_retry_block as materialized");
        expect(sql).toContain("validation_json @> '{\"retryableByNewRun\": true}'::jsonb");
        expect(sql).toContain("'generation_unavailable'::text as write_outcome");
        expect(sql).toContain("$4 = 'candidate_coaching'");
    });

    it("rejects inconsistent resolved configuration before querying Postgres", async () => {
        const query = vi.fn();
        const repository = createCandidateAnswerHistoryRepository({ query });

        await expect(repository.claimEvaluationRun({
            candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            candidatePracticeSessionId: attemptRow.candidate_practice_session_id,
            candidateProfileId: attemptRow.candidate_profile_id,
            purpose: "candidate_coaching",
            provider: candidateAnswerAnalysisFixtureRunMetadata.provider,
            modelName: candidateAnswerAnalysisFixtureRunMetadata.modelName,
            promptVersion: candidateAnswerAnalysisFixtureRunMetadata.promptVersion,
            evaluatorVersion: candidateAnswerAnalysisFixtureRunMetadata.evaluatorVersion,
            configurationManifest: candidateAnswerAnalysisFixtureRunMetadata.configurationManifest,
            configurationFingerprint: "0".repeat(64),
            inputFingerprint: "input-1",
            idempotencyKey: "analysis-key-1",
            requestedAt: "2026-07-14T18:03:00.000Z",
            claimExpiresAt: "2026-07-14T18:04:00.000Z",
        })).rejects.toThrow("Evaluator-run configuration identity is inconsistent.");
        expect(query).not.toHaveBeenCalled();
    });

    it("returns a conflict when candidate coaching already has mismatched active work for the same answer input", async () => {
        const query = vi.fn(async (sql: string, values: unknown[]) => {
            void sql;
            void values;
            return { rows: [{ write_outcome: "idempotency_conflict", ...evaluationRunRow }] };
        });
        const repository = createCandidateAnswerHistoryRepository({ query });
        const differentConfigurationManifest = {
            ...candidateAnswerAnalysisFixtureRunMetadata.configurationManifest,
            pipelineProvider: "different-provider",
        };

        await expect(repository.claimEvaluationRun({
            candidateAnswerAttemptId: attemptRow.candidate_answer_attempt_id,
            candidatePracticeSessionId: attemptRow.candidate_practice_session_id,
            candidateProfileId: attemptRow.candidate_profile_id,
            purpose: "candidate_coaching",
            provider: "different-provider",
            modelName: candidateAnswerAnalysisFixtureRunMetadata.modelName,
            promptVersion: candidateAnswerAnalysisFixtureRunMetadata.promptVersion,
            evaluatorVersion: candidateAnswerAnalysisFixtureRunMetadata.evaluatorVersion,
            configurationManifest: differentConfigurationManifest,
            configurationFingerprint: createEvaluatorFingerprint(differentConfigurationManifest),
            inputFingerprint: "input-1",
            idempotencyKey: "different-key",
            requestedAt: "2026-07-14T18:01:10.000Z",
            claimExpiresAt: "2026-07-14T18:02:10.000Z",
        })).resolves.toMatchObject({
            outcome: "idempotency_conflict",
            run: { generationAttempt: 1 },
        });

        const sql = query.mock.calls[0]?.[0] ?? "";
        expect(sql).toContain("$4 = 'candidate_coaching' and run.input_fingerprint = $11");
        expect(sql).toContain("run.configuration_fingerprint = $9");
        expect(sql).toContain("run.configuration_manifest_json = $10::jsonb");
        expect(sql).toContain("then 'replayed'");
        expect(sql).toContain("else 'idempotency_conflict'");
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
            expect.stringMatching(/with completed as[\s\S]+claim_expires_at > \$5[\s\S]+claim_expires_at > clock_timestamp\(\)[\s\S]+run\.lifecycle_state = 'completed'/),
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
