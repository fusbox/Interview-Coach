import { describe, expect, it, vi } from "vitest";

import { CandidatePasswordRecoveryRepository } from "./candidate-password-recovery-repository";

describe("candidate password recovery repository", () => {
    it("passes only password and token hashes into the transactional reset boundary", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{
                reset_outcome: "reset",
                reset_user_id: "candidate-user-1",
                revoked_session_count: "2",
            }],
        });
        const repository = new CandidatePasswordRecoveryRepository({ query });

        await expect(repository.consume({
            tokenHash: "a".repeat(64),
            passwordHash: "scrypt$password-hash",
            ipAddress: "127.0.0.1",
            userAgent: "test",
        })).resolves.toEqual({
            outcome: "reset",
            userId: "candidate-user-1",
            revokedSessionCount: 2,
        });
        expect(query.mock.calls[0][0]).toContain("consume_candidate_password_reset_v1");
        expect(query.mock.calls[0][1]).toEqual([
            "a".repeat(64),
            "scrypt$password-hash",
            "127.0.0.1",
            "test",
        ]);
    });

    it.each(["expired", "invalid"] as const)("maps the %s terminal outcome", async (outcome) => {
        const repository = new CandidatePasswordRecoveryRepository({
            query: vi.fn().mockResolvedValue({
                rows: [{ reset_outcome: outcome }],
            }),
        });

        await expect(repository.consume({
            tokenHash: "b".repeat(64),
            passwordHash: "scrypt$password-hash",
            ipAddress: null,
            userAgent: null,
        })).resolves.toEqual({ outcome });
    });
});
