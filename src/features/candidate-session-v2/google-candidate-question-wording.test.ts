import { createHash } from "node:crypto";

import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { describe, expect, it, vi } from "vitest";

import { createCandidateQuestionPlan } from "./candidate-question-plan";
import { createCandidateQuestionWordingRequest } from "./candidate-question-wording";
import { createCandidateQuestionWordingRuntime, CandidateQuestionWordingRuntimeError } from "./candidate-question-wording-runtime";
import { createCandidateQuestionWordingRuntimeFromEnvironment } from "./candidate-question-wording-runtime-selection";
import {
    GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_MANIFEST,
    GOOGLE_CANDIDATE_QUESTION_WORDING_MODEL,
    GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
    GOOGLE_CANDIDATE_QUESTION_WORDING_RESPONSE_SCHEMA,
    GOOGLE_CANDIDATE_QUESTION_WORDING_SYSTEM_INSTRUCTION,
    createGoogleCandidateQuestionWordingAdapter,
    createGoogleCandidateQuestionWordingAdapterFromEnvironment,
    type GoogleCandidateQuestionWordingTransport,
} from "./google-candidate-question-wording";

describe("Google candidate question wording adapter", () => {
    it("binds the exact code-owned prompt and schema into configuration identity", () => {
        expect(GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_MANIFEST.systemInstructionFingerprint).toBe(
            createHash("sha256").update(JSON.stringify(GOOGLE_CANDIDATE_QUESTION_WORDING_SYSTEM_INSTRUCTION)).digest("hex"),
        );
        expect(GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_MANIFEST.responseSchemaFingerprint).toBe(
            createHash("sha256").update(JSON.stringify(GOOGLE_CANDIDATE_QUESTION_WORDING_RESPONSE_SCHEMA)).digest("hex"),
        );
        expect(GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID).toBe(
            "google_gemini_2_5_flash_question_wording_v2",
        );
        expect(GOOGLE_CANDIDATE_QUESTION_WORDING_SYSTEM_INSTRUCTION.join("\n")).toContain(
            "prefer demonstrated tool or process use",
        );
        expect(GOOGLE_CANDIDATE_QUESTION_WORDING_SYSTEM_INSTRUCTION.join("\n")).toContain(
            "Do not ask for exact numerical standards",
        );
        expect(GOOGLE_CANDIDATE_QUESTION_WORDING_SYSTEM_INSTRUCTION.join("\n")).toContain(
            "do not use your own knowledge",
        );
        expect(GOOGLE_CANDIDATE_QUESTION_WORDING_SYSTEM_INSTRUCTION.join("\n")).toContain(
            "Do not author hints",
        );
    });

    it("selects one exact server profile without retaining its credential", () => {
        const transportFactory = vi.fn(() => createTransport([]));
        expect(createGoogleCandidateQuestionWordingAdapterFromEnvironment({
            env: { CANDIDATE_QUESTION_WORDING_PROVIDER: "fixture" },
            transportFactory,
        })).toBeNull();

        const adapter = createGoogleCandidateQuestionWordingAdapterFromEnvironment({
            env: {
                CANDIDATE_QUESTION_WORDING_PROVIDER: "google_genai",
                CANDIDATE_QUESTION_WORDING_PROFILE: GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
                GEMINI_API_KEY: " server-only-secret ",
            },
            transportFactory,
        });

        expect(transportFactory).toHaveBeenCalledWith("server-only-secret");
        expect(adapter?.metadata).toMatchObject({
            provider: "google_genai",
            modelName: GOOGLE_CANDIDATE_QUESTION_WORDING_MODEL,
            profileId: GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
        });
        expect(JSON.stringify(adapter)).not.toContain("server-only-secret");
    });

    it.each([
        [{ CANDIDATE_QUESTION_WORDING_PROVIDER: "google_genai", GEMINI_API_KEY: "secret" }],
        [{
            CANDIDATE_QUESTION_WORDING_PROVIDER: "google_genai",
            CANDIDATE_QUESTION_WORDING_PROFILE: "wrong-profile",
            GEMINI_API_KEY: "secret",
        }],
        [{
            CANDIDATE_QUESTION_WORDING_PROVIDER: "google_genai",
            CANDIDATE_QUESTION_WORDING_PROFILE: GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
        }],
    ])("fails closed when the selected Google profile is incomplete", (env) => {
        expect(() => createGoogleCandidateQuestionWordingAdapterFromEnvironment({ env }))
            .toThrow(new CandidateQuestionWordingRuntimeError("misconfigured"));
    });

    it("sends one untrusted bounded context request and hydrates code-owned identity", async () => {
        const transport = createTransport([providerResponse({
            questions: [
                { slotId: "slot-1", category: "screening", questionText: "What interests you about this material handler role?" },
                { slotId: "slot-2", category: "behavioral", questionText: "Tell me about a time you caught a labeling or inventory error." },
                { slotId: "slot-3", category: "culture_fit", questionText: "What kind of team communication helps you work safely and accurately?" },
                { slotId: "slot-4", category: "screening", questionText: "Which parts of your background prepare you for inventory work?" },
                { slotId: "slot-5", category: "technical_role_specific", questionText: "How do you verify that materials are labeled and stored correctly?" },
            ],
        }, { promptTokenCount: 220, candidatesTokenCount: 90 })]);
        const runtime = createCandidateQuestionWordingRuntime({
            adapter: createGoogleCandidateQuestionWordingAdapter({ transport }),
        });
        const request = createRequest();

        const result = await runtime.wordQuestions(request);

        expect(transport.calls).toHaveLength(1);
        const call = transport.calls[0];
        const userText = readUserText(call);
        expect(String(call.config?.systemInstruction)).toContain("untrusted role");
        expect(JSON.parse(userText)).toMatchObject({
            payloadClassification: "untrusted_candidate_practice_context",
            task: "word_candidate_interview_question_plan",
            data: {
                targetRole: "Material Handler",
                jobDescription: request.setupSnapshot.jobDescription,
                resumeText: request.setupSnapshot.resumeText,
                interviewStage: "screening",
                slots: expect.arrayContaining([
                    expect.objectContaining({ slotId: "slot-1", index: 0, category: "screening" }),
                ]),
            },
        });
        expect(call).toMatchObject({
            model: GOOGLE_CANDIDATE_QUESTION_WORDING_MODEL,
            config: {
                responseMimeType: "application/json",
                responseJsonSchema: GOOGLE_CANDIDATE_QUESTION_WORDING_RESPONSE_SCHEMA,
                temperature: 0.25,
                maxOutputTokens: 4_096,
                candidateCount: 1,
                seed: 0,
                thinkingConfig: { thinkingBudget: 1_024, includeThoughts: false },
                httpOptions: { timeout: 20_000 },
            },
        });
        expect(result).toMatchObject({
            status: "questions_worded",
            questions: expect.arrayContaining([
                expect.objectContaining({
                    slotId: "slot-1",
                    index: 0,
                    category: "screening",
                }),
            ]),
            generation: {
                provider: "google_genai",
                modelName: GOOGLE_CANDIDATE_QUESTION_WORDING_MODEL,
                validation: {
                    tokenUsage: { inputTokens: 220, outputTokens: 90 },
                    rawOutputStored: false,
                    promptStored: false,
                },
            },
        });
    });

    it.each([
        [{ status: 429 }, "rate_limited", true],
        [{ status: 503 }, "provider_5xx", true],
        [{ status: 400 }, "provider_4xx", false],
        [{ status: 401 }, "misconfigured", false],
        [new Error("private provider detail"), "provider_unavailable", true],
    ])("normalizes provider failures without exposing detail", async (providerError, kind, retryable) => {
        const transport = createRejectingTransport(providerError);
        const runtime = createCandidateQuestionWordingRuntime({
            adapter: createGoogleCandidateQuestionWordingAdapter({ transport }),
        });
        await expect(runtime.wordQuestions(createRequest())).rejects.toMatchObject({ kind, retryable });
        expect(transport.calls).toHaveLength(1);
    });

    it("keeps fixture and fault profiles local-only", () => {
        expect(createCandidateQuestionWordingRuntimeFromEnvironment({
            env: { NODE_ENV: "production", CANDIDATE_QUESTION_WORDING_PROVIDER: "fixture" },
        })).toBeNull();
        expect(createCandidateQuestionWordingRuntimeFromEnvironment({
            env: { NODE_ENV: "production", CANDIDATE_QUESTION_WORDING_PROVIDER: "fault" },
        })).toBeNull();
        expect(createCandidateQuestionWordingRuntimeFromEnvironment({
            env: {
                NODE_ENV: "production",
                CANDIDATE_QUESTION_WORDING_PROVIDER: "google_genai",
                CANDIDATE_QUESTION_WORDING_PROFILE: GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
                GEMINI_API_KEY: "server-key",
            },
            googleTransportFactory: () => createTransport([]),
        })?.metadata).toMatchObject({ provider: "google_genai" });
        expect(createCandidateQuestionWordingRuntimeFromEnvironment({
            env: {
                NODE_ENV: "development",
                CANDIDATE_HOST_LAUNCH_DEV_MODE: "true",
                CANDIDATE_HOST_LAUNCH_DEV_SECRET: "local-secret",
            },
        })?.metadata).toMatchObject({ provider: "candidate_v2_question_wording_fixture" });
    });
});

