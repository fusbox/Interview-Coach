import { createHash } from "node:crypto";

import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { describe, expect, it, vi } from "vitest";

import type { CandidateCoachUpdateSynthesisInput } from "./candidate-coach-update-artifact";
import {
    CandidateCoachUpdateRuntimeError,
    createCandidateCoachUpdateSynthesisRuntime,
} from "./candidate-coach-update-runtime";
import { createCandidateCoachUpdateRuntimeFromEnvironment } from "./candidate-coach-update-runtime-selection";
import {
    GOOGLE_CANDIDATE_COACH_UPDATE_MODEL,
    GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID,
    GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_MANIFEST,
    GOOGLE_CANDIDATE_COACH_UPDATE_RESPONSE_SCHEMA,
    GOOGLE_CANDIDATE_COACH_UPDATE_SYSTEM_INSTRUCTION,
    createGoogleCandidateCoachUpdateAdapter,
    createGoogleCandidateCoachUpdateAdapterFromEnvironment,
    type GoogleCandidateCoachUpdateTransport,
} from "./google-candidate-coach-update";

describe("Google candidate Coach Update adapter", () => {
    it("binds the exact code-owned system instruction into configuration identity", () => {
        expect(GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_MANIFEST.systemInstructionFingerprint).toBe(
            createHash("sha256")
                .update(JSON.stringify(GOOGLE_CANDIDATE_COACH_UPDATE_SYSTEM_INSTRUCTION))
                .digest("hex"),
        );
    });

    it("selects one exact server profile without retaining or exposing its credential", () => {
        const transport = createTransport([]);
        const transportFactory = vi.fn(() => transport);

        expect(createGoogleCandidateCoachUpdateAdapterFromEnvironment({
            env: { CANDIDATE_COACH_UPDATE_PROVIDER: "fixture" },
            transportFactory,
        })).toBeNull();
        const adapter = createGoogleCandidateCoachUpdateAdapterFromEnvironment({
            env: {
                CANDIDATE_COACH_UPDATE_PROVIDER: "google_genai",
                CANDIDATE_COACH_UPDATE_PROFILE: GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID,
                GEMINI_API_KEY: " server-only-secret ",
            },
            transportFactory,
        });

        expect(transportFactory).toHaveBeenCalledWith("server-only-secret");
        expect(adapter?.metadata).toMatchObject({
            provider: "google_genai",
            modelName: GOOGLE_CANDIDATE_COACH_UPDATE_MODEL,
            promptVersion: "candidate_coach_update_synthesis_prompt_v1",
        });
        expect(JSON.stringify(adapter)).not.toContain("server-only-secret");
    });

    it.each([
        [{ CANDIDATE_COACH_UPDATE_PROVIDER: "google_genai", GEMINI_API_KEY: "secret" }],
        [{
            CANDIDATE_COACH_UPDATE_PROVIDER: "google_genai",
            CANDIDATE_COACH_UPDATE_PROFILE: "wrong-profile",
            GEMINI_API_KEY: "secret",
        }],
        [{
            CANDIDATE_COACH_UPDATE_PROVIDER: "google_genai",
            CANDIDATE_COACH_UPDATE_PROFILE: GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID,
        }],
    ])("fails closed when a selected Google profile is incomplete", (env) => {
        expect(() => createGoogleCandidateCoachUpdateAdapterFromEnvironment({ env }))
            .toThrow(new CandidateCoachUpdateRuntimeError("misconfigured"));
    });

    it("sends only candidate-safe facts in one untrusted structured request and hydrates identity in code", async () => {
        const transport = createTransport([providerResponse({
            title: "Material Handler practice update",
            summary: "Your latest practice showed a direct example and one useful next step.",
            primaryFocus: "Make the result of your action more explicit.",
            questionUpdates: [{
                questionNumber: 1,
                comparisonMessage: "This is your first accepted practice evidence for this question.",
            }],
        }, { promptTokenCount: 140, candidatesTokenCount: 48 })]);
        const runtime = createCandidateCoachUpdateSynthesisRuntime({
            adapter: createGoogleCandidateCoachUpdateAdapter({ transport }),
        });
        const input = createInput();

        const result = await runtime.synthesize(input);

        expect(transport.calls).toHaveLength(1);
        const call = transport.calls[0];
        const systemInstruction = String(call.config?.systemInstruction);
        const userText = readUserText(call);
        expect(systemInstruction).toContain("untrusted data");
        expect(systemInstruction).not.toContain(input.candidateProfileId);
        expect(systemInstruction).not.toContain(input.questions[0].answerAttempt.answerText);
        expect(userText).not.toContain(input.candidateProfileId);
        expect(userText).not.toContain(input.roleProfileId);
        expect(userText).not.toContain(input.sourceCandidatePracticeSessionId);
        expect(userText).not.toContain(input.questions[0].answerAttempt.answerText);
        expect(JSON.parse(userText)).toMatchObject({
            payloadClassification: "untrusted_candidate_coaching_facts",
            task: "synthesize_candidate_coach_update",
            data: {
                synthesisInputFingerprint: input.synthesisInputFingerprint,
                questions: [{ answer: { mode: "text" } }],
            },
        });
        expect(call).toMatchObject({
            model: GOOGLE_CANDIDATE_COACH_UPDATE_MODEL,
            config: {
                responseMimeType: "application/json",
                responseJsonSchema: GOOGLE_CANDIDATE_COACH_UPDATE_RESPONSE_SCHEMA,
                temperature: 0.2,
                maxOutputTokens: 2_048,
                candidateCount: 1,
                seed: 0,
                thinkingConfig: { thinkingBudget: 512, includeThoughts: false },
                httpOptions: { timeout: 12_000 },
            },
        });
        expect(result.content).toMatchObject({
            status: "candidate_coach_update_content_v2",
            questions: [{
                questionKey: "slot-1",
                answer: { candidateAnswerAttemptId: "attempt-current" },
                source: { candidatePracticeSessionId: "source-session" },
            }],
        });
        expect(result.validation).toMatchObject({
            transportAttemptCount: 1,
            tokenUsage: { inputTokens: 140, outputTokens: 48 },
            rawOutputStored: false,
            promptStored: false,
        });
    });

    it.each([
        [{ status: 429 }, "rate_limited", true],
        [{ status: 503 }, "provider_5xx", true],
        [{ status: 400 }, "provider_4xx", false],
        [{ status: 401 }, "misconfigured", false],
        [new Error("private provider detail"), "provider_unavailable", true],
    ])("normalizes provider failures without exposing provider detail", async (providerError, kind, retryable) => {
        const transport = createRejectingTransport(providerError);
        const runtime = createCandidateCoachUpdateSynthesisRuntime({
            adapter: createGoogleCandidateCoachUpdateAdapter({ transport }),
        });

        await expect(runtime.synthesize(createInput())).rejects.toMatchObject({ kind, retryable });
        expect(transport.calls).toHaveLength(1);
    });

    it("rejects provider safety blocks and malformed structured output", async () => {
        const blockedRuntime = createCandidateCoachUpdateSynthesisRuntime({
            adapter: createGoogleCandidateCoachUpdateAdapter({
                transport: createTransport([{
                    promptFeedback: { blockReason: "SAFETY" },
                } as unknown as GenerateContentResponse]),
            }),
        });
        await expect(blockedRuntime.synthesize(createInput())).rejects.toMatchObject({
            kind: "safety_blocked",
            lifecycleState: "rejected",
            retryable: false,
        });

        const malformedRuntime = createCandidateCoachUpdateSynthesisRuntime({
            adapter: createGoogleCandidateCoachUpdateAdapter({
                transport: createTransport([providerRawResponse("{not-json")]),
            }),
        });
        await expect(malformedRuntime.synthesize(createInput())).rejects.toMatchObject({
            kind: "invalid_json",
            lifecycleState: "rejected",
        });
    });

    it("selects Google outside local development while keeping fixture and fault profiles local-only", () => {
        const transport = createTransport([]);
        const googleRuntime = createCandidateCoachUpdateRuntimeFromEnvironment({
            env: {
                NODE_ENV: "production",
                CANDIDATE_COACH_UPDATE_PROVIDER: "google_genai",
                CANDIDATE_COACH_UPDATE_PROFILE: GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID,
                GEMINI_API_KEY: "server-key",
            },
            explicitLocalDev: false,
            googleTransportFactory: () => transport,
        });
        expect(googleRuntime?.metadata).toMatchObject({
            provider: "google_genai",
            modelName: "gemini-2.5-flash",
        });
        expect(createCandidateCoachUpdateRuntimeFromEnvironment({
            env: { NODE_ENV: "production", CANDIDATE_COACH_UPDATE_PROVIDER: "fixture" },
            explicitLocalDev: true,
        })).toBeNull();
        expect(createCandidateCoachUpdateRuntimeFromEnvironment({
            env: { NODE_ENV: "production", CANDIDATE_COACH_UPDATE_PROVIDER: "fault" },
            explicitLocalDev: true,
        })).toBeNull();
        expect(createCandidateCoachUpdateRuntimeFromEnvironment({
            env: { NODE_ENV: "production", CANDIDATE_COACH_UPDATE_PROVIDER: "google_genai" },
            explicitLocalDev: false,
        })).toBeNull();
    });
});

