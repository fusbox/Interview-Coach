import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

vi.mock("nodemailer", () => ({
    default: {
        createTransport: vi.fn(() => ({
            sendMail: vi.fn(),
        })),
    },
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
    it("allows local/test imports without SMTP credentials", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "test",
        };
        delete process.env.SMTP_USERNAME;
        delete process.env.SMTP_PASSWORD;

        const { EmailService } = await import("./email-service");

        expect(EmailService).toBeDefined();
    });

    it("fails fast in production when SMTP credentials are missing", async () => {
        process.env = {
            ...process.env,
            NODE_ENV: "production",
        };
        delete process.env.SMTP_USERNAME;
        delete process.env.SMTP_PASSWORD;

        await expect(import("./email-service")).rejects.toThrow(
            "[ServerEnv] Missing required environment variable SMTP_USERNAME for email delivery configuration."
        );
    });
});
