import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiGenerationRepository } from "./ai-generation-repository";

const loggerWarnMock = vi.fn();

vi.mock("@/lib/logger", () => ({
    Logger: {
        warn: loggerWarnMock,
    },
}));

vi.mock("./ai-generation-repository", () => ({
    SupabaseAiGenerationRepository: vi.fn(),
}));

describe("captureAiGeneration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the generation id when persistence succeeds", async () => {
        const repository: AiGenerationRepository = {
            create: vi.fn().mockResolvedValue("generation-1"),
        };
        const { captureAiGeneration } = await import("./capture-ai-generation");

        const result = await captureAiGeneration({
            appName: "recruiter_app",
            surface: "question_generation",
            status: "success",
            inputSnapshot: { role: "Warehouse Associate" },
            promptVersion: "question-generation-v1",
            modelProvider: "gemini",
            modelName: "gemini-2.5-flash",
            latencyMs: 10,
            redactionStatus: "not_applicable",
        }, { repository });

        expect(result).toBe("generation-1");
        expect(repository.create).toHaveBeenCalledTimes(1);
    });

    it("logs and returns a fallback generation id when primary persistence fails", async () => {
        const repository: AiGenerationRepository = {
            create: vi.fn()
                .mockRejectedValueOnce(new Error("database unavailable"))
                .mockResolvedValueOnce("fallback-generation-1"),
        };
        const { captureAiGeneration } = await import("./capture-ai-generation");

        const result = await captureAiGeneration({
            appName: "recruiter_app",
            surface: "question_generation",
            status: "failed",
            inputSnapshot: { role: "Warehouse Associate" },
            promptVersion: "question-generation-v1",
            modelProvider: "gemini",
            modelName: "gemini-2.5-flash",
            latencyMs: 10,
            correlationId: "corr-1",
            redactionStatus: "not_applicable",
        }, { repository });

        expect(result).toBe("fallback-generation-1");
        expect(repository.create).toHaveBeenCalledTimes(2);
        expect(repository.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
            surface: "question_generation",
            status: "partial",
            inputSnapshot: expect.objectContaining({
                captureFallback: true,
                originalStatus: "failed",
            }),
            privacyFlags: ["capture_fallback"],
        }));
        expect(loggerWarnMock).toHaveBeenCalledWith(
            "[AIQuality] Failed to capture AI generation",
            expect.objectContaining({
                surface: "question_generation",
                status: "failed",
                correlationId: "corr-1",
            }),
            "AIQuality"
        );
    });

    it("returns null when both primary and fallback persistence fail", async () => {
        const repository: AiGenerationRepository = {
            create: vi.fn().mockRejectedValue(new Error("database unavailable")),
        };
        const { captureAiGeneration } = await import("./capture-ai-generation");

        const result = await captureAiGeneration({
            appName: "recruiter_app",
            surface: "question_generation",
            status: "failed",
            inputSnapshot: { role: "Warehouse Associate" },
            promptVersion: "question-generation-v1",
            modelProvider: "gemini",
            modelName: "gemini-2.5-flash",
            latencyMs: 10,
            correlationId: "corr-1",
            redactionStatus: "not_applicable",
        }, { repository });

        expect(result).toBeNull();
        expect(repository.create).toHaveBeenCalledTimes(2);
        expect(loggerWarnMock).toHaveBeenCalledWith(
            "[AIQuality] Failed to capture fallback AI generation",
            expect.objectContaining({
                surface: "question_generation",
                status: "failed",
                correlationId: "corr-1",
            }),
            "AIQuality"
        );
    });
});
