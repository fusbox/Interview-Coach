import { afterEach, describe, expect, it } from "vitest";

import { EvidenceFirstEvaluatorRuntimeError } from "@/features/evaluation-v2/evidence-first-evaluator-runtime";

import type { CandidateAnswerAnalysisProviderRequest } from "./candidate-answer-analysis-adapter";
import {
    CANDIDATE_ANSWER_ANALYSIS_FAULT_MODES,
    createCandidateAnswerAnalysisDevelopmentRuntime,
    resetCandidateAnswerAnalysisFaultInjectionState,
    runFaultInjectedCandidateAnswerAnalysis,
    type CandidateAnswerAnalysisFaultMode,
} from "./candidate-answer-analysis-fault-injection";

afterEach(() => {
    resetCandidateAnswerAnalysisFaultInjectionState();
});

describe("candidate answer-analysis development runtime", () => {
    it("is disabled outside explicit nonproduction local development", () => {
        expect(createCandidateAnswerAnalysisDevelopmentRuntime({
            env: {
                NODE_ENV: "development",
                CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "fault",
                CANDIDATE_ANSWER_ANALYSIS_FAULT_MODE: "provider_5xx_once",
            },
            explicitLocalDev: false,
        })).toBeNull();
        expect(createCandidateAnswerAnalysisDevelopmentRuntime({
            env: {
                NODE_ENV: "production",
                CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "fault",
                CANDIDATE_ANSWER_ANALYSIS_FAULT_MODE: "provider_5xx_once",
            },
            explicitLocalDev: true,
        })).toBeNull();
    });

    it("rejects an unknown mode instead of falling back to a configured fault", () => {
        expect(createCandidateAnswerAnalysisDevelopmentRuntime({
            env: {
                NODE_ENV: "development",
                CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "fault",
                CANDIDATE_ANSWER_ANALYSIS_FAULT_MODE: "anything_from_the_request",
            },
            explicitLocalDev: true,
        })).toBeNull();
    });

    it("keeps the ordinary fixture on the same development-runtime selection boundary", async () => {
        const runtime = createCandidateAnswerAnalysisDevelopmentRuntime({
            env: {
                NODE_ENV: "development",
                CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "fixture",
            },
            explicitLocalDev: true,
        });

        const result = await runtime?.requestAnswerAnalysis(createRequest(), { evaluationRunId: "run-fixture" });

        expect(result).toMatchObject({
            status: "evidence_first_evaluator_run_accepted",
            evaluationRunId: "run-fixture",
        });
        expect(runtime?.runMetadata).toMatchObject({
            provider: "candidate_v2_evidence_first_pipeline",
            modelName: "deterministic_local_fixture_v1",
        });
    });

    it.each([
        ["timeout_once", "failed", "PROVIDER_TIMEOUT", "evidence_extraction", 2],
        ["rate_limited_once", "failed", "PROVIDER_RATE_LIMITED", "evidence_extraction", 2],
        ["provider_5xx_once", "failed", "PROVIDER_5XX", "evidence_extraction", 2],
        ["provider_unavailable_once", "failed", "PROVIDER_UNAVAILABLE", "evidence_extraction", 1],
        ["misconfigured_once", "failed", "PROVIDER_MISCONFIGURED", "evidence_extraction", 1],
        ["invalid_extraction_schema_once", "rejected", "INVALID_EXTRACTION_SCHEMA", "evidence_extraction", 2],
        ["fingerprint_mismatch_once", "rejected", "EXTRACTION_INPUT_MISMATCH", "evidence_extraction", 1],
        ["span_mismatch_once", "rejected", "EVIDENCE_SPAN_NOT_EXACT", "evidence_extraction", 2],
        ["unsafe_inference_once", "rejected", "UNSAFE_INFERENCE", "evidence_extraction", 1],
        ["verifier_rejected_once", "rejected", "VERIFICATION_FAULT_INJECTED_REJECTION", "verification", 2],
        ["invalid_feedback_schema_once", "rejected", "INVALID_FEEDBACK_SCHEMA", "feedback_composition", 3],
    ] as const)(
        "fails one %s evaluator run with bounded metadata and then permits explicit recovery",
        async (mode, disposition, errorCode, stage, attemptCount) => {
            const request = createRequest();
            let error: EvidenceFirstEvaluatorRuntimeError | null = null;
            try {
                await runFaultInjectedCandidateAnswerAnalysis(request, {
                    evaluationRunId: "run-failed",
                    mode,
                });
            } catch (candidateError) {
                error = candidateError as EvidenceFirstEvaluatorRuntimeError;
            }

            expect(error).toBeInstanceOf(EvidenceFirstEvaluatorRuntimeError);
            expect(error).toMatchObject({ disposition, errorCode, stage });
            expect(error?.attempts).toHaveLength(attemptCount);
            expect(JSON.stringify(error)).not.toContain(request.answer.text);
            expect(JSON.stringify(error)).not.toContain(request.setupContext.jobDescription);

            const recovered = await runFaultInjectedCandidateAnswerAnalysis(request, {
                evaluationRunId: "run-recovered",
                mode,
            });

            expect(recovered).toMatchObject({
                status: "evidence_first_evaluator_run_accepted",
                evaluationRunId: "run-recovered",
                inputFingerprint: recovered.accepted.candidateProjection.inputFingerprint,
            });
        },
    );

    it("keeps the allowlist explicit and fail-first", () => {
        expect(CANDIDATE_ANSWER_ANALYSIS_FAULT_MODES).toEqual([
            "success",
            "timeout_once",
            "rate_limited_once",
            "provider_5xx_once",
            "provider_unavailable_once",
            "misconfigured_once",
            "invalid_extraction_schema_once",
            "fingerprint_mismatch_once",
            "span_mismatch_once",
            "unsafe_inference_once",
            "verifier_rejected_once",
            "invalid_feedback_schema_once",
        ] satisfies CandidateAnswerAnalysisFaultMode[]);
    });
});

function createRequest(): CandidateAnswerAnalysisProviderRequest {
    return {
        status: "answer_analysis_provider_requested",
        provider: "candidate_v2_answer_evaluator",
        requestedAt: "2026-07-16T20:02:00.000Z",
        answer: {
            slotId: "slot-1",
            questionIndex: 0,
            mode: "text",
            text: "I checked the work order, inspected the label, and documented the result.",
            submittedAt: "2026-07-16T20:01:00.000Z",
            answerAttemptId: "attempt-1",
            attemptNumber: 1,
            trigger: "initial_submit",
        },
        question: {
            slotId: "slot-1",
            questionIndex: 0,
            category: "behavioral",
            questionText: "Tell me about a time you checked important work.",
            plannedPurpose: "Show a real example and what changed.",
        },
        setupContext: {
            targetRole: "Quality Control Inspector",
            jobDescription: "Inspect finished packaging and verify labels.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 5,
        },
    };
}
