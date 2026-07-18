import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { describe, expect, it, vi } from "vitest";

import {
    CANDIDATE_COACH_UPDATE_LIVE_TEST_ENV,
    CandidateCoachUpdateLiveValidationGuardError,
    candidateCoachUpdateLiveValidationArtifactSchema,
    findProhibitedCoachUpdateLiveArtifactKeys,
    runCandidateCoachUpdateLiveValidation,
} from "./candidate-coach-update-live-validation";
import {
    GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_FINGERPRINT,
    GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID,
    type GoogleCandidateCoachUpdateTransport,
} from "./google-candidate-coach-update";

const baseEnvironment = {
    [CANDIDATE_COACH_UPDATE_LIVE_TEST_ENV]: "true",
    CANDIDATE_COACH_UPDATE_PROVIDER: "google_genai",
    CANDIDATE_COACH_UPDATE_PROFILE: GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID,
    GEMINI_API_KEY: "server-only-live-secret",
};

describe("candidate Coach Update live validation", () => {
    it.each([
        [false, baseEnvironment, "LIVE_COACH_UPDATE_CLI_CONFIRMATION_REQUIRED"],
        [true, { ...baseEnvironment, [CANDIDATE_COACH_UPDATE_LIVE_TEST_ENV]: undefined }, "LIVE_COACH_UPDATE_FLAG_REQUIRED"],
        [true, { ...baseEnvironment, CANDIDATE_COACH_UPDATE_PROVIDER: "fixture" }, "LIVE_COACH_UPDATE_PROVIDER_MISMATCH"],
        [true, { ...baseEnvironment, CANDIDATE_COACH_UPDATE_PROFILE: "wrong" }, "LIVE_COACH_UPDATE_PROFILE_MISMATCH"],
        [true, { ...baseEnvironment, GEMINI_API_KEY: "" }, "LIVE_COACH_UPDATE_CREDENTIAL_REQUIRED"],
    ])("fails before transport assembly when an explicit guard is missing", async (
        confirmedLiveProvider,
        env,
        safeCode,
    ) => {
        const createTransport = vi.fn();

        await expect(runCandidateCoachUpdateLiveValidation({
            env,
            confirmedLiveProvider,
            dependencies: { createTransport },
        })).rejects.toEqual(new CandidateCoachUpdateLiveValidationGuardError(safeCode));
        expect(createTransport).not.toHaveBeenCalled();
    });

    it("captures one accepted synthetic run without identity, raw answers, request, output, or credentials", async () => {
        const transport = createTransport([providerResponse({
            title: "Your latest practice, connected",
            summary: "You made your actions clear in both answers. The next useful step is to make each result and communication choice more specific.",
            primaryFocus: "Name the result and explain how you would communicate the tradeoff.",
            questionUpdates: [
                {
                    questionNumber: 1,
                    comparisonMessage: "This is the first accepted practice evidence for this question, with a clear action and a result still to add.",
                },
                {
                    questionNumber: 2,
                    comparisonMessage: "Compared with the earlier practice, this response now explains the decision criteria; communicating the tradeoff remains the next step.",
                },
            ],
        }, { promptTokenCount: 222, candidatesTokenCount: 84 })]);

        const artifact = await runCandidateCoachUpdateLiveValidation({
            env: baseEnvironment,
            confirmedLiveProvider: true,
            dependencies: {
                now: () => new Date("2026-07-17T20:00:00.000Z"),
                createTransport: () => transport,
            },
        });

        expect(transport.calls).toHaveLength(1);
        expect(artifact.profile.configurationFingerprint).toBe(
            GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_FINGERPRINT,
        );
        expect(artifact.summary).toEqual({
            transportAttemptCount: 1,
            automatedGatePassed: true,
            humanLanguageReview: "required",
        });
        expect(artifact.result).toMatchObject({
            outcome: "accepted",
            metrics: { inputTokens: 222, outputTokens: 84 },
            language: {
                questionUpdates: [
                    { questionNumber: 1, comparisonKind: "first_practice", priorComparableAttemptCount: 0 },
                    { questionNumber: 2, comparisonKind: "repeat_practice", priorComparableAttemptCount: 1 },
                ],
            },
        });
        expect(findProhibitedCoachUpdateLiveArtifactKeys(artifact)).toEqual([]);
        const serialized = JSON.stringify(artifact);
        expect(serialized).not.toContain("server-only-live-secret");
        expect(serialized).not.toContain("RAW_CURRENT_ANSWER");
        expect(serialized).not.toContain("qa-private-candidate-id");
        expect(serialized).not.toContain("Tell me about a time");
        expect(candidateCoachUpdateLiveValidationArtifactSchema.parse(artifact)).toEqual(artifact);
    });

    it("records a safe terminal failure without retaining the provider exception", async () => {
        const transport = createRejectingTransport(new Error("private provider exception body"));

        const artifact = await runCandidateCoachUpdateLiveValidation({
            env: baseEnvironment,
            confirmedLiveProvider: true,
            dependencies: {
                now: () => new Date("2026-07-17T20:01:00.000Z"),
                createTransport: () => transport,
            },
        });

        expect(artifact.result).toEqual({
            outcome: "failed",
            failure: {
                errorCode: "COACH_UPDATE_PROVIDER_PROVIDER_UNAVAILABLE",
                retryable: true,
            },
        });
        expect(artifact.summary.automatedGatePassed).toBe(false);
        expect(JSON.stringify(artifact)).not.toContain("private provider exception body");
    });

    it("detects prohibited retained fields and rejects a non-derived gate summary", async () => {
        expect(findProhibitedCoachUpdateLiveArtifactKeys({
            safe: { answerText: "should not be retained" },
            nested: { api_key: "secret" },
        })).toEqual([
            "artifact.nested.api_key",
            "artifact.safe.answerText",
        ]);

        const artifact = await runCandidateCoachUpdateLiveValidation({
            env: baseEnvironment,
            confirmedLiveProvider: true,
            dependencies: {
                now: () => new Date("2026-07-17T20:02:00.000Z"),
                createTransport: () => createTransport([providerResponse({
                    title: "Practice update",
                    summary: "Your actions are clear, with results as the next useful focus.",
                    primaryFocus: "Add the result of each action.",
                    questionUpdates: [
                        { questionNumber: 1, comparisonMessage: "This is the first practice evidence for this question." },
                        { questionNumber: 2, comparisonMessage: "This response makes the decision criteria clearer than before." },
                    ],
                })]),
            },
        });

        expect(() => candidateCoachUpdateLiveValidationArtifactSchema.parse({
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
    } satisfies GoogleCandidateCoachUpdateTransport & { calls: GenerateContentParameters[] };
}

function createRejectingTransport(error: unknown) {
    const calls: GenerateContentParameters[] = [];
    return {
        calls,
        async generateContent(input: GenerateContentParameters): Promise<GenerateContentResponse> {
            calls.push(input);
            throw error;
        },
    } satisfies GoogleCandidateCoachUpdateTransport & { calls: GenerateContentParameters[] };
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
