import { createHash } from "node:crypto";

import type { CreateCandidatePracticeIntentInput } from "./candidate-practice-intent-repository";

export const CANDIDATE_DIRECT_PRACTICE_INTENT_IDEMPOTENCY_HEADER = "Idempotency-Key";
export const CANDIDATE_DIRECT_PRACTICE_INTENT_REPLAY_WINDOW_MS = 24 * 60 * 60 * 1_000;

export function normalizeCandidateDirectPracticeIntentIdempotencyKey(value: string | null) {
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
export function hashCandidateDirectPracticeIntentIdempotencyKey(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createCandidateDirectPracticeIntentRequestFingerprint(
    input: CreateCandidatePracticeIntentInput,
) {
    return createHash("sha256")
        .update(JSON.stringify(canonicalize({
            source: input.source,
            roleProfileId: input.roleProfileId,
            targetInterviewId: input.targetInterviewId,
            targetRole: input.targetRole,
            setupContext: input.setupContext,
            items: input.items,
        })), "utf8")
        .digest("hex");
}

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }
    if (!value || typeof value !== "object") {
        return value;
    }
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => [key, canonicalize(child)]),
    );
}
