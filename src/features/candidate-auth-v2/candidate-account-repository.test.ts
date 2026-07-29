import { describe, expect, it, vi } from "vitest";

import { CandidateAccountRepository } from "./candidate-account-repository";

describe("candidate account repository", () => {
    it("passes profile, consent, and hashed verification facts through one registration call", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{
                registration_outcome: "created",
                registered_user_id: "user-1",
                registered_candidate_profile_id: "profile-1",
                verification_token_id: "token-1",
            }],
        });
        const repository = new CandidateAccountRepository({ query });

        await expect(repository.register({
            email: "sam@example.com",
            passwordHash: "scrypt$hash",
            firstName: "Sam",
            lastName: "Rivera",
            phoneE164: "+13125550100",
            postalCode: "60601",
            contactPreferences: { email: true, sms: false, phone: false },
            contactAuthorization: true,
            termsVersion: "terms-v1",
            privacyVersion: "privacy-v1",
            cookieVersion: "cookie-v1",
            responsibleAiVersion: "ai-v1",
            contactAuthorizationVersion: "contact-v1",
            verificationTokenHash: "a".repeat(64),
            verificationExpiresAt: "2026-07-28T00:00:00.000Z",
            ipAddress: "127.0.0.1",
            userAgent: "test",
        })).resolves.toEqual({
            outcome: "created",
            userId: "user-1",
            candidateProfileId: "profile-1",
            tokenId: "token-1",
        });
        expect(query.mock.calls[0][0]).toContain("register_candidate_app_account_v2");
        expect(query.mock.calls[0][1]).toContain("https://talentarbor.com/cookie-policy");
        expect(query.mock.calls[0][1]).not.toContain("raw-verification-token");
    });

    it("maps non-disclosing duplicate and resend outcomes", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ registration_outcome: "exists" }] })
            .mockResolvedValueOnce({ rows: [{ issue_outcome: "cooldown" }] });
        const repository = new CandidateAccountRepository({ query });

        await expect(repository.register({
            email: "sam@example.com",
            passwordHash: "scrypt$hash",
            firstName: "Sam",
            lastName: "Rivera",
            phoneE164: "+13125550100",
            postalCode: "60601",
            contactPreferences: { email: false, sms: false, phone: false },
            contactAuthorization: false,
            termsVersion: "terms-v1",
            privacyVersion: "privacy-v1",
            cookieVersion: "cookie-v1",
            responsibleAiVersion: "ai-v1",
            contactAuthorizationVersion: "contact-v1",
            verificationTokenHash: "a".repeat(64),
            verificationExpiresAt: "2026-07-28T00:00:00.000Z",
            ipAddress: null,
            userAgent: null,
        })).resolves.toEqual({ outcome: "exists" });
        await expect(repository.issueVerification({
            email: "sam@example.com",
            tokenHash: "a".repeat(64),
            expiresAt: "2026-07-28T00:00:00.000Z",
        })).resolves.toEqual({ outcome: "cooldown" });
    });

    it("keeps consumed verification replay idempotent", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{
                verification_outcome: "already_verified",
                verified_user_id: "user-1",
            }],
        });
        const repository = new CandidateAccountRepository({ query });
        await expect(repository.consumeVerification("a".repeat(64))).resolves.toEqual({
            outcome: "already_verified",
            userId: "user-1",
        });
    });
});
