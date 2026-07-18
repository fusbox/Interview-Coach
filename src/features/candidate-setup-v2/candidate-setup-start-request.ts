import { createHash } from "node:crypto";

import type { CandidateSetupPayload } from "./candidate-setup-contract";

export const CANDIDATE_SETUP_START_CLAIM_LEASE_MS = 60_000;
export const CANDIDATE_SETUP_START_REPLAY_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const CANDIDATE_SETUP_START_IDEMPOTENCY_HEADER = "Idempotency-Key";

export type CandidateSetupStartClaim = {
    idempotencyKeyHash: string;
    requestFingerprint: string;
    claimGeneration: number;
};

export type CandidateSetupStartClaimResult =
    | ({ outcome: "acquired" } & CandidateSetupStartClaim)
    | ({ outcome: "replayed"; candidatePracticeSessionId: string } & CandidateSetupStartClaim)
    | ({ outcome: "in_progress" } & CandidateSetupStartClaim)
    | ({ outcome: "conflict" } & CandidateSetupStartClaim);

export type CandidateSetupStartRequestFingerprintInput = {
    setup: CandidateSetupPayload;
    setupEntryMode: "trusted_host_job" | null;
    prepContextAnchor: {
        requestedRoleProfileId: string | null;
        candidateLaunchSessionId: string | null;
        sourcePlatform: string | null;
        jobCollectionId: string | null;
        requirementId: string | null;
    };
    prepContextDecision: {
        action: "create_separate_path";
        matchingRoleProfileId: string;
    } | null;
};

export function normalizeCandidateSetupStartIdempotencyKey(value: string | null): string | null {
    const normalized = value?.trim() ?? "";
    if (
        normalized.length < 16
        || normalized.length > 128
        || !/^[A-Za-z0-9._:-]+$/.test(normalized)
    ) {
        return null;
    }
    return normalized;
}

export function hashCandidateSetupStartIdempotencyKey(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createCandidateSetupStartRequestFingerprint(
    input: CandidateSetupStartRequestFingerprintInput,
): string {
    const canonical = {
        setup: {
            targetRole: input.setup.targetRole,
            jobDescription: input.setup.jobDescription,
            resumeText: input.setup.resumeText,
            interviewStage: input.setup.interviewStage,
            questionCount: input.setup.questionCount,
            resumeCaptureMode: input.setup.resumeCaptureMode,
        },
        setupEntryMode: input.setupEntryMode,
        prepContextAnchor: input.prepContextAnchor,
        prepContextDecision: input.prepContextDecision,
    };

    return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

export function createCandidateSetupStartClaimTimes(now: Date) {
    return {
        claimedAt: now.toISOString(),
        claimExpiresAt: new Date(now.getTime() + CANDIDATE_SETUP_START_CLAIM_LEASE_MS).toISOString(),
        requestExpiresAt: new Date(now.getTime() + CANDIDATE_SETUP_START_REPLAY_WINDOW_MS).toISOString(),
    };
}