function createRequest() {
    const questionPlanSnapshot = createCandidateQuestionPlan({ interviewStage: "screening", questionCount: 5 });
    return createCandidateQuestionWordingRequest({
        setupSnapshot: {
            targetRole: "Material Handler",
            jobDescription: "Move, label, and verify inventory safely.",
            resumeText: "Prepared outbound orders and checked labels.",
            interviewStage: "screening",
            questionCount: 5,
            resumeCaptureMode: "pasted_text",
            resumeArtifact: {
                artifactId: "resume-artifact-1",
                version: 1,
                revision: 1,
                source: "pasted_text",
                candidateLabel: "Pasted resume",
                reviewState: "accepted",
            },
            createdAt: "2026-07-18T12:00:00.000Z",
        },
        questionPlanSnapshot,
        now: new Date("2026-07-18T12:01:00.000Z"),
    });
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
    } satisfies GoogleCandidateQuestionWordingTransport & { calls: GenerateContentParameters[] };
}

function createRejectingTransport(error: unknown) {
    const calls: GenerateContentParameters[] = [];
    return {
        calls,
        async generateContent(input: GenerateContentParameters): Promise<GenerateContentResponse> {
            calls.push(input);
            throw error;
        },
    } satisfies GoogleCandidateQuestionWordingTransport & { calls: GenerateContentParameters[] };
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

function readUserText(input: GenerateContentParameters) {
    const contents = Array.isArray(input.contents) ? input.contents : [];
    const content = contents[0];
    if (
        !content
        || typeof content === "string"
        || !("parts" in content)
        || !Array.isArray(content.parts)
    ) return "";
    const part = content.parts[0];
    return part && "text" in part && typeof part.text === "string" ? part.text : "";
}
