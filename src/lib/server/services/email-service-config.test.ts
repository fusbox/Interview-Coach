import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

vi.mock("resend", () => ({
    Resend: class {},
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("email service configuration", () => {
    it("allows local/test imports without RESEND_API_KEY", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "test",
        };
        delete process.env.RESEND_API_KEY;

        const { EmailService } = await import("./email-service");

        expect(EmailService).toBeDefined();
    });

    it("fails fast in production when RESEND_API_KEY is missing", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "production",
        };
        delete process.env.RESEND_API_KEY;

        await expect(import("./email-service")).rejects.toThrow(
            "[ServerEnv] Missing required environment variable RESEND_API_KEY for email delivery configuration."
        );
    });
});
