import { createHash } from "node:crypto";

import type { CandidateLaunchContext } from "@/features/candidate-auth-v2/candidate-launch-context";
import type { CandidateHostLaunchWorkspace } from "@/features/candidate-auth-v2/host-launch-contract";
import {
    CANDIDATE_SETUP_LIMITS,
    type CandidateSetupPayload,
} from "./candidate-setup-contract";

export type CandidateTrustedSetupContext = {
    sourcePlatform: CandidateHostLaunchWorkspace;
    jobCollectionId: string;
    requirementId: string | null;
    targetRole: string;
    jobDescription: string;
    jobDescriptionHash: string;
};

export type CandidateSetupEntryContext = {
    candidateProfileId: string;
    candidateLaunchSessionId: string;
    trustedSetupContext: CandidateTrustedSetupContext | null;
};

export type CandidateSetupEntryQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export function createCandidateSetupDraftOwnerKey(
    candidateProfileId: string,
    trustedSetupContext: CandidateTrustedSetupContext | null,
) {
    const candidateKey = `candidate:${candidateProfileId}`;
    return trustedSetupContext
        ? [
            candidateKey,
            "host",
            trustedSetupContext.sourcePlatform,
            trustedSetupContext.jobCollectionId,
        ].join(":")
        : candidateKey;
}

export function createCandidateTrustedSetupContext(input: {
    workspace: CandidateHostLaunchWorkspace;
    launchContext: CandidateLaunchContext;
}): CandidateTrustedSetupContext | null {
    const job = input.launchContext.job;
    if (!job) {
        return null;
    }

    if (
        job.title.length > CANDIDATE_SETUP_LIMITS.targetRole
        || job.description.length > CANDIDATE_SETUP_LIMITS.jobDescription
    ) {
        return null;
    }

    return {
        sourcePlatform: input.workspace,
        jobCollectionId: job.jobCollectionId,
        requirementId: job.requirementId,
        targetRole: job.title,
        jobDescription: job.description,
        jobDescriptionHash: hashJobDescription(job.description),
    };
}

export function createCandidateSetupEntryRepository(client: CandidateSetupEntryQueryClient) {
    return {
        async resolveLaunchEntry(candidateLaunchSessionId: string): Promise<CandidateSetupEntryContext | null> {
            const sessionId = normalizeRequiredString(candidateLaunchSessionId);
            if (!sessionId) {
                return null;
            }

            const result = await client.query(`
                select
                  launch.candidate_profile_id,
                  launch.job_collection_id as launch_job_collection_id,
                  launch.setup_context_consumed_at,
                  setup.source_platform,
                  setup.job_collection_id,
                  setup.requirement_id,
                  setup.target_role,
                  setup.job_description_snapshot,
                  setup.job_description_hash
                from public.candidate_launch_sessions launch
                left join public.candidate_launch_setup_contexts setup
                  on setup.candidate_launch_session_id = launch.candidate_launch_session_id
                 and setup.candidate_profile_id = launch.candidate_profile_id
                 and setup.expires_at > now()
                where launch.candidate_launch_session_id = $1
                  and launch.revoked_at is null
                  and launch.expires_at > now()
                limit 1
            `, [sessionId]);

            return toCandidateSetupEntryContext(result.rows[0], sessionId);
        },

        async consumeWithExistingPrepContext(input: {
            candidateProfileId: string;
            candidateLaunchSessionId: string;
            roleProfileId: string;
        }): Promise<boolean> {
            const result = await client.query(`
                with eligible_selection as (
                  select profile.role_profile_id
                  from public.candidate_launch_sessions launch
                  join public.candidate_launch_setup_contexts setup
                    on setup.candidate_launch_session_id = launch.candidate_launch_session_id
                   and setup.candidate_profile_id = launch.candidate_profile_id
                  join public.candidate_role_preparation_profiles profile
                    on profile.role_profile_id = $3
                   and profile.candidate_profile_id = launch.candidate_profile_id
                   and profile.source = 'host_platform'
                   and profile.source_platform = setup.source_platform
                   and profile.source_job_collection_id = setup.job_collection_id
                   and profile.status in ('active', 'paused')
                   and exists (
                     select 1
                     from public.candidate_practice_sessions practice
                     where practice.role_profile_id = profile.role_profile_id
                       and practice.candidate_profile_id = launch.candidate_profile_id
                   )
                  where launch.candidate_launch_session_id = $2
                    and launch.candidate_profile_id = $1
                    and launch.revoked_at is null
                    and launch.expires_at > now()
                    and launch.setup_context_consumed_at is null
                    and setup.expires_at > now()
                ), deleted_setup_context as (
                  delete from public.candidate_launch_setup_contexts setup
                  where setup.candidate_launch_session_id = $2
                    and setup.candidate_profile_id = $1
                    and exists (select 1 from eligible_selection)
                  returning setup.candidate_launch_session_id
                ), consumed_launch_session as (
                  update public.candidate_launch_sessions launch
                  set setup_context_consumed_at = now()
                  where launch.candidate_launch_session_id = $2
                    and launch.candidate_profile_id = $1
                    and launch.setup_context_consumed_at is null
                    and exists (select 1 from deleted_setup_context)
                  returning launch.candidate_launch_session_id
                )
                select role_profile_id
                from eligible_selection
                where exists (select 1 from consumed_launch_session)
            `, [
                input.candidateProfileId,
                input.candidateLaunchSessionId,
                input.roleProfileId,
            ]);

            return readString(result.rows[0]?.role_profile_id) === input.roleProfileId;
        },
    };
}

