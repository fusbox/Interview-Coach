import type { CandidateResumeTextArtifactQueryClient } from "./candidate-resume-text-artifact-repository";

export type CandidateResumeIngestionSource = "pasted_text" | "document_upload" | "photo_capture";

export type CandidateResumeIngestionClaimOutcome =
    | "acquired"
    | "replayed"
    | "in_progress"
    | "owner_busy"
    | "rate_limited"
    | "capacity_limited"
    | "ownership_conflict"
    | "generation_limit"
    | "terminal";

export type CandidateResumeIngestionTerminalReason =
    | "invalid_request"
    | "unsupported_type"
    | "too_large"
    | "unreadable_source"
    | "extraction_failed"
    | "empty_extraction"
    | "provider_unavailable"
    | "provider_rejected"
    | "disposal_failed"
    | "persistence_failed";

export type CandidateResumeIngestionSizeClass = "unknown" | "tiny" | "small" | "medium" | "large" | "maximum";
export type CandidateResumeIngestionLatencyClass = "under_1s" | "under_5s" | "under_15s" | "under_45s" | "over_45s";
export type CandidateResumeIngestionPageCountClass = "none" | "one" | "multiple";
export type CandidateResumeIngestionDiagnosticReason =
    | CandidateResumeIngestionTerminalReason
    | CandidateResumeIngestionClaimOutcome
    | "completed"
    | "completed_replay"
    | "replay_selection_missing"
    | "superseded"
    | "stale_claim";

export type CandidateResumeIngestionDiagnostic = {
    event: "candidate_resume_ingestion";
    source: CandidateResumeIngestionSource;
    outcome: "accepted" | "replayed" | "denied" | "failed" | "superseded";
    reason: CandidateResumeIngestionDiagnosticReason;
    statusCode: number;
    claimGeneration: number;
    durationMs: number;
    latencyClass: CandidateResumeIngestionLatencyClass;
    inputSizeClass: CandidateResumeIngestionSizeClass;
    pageCountClass: CandidateResumeIngestionPageCountClass;
};

export type CandidateResumeIngestionPolicy = {
    globalActiveLimit: number;
    recentOwnerLimit: number;
    recentWindowSeconds: number;
    leaseSeconds: number;
    generationLimit: number;
};

export const CANDIDATE_RESUME_INGESTION_POLICIES: Record<CandidateResumeIngestionSource, CandidateResumeIngestionPolicy> = {
    pasted_text: {
        globalActiveLimit: 32,
        recentOwnerLimit: 20,
        recentWindowSeconds: 10 * 60,
        leaseSeconds: 30,
        generationLimit: 3,
    },
    document_upload: {
        globalActiveLimit: 4,
        recentOwnerLimit: 8,
        recentWindowSeconds: 10 * 60,
        leaseSeconds: 120,
        generationLimit: 3,
    },
    photo_capture: {
        globalActiveLimit: 2,
        recentOwnerLimit: 6,
        recentWindowSeconds: 10 * 60,
        leaseSeconds: 60,
        generationLimit: 3,
    },
};

export function createCandidateResumeIngestionOperationRepository(client: CandidateResumeTextArtifactQueryClient) {
    return {
        async claimOperation(input: {
            operationId: string;
            candidateProfileId: string;
            setupOwnerKey: string;
            source: CandidateResumeIngestionSource;
            now: Date;
            policy?: CandidateResumeIngestionPolicy;
        }) {
            const policy = input.policy ?? CANDIDATE_RESUME_INGESTION_POLICIES[input.source];
            const claimExpiresAt = new Date(input.now.getTime() + policy.leaseSeconds * 1000);
            const result = await client.query(`
                select *
                from public.claim_candidate_resume_ingestion_operation(
                  $1::uuid, $2::uuid, $3, $4, $5::timestamptz, $6::timestamptz,
                  $7::integer, $8::integer, $9::integer, $10::integer
                )
            `, [
                normalizeRequired(input.operationId),
                normalizeRequired(input.candidateProfileId),
                normalizeOwnerKey(input.setupOwnerKey),
                input.source,
                input.now.toISOString(),
                claimExpiresAt.toISOString(),
                policy.globalActiveLimit,
                policy.recentOwnerLimit,
                policy.recentWindowSeconds,
                policy.generationLimit,
            ]);
            const row = result.rows[0];
            const outcome = readClaimOutcome(row?.claim_outcome);
            return {
                outcome,
                claimGeneration: readNonNegativeInteger(row?.claim_generation),
                artifactId: readOptionalString(row?.candidate_resume_artifact_id),
                claimExpiresAt: readOptionalIsoDate(row?.claim_expires_at),
            };
        },

        async completeOperationAndPublish(input: {
            operationId: string;
            candidateProfileId: string;
            setupOwnerKey: string;
            source: CandidateResumeIngestionSource;
            claimGeneration: number;
            artifactId: string;
            inputSizeClass: CandidateResumeIngestionSizeClass;
            pageCount: number;
            durationMs: number;
            now: Date;
        }) {
            const result = await client.query(`
                select public.complete_candidate_resume_ingestion_operation(
                  $1::uuid, $2::uuid, $3, $4, $5::integer, $6::uuid, $7, $8::integer, $9::integer, $10::timestamptz
                ) as outcome
            `, operationValues(input));
            return readCompletionOutcome(result.rows[0]?.outcome);
        },

        async failOperation(input: {
            operationId: string;
            candidateProfileId: string;
            setupOwnerKey: string;
            source: CandidateResumeIngestionSource;
            claimGeneration: number;
            terminalReason: CandidateResumeIngestionTerminalReason;
            inputSizeClass: CandidateResumeIngestionSizeClass;
            pageCount: number;
            durationMs: number;
            now: Date;
        }) {
            const result = await client.query(`
                select public.fail_candidate_resume_ingestion_operation(
                  $1::uuid, $2::uuid, $3, $4, $5::integer, $6, $7, $8::integer, $9::integer, $10::timestamptz
                ) as outcome
            `, [
                normalizeRequired(input.operationId),
                normalizeRequired(input.candidateProfileId),
                normalizeOwnerKey(input.setupOwnerKey),
                input.source,
                input.claimGeneration,
                input.terminalReason,
                input.inputSizeClass,
                normalizePageCount(input.pageCount),
                normalizeDuration(input.durationMs),
                input.now.toISOString(),
            ]);
            return readFailureOutcome(result.rows[0]?.outcome);
        },
    };
}

