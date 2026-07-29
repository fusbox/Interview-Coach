import { describe, expect, it, vi } from "vitest";

import { CandidateAccountEmailProviderError } from "./candidate-account-email-provider";
import {
    consumeCandidatePasswordReset,
    requestCandidatePasswordReset,
} from "./candidate-password-recovery-service";

const env = {
    NODE_ENV: "development",
    CANDIDATE_PASSWORD_RESET_TTL_SECONDS: "1800",
};

describe("candidate password recovery", () => {
    it("issues a hashed reset token and returns a fixture-only development URL", async () => {
        const repository = createRepository();
        const emailProvider = {
            name: "fixture",
            sendVerification: vi.fn(),
            sendPasswordReset: vi.fn().mockResolvedValue({ providerReferenceId: "fixture-1" }),
        };

        await expect(requestCandidatePasswordReset(
            " Sam@Example.com ",
            "http://localhost:3000",
            {
                repository,
                emailProvider,
                env,
                token: () => "raw-reset-token",
                now: () => new Date("2026-07-28T12:00:00.000Z"),
            },
        )).resolves.toEqual({
            outcome: "accepted",
            developmentResetUrl:
                "http://localhost:3000/candidate/reset-password?token=raw-reset-token",
        });
        expect(repository.issue).toHaveBeenCalledWith({
            email: "sam@example.com",
            tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
            expiresAt: "2026-07-28T12:30:00.000Z",
        });
        expect(repository.issue.mock.calls[0][0].tokenHash).not.toBe("raw-reset-token");
        expect(emailProvider.sendPasswordReset).toHaveBeenCalledWith(expect.objectContaining({
            expiresInMinutes: 30,
        }));
    });

    it("does not send or disclose an ignored or cooling-down account", async () => {
        const repository = createRepository();
        repository.issue.mockResolvedValue({ outcome: "ignored" });
        const emailProvider = {
            name: "fixture",
            sendVerification: vi.fn(),
            sendPasswordReset: vi.fn(),
        };

        await expect(requestCandidatePasswordReset(
            "sam@example.com",
            "http://localhost:3000",
            { repository, emailProvider, env },
        )).resolves.toEqual({ outcome: "accepted" });
        expect(emailProvider.sendPasswordReset).not.toHaveBeenCalled();
    });

    it("invalidates a reset credential whose delivery failed", async () => {
        const repository = createRepository();
        const emailProvider = {
            name: "smtp",
            sendVerification: vi.fn(),
            sendPasswordReset: vi.fn().mockRejectedValue(
                new CandidateAccountEmailProviderError("smtp_outcome_unknown", false),
            ),
        };

        await expect(requestCandidatePasswordReset(
            "sam@example.com",
            "http://localhost:3000",
            {
                repository,
                emailProvider,
                env,
                token: () => "raw-reset-token",
            },
        )).resolves.toEqual({ outcome: "delivery_failed" });
        expect(repository.invalidate).toHaveBeenCalledWith(
            expect.stringMatching(/^[0-9a-f]{64}$/),
        );
        expect(repository.recordEmailDelivery).toHaveBeenCalledWith(expect.objectContaining({
            outcome: "failed",
            reason: "smtp_outcome_unknown",
        }));
    });

    it("hashes the new password before atomically consuming reset state", async () => {
        const repository = createRepository();
        repository.consume.mockResolvedValue({
            outcome: "reset",
            userId: "user-1",
            revokedSessionCount: 2,
        });

        await expect(consumeCandidatePasswordReset(
            {
                token: "raw-reset-token",
                password: "new-candidate-password",
            },
            { ipAddress: "127.0.0.1", userAgent: "test" },
            {
                repository,
                hashPassword: vi.fn().mockResolvedValue("scrypt$new-hash"),
            },
        )).resolves.toEqual({
            outcome: "reset",
            userId: "user-1",
            revokedSessionCount: 2,
        });
        expect(repository.consume).toHaveBeenCalledWith({
            tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
            passwordHash: "scrypt$new-hash",
            ipAddress: "127.0.0.1",
            userAgent: "test",
        });
    });
});

function createRepository() {
    return {
        issue: vi.fn().mockResolvedValue({
            outcome: "issued",
            userId: "user-1",
            tokenId: "token-1",
            firstName: "Sam",
        }),
        invalidate: vi.fn().mockResolvedValue(undefined),
        consume: vi.fn(),
        recordEmailDelivery: vi.fn().mockResolvedValue(undefined),
    } as unknown as {
        issue: ReturnType<typeof vi.fn>;
        invalidate: ReturnType<typeof vi.fn>;
        consume: ReturnType<typeof vi.fn>;
        recordEmailDelivery: ReturnType<typeof vi.fn>;
    } & import("./candidate-password-recovery-repository").CandidatePasswordRecoveryRepository;
}