function createInput(): CandidateCoachUpdateSynthesisInput {
    return {
        status: "candidate_coach_update_synthesis_input_v1",
        candidateProfileId: "candidate-private-id",
        roleProfileId: "role-profile-private-id",
        sourceCandidatePracticeSessionId: "session-private-id",
        targetRole: "Material Handler",
        completedAt: "2026-07-17T12:05:00.000Z",
        questionCount: 1,
        answeredCount: 1,
        sourceCompletionFingerprint: "completion-fingerprint",
        synthesisInputFingerprint: "synthesis-fingerprint",
        questions: [{
            questionKey: "slot-1",
            questionNumber: 1,
            category: "Behavioral",
            questionText: "Tell me about a time you handled an urgent shipment.",
            answerAttempt: {
                candidateAnswerAttemptId: "attempt-current",
                candidatePracticeSessionId: "session-private-id",
                candidateProfileId: "candidate-private-id",
                questionSlotId: "slot-1",
                questionIndex: 0,
                attemptNumber: 1,
                trigger: "initial_submit",
                supersedesCandidateAnswerAttemptId: null,
                mode: "text",
                answerText: "RAW_ANSWER_SENTINEL I organized the urgent shipment.",
                idempotencyKey: "answer-idempotency-key",
                payloadFingerprint: "answer-fingerprint",
                submittedAt: "2026-07-17T12:01:00.000Z",
                createdAt: "2026-07-17T12:01:00.000Z",
            },
            acceptedEvaluationRun: {
                candidateAnswerEvaluationRunId: "run-current",
            } as CandidateCoachUpdateSynthesisInput["questions"][number]["acceptedEvaluationRun"],
            acceptedAnalysis: createAnalysis(),
            transcriptCanvas: null,
            source: { candidatePracticeSessionId: "source-session", questionKey: "source-slot" },
            priorComparableAttempts: [],
        }],
    };
}

function createAnalysis() {
    return {
        status: "answer_analysis_provider_result" as const,
        provider: "candidate_v2_answer_evaluator" as const,
        analyzedAt: "2026-07-17T12:02:00.000Z",
        answer: { slotId: "slot-1", questionIndex: 0 },
        coachFeedback: {
            acknowledgement: "You gave a direct example.",
            observation: "The response connects the action to the role.",
            nextPracticeFocus: "Name the result of the action.",
        },
        evidence: [
            { criterionId: "answer_focus", applicability: "observed" as const, score: 3 },
            { criterionId: "impact", applicability: "not_elicited" as const },
        ],
    };
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

function providerRawResponse(text: string) {
    return {
        text,
        candidates: [{ finishReason: "STOP" }],
    } as unknown as GenerateContentResponse;
}

function readUserText(call: GenerateContentParameters) {
    const contents = Array.isArray(call.contents) ? call.contents : [call.contents];
    const first = contents[0];
    if (typeof first === "string") return first;
    if (!first || typeof first !== "object" || !("parts" in first) || !Array.isArray(first.parts)) return "";
    const part = first.parts[0];
    return part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : "";
}
