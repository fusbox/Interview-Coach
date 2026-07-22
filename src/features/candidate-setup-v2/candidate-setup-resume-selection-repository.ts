import {
    CANDIDATE_RESUME_DIRECT_PII_POLICY_VERSION,
    CANDIDATE_RESUME_TEXT_PROCESSING_POLICY_VERSION,
} from "./candidate-resume-text-processing";
import {
    toCandidateResumeTextArtifact,
    type CandidateResumeTextArtifact,
    type CandidateResumeTextArtifactQueryClient,
} from "./candidate-resume-text-artifact-repository";

export const CANDIDATE_RESUME_SELECTION_OPERATION_HEADER = "x-candidate-resume-selection-operation";

export class CandidateSetupResumeSelectionError extends Error {
    readonly code: "INVALID_OPERATION" | "STALE_OPERATION" | "PERSISTENCE_FAILED";

    constructor(code: "INVALID_OPERATION" | "STALE_OPERATION" | "PERSISTENCE_FAILED") {
        super(code);
        this.name = "CandidateSetupResumeSelectionError";
        this.code = code;
    }
}

export function createCandidateSetupResumeSelectionRepository(client: CandidateResumeTextArtifactQueryClient) {
    return {
        async beginSelectionOperation(input: {
            candidateProfileId: string;
            setupOwnerKey: string;
            operationId: string;
            now: Date;
        }) {
            const result = await client.query(`
                insert into public.candidate_setup_resume_selections (
                  candidate_profile_id,
                  setup_owner_key,
                  selection_revision,
                  pending_operation_id,
                  candidate_resume_artifact_id,
                  lifecycle_state,
                  consumed_role_profile_id,
                  consumed_candidate_practice_session_id,
                  consumed_at,
                  created_at,
                  updated_at
                ) values (
                  $1::uuid, $2, 1, $3::uuid, null, 'pending', null, null, null, $4::timestamptz, $4::timestamptz
                )
                on conflict (candidate_profile_id, setup_owner_key) do update
                set selection_revision = candidate_setup_resume_selections.selection_revision + 1,
                    pending_operation_id = excluded.pending_operation_id,
                    candidate_resume_artifact_id = null,
                    lifecycle_state = 'pending',
                    consumed_role_profile_id = null,
                    consumed_candidate_practice_session_id = null,
                    consumed_at = null,
                    updated_at = excluded.updated_at
                returning selection_revision
            `, [
                normalizeRequiredId(input.candidateProfileId),
                normalizeSetupOwnerKey(input.setupOwnerKey),
                normalizeOperationId(input.operationId),
                input.now.toISOString(),
            ]);
            const revision = readPositiveInteger(result.rows[0]?.selection_revision);
            if (!revision) throw new CandidateSetupResumeSelectionError("PERSISTENCE_FAILED");
            return { revision };
        },

        async finalizeSelectionOperation(input: {
            candidateProfileId: string;
            setupOwnerKey: string;
            operationId: string;
            artifactId: string;
            now: Date;
        }) {
            const result = await client.query(`
                update public.candidate_setup_resume_selections selection
                set pending_operation_id = null,
                    candidate_resume_artifact_id = $4::uuid,
                    lifecycle_state = 'active',
                    updated_at = $5::timestamptz
                where selection.candidate_profile_id = $1::uuid
                  and selection.setup_owner_key = $2
                  and selection.pending_operation_id = $3::uuid
                  and selection.lifecycle_state = 'pending'
                  and exists (
                    select 1
                    from public.candidate_resume_processed_artifacts artifact
                    where artifact.candidate_resume_artifact_id = $4::uuid
                      and artifact.candidate_profile_id = selection.candidate_profile_id
                      and artifact.review_state in ('awaiting_review', 'accepted')
                  )
                returning selection_revision
            `, [
                normalizeRequiredId(input.candidateProfileId),
                normalizeSetupOwnerKey(input.setupOwnerKey),
                normalizeOperationId(input.operationId),
                normalizeRequiredId(input.artifactId),
                input.now.toISOString(),
            ]);
            return Boolean(readPositiveInteger(result.rows[0]?.selection_revision));
        },

        async abandonSelectionOperation(input: {
            candidateProfileId: string;
            setupOwnerKey: string;
            operationId: string;
            now: Date;
        }) {
            const result = await client.query(`
                update public.candidate_setup_resume_selections
                set pending_operation_id = null,
                    candidate_resume_artifact_id = null,
                    lifecycle_state = 'cleared',
                    updated_at = $4::timestamptz
                where candidate_profile_id = $1::uuid
                  and setup_owner_key = $2
                  and pending_operation_id = $3::uuid
                  and lifecycle_state = 'pending'
                returning selection_revision
            `, [
                normalizeRequiredId(input.candidateProfileId),
                normalizeSetupOwnerKey(input.setupOwnerKey),
                normalizeOperationId(input.operationId),
                input.now.toISOString(),
            ]);
            return Boolean(readPositiveInteger(result.rows[0]?.selection_revision));
        },

        async clearSelection(input: {
            candidateProfileId: string;
            setupOwnerKey: string;
            now: Date;
        }) {
            const result = await client.query(`
                insert into public.candidate_setup_resume_selections (
                  candidate_profile_id,
                  setup_owner_key,
                  selection_revision,
                  pending_operation_id,
                  candidate_resume_artifact_id,
                  lifecycle_state,
                  consumed_role_profile_id,
                  consumed_candidate_practice_session_id,
                  consumed_at,
                  created_at,
                  updated_at
                ) values (
                  $1::uuid, $2, 1, null, null, 'cleared', null, null, null, $3::timestamptz, $3::timestamptz
                )
                on conflict (candidate_profile_id, setup_owner_key) do update
                set selection_revision = candidate_setup_resume_selections.selection_revision + 1,
                    pending_operation_id = null,
                    candidate_resume_artifact_id = null,
                    lifecycle_state = 'cleared',
                    consumed_role_profile_id = null,
                    consumed_candidate_practice_session_id = null,
                    consumed_at = null,
                    updated_at = excluded.updated_at
                returning selection_revision
            `, [
                normalizeRequiredId(input.candidateProfileId),
                normalizeSetupOwnerKey(input.setupOwnerKey),
                input.now.toISOString(),
            ]);
            const revision = readPositiveInteger(result.rows[0]?.selection_revision);
            if (!revision) throw new CandidateSetupResumeSelectionError("PERSISTENCE_FAILED");
            return { revision };
        },

        async recoverActiveSelection(input: {
            candidateProfileId: string;
            setupOwnerKey: string;
        }): Promise<CandidateResumeTextArtifact | null> {
            const result = await client.query(`
                select artifact.*
                from public.candidate_setup_resume_selections selection
                join public.candidate_resume_processed_artifacts artifact
                  on artifact.candidate_profile_id = selection.candidate_profile_id
                 and artifact.candidate_resume_artifact_id = selection.candidate_resume_artifact_id
                where selection.candidate_profile_id = $1::uuid
                  and selection.setup_owner_key = $2
                  and selection.lifecycle_state = 'active'
                  and artifact.review_state in ('awaiting_review', 'accepted')
                  and artifact.processing_policy_version = $3
                  and artifact.pii_policy_version = $4
                limit 1
            `, [
                normalizeRequiredId(input.candidateProfileId),
                normalizeSetupOwnerKey(input.setupOwnerKey),
                CANDIDATE_RESUME_TEXT_PROCESSING_POLICY_VERSION,
                CANDIDATE_RESUME_DIRECT_PII_POLICY_VERSION,
            ]);
            return result.rows[0] ? toCandidateResumeTextArtifact(result.rows[0]) : null;
        },

        async resolveAcceptedSelection(input: {
            candidateProfileId: string;
            setupOwnerKey: string;
            artifactId: string;
            version: number;
            revision: number;
        }): Promise<CandidateResumeTextArtifact | null> {
            const result = await client.query(`
                select artifact.*
                from public.candidate_setup_resume_selections selection
                join public.candidate_resume_processed_artifacts artifact
                  on artifact.candidate_profile_id = selection.candidate_profile_id
                 and artifact.candidate_resume_artifact_id = selection.candidate_resume_artifact_id
                where selection.candidate_profile_id = $1::uuid
                  and selection.setup_owner_key = $2
                  and selection.lifecycle_state = 'active'
                  and artifact.candidate_resume_artifact_id = $3::uuid
                  and artifact.version = $4
                  and artifact.review_revision = $5
                  and artifact.review_state = 'accepted'
                  and artifact.processing_policy_version = $6
                  and artifact.pii_policy_version = $7
                limit 1
            `, [
                normalizeRequiredId(input.candidateProfileId),
                normalizeSetupOwnerKey(input.setupOwnerKey),
                normalizeRequiredId(input.artifactId),
                input.version,
                input.revision,
                CANDIDATE_RESUME_TEXT_PROCESSING_POLICY_VERSION,
                CANDIDATE_RESUME_DIRECT_PII_POLICY_VERSION,
            ]);
            return result.rows[0] ? toCandidateResumeTextArtifact(result.rows[0]) : null;
        },
    };
}

export function readCandidateResumeSelectionOperationId(value: string | null) {
    if (!value) return null;
    try {
        return normalizeOperationId(value);
    } catch {
        return null;
    }
}

function normalizeOperationId(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
        throw new CandidateSetupResumeSelectionError("INVALID_OPERATION");
    }
    return normalized;
}

function normalizeRequiredId(value: string) {
    const normalized = value.trim();
    if (!normalized) throw new CandidateSetupResumeSelectionError("PERSISTENCE_FAILED");
    return normalized;
}

function normalizeSetupOwnerKey(value: string) {
    const normalized = value.trim();
    if (!normalized || normalized.length > 320) {
        throw new CandidateSetupResumeSelectionError("PERSISTENCE_FAILED");
    }
    return normalized;
}

function readPositiveInteger(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
