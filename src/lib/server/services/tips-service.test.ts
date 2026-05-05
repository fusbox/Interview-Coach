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
        TIPS: "mock-model"
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

describe("TipsService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        captureAiGenerationMock.mockResolvedValue("generation-1");
    });

    it("classifies malformed provider payloads distinctly", async () => {
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({ doThis: "Only one field" })
        });

        const { TipsService } = await import("./tips-service");

        await expect(
            TipsService.generateTips("Tell me about yourself", "QA Engineer")
        ).rejects.toBeInstanceOf(ProviderResponseError);

        expect(incrementMetricMock).toHaveBeenCalledWith("ai_requests_total", {
            operation: "tips",
            outcome: "malformed_response"
        });
        expect(loggerErrorMock).toHaveBeenCalledWith(
            "[TipsService] Generation Failed",
            expect.objectContaining({
                provider: "gemini",
                operation: "generateTips",
                providerErrorKind: "schema_validation",
                error: expect.any(ProviderResponseError)
            })
        );
        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            surface: "hint",
            status: "failed",
            rawOutput: expect.any(String),
            error: expect.objectContaining({
                operation: "generateTips",
                kind: "schema_validation"
            })
        }));
    });

    it("stores resume and blueprint context as artifacts instead of input snapshot content", async () => {
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({
                doThis: "Use the inventory story.",
                avoidThis: "Do not stay generic."
            })
        });

        const { TipsService } = await import("./tips-service");

        await TipsService.generateTips(
            "Tell me about a process you improved.",
            "Warehouse Associate",
            undefined,
            { title: "Warehouse Associate", competencies: [] },
            "Worked at Acme Logistics."
        );

        expect(captureAiGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
            surface: "hint",
            status: "success",
            inputSnapshot: expect.objectContaining({
                questionText: "Tell me about a process you improved.",
                role: "Warehouse Associate",
                hasResumeText: true
            }),
            contextArtifacts: expect.arrayContaining([
                expect.objectContaining({ type: "blueprint" }),
                expect.objectContaining({ type: "resume", content: "Worked at [ORGANIZATION]." })
            ])
        }));
        expect(captureAiGenerationMock.mock.calls[0][0].inputSnapshot).not.toHaveProperty("resumeText");
    });
});
