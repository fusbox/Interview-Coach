import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderResponseError } from "@/lib/server/provider-errors";

const sendMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock("resend", () => ({
    Resend: class {
        emails = {
            send: sendMock
        };
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
        process.env.RESEND_API_KEY = "test-key";
    });

    it("throws a typed provider error when Resend returns an invalid success payload", async () => {
        sendMock.mockResolvedValue({ data: { unexpected: "value" }, error: null });
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
                provider: "resend",
                operation: "sendInviteEmail",
                providerErrorKind: "schema_validation",
                error: expect.any(ProviderResponseError)
            }),
            "EmailService"
        );
    });
});