function operationValues(input: {
    operationId: string;
    candidateProfileId: string;
    setupOwnerKey: string;
    source: CandidateResumeIngestionSource;
    claimGeneration: number;
    artifactId: string;
    inputSizeClass: CandidateResumeIngestionSizeClass;
    pageCount: number;
    durationMs: number;
    now: Date;
}) {
    return [
        normalizeRequired(input.operationId),
        normalizeRequired(input.candidateProfileId),
        normalizeOwnerKey(input.setupOwnerKey),
        input.source,
        input.claimGeneration,
        normalizeRequired(input.artifactId),
        input.inputSizeClass,
        normalizePageCount(input.pageCount),
        normalizeDuration(input.durationMs),
        input.now.toISOString(),
    ];
}

export function classifyCandidateResumeInputSize(bytes: number): CandidateResumeIngestionSizeClass {
    if (!Number.isFinite(bytes) || bytes < 0) return "unknown";
    if (bytes <= 16 * 1024) return "tiny";
    if (bytes <= 128 * 1024) return "small";
    if (bytes <= 1024 * 1024) return "medium";
    if (bytes <= 5 * 1024 * 1024) return "large";
    return "maximum";
}

export function classifyCandidateResumeLatency(durationMs: number): CandidateResumeIngestionLatencyClass {
    if (durationMs < 1000) return "under_1s";
    if (durationMs < 5000) return "under_5s";
    if (durationMs < 15000) return "under_15s";
    if (durationMs < 45000) return "under_45s";
    return "over_45s";
}

export function classifyCandidateResumePageCount(pageCount: number): CandidateResumeIngestionPageCountClass {
    if (pageCount <= 0) return "none";
    if (pageCount === 1) return "one";
    return "multiple";
}

export function emitCandidateResumeIngestionDiagnostic(
    diagnostic: CandidateResumeIngestionDiagnostic,
    sink: ((event: CandidateResumeIngestionDiagnostic) => void) | undefined,
) {
    try {
        sink?.(diagnostic);
    } catch {
        // Diagnostics must never alter the candidate workflow.
    }
}

export function createCandidateResumeIngestionDiagnostic(input: Omit<
    CandidateResumeIngestionDiagnostic,
    "event" | "durationMs" | "latencyClass" | "pageCountClass"
> & { durationMs: number; pageCount: number }): CandidateResumeIngestionDiagnostic {
    const durationMs = normalizeDuration(input.durationMs);
    return {
        event: "candidate_resume_ingestion",
        source: input.source,
        outcome: input.outcome,
        reason: input.reason,
        statusCode: input.statusCode,
        claimGeneration: input.claimGeneration,
        durationMs,
        latencyClass: classifyCandidateResumeLatency(durationMs),
        inputSizeClass: input.inputSizeClass,
        pageCountClass: classifyCandidateResumePageCount(input.pageCount),
    };
}

function readClaimOutcome(value: unknown): CandidateResumeIngestionClaimOutcome {
    const valueString = readOptionalString(value);
    if (
        valueString === "acquired" || valueString === "replayed" || valueString === "in_progress"
        || valueString === "owner_busy" || valueString === "rate_limited" || valueString === "capacity_limited"
        || valueString === "ownership_conflict" || valueString === "generation_limit" || valueString === "terminal"
    ) return valueString;
    throw new Error("Invalid candidate resume ingestion claim outcome.");
}

function readCompletionOutcome(value: unknown) {
    const valueString = readOptionalString(value);
    if (valueString === "completed" || valueString === "replayed" || valueString === "superseded" || valueString === "stale_claim" || valueString === "ownership_conflict") {
        return valueString;
    }
    throw new Error("Invalid candidate resume ingestion completion outcome.");
}

function readFailureOutcome(value: unknown) {
    const valueString = readOptionalString(value);
    if (valueString === "failed" || valueString === "stale_claim" || valueString === "ownership_conflict") return valueString;
    throw new Error("Invalid candidate resume ingestion failure outcome.");
}

function normalizeRequired(value: string) {
    const normalized = value.trim();
    if (!normalized) throw new Error("Candidate resume ingestion identity is required.");
    return normalized;
}

function normalizeOwnerKey(value: string) {
    const normalized = value.trim();
    if (!normalized || normalized.length > 320) throw new Error("Candidate resume setup owner is invalid.");
    return normalized;
}

function normalizePageCount(value: number) {
    return Math.min(4, Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)));
}

function normalizeDuration(value: number) {
    return Math.min(300000, Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)));
}

function readNonNegativeInteger(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) throw new Error("Invalid candidate resume ingestion generation.");
    return parsed;
}

function readOptionalString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readOptionalIsoDate(value: unknown) {
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
    const normalized = readOptionalString(value);
    if (!normalized) return null;
    const parsed = new Date(normalized);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}
