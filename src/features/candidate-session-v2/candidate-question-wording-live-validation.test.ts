import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { describe, expect, it, vi } from "vitest";

import {
    CANDIDATE_QUESTION_WORDING_LIVE_TEST_ENV,
    CandidateQuestionWordingLiveValidationGuardError,
    candidateQuestionWordingLiveValidationArtifactSchema,
    findProhibitedQuestionWordingLiveArtifactKeys,
    runCandidateQuestionWordingLiveValidation,
} from "./candidate-question-wording-live-validation";
import {
    GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT,
    GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
    type GoogleCandidateQuestionWordingTransport,
} from "./google-candidate-question-wording";

const baseEnvironment = {
    [CANDIDATE_QUESTION_WORDING_LIVE_TEST_ENV]: "true",
    CANDIDATE_QUESTION_WORDING_PROVIDER: "google_genai",
    CANDIDATE_QUESTION_WORDING_PROFILE: GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
    GEMINI_API_KEY: "server-only-live-secret",
};

describe("candidate question wording live validation", () => {
    it.each([
        [false, baseEnvironment, "LIVE_QUESTION_WORDING_CLI_CONFIRMATION_REQUIRED"],
        [true, { ...baseEnvironment, [CANDIDATE_QUESTION_WORDING_LIVE_TEST_ENV]: undefined }, "LIVE_QUESTION_WORDING_FLAG_REQUIRED"],
        [true, { ...baseEnvironment, CANDIDATE_QUESTION_WORDING_PROVIDER: "fixture" }, "LIVE_QUESTION_WORDING_PROVIDER_MISMATCH"],
        [true, { ...baseEnvironment, CANDIDATE_QUESTION_WORDING_PROFILE: "wrong" }, "LIVE_QUESTION_WORDING_PROFILE_MISMATCH"],
        [true, { ...baseEnvironment, GEMINI_API_KEY: "" }, "LIVE_QUESTION_WORDING_CREDENTIAL_REQUIRED"],
    ])("fails before transport assembly when an explicit guard is missing", async (
        confirmedLiveProvider,
        env,
        safeCode,
    ) => {
        const createTransport = vi.fn();
        await expect(runCandidateQuestionWordingLiveValidation({
            env,
            confirmedLiveProvider,
            dependencies: { createTransport },
        })).rejects.toEqual(new CandidateQuestionWordingLiveValidationGuardError(safeCode));
        expect(createTransport).not.toHaveBeenCalled();
    });

    it("captures one accepted synthetic run without request, raw output, setup documents, or credentials", async () => {
        const transport = createTransport([providerResponse({
            questions: [
                { slotId: "slot-1", category: "screening", questionText: "What interests you about inspecting quality in a warehouse environment?" },
                { slotId: "slot-2", category: "behavioral", questionText: "Tell me about a time you found and documented an error before it caused a larger problem." },
                { slotId: "slot-3", category: "culture_fit", questionText: "What kind of communication helps you maintain quality while working with a busy team?" },
                { slotId: "slot-4", category: "case_scenario", questionText: "How would you respond if you found repeated defects while an urgent shipment was waiting?" },
                { slotId: "slot-5", category: "technical_role_specific", questionText: "How would you verify and document that incoming products meet quality requirements?" },
            ],
        }, { promptTokenCount: 310, candidatesTokenCount: 120 })]);

        const artifact = await runCandidateQuestionWordingLiveValidation({
            env: baseEnvironment,
            confirmedLiveProvider: true,
            dependencies: {
                now: () => new Date("2026-07-18T20:00:00.000Z"),
                createTransport: () => transport,
            },
        });

        expect(transport.calls).toHaveLength(1);
        expect(artifact.profile.configurationFingerprint).toBe(GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT);
        expect(artifact.summary).toEqual({
            transportAttemptCount: 1,
            automatedGatePassed: true,
            humanQuestionReview: "required",
        });
        expect(artifact.result).toMatchObject({
            outcome: "accepted",
            metrics: { inputTokens: 310, outputTokens: 120 },
            questions: expect.arrayContaining([
                expect.objectContaining({ slotId: "slot-1", category: "screening" }),
            ]),
        });
        expect(findProhibitedQuestionWordingLiveArtifactKeys(artifact)).toEqual([]);
        const serialized = JSON.stringify(artifact);
        expect(serialized).not.toContain("server-only-live-secret");
        expect(serialized).not.toContain("Inspect incoming products");
        expect(serialized).not.toContain("Checked outbound orders");
        expect(candidateQuestionWordingLiveValidationArtifactSchema.parse(artifact)).toEqual(artifact);
    });

    it("records a safe terminal failure without retaining the provider exception", async () => {
        const artifact = await runCandidateQuestionWordingLiveValidation({
            env: baseEnvironment,
            confirmedLiveProvider: true,
            dependencies: {
                now: () => new Date("2026-07-18T20:01:00.000Z"),
                createTransport: () => createRejectingTransport(new Error("private provider exception body")),
            },
        });

        expect(artifact.result).toEqual({
            outcome: "failed",
            failure: {
                errorCode: "QUESTION_WORDING_PROVIDER_PROVIDER_UNAVAILABLE",
                retryable: true,
            },
        });
        expect(artifact.summary.automatedGatePassed).toBe(false);
        expect(JSON.stringify(artifact)).not.toContain("private provider exception body");
    });

    it("detects prohibited retained fields and rejects a non-derived gate summary", async () => {
        expect(findProhibitedQuestionWordingLiveArtifactKeys({
            safe: { resumeText: "should not be retained" },
            nested: { api_key: "secret" },
        })).toEqual(["artifact.nested.api_key", "artifact.safe.resumeText"]);

        const artifact = await runCandidateQuestionWordingLiveValidation({
            env: baseEnvironment,
            confirmedLiveProvider: true,
            dependencies: {
                now: () => new Date("2026-07-18T20:02:00.000Z"),
                createTransport: () => createTransport([providerResponse({
                    questions: [
                        { slotId: "slot-1", category: "screening", questionText: "What interests you about quality inspection work?" },
                        { slotId: "slot-2", category: "behavioral", questionText: "Tell me about a time you caught an error before work moved forward." },
                        { slotId: "slot-3", category: "culture_fit", questionText: "What team habits help you maintain careful and consistent work?" },
                        { slotId: "slot-4", category: "case_scenario", questionText: "How would you handle an urgent order when you found a possible defect?" },
                        { slotId: "slot-5", category: "technical_role_specific", questionText: "How would you record and communicate a product defect?" },
                    ],
                })]),
            },
        });
        expect(() => candidateQuestionWordingLiveValidationArtifactSchema.parse({
            ...artifact,
            summary: { ...artifact.summary, automatedGatePassed: false },
        })).toThrow();
    });
});

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
    } satisfies GoogleCandidateQuestionWordingTransport & { calls: GenerateContentParameters[] };
}

function createRejectingTransport(error: unknown) {
    return {
        async generateContent(): Promise<GenerateContentResponse> {
            throw error;
        },
    } satisfies GoogleCandidateQuestionWordingTransport;
}

function providerResponse(value: unknown, usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
}) {
    return {
        text: JSON.stringify(value),
        candidates: [{ finishReason: "STOP" }],
        usageMetadata,
    } as unknown as GenerateContentResponse;
}
