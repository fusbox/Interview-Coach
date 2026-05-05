import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderResponseError } from "@/lib/server/provider-errors";

const generateContentMock = vi.fn();
const incrementMetricMock = vi.fn();
const observeMetricMock = vi.fn();
const loggerErrorMock = vi.fn();
const captureAiGenerationMock = vi.fn();

vi.mock("@/lib/server/services/ai-config", () => ({
    ai: {
        models: {
            generateContent: generateContentMock
        }
    },
    AI_MODELS: {
        STRONG_RESPONSE: "mock-model"
    }
}));

vi.mock("@/lib/server/metrics", () => ({
    incrementMetric: incrementMetricMock,
    observeMetric: observeMetricMock
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: loggerErrorMock
    }
}));

vi.mock("@/lib/server/ai-quality/capture-ai-generation", () => ({
    captureAiGeneration: captureAiGenerationMock
}));

describe("StrongResponseService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        captureAiGenerationMock.mockResolvedValue("generation-1");
    });

    it("throws a typed provider error for invalid Gemini payloads", async () => {
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({ strongResponse: "Only one field" })
        });

        const { StrongResponseService } = await import("./strong-response-service");

        await expect(
            StrongResponseService.generateStrongResponse("Tell me about yourself", "QA Engineer")
        ).rejects.toBeInstanceOf(ProviderResponseError);
        expect(incrementMetricMock).toHaveBeenCalledWith("ai_requests_total", {
            operation: "strong_response",
            outcome: "malformed_response"
        });
        expect(loggerErrorMock).toHaveBeenCalledWith(
            "[StrongResponseService] Generation Failed",
            expect.objectContaining({
                provider: "gemini",
                operation: "generateStrongResponse",
                providerErrorKind: "schema_validation",
                error: expect.any(ProviderResponseError)
            })
        );
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            surface: "strong_response",
            status: "failed",
            rawOutput: expect.any(String),
            error: expect.objectContaining({
                operation: "generateStrongResponse",
                kind: "schema_validation"
            })
        }));
    });

    it("stores resume context as an artifact instead of input snapshot content", async () => {
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({
                strongResponse: "I improved inventory accuracy by checking each order twice.",
                whyThisWorks: "It is specific and role-relevant."
            })
        });

        const { StrongResponseService } = await import("./strong-response-service");

        await StrongResponseService.generateStrongResponse(
            "Tell me about a process you improved.",
            "Warehouse Associate",
            "Worked at Acme Logistics."
        );

        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            surface: "strong_response",
            status: "success",
            inputSnapshot: expect.objectContaining({
                questionText: "Tell me about a process you improved.",
                role: "Warehouse Associate",
                hasResumeText: true
            }),
            contextArtifacts: expect.arrayContaining([
                expect.objectContaining({ type: "resume", content: "Worked at [ORGANIZATION]." })
            ])
        }));
        expect(captureAiGenerationMock.mock.calls[0][0].inputSnapshot).not.toHaveProperty("resumeText");
    });
});