export function applyCandidateTrustedSetupContext(
    setupInput: CandidateSetupPayload,
    trustedSetupContext: CandidateTrustedSetupContext | null,
): CandidateSetupPayload | null {
    if (!trustedSetupContext) {
        return setupInput;
    }

    if (
        setupInput.targetRole !== trustedSetupContext.targetRole
        || hashJobDescription(setupInput.jobDescription) !== trustedSetupContext.jobDescriptionHash
    ) {
        return null;
    }

    return {
        ...setupInput,
        targetRole: trustedSetupContext.targetRole,
        jobDescription: trustedSetupContext.jobDescription,
    };
}

function toCandidateSetupEntryContext(
    row: Record<string, unknown> | undefined,
    candidateLaunchSessionId: string,
): CandidateSetupEntryContext | null {
    const candidateProfileId = readString(row?.candidate_profile_id);
    if (!candidateProfileId) {
        return null;
    }

    const launchJobCollectionId = readString(row?.launch_job_collection_id);
    const setupContextConsumedAt = readTimestamp(row?.setup_context_consumed_at);
    if (!launchJobCollectionId || setupContextConsumedAt) {
        return {
            candidateProfileId,
            candidateLaunchSessionId,
            trustedSetupContext: null,
        };
    }

    const sourcePlatform = readSourcePlatform(row?.source_platform);
    const jobCollectionId = readString(row?.job_collection_id);
    const targetRole = readString(row?.target_role);
    const jobDescription = readString(row?.job_description_snapshot);
    const jobDescriptionHash = readHash(row?.job_description_hash);
    if (
        !sourcePlatform
        || jobCollectionId !== launchJobCollectionId
        || !targetRole
        || !jobDescription
        || !jobDescriptionHash
        || hashJobDescription(jobDescription) !== jobDescriptionHash
    ) {
        return null;
    }

    return {
        candidateProfileId,
        candidateLaunchSessionId,
        trustedSetupContext: {
            sourcePlatform,
            jobCollectionId,
            requirementId: readString(row?.requirement_id),
            targetRole,
            jobDescription,
            jobDescriptionHash,
        },
    };
}

function hashJobDescription(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

function normalizeRequiredString(value: string) {
    const normalized = value.trim();
    return normalized || null;
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readHash(value: unknown) {
    const normalized = readString(value);
    return normalized && /^[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

function readTimestamp(value: unknown) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
    }
    const normalized = readString(value);
    return normalized && !Number.isNaN(Date.parse(normalized)) ? normalized : null;
}

function readSourcePlatform(value: unknown): CandidateHostLaunchWorkspace | null {
    return value === "talentarbor" || value === "rangamworks" ? value : null;
}
