import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderResponseError } from "@/lib/server/provider-errors";

const generateContentMock = vi.fn();
const incrementMetricMock = vi.fn();
const observeMetricMock = vi.fn();
const loggerErrorMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();

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

describe("AIService malformed provider handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
    });
});
