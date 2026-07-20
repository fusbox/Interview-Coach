import { afterEach, describe, expect, it, vi } from "vitest";

const { sendMail, createTransport } = vi.hoisted(() => {
    const sendMail = vi.fn();
    return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});

vi.mock("nodemailer", () => ({ default: { createTransport } }));

import {
    createRecruiterInvitationDeliveryProvider,
    RecruiterInvitationProviderError,
} from "./recruiter-invitation-delivery-provider";

afterEach(() => vi.clearAllMocks());

describe("recruiter invitation delivery provider", () => {
    it("fails explicitly when no provider is configured", async () => {
        const provider = createRecruiterInvitationDeliveryProvider({ NODE_ENV: "development" });
        await expect(provider.send(sendInput())).rejects.toMatchObject({
            code: "provider_not_configured",
            outcomeKnown: true,
        });
    });

    it("keeps the fixture provider out of production", async () => {
        const provider = createRecruiterInvitationDeliveryProvider({
            NODE_ENV: "production",
            RECRUITER_INVITATION_DELIVERY_PROVIDER: "fixture",
        });
        await expect(provider.send(sendInput())).rejects.toBeInstanceOf(RecruiterInvitationProviderError);
    });

    it("sends one SMTP recipient with a stable attempt message id", async () => {
        sendMail.mockResolvedValue({
            messageId: "provider-message-1",
            accepted: ["irma@example.com"],
            rejected: [],
        });
        const provider = createRecruiterInvitationDeliveryProvider({
            NODE_ENV: "test",
            RECRUITER_INVITATION_DELIVERY_PROVIDER: "smtp",
            SMTP_USERNAME: "user",
            SMTP_PASSWORD: "secret",
            SMTP_FROM_EMAIL: "Interview Coach <interviews@coach.rangam.com>",
        });

        await expect(provider.send(sendInput())).resolves.toEqual({ providerReferenceId: "provider-message-1" });
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
            to: "irma@example.com",
            messageId: "<invite-attempt-1@coach.rangam.com>",
        }));
        expect(sendMail.mock.calls[0][0]).not.toHaveProperty("bcc");
        expect(sendMail.mock.calls[0][0]).not.toHaveProperty("cc");
    });

    it("classifies an indeterminate transport exception without making it retryable", async () => {
        sendMail.mockRejectedValue(Object.assign(new Error("socket closed"), { code: "ECONNRESET" }));
        const provider = createRecruiterInvitationDeliveryProvider({
            NODE_ENV: "test",
            RECRUITER_INVITATION_DELIVERY_PROVIDER: "smtp",
            SMTP_USERNAME: "user",
            SMTP_PASSWORD: "secret",
        });

        await expect(provider.send(sendInput())).rejects.toMatchObject({
            code: "smtp_outcome_unknown",
            retryable: false,
            outcomeKnown: false,
        });
    });
});

function sendInput() {
    return {
        attemptId: "attempt-1",
        recipientEmail: "irma@example.com",
        message: { subject: "Subject", text: "Text", html: "<p>Text</p>" },
    };
}
