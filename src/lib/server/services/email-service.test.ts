import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderResponseError } from "@/lib/server/provider-errors";

const sendMailMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock("nodemailer", () => ({
    default: {
        createTransport: vi.fn(() => ({
            sendMail: sendMailMock
        }))
    }
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: loggerErrorMock
    }
}));

describe("EmailService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SMTP_USERNAME = "test-user";
        process.env.SMTP_PASSWORD = "test-pass";
    });

    it("throws a typed provider error when SMTP returns an invalid success payload", async () => {
        sendMailMock.mockResolvedValue({ envelope: { to: ["candidate@example.com"] } });
        const { EmailService } = await import("./email-service");

        await expect(
            EmailService.sendInviteEmail({
                recipientEmails: ["candidate@example.com"],
                recipientFirstName: "Cand",
                role: "QA Engineer",
                inviteLink: "https://example.com/s/token",
                recruiterName: "Recruiter"
            })
        ).rejects.toBeInstanceOf(ProviderResponseError);
        expect(loggerErrorMock).toHaveBeenCalledWith(
            "[EmailService] Failed to send invite email",
            expect.objectContaining({
                provider: "smtp",
                operation: "sendInviteEmail",
                providerErrorKind: "schema_validation",
                error: expect.any(ProviderResponseError)
            }),
            "EmailService"
        );
    });

    it("throws a typed provider error when SMTP rejects a recipient", async () => {
        sendMailMock.mockResolvedValue({
            messageId: "message-1",
            accepted: [],
            rejected: ["candidate@example.com"],
            response: "250 Ok"
        });
        const { EmailService } = await import("./email-service");

        await expect(
            EmailService.sendInviteEmail({
                recipientEmails: ["candidate@example.com"],
                recipientFirstName: "Cand",
                role: "QA Engineer",
                inviteLink: "https://example.com/s/token",
                recruiterName: "Recruiter"
            })
        ).rejects.toBeInstanceOf(ProviderResponseError);
        expect(loggerErrorMock).toHaveBeenCalledWith(
            "[EmailService] Failed to send invite email",
            expect.objectContaining({
                provider: "smtp",
                operation: "sendInviteEmail",
                providerErrorKind: "schema_validation",
                error: expect.any(ProviderResponseError)
            }),
            "EmailService"
        );
    });
});
