import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderResponseError } from "@/lib/server/provider-errors";

const generateContentMock = vi.fn();

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

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe("StrongResponseService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws a typed provider error for invalid Gemini payloads", async () => {
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({ strongResponse: "Only one field" })
        });

        const { StrongResponseService } = await import("./strong-response-service");

        await expect(
            StrongResponseService.generateStrongResponse("Tell me about yourself", "QA Engineer")
        ).rejects.toBeInstanceOf(ProviderResponseError);
    });
});
