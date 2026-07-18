import { describe, expect, it, vi } from "vitest";

import { createCandidateSetupStartRequestRepository } from "./candidate-setup-start-request-repository";

const keyHash = "a".repeat(64);
const requestFingerprint = "b".repeat(64);

describe("candidate setup start request repository", () => {
    it.each([
        ["acquired", null],
        ["in_progress", null],
        ["conflict", null],
        ["replayed", "11111111-1111-4111-8111-111111111111"],
    ] as const)("normalizes the %s claim outcome", async (claimOutcome, candidatePracticeSessionId) => {
        const query = vi.fn(async () => ({
            rows: [{
                claim_outcome: claimOutcome,
                idempotency_key_hash: keyHash,
                request_fingerprint: requestFingerprint,
                claim_generation: 2,
                candidate_practice_session_id: candidatePracticeSessionId,
            }],
        }));
        const repository = createCandidateSetupStartRequestRepository({ query });

        await expect(repository.claimSetupStart({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            idempotencyKeyHash: keyHash,
            requestFingerprint,
            claimedAt: "2026-07-18T12:00:00.000Z",
            claimExpiresAt: "2026-07-18T12:01:00.000Z",
            requestExpiresAt: "2026-07-19T12:00:00.000Z",
        })).resolves.toEqual({
            outcome: claimOutcome,
            idempotencyKeyHash: keyHash,
            requestFingerprint,
            claimGeneration: 2,
            ...(candidatePracticeSessionId ? { candidatePracticeSessionId } : {}),
        });
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("pg_advisory_xact_lock"),
            expect.any(Array),
        );
    });

    it("fails only the matching pending claim generation", async () => {
        const query = vi.fn(async () => ({
            rows: [{ candidate_setup_start_request_id: "11111111-1111-4111-8111-111111111111" }],
        }));
        const repository = createCandidateSetupStartRequestRepository({ query });

        await expect(repository.failSetupStart({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            idempotencyKeyHash: keyHash,
            requestFingerprint,
            claimGeneration: 2,
            failedAt: "2026-07-18T12:00:30.000Z",
            errorCode: "QUESTION_WORDING_PROVIDER_TIMEOUT",
        })).resolves.toBe(true);
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("and claim_generation = $4"),
            expect.arrayContaining([2, "QUESTION_WORDING_PROVIDER_TIMEOUT"]),
        );
    });
});
