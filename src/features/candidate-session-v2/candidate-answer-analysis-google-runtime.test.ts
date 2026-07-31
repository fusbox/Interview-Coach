import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { describe, expect, it, vi } from "vitest";

import { runFixtureEvidenceFirstEvaluator } from "./candidate-answer-analysis-fixture";
import { createCandidateAnswerAnalysisGoogleRuntime } from "./candidate-answer-analysis-google-runtime";
import type { CandidateAnswerAnalysisProviderRequest } from "./candidate-answer-analysis-adapter";

describe("candidate answer-analysis Google runtime", () => {
    it("assembles only for the exact Google provider/profile/credential contract", () => {
        const transportFactory = vi.fn(() => createTransport([]));

        expect(createCandidateAnswerAnalysisGoogleRuntime({
            env: { CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "fixture" },
            transportFactory,
        })).toBeNull();
        const runtime = createCandidateAnswerAnalysisGoogleRuntime({
            env: {
                CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "google_genai",
                CANDIDATE_ANSWER_ANALYSIS_PROFILE: "google_gemini_2_5_flash_v1",
                GEMINI_API_KEY: " route-secret ",
            },
            transportFactory,
        });

        expect(transportFactory).toHaveBeenCalledOnce();
        expect(transportFactory).toHaveBeenCalledWith("route-secret");
        expect(runtime?.runMetadata).toMatchObject({
            provider: "candidate_v2_evidence_first_pipeline",
            modelName: "google_gemini_2_5_flash_v1",
            configurationManifest: {
                configurationStatus: "resolved",
                serviceMode: "gemini_api",
                adapterVersion: "google_genai_evidence_first_adapter_v16",
            },
        });
        expect(JSON.stringify(runtime)).not.toContain("route-secret");
    });

    it("refuses provider work without the evaluator-run id created by the route claim", async () => {
        const transport = createTransport([]);
        const runtime = createRuntime(transport);

        await expect(runtime.requestAnswerAnalysis(createRequest())).rejects.toMatchObject({
            failureClass: "misconfigured",
            safeCode: "GOOGLE_EVALUATION_RUN_ID_REQUIRED",
        });
        expect(transport.calls).toHaveLength(0);
    });

    it("maps the candidate request into the conformed evaluator and preserves the claimed run id", async () => {
        const request = createRequest();
        const fixtureRun = await runFixtureEvidenceFirstEvaluator(request);
        const transport = createTransport([
            providerResponse(fixtureRun.accepted.extraction),
            providerResponse(fixtureRun.accepted.feedback),
        ]);
        const runtime = createRuntime(transport);

        const run = await runtime.requestAnswerAnalysis(request, { evaluationRunId: "claimed-run-1" });

        expect(run).toMatchObject({
            status: "evidence_first_evaluator_run_accepted",
            evaluationRunId: "claimed-run-1",
            inputFingerprint: runtime.createInputFingerprint(request),
            profile: { profileId: "google_gemini_2_5_flash_v1" },
        });
        expect(transport.calls).toHaveLength(2);
    });
});

function createRuntime(transport: ReturnType<typeof createTransport>) {
    return createCandidateAnswerAnalysisGoogleRuntime({
        env: {
            CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "google_genai",
            CANDIDATE_ANSWER_ANALYSIS_PROFILE: "google_gemini_2_5_flash_v1",
            GEMINI_API_KEY: "test-key",
        },
        transportFactory: () => transport,
    })!;
}

function createTransport(responses: GenerateContentResponse[]) {
    const calls: GenerateContentParameters[] = [];
    return {
        calls,
        async generateContent(input: GenerateContentParameters) {
            calls.push(input);
            const response = responses.shift();
            if (!response) throw new Error("Unexpected mocked provider call.");
            return response;
        },
    };
}

function providerResponse(value: unknown) {
    return {
        text: JSON.stringify(value),
        candidates: [{ finishReason: "STOP" }],
    } as unknown as GenerateContentResponse;
}

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
