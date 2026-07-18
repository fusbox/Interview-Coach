import { describe, expect, it } from "vitest";

import {
    CANDIDATE_SETUP_START_CLAIM_LEASE_MS,
    CANDIDATE_SETUP_START_REPLAY_WINDOW_MS,
    createCandidateSetupStartClaimTimes,
    createCandidateSetupStartRequestFingerprint,
    hashCandidateSetupStartIdempotencyKey,
    normalizeCandidateSetupStartIdempotencyKey,
} from "./candidate-setup-start-request";

const setup = {
    targetRole: "Warehouse lead",
    jobDescription: "Coordinate safety workflows.",
    resumeText: null,
    interviewStage: "first_interview" as const,
    questionCount: 7,
    resumeCaptureMode: "none" as const,
};

const prepContextAnchor = {
    requestedRoleProfileId: null,
    candidateLaunchSessionId: null,
    sourcePlatform: null,
    jobCollectionId: null,
    requirementId: null,
};

describe("candidate setup start request contract", () => {
    it("accepts bounded opaque keys and hashes them before persistence", () => {
        const key = "setup-request-1234567890";
        expect(normalizeCandidateSetupStartIdempotencyKey(` ${key} `)).toBe(key);
        expect(hashCandidateSetupStartIdempotencyKey(key)).toMatch(/^[a-f0-9]{64}$/);
        expect(normalizeCandidateSetupStartIdempotencyKey("short")).toBeNull();
        expect(normalizeCandidateSetupStartIdempotencyKey("setup request with spaces")).toBeNull();
    });

    it("keeps retries stable while distinguishing setup and explicit path decisions", () => {
        const base = createCandidateSetupStartRequestFingerprint({
            setup,
            setupEntryMode: null,
            prepContextAnchor,
            prepContextDecision: null,
        });
        expect(createCandidateSetupStartRequestFingerprint({
            setup: { ...setup },
            setupEntryMode: null,
            prepContextAnchor,
            prepContextDecision: null,
        })).toBe(base);
        expect(createCandidateSetupStartRequestFingerprint({
            setup: { ...setup, questionCount: 5 },
            setupEntryMode: null,
            prepContextAnchor,
            prepContextDecision: null,
        })).not.toBe(base);
        expect(createCandidateSetupStartRequestFingerprint({
            setup,
            setupEntryMode: null,
            prepContextAnchor,
            prepContextDecision: {
                action: "create_separate_path",
                matchingRoleProfileId: "33333333-3333-4333-8333-333333333333",
            },
        })).not.toBe(base);
        expect(createCandidateSetupStartRequestFingerprint({
            setup,
            setupEntryMode: "trusted_host_job",
            prepContextAnchor: {
                ...prepContextAnchor,
                candidateLaunchSessionId: "44444444-4444-4444-8444-444444444444",
                sourcePlatform: "talentarbor",
                jobCollectionId: "555",
            },
            prepContextDecision: null,
        })).not.toBe(base);
    });

    it("uses a one-minute claim lease inside a 24-hour replay window", () => {
        const now = new Date("2026-07-18T12:00:00.000Z");
        expect(createCandidateSetupStartClaimTimes(now)).toEqual({
            claimedAt: now.toISOString(),
            claimExpiresAt: new Date(now.getTime() + CANDIDATE_SETUP_START_CLAIM_LEASE_MS).toISOString(),
            requestExpiresAt: new Date(now.getTime() + CANDIDATE_SETUP_START_REPLAY_WINDOW_MS).toISOString(),
        });
    });
});
