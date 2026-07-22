import {
    CANDIDATE_RESUME_DIRECT_PII_POLICY_VERSION,
    CANDIDATE_RESUME_TEXT_PROCESSING_POLICY_VERSION,
    processCandidateResumeText,
    type CandidateResumePiiRedactionCounts,
    type CandidateResumeTextSource,
} from "./candidate-resume-text-processing";

export type CandidateResumeTextArtifactQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export type CandidateResumeTextArtifact = {
    artifactId: string;
    candidateProfileId: string;
    roleProfileId: string | null;
    version: number;
    revision: number;
    source: CandidateResumeTextSource;
    candidateLabel: string;
    normalizedText: string;
    sourceFingerprint: string;
    normalizedTextFingerprint: string;
    processingPolicyVersion: string;
    piiPolicyVersion: string;
    piiRedactionCounts: CandidateResumePiiRedactionCounts;
    reviewState: "awaiting_review" | "accepted" | "replaced";
    createdAt: string;
    acceptedAt: string | null;
    originalRetained: false;
};

export type CandidateResumeArtifactAcceptResult = {
    outcome: "accepted" | "review_required";
    artifact: CandidateResumeTextArtifact;
};

export class CandidateResumeArtifactRepositoryError extends Error {
    readonly code: "NOT_FOUND" | "STALE_POLICY" | "STALE_REVISION" | "PERSISTENCE_FAILED";

    constructor(code: "NOT_FOUND" | "STALE_POLICY" | "STALE_REVISION" | "PERSISTENCE_FAILED") {
        super(code);
        this.name = "CandidateResumeArtifactRepositoryError";
        this.code = code;
    }
}

