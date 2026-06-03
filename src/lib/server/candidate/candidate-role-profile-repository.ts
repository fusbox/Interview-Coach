import { createHash } from "node:crypto";

import type { QueryResultRow } from "pg";

import { queryPostgres } from "@/lib/server/db/postgres";

export type CandidateRoleProfileSource = "manual" | "host_platform" | "dev_seed";
export type CandidateRoleProfileStatus = "active" | "paused" | "archived";

export type CandidateRolePreparationProfile = {
    roleProfileId: string;
    candidateProfileId: string;
    targetRole: string;
    normalizedTargetRole: string;
    jobDescriptionSnapshot: string;
    jobDescriptionHash: string;
    resumeContextSnapshot: unknown | null;
    source: CandidateRoleProfileSource;
    status: CandidateRoleProfileStatus;
    lastPracticedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type ResolveCandidateRolePreparationProfileInput = {
    candidateProfileId: string;
    targetRole: string;
    jobDescription: string;
    resumeContext?: unknown | null;
    source?: CandidateRoleProfileSource;
};

type CandidateRolePreparationProfileRow = QueryResultRow & {
    role_profile_id: string;
    candidate_profile_id: string;
    target_role: string;
    normalized_target_role: string;
    job_description_snapshot: string;
    job_description_hash: string;
    resume_context_snapshot_json: unknown | null;
    source: CandidateRoleProfileSource;
    status: CandidateRoleProfileStatus;
    last_practiced_at: string | Date | null;
    created_at: string | Date;
    updated_at: string | Date;
};

const roleProfileSelect = `
    role_profile_id,
    candidate_profile_id,
    target_role,
    normalized_target_role,
    job_description_snapshot,
    job_description_hash,
    resume_context_snapshot_json,
    source,
    status,
    last_practiced_at,
    created_at,
    updated_at
`;

export async function resolveCandidateRolePreparationProfile(
    input: ResolveCandidateRolePreparationProfileInput,
): Promise<CandidateRolePreparationProfile> {
    const candidateProfileId = normalizeId(input.candidateProfileId, "Candidate profile ID");
    const targetRole = normalizeRequiredText(input.targetRole);
    const jobDescription = normalizeRequiredText(input.jobDescription);

    if (!targetRole || !jobDescription) {
        throw new Error("Candidate role profile requires target role and job description context.");
    }

    const normalizedTargetRole = normalizeLookupText(targetRole);
    const jobDescriptionHash = hashText(jobDescription);
    const source = input.source ?? "manual";
    const resumeContext = input.resumeContext ?? null;

    const result = await queryPostgres<CandidateRolePreparationProfileRow>(
        `
            with existing as (
                select ${roleProfileSelect}
                from public.candidate_role_preparation_profiles
                where candidate_profile_id = $1
                    and normalized_target_role = $3
                    and job_description_hash = $5
                    and status in ('active', 'paused')
                order by updated_at desc
                limit 1
            ),
            inserted as (
                insert into public.candidate_role_preparation_profiles (
                    candidate_profile_id,
                    target_role,
                    normalized_target_role,
                    job_description_snapshot,
                    job_description_hash,
                    resume_context_snapshot_json,
                    source
                )
                select $1, $2, $3, $4, $5, $6, $7
                where not exists (select 1 from existing)
                on conflict do nothing
                returning ${roleProfileSelect}
            )
            select ${roleProfileSelect} from inserted
            union all
            select ${roleProfileSelect} from existing
            limit 1
        `,
        [
            candidateProfileId,
            targetRole,
            normalizedTargetRole,
            jobDescription,
            jobDescriptionHash,
            resumeContext,
            source,
        ],
    );

    if (result.rows[0]) {
        return mapCandidateRolePreparationProfileRow(result.rows[0]);
    }

    const retryResult = await queryPostgres<CandidateRolePreparationProfileRow>(
        `
            select ${roleProfileSelect}
            from public.candidate_role_preparation_profiles
            where candidate_profile_id = $1
                and normalized_target_role = $2
                and job_description_hash = $3
                and status in ('active', 'paused')
            order by updated_at desc
            limit 1
        `,
        [candidateProfileId, normalizedTargetRole, jobDescriptionHash],
    );

    if (!retryResult.rows[0]) {
        throw new Error("Candidate role profile could not be resolved.");
    }

    return mapCandidateRolePreparationProfileRow(retryResult.rows[0]);
}

function normalizeId(value: string, fieldName: string) {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error(`${fieldName} is required.`);
    }
    return normalized;
}

function normalizeRequiredText(value: string) {
    return value.replace(/\s+/g, " ").trim();
}

function normalizeLookupText(value: string) {
    return normalizeRequiredText(value).toLowerCase();
}

function hashText(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

function mapCandidateRolePreparationProfileRow(row: CandidateRolePreparationProfileRow): CandidateRolePreparationProfile {
    return {
        roleProfileId: row.role_profile_id,
        candidateProfileId: row.candidate_profile_id,
        targetRole: row.target_role,
        normalizedTargetRole: row.normalized_target_role,
        jobDescriptionSnapshot: row.job_description_snapshot,
        jobDescriptionHash: row.job_description_hash,
        resumeContextSnapshot: row.resume_context_snapshot_json ?? null,
        source: row.source,
        status: row.status,
        lastPracticedAt: row.last_practiced_at ? new Date(row.last_practiced_at).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
    };
}
