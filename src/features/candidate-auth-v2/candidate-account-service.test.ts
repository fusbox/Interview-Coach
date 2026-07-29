import { describe, expect, it, vi } from "vitest";

import type { CandidateRegistrationRequest } from "./candidate-account-contract";
import { CandidateAccountEmailProviderError } from "./candidate-account-email-provider";
import {
    consumeCandidateEmailVerification,
    registerCandidateAccount,
    resendCandidateEmailVerification,
} from "./candidate-account-service";

const registration: CandidateRegistrationRequest = {
    firstName: "Sam",
    lastName: "Rivera",
    email: "Sam@Example.com",
    password: "long-password",
    phone: "(312) 555-0100",
    postalCode: "60601",
    contactPreferences: { email: true, sms: false, phone: false },
    contactAuthorization: true,
    platformPolicyAccepted: true,
    responsibleAiAcknowledged: true,
};

const env = {
    NODE_ENV: "development",
    CANDIDATE_TERMS_VERSION: "terms-v1",
    CANDIDATE_PRIVACY_VERSION: "privacy-v1",
    CANDIDATE_COOKIE_VERSION: "cookie-v1",
    CANDIDATE_RESPONSIBLE_AI_VERSION: "ai-v1",
    CANDIDATE_CONTACT_AUTHORIZATION_VERSION: "contact-v1",
};

describe("candidate account service", () => {
    it("persists normalized identity before sending a verification link", async () => {
        const repository = createRepository();
        const emailProvider = {
            name: "fixture",
            sendVerification: vi.fn().mockResolvedValue({ providerReferenceId: "fixture-1" }),
            sendPasswordReset: vi.fn(),
        };

        await expect(registerCandidateAccount(
            registration,
            { ipAddress: "127.0.0.1", userAgent: "test" },
            "http://localhost:3000",
            {
                repository,
                emailProvider,
                env,
                token: () => "raw-verification-token",
                now: () => new Date("2026-07-27T12:00:00.000Z"),
                hashPassword: vi.fn().mockResolvedValue("scrypt$hash"),
            },
        )).resolves.toEqual({
            outcome: "accepted",
            developmentVerificationUrl:
                "http://localhost:3000/candidate/verify-email?token=raw-verification-token",
        });
        expect(repository.register).toHaveBeenCalledWith(expect.objectContaining({
            email: "sam@example.com",
            phoneE164: "+13125550100",
            passwordHash: "scrypt$hash",
            termsVersion: "terms-v1",
            cookieVersion: "cookie-v1",
        }));
        expect(emailProvider.sendVerification).toHaveBeenCalledWith(expect.objectContaining({
            recipientEmail: "sam@example.com",
        }));
    });

    it("does not send or reveal whether a duplicate registration exists", async () => {
        const repository = createRepository();
        repository.register.mockResolvedValue({ outcome: "exists" });
        const emailProvider = {
            name: "fixture",
            sendVerification: vi.fn(),
            sendPasswordReset: vi.fn(),
        };

        await expect(registerCandidateAccount(
            registration,
            { ipAddress: null, userAgent: null },
            "http://localhost:3000",
            {
                repository,
                emailProvider,
                env,
                hashPassword: vi.fn().mockResolvedValue("scrypt$hash"),
            },
        )).resolves.toEqual({ outcome: "accepted" });
        expect(emailProvider.sendVerification).not.toHaveBeenCalled();
    });

    it("invalidates the verification token when provider delivery fails", async () => {
        const repository = createRepository();
        const emailProvider = {
            name: "smtp",
            sendVerification: vi.fn().mockRejectedValue(
                new CandidateAccountEmailProviderError("smtp_outcome_unknown", false),
            ),
            sendPasswordReset: vi.fn(),
        };

        await expect(registerCandidateAccount(
            registration,
            { ipAddress: null, userAgent: null },
            "http://localhost:3000",
            {
                repository,
                emailProvider,
                env,
                token: () => "raw-verification-token",
                hashPassword: vi.fn().mockResolvedValue("scrypt$hash"),
            },
        )).resolves.toEqual({ outcome: "delivery_failed" });
        expect(repository.invalidateVerification).toHaveBeenCalled();
        expect(repository.recordEmailDelivery).toHaveBeenCalledWith(expect.objectContaining({
            outcome: "failed",
            reason: "smtp_outcome_unknown",
        }));
    });

    it("keeps resend cooldown and unknown accounts enumeration-safe", async () => {
        const repository = createRepository();
        repository.issueVerification.mockResolvedValue({ outcome: "cooldown" });
        const emailProvider = {
            name: "fixture",
            sendVerification: vi.fn(),
            sendPasswordReset: vi.fn(),
        };

        await expect(resendCandidateEmailVerification(
            "sam@example.com",
            "http://localhost:3000",
            { repository, emailProvider, env },
        )).resolves.toEqual({ outcome: "accepted" });
        expect(emailProvider.sendVerification).not.toHaveBeenCalled();
    });

    it("hashes the raw token before verification consumption", async () => {
        const repository = createRepository();
        repository.consumeVerification.mockResolvedValue({
            outcome: "verified",
            userId: "user-1",
        });
        await expect(consumeCandidateEmailVerification("raw-verification-token", { repository }))
            .resolves.toEqual({ outcome: "verified", userId: "user-1" });
        expect(repository.consumeVerification).toHaveBeenCalledWith(
            expect.stringMatching(/^[0-9a-f]{64}$/),
        );
        expect(repository.consumeVerification).not.toHaveBeenCalledWith("raw-verification-token");
    });
});

function createRepository() {
    return {
        register: vi.fn().mockResolvedValue({
            outcome: "created",
            userId: "user-1",
            candidateProfileId: "profile-1",
            tokenId: "token-1",
        }),
        issueVerification: vi.fn(),
        invalidateVerification: vi.fn().mockResolvedValue(undefined),
        consumeVerification: vi.fn(),
        recordEmailDelivery: vi.fn().mockResolvedValue(undefined),
    } as unknown as {
        register: ReturnType<typeof vi.fn>;
        issueVerification: ReturnType<typeof vi.fn>;
        invalidateVerification: ReturnType<typeof vi.fn>;
        consumeVerification: ReturnType<typeof vi.fn>;
        recordEmailDelivery: ReturnType<typeof vi.fn>;
    } & import("./candidate-account-repository").CandidateAccountRepository;
}
