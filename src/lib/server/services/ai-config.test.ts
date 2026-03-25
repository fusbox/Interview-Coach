import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

vi.mock("@/lib/logger", () => ({
    Logger: {
        warn: vi.fn(),
    },
}));

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("ai-config", () => {
    it("allows local/test imports without GEMINI_API_KEY", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "test",
        };
        delete process.env.GEMINI_API_KEY;

        const { ai } = await import("./ai-config");

        expect(ai).toBeNull();
    });

    it("fails fast in production when GEMINI_API_KEY is missing", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "production",
        };
        delete process.env.GEMINI_API_KEY;

        await expect(import("./ai-config")).rejects.toThrow(
            "[ServerEnv] Missing required environment variable GEMINI_API_KEY for AI service configuration."
        );
    });
});