export function createCandidateResumeTextArtifactRepository(client: CandidateResumeTextArtifactQueryClient) {
    return {
        async createOrRecoverReviewArtifact(input: {
            candidateProfileId: string;
            source: CandidateResumeTextSource;
            text: unknown;
            candidateLabel?: string | null;
            sourceFingerprint?: string;
            now: Date;
        }): Promise<CandidateResumeTextArtifact> {
            const candidateProfileId = normalizeRequiredId(input.candidateProfileId);
            const identity = await readCandidateIdentity(client, candidateProfileId);
            if (!identity) {
                throw new CandidateResumeArtifactRepositoryError("NOT_FOUND");
            }
            const processed = processCandidateResumeText({
                source: input.source,
                text: input.text,
                candidateLabel: input.candidateLabel,
                knownIdentityAliases: [identity.displayName, identity.email],
                sourceFingerprint: input.sourceFingerprint,
            });

            for (let attempt = 0; attempt < 2; attempt += 1) {
                const result = await client.query(`
                    with next_version as (
                      select coalesce(max(version), 0) + 1 as version
                      from public.candidate_resume_processed_artifacts
                      where candidate_profile_id = $1::uuid
                    ), inserted as (
                      insert into public.candidate_resume_processed_artifacts (
                        candidate_profile_id,
                        version,
                        source,
                        candidate_label,
                        normalized_text,
                        source_fingerprint,
                        normalized_text_fingerprint,
                        processing_policy_version,
                        pii_policy_version,
                        pii_redaction_counts_json,
                        review_state,
                        original_retained,
                        created_at,
                        updated_at
                      )
                      select
                        $1::uuid,
                        next_version.version,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9::jsonb,
                        'awaiting_review',
                        false,
                        $10::timestamptz,
                        $10::timestamptz
                      from next_version
                      on conflict do nothing
                      returning *
                    )
                    select * from inserted
                    union all
                    select existing.*
                    from public.candidate_resume_processed_artifacts existing
                    where existing.candidate_profile_id = $1::uuid
                      and existing.source = $2
                      and existing.source_fingerprint = $5
                      and existing.processing_policy_version = $7
                      and existing.pii_policy_version = $8
                    limit 1
                `, [
                    candidateProfileId,
                    processed.source,
                    processed.candidateLabel,
                    processed.normalizedText,
                    processed.sourceFingerprint,
                    processed.normalizedTextFingerprint,
                    processed.processingPolicyVersion,
                    processed.piiPolicyVersion,
                    JSON.stringify(processed.piiRedactionCounts),
                    input.now.toISOString(),
                ]);
                const artifact = result.rows[0] ? toCandidateResumeTextArtifact(result.rows[0]) : null;
                if (artifact) {
                    return artifact;
                }
            }

            throw new CandidateResumeArtifactRepositoryError("PERSISTENCE_FAILED");
        },

        async acceptReview(input: {
            candidateProfileId: string;
            setupOwnerKey: string;
            artifactId: string;
            expectedVersion: number;
            expectedRevision: number;
            reviewedText: unknown;
            now: Date;
        }): Promise<CandidateResumeArtifactAcceptResult> {
            const candidateProfileId = normalizeRequiredId(input.candidateProfileId);
            const artifactId = normalizeRequiredId(input.artifactId);
            const current = await readOwnedArtifactWithIdentity(
                client,
                candidateProfileId,
                normalizeSetupOwnerKey(input.setupOwnerKey),
                artifactId,
            );
            if (!current) {
                throw new CandidateResumeArtifactRepositoryError("NOT_FOUND");
            }
            if (current.artifact.version !== input.expectedVersion || current.artifact.revision !== input.expectedRevision) {
                throw new CandidateResumeArtifactRepositoryError("STALE_REVISION");
            }
            if (
                current.artifact.processingPolicyVersion !== CANDIDATE_RESUME_TEXT_PROCESSING_POLICY_VERSION
                || current.artifact.piiPolicyVersion !== CANDIDATE_RESUME_DIRECT_PII_POLICY_VERSION
            ) {
                throw new CandidateResumeArtifactRepositoryError("STALE_POLICY");
            }

            const processed = processCandidateResumeText({
                source: current.artifact.source,
                text: input.reviewedText,
                candidateLabel: current.artifact.candidateLabel,
                knownIdentityAliases: [current.displayName, current.email],
            });

            if (current.artifact.reviewState === "accepted") {
                if (processed.normalizedTextFingerprint !== current.artifact.normalizedTextFingerprint) {
                    throw new CandidateResumeArtifactRepositoryError("STALE_REVISION");
                }
                return { outcome: "accepted", artifact: current.artifact };
            }
            if (current.artifact.reviewState !== "awaiting_review") {
                throw new CandidateResumeArtifactRepositoryError("STALE_REVISION");
            }

            const nextState = processed.policyChangedText ? "awaiting_review" : "accepted";
            const nextCounts = mergeRedactionCounts(
                current.artifact.piiRedactionCounts,
                processed.piiRedactionCounts,
            );
            const result = await client.query(`
                update public.candidate_resume_processed_artifacts
                set normalized_text = $5,
                    normalized_text_fingerprint = $6,
                    pii_redaction_counts_json = $7::jsonb,
                    review_state = $8,
                    review_revision = review_revision + 1,
                    accepted_at = case when $8 = 'accepted' then $9::timestamptz else null end,
                    updated_at = $9::timestamptz
                where candidate_resume_artifact_id = $1::uuid
                  and candidate_profile_id = $2::uuid
                  and version = $3
                  and review_revision = $4
                  and review_state = 'awaiting_review'
                  and exists (
                    select 1
                    from public.candidate_setup_resume_selections selection
                    where selection.candidate_profile_id = $2::uuid
                      and selection.setup_owner_key = $10
                      and selection.candidate_resume_artifact_id = $1::uuid
                      and selection.lifecycle_state = 'active'
                  )
                returning *
            `, [
                artifactId,
                candidateProfileId,
                input.expectedVersion,
                input.expectedRevision,
                processed.normalizedText,
                processed.normalizedTextFingerprint,
                JSON.stringify(nextCounts),
                nextState,
                input.now.toISOString(),
                normalizeSetupOwnerKey(input.setupOwnerKey),
            ]);
            const updated = result.rows[0] ? toCandidateResumeTextArtifact(result.rows[0]) : null;
            if (!updated) {
                throw new CandidateResumeArtifactRepositoryError("STALE_REVISION");
            }

            return {
                outcome: nextState === "accepted" ? "accepted" : "review_required",
                artifact: updated,
            };
        },

        async resolveAcceptedArtifact(input: {
            candidateProfileId: string;
            artifactId: string;
            version: number;
            revision: number;
        }): Promise<CandidateResumeTextArtifact | null> {
            const result = await client.query(`
                select *
                from public.candidate_resume_processed_artifacts
                where candidate_resume_artifact_id = $1::uuid
                  and candidate_profile_id = $2::uuid
                  and version = $3
                  and review_revision = $4
                  and processing_policy_version = $5
                  and pii_policy_version = $6
                  and review_state = 'accepted'
                limit 1
            `, [
                normalizeRequiredId(input.artifactId),
                normalizeRequiredId(input.candidateProfileId),
                input.version,
                input.revision,
                CANDIDATE_RESUME_TEXT_PROCESSING_POLICY_VERSION,
                CANDIDATE_RESUME_DIRECT_PII_POLICY_VERSION,
            ]);
            return result.rows[0] ? toCandidateResumeTextArtifact(result.rows[0]) : null;
        },
    };
}

async function readCandidateIdentity(client: CandidateResumeTextArtifactQueryClient, candidateProfileId: string) {
    const result = await client.query(`
        select display_name, email
        from public.candidate_profiles
        where candidate_profile_id = $1::uuid
          and status = 'active'
        limit 1
    `, [candidateProfileId]);
    const row = result.rows[0];
    if (!row) {
        return null;
    }
    return {
        displayName: readOptionalString(row.display_name),
        email: readOptionalString(row.email),
    };
}

