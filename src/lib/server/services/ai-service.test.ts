import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderResponseError } from "@/lib/server/provider-errors";

const generateContentMock = vi.fn();
const incrementMetricMock = vi.fn();
const observeMetricMock = vi.fn();
const loggerErrorMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const captureAiGenerationMock = vi.fn();

vi.mock("@/lib/server/services/ai-config", () => ({
    ai: {
        models: {
            generateContent: generateContentMock
        }
    },
    AI_MODELS: {
        ANALYSIS: "mock-analysis-model"
    }
}));

vi.mock("@/lib/server/metrics", () => ({
    incrementMetric: incrementMetricMock,
    observeMetric: observeMetricMock
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        error: loggerErrorMock,
        info: loggerInfoMock,
        warn: loggerWarnMock
    }
}));

vi.mock("@/lib/server/ai-quality/capture-ai-generation", () => ({
    captureAiGeneration: captureAiGenerationMock
}));

describe("AIService malformed provider handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        captureAiGenerationMock.mockResolvedValue("generation-1");
    });

    it("records malformed_response metrics and returns fallback analysis", async () => {
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({
                contentPulse: {
                    dimension: "not_a_real_dimension",
                    headline: "Bad payload",
                    body: "This should fail schema validation."
                }
            })
        });

        const { AIService } = await import("./ai-service");

        const result = await AIService.analyzeAnswer(
            { id: "q1", text: "Tell me about yourself", category: "general", index: 0 },
            "I have relevant experience.",
            null
        );

        expect(result.contentPulse?.headline).toBe("System Offline");
        expect(incrementMetricMock).toHaveBeenCalledWith("ai_requests_total", {
            operation: "analysis",
            outcome: "malformed_response"
        });
        expect(observeMetricMock).toHaveBeenCalledWith(
            "ai_request_duration_ms",
            expect.any(Number),
            {
                operation: "analysis",
                outcome: "malformed_response"
            }
        );
        expect(loggerErrorMock).toHaveBeenCalledWith(
            "AI Analysis Failed",
            expect.objectContaining({
                provider: "gemini",
                operation: "analyzeAnswer",
                providerErrorKind: "schema_validation",
                error: expect.any(ProviderResponseError)
            })
        );
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            surface: "answer_feedback",
            status: "failed",
            modelProvider: "gemini",
            rawOutput: expect.any(String),
            error: expect.objectContaining({
                operation: "analyzeAnswer",
                kind: "schema_validation"
            })
        }));
    });

    it("records malformed_response metrics and returns fallback summary", async () => {
        generateContentMock.mockResolvedValueOnce({
            text: "   "
        });

        const { AIService } = await import("./ai-service");

        const result = await AIService.summarizeSession({
            id: "session-1",
            role: "QA Engineer",
            status: "COMPLETED",
            questions: [],
            currentQuestionIndex: 0,
            answers: {},
            initialsRequired: false
        });

        expect(result).toContain("Executive Summary");
        expect(incrementMetricMock).toHaveBeenCalledWith("ai_requests_total", {
            operation: "session_summary",
            outcome: "malformed_response"
        });
        expect(loggerErrorMock).toHaveBeenCalledWith(
            "Session Summarization Failed",
            expect.objectContaining({
                provider: "gemini",
                operation: "summarizeSession",
                providerErrorKind: "schema_validation",
                error: expect.any(ProviderResponseError)
            })
        );
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            surface: "session_debrief",
            status: "failed",
            modelProvider: "gemini",
            rawOutput: "   ",
            error: expect.objectContaining({
                operation: "summarizeSession",
                kind: "schema_validation"
            })
        }));
    });

    it("captures session debrief inputs as structured answers and job description artifact", async () => {
        generateContentMock.mockResolvedValueOnce({
            text: "### Executive Summary\nYou completed the session."
        });

        const { AIService } = await import("./ai-service");

        await AIService.summarizeSession({
            id: "session-1",
            recruiterId: "recruiter-1",
            role: "Data Entry Clerk",
            jobDescription: "Enter records for Brightpath Medical Clinic.",
            status: "COMPLETED",
            questions: [{ id: "q1", text: "What tools have you used?", category: "technical", index: 0 }],
            currentQuestionIndex: 0,
            answers: {
                q1: {
                    questionId: "q1",
                    transcript: "I used spreadsheets at Brightpath Medical Clinic.",
                    analysis: {
                        meta: { tier: 1, modality: "text" },
                        scores: {
                            focus_relevance: { score: 4, label: "Relevant example" },
                            structural_clarity: { score: 4, label: "Clear" },
                            specificity_concreteness: { score: 4, label: "Specific" },
                            outcome_explicitness: { score: 3, label: "Some outcome" },
                            decision_rationale: { score: 3, label: "Some rationale" },
                            filler_words: { score: 5, label: "No fillers" },
                            signposting: { score: 3, label: "Basic signposting" },
                            conciseness: { score: 4, label: "Concise" },
                            resilience: { score: 4, label: "Positive" }
                        }
                    }
                }
            },
            initialsRequired: false
        });

        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            surface: "session_debrief",
            status: "success",
            createdBy: "recruiter-1",
            inputSnapshot: expect.objectContaining({
                sessionId: "session-1",
                role: "Data Entry Clerk",
                hasJobDescription: true,
                answers: [
                    expect.objectContaining({
                        questionId: "q1",
                        questionText: "What tools have you used?",
                        transcript: "I used spreadsheets at [ORGANIZATION]."
                    })
                ]
            }),
            contextArtifacts: [
                expect.objectContaining({
                    type: "job_description",
                    content: "Enter records for [ORGANIZATION]."
                })
            ],
            privacyFlags: ["contains_session_transcripts"]
        }));
    });
});
