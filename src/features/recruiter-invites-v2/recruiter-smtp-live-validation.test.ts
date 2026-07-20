import { describe, expect, it } from "vitest";

import {
    createRecruiterSmtpLiveValidationSummary,
    readRecruiterSmtpLiveValidationConfig,
    RECRUITER_SMTP_LIVE_ACKNOWLEDGEMENT,
} from "./recruiter-smtp-live-validation";

describe("recruiter SMTP live validation guard", () => {
    it("requires explicit real-email acknowledgement and one recipient", () => {
        const env = validEnv();
        delete env.RECRUITER_SMTP_LIVE_VALIDATION;
        expect(() => readRecruiterSmtpLiveValidationConfig(env)).toThrow(/acknowledge one real email/);

        const missingRecipient = validEnv();
        delete missingRecipient.RECRUITER_SMTP_LIVE_RECIPIENT;
        expect(() => readRecruiterSmtpLiveValidationConfig(missingRecipient)).toThrow(/approved test mailbox/);
    });

    it("rejects production, fixture delivery, unspecified bind origins, and incomplete secrets", () => {
        expect(() => readRecruiterSmtpLiveValidationConfig({ ...validEnv(), NODE_ENV: "production" })).toThrow(/production/);
        expect(() => readRecruiterSmtpLiveValidationConfig({
            ...validEnv(),
            RECRUITER_INVITATION_DELIVERY_PROVIDER: "fixture",
        })).toThrow(/smtp delivery provider/);
        expect(() => readRecruiterSmtpLiveValidationConfig({
            ...validEnv(),
            RECRUITER_SMTP_LIVE_APP_ORIGIN: "http://0.0.0.0:3000",
        })).toThrow(/usable HTTP/);
        expect(() => readRecruiterSmtpLiveValidationConfig({
            ...validEnv(),
            SMTP_PASSWORD: "",
        })).toThrow(/SMTP_PASSWORD/);
    });

    it("normalizes only the approved recipient and usable origin", () => {
        expect(readRecruiterSmtpLiveValidationConfig(validEnv())).toEqual({
            recipientEmail: "smtp-validator@example.com",
            appOrigin: "http://localhost:3000",
        });
    });

    it("emits a fixed metadata-only success summary", () => {
        const summary = createRecruiterSmtpLiveValidationSummary({
            validationRunId: "validation-run-1",
            attemptNumber: 1,
            handoffRecovered: true,
            dashboardRecovered: true,
            acceptedResendSuppressed: true,
            providerCallCount: 1,
            ownerFenceVerified: true,
            temporaryAggregateRemoved: true,
        });
        expect(summary).toEqual(expect.objectContaining({
            ok: true,
            provider: "smtp",
            providerAccepted: true,
            providerCallCount: 1,
        }));
        expect(JSON.stringify(summary)).not.toMatch(/smtp-validator|password|token|provider-reference|batchId|recipientId/);
    });
});

function validEnv(): Record<string, string> {
    return {
        NODE_ENV: "development",
        RECRUITER_SMTP_LIVE_VALIDATION: RECRUITER_SMTP_LIVE_ACKNOWLEDGEMENT,
        RECRUITER_SMTP_LIVE_RECIPIENT: " SMTP-VALIDATOR@example.com ",
        RECRUITER_SMTP_LIVE_APP_ORIGIN: "http://localhost:3000/",
        RECRUITER_INVITATION_DELIVERY_PROVIDER: "smtp",
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "587",
        SMTP_USERNAME: "smtp-user",
        SMTP_PASSWORD: "smtp-password",
        SMTP_FROM_EMAIL: "Interview Coach <interviews@example.com>",
        ENCRYPTION_SECRET: "12345678901234567890123456789012",
    };
}
