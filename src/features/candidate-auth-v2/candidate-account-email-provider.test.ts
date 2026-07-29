import { describe, expect, it } from "vitest";

import {
    createCandidateAccountEmailProvider,
} from "./candidate-account-email-provider";

describe("candidate account email provider", () => {
    it("supports an explicit nonproduction fixture", async () => {
        const provider = createCandidateAccountEmailProvider({
            NODE_ENV: "development",
            CANDIDATE_ACCOUNT_EMAIL_PROVIDER: "fixture",
        });
        await expect(provider.sendVerification({
            recipientEmail: "sam@example.com",
            firstName: "Sam",
            verificationUrl: "http://localhost/verify",
        })).resolves.toEqual({
            providerReferenceId: expect.stringContaining("fixture-"),
        });
        await expect(provider.sendPasswordReset({
            recipientEmail: "sam@example.com",
            firstName: "Sam",
            resetUrl: "http://localhost/reset",
            expiresInMinutes: 30,
        })).resolves.toEqual({
            providerReferenceId: expect.stringContaining("fixture-"),
        });
    });

    it("fails closed when fixture is selected in production", async () => {
        const provider = createCandidateAccountEmailProvider({
            NODE_ENV: "production",
            CANDIDATE_ACCOUNT_EMAIL_PROVIDER: "fixture",
        });
        await expect(provider.sendVerification({
            recipientEmail: "sam@example.com",
            firstName: "Sam",
            verificationUrl: "https://example.com/verify",
        })).rejects.toEqual(expect.objectContaining({
            code: "fixture_not_allowed",
        }));
    });
});
