import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderResponseError } from "@/lib/server/provider-errors";

const generateContentMock = vi.fn();
const incrementMetricMock = vi.fn();
const observeMetricMock = vi.fn();
const loggerErrorMock = vi.fn();

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

describe("TipsService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
    });
});
