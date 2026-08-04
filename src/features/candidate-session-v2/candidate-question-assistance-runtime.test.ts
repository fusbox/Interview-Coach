import { describe, expect, it, vi } from "vitest";

import {
    CandidateQuestionAssistanceRuntimeError,
    CANDIDATE_QUESTION_ASSISTANCE_GOOGLE_PROFILE,
    createCandidateQuestionAssistanceRuntimeFromEnvironment,
} from "./candidate-question-assistance-runtime";

const request = {
    assistanceKind: "hints" as const,
    questionKey: "q1",
    questionText: "Tell me about a time you improved a process.",
    category: "behavioral" as const,
    targetRole: "Quality Inspector",
    jobDescription: "Inspect products and document findings.",
    resumeText: "Improved an intake checklist in a prior role.",
};

describe("candidate question assistance runtime", () => {
    it("creates deterministic fixture hints and a stable request fingerprint", async () => {
        const runtime = createCandidateQuestionAssistanceRuntimeFromEnvironment({ env: {} });
        const result = await runtime.generate(request);

        expect(result.output).toEqual(expect.objectContaining({
            status: "candidate_question_hints_v1",
        }));
        expect(result.requestFingerprint).toBe(runtime.createRequestFingerprint(request));
        expect(result.requestFingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    it("generates strong response only when that assistance kind is requested", async () => {
        const runtime = createCandidateQuestionAssistanceRuntimeFromEnvironment({ env: {} });
        const result = await runtime.generate({
            ...request,
            assistanceKind: "strong_response",
        });

        expect(result.output).toEqual(expect.objectContaining({
            status: "candidate_strong_response_v1",
            strongResponse: expect.any(String),
            whyThisWorks: expect.any(String),
        }));
    });

    it("validates Google structured output", async () => {
        const generateContent = vi.fn().mockResolvedValue({
            text: JSON.stringify({
                doThis: "Choose one relevant example and explain your own contribution.",
                avoidThis: "Avoid describing the team's work without making your role clear.",
            }),
            usageMetadata: {
                promptTokenCount: 100,
                candidatesTokenCount: 40,
            },
        });
        const runtime = createCandidateQuestionAssistanceRuntimeFromEnvironment({
            env: {
                CANDIDATE_QUESTION_ASSISTANCE_PROVIDER: "google_genai",
                CANDIDATE_QUESTION_ASSISTANCE_PROFILE:
                    CANDIDATE_QUESTION_ASSISTANCE_GOOGLE_PROFILE,
            },
            transport: { generateContent },
        });

        const result = await runtime.generate(request);

        expect(result.output.status).toBe("candidate_question_hints_v1");
        expect(result.tokenUsage).toEqual({ inputTokens: 100, outputTokens: 40 });
        expect(generateContent).toHaveBeenCalledOnce();
        expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
            config: expect.objectContaining({ maxOutputTokens: 2_048 }),
        }));
    });

    it("recovers one bounded JSON object envelope before exact strong-response validation", async () => {
        const generateContent = vi.fn().mockResolvedValue({
            text: `Here is the requested response:\n\`\`\`json\n${JSON.stringify({
                strongResponse:
                    "I noticed a recurring quality issue, checked the approved requirements, documented what I found, and raised it before the work moved forward.",
                whyThisWorks:
                    "It answers directly and gives a concise example. The candidate's actions and result remain easy to follow.",
            })}\n\`\`\``,
            candidates: [{ finishReason: "STOP" }],
        });
        const runtime = createCandidateQuestionAssistanceRuntimeFromEnvironment({
            env: {
                CANDIDATE_QUESTION_ASSISTANCE_PROVIDER: "google_genai",
                CANDIDATE_QUESTION_ASSISTANCE_PROFILE:
                    CANDIDATE_QUESTION_ASSISTANCE_GOOGLE_PROFILE,
            },
            transport: { generateContent },
        });

        const result = await runtime.generate({ ...request, assistanceKind: "strong_response" });

        expect(result.output).toMatchObject({ status: "candidate_strong_response_v1" });
    });

    it("classifies malformed output with metadata-only provider diagnostics", async () => {
        const generateContent = vi.fn().mockResolvedValue({
            text: "{truncated",
            candidates: [{ finishReason: "MAX_TOKENS" }],
        });
        const runtime = createCandidateQuestionAssistanceRuntimeFromEnvironment({
            env: {
                CANDIDATE_QUESTION_ASSISTANCE_PROVIDER: "google_genai",
                CANDIDATE_QUESTION_ASSISTANCE_PROFILE:
                    CANDIDATE_QUESTION_ASSISTANCE_GOOGLE_PROFILE,
            },
            transport: { generateContent },
        });

        await expect(runtime.generate({ ...request, assistanceKind: "strong_response" }))
            .rejects.toMatchObject({
                code: "invalid_json",
                diagnostics: {
                    responseLength: 10,
                    finishReason: "MAX_TOKENS",
                },
            } satisfies Partial<CandidateQuestionAssistanceRuntimeError>);
    });
});