async function readOwnedArtifactWithIdentity(
    client: CandidateResumeTextArtifactQueryClient,
    candidateProfileId: string,
    setupOwnerKey: string,
    artifactId: string,
) {
    const result = await client.query(`
        select artifact.*, profile.display_name, profile.email
        from public.candidate_resume_processed_artifacts artifact
        join public.candidate_profiles profile
          on profile.candidate_profile_id = artifact.candidate_profile_id
        where artifact.candidate_resume_artifact_id = $1::uuid
          and artifact.candidate_profile_id = $2::uuid
          and profile.status = 'active'
          and exists (
            select 1
            from public.candidate_setup_resume_selections selection
            where selection.candidate_profile_id = artifact.candidate_profile_id
              and selection.setup_owner_key = $3
              and selection.candidate_resume_artifact_id = artifact.candidate_resume_artifact_id
              and selection.lifecycle_state = 'active'
          )
        limit 1
    `, [artifactId, candidateProfileId, setupOwnerKey]);
    const row = result.rows[0];
    return row
        ? {
            artifact: toCandidateResumeTextArtifact(row),
            displayName: readOptionalString(row.display_name),
            email: readOptionalString(row.email),
        }
        : null;
}

export function toCandidateResumeTextArtifact(row: Record<string, unknown>): CandidateResumeTextArtifact {
    return {
        artifactId: readRequiredString(row.candidate_resume_artifact_id),
        candidateProfileId: readRequiredString(row.candidate_profile_id),
        roleProfileId: readOptionalString(row.role_profile_id),
        version: readPositiveInteger(row.version),
        revision: readPositiveInteger(row.review_revision),
        source: readResumeTextSource(row.source),
        candidateLabel: readRequiredString(row.candidate_label),
        normalizedText: readRequiredString(row.normalized_text),
        sourceFingerprint: readRequiredString(row.source_fingerprint),
        normalizedTextFingerprint: readRequiredString(row.normalized_text_fingerprint),
        processingPolicyVersion: readRequiredString(row.processing_policy_version),
        piiPolicyVersion: readRequiredString(row.pii_policy_version),
        piiRedactionCounts: readRedactionCounts(row.pii_redaction_counts_json),
        reviewState: row.review_state === "accepted"
            ? "accepted"
            : row.review_state === "replaced"
                ? "replaced"
                : "awaiting_review",
        createdAt: readTimestamp(row.created_at),
        acceptedAt: row.accepted_at == null ? null : readTimestamp(row.accepted_at),
        originalRetained: false,
    };
}

function readResumeTextSource(value: unknown): CandidateResumeTextArtifact["source"] {
    if (
        value === "pasted_text"
        || value === "document_upload"
        || value === "photo_capture"
        || value === "trusted_host"
    ) {
        return value;
    }
    throw new CandidateResumeArtifactRepositoryError("PERSISTENCE_FAILED");
}

function readRedactionCounts(value: unknown): CandidateResumePiiRedactionCounts {
    const record = value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
    return {
        known_name: readBoundedCount(record.known_name),
        personal_detail: readBoundedCount(record.personal_detail),
        email: readBoundedCount(record.email),
        phone: readBoundedCount(record.phone),
        address: readBoundedCount(record.address),
        date_of_birth: readBoundedCount(record.date_of_birth),
        government_identifier: readBoundedCount(record.government_identifier),
        personal_url_or_handle: readBoundedCount(record.personal_url_or_handle),
    };
}

function mergeRedactionCounts(
    left: CandidateResumePiiRedactionCounts,
    right: CandidateResumePiiRedactionCounts,
): CandidateResumePiiRedactionCounts {
    return Object.fromEntries(Object.keys(left).map((key) => [
        key,
        Math.min(999, left[key as keyof CandidateResumePiiRedactionCounts] + right[key as keyof CandidateResumePiiRedactionCounts]),
    ])) as CandidateResumePiiRedactionCounts;
}

function normalizeRequiredId(value: string) {
    const normalized = value.trim();
    if (!normalized) {
        throw new CandidateResumeArtifactRepositoryError("NOT_FOUND");
    }
    return normalized;
}

function normalizeSetupOwnerKey(value: string) {
    const normalized = value.trim();
    if (!normalized || normalized.length > 320) {
        throw new CandidateResumeArtifactRepositoryError("NOT_FOUND");
    }
    return normalized;
}

function readRequiredString(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
        throw new CandidateResumeArtifactRepositoryError("PERSISTENCE_FAILED");
    }
    return value.trim();
}

function readOptionalString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPositiveInteger(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new CandidateResumeArtifactRepositoryError("PERSISTENCE_FAILED");
    }
    return parsed;
}

function readBoundedCount(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? Math.min(999, parsed) : 0;
}

function readTimestamp(value: unknown) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return readRequiredString(value);
}
