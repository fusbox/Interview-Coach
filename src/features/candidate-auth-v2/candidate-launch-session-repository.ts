import type { CandidateLaunchSessionRepository } from "./candidate-launch-session-resolver";

export type CandidateLaunchSessionQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export function createCandidateLaunchSessionRepository(
    client: CandidateLaunchSessionQueryClient,
): CandidateLaunchSessionRepository {
    return {
        async findProfileByIdentity(identity) {
            const result = await client.query(`
                select i.candidate_profile_id, i.platform_candidate_id
                from public.candidate_identities i
                join public.candidate_profiles p
                  on p.candidate_profile_id = i.candidate_profile_id
                 and p.status = 'active'
                where i.provider = $1
                  and i.issuer = $2
                  and i.subject = $3
                limit 1
            `, [
                identity.provider,
                identity.issuer,
                identity.subject,
            ]);

            const candidateProfileId = readString(result.rows[0]?.candidate_profile_id);
            return candidateProfileId
                ? {
                    candidateProfileId,
                    platformCandidateId: readString(result.rows[0]?.platform_candidate_id),
                }
                : null;
        },

        async createProfileFromLaunch(input) {
            const result = await client.query(`
                insert into public.candidate_profiles (
                  auth_subject,
                  email,
                  display_name,
                  workspace
                )
                values ($1, $2, $3, $4)
                on conflict (auth_subject) do update
                  set email = excluded.email,
                      display_name = excluded.display_name,
                      workspace = excluded.workspace
                  where candidate_profiles.status = 'active'
                returning candidate_profile_id
            `, [
                input.authSubject,
                input.email,
                input.displayName,
                input.workspace,
            ]);

            const candidateProfileId = readString(result.rows[0]?.candidate_profile_id);
            return candidateProfileId
                ? {
                    candidateProfileId,
                    platformCandidateId: input.platformCandidateId,
                }
                : null;
        },

        async refreshProfileFromLaunch(input) {
            const result = await client.query(`
                update public.candidate_profiles
                set email = $3,
                    display_name = $4,
                    workspace = $5
                where candidate_profile_id = $1
                  and auth_subject = $2
                  and status = 'active'
                returning candidate_profile_id
            `, [
                input.candidateProfileId,
                input.authSubject,
                input.email,
                input.displayName,
                input.workspace,
            ]);

            const candidateProfileId = readString(result.rows[0]?.candidate_profile_id);
            return candidateProfileId
                ? {
                    candidateProfileId,
                    platformCandidateId: input.platformCandidateId,
                }
                : null;
        },

        async upsertIdentity(input) {
            await client.query(`
                insert into public.candidate_identities (
                  candidate_profile_id,
                  provider,
                  issuer,
                  subject,
                  email,
                  host_candidate_id,
                  host_user_id,
                  platform_candidate_id,
                  workspace,
                  last_seen_at
                )
                values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                on conflict (provider, issuer, subject) do update
                  set candidate_profile_id = excluded.candidate_profile_id,
                      email = excluded.email,
                      host_candidate_id = excluded.host_candidate_id,
                      host_user_id = excluded.host_user_id,
                      platform_candidate_id = excluded.platform_candidate_id,
                      workspace = excluded.workspace,
                      last_seen_at = excluded.last_seen_at
            `, [
                input.candidateProfileId,
                input.identity.provider,
                input.identity.issuer,
                input.identity.subject,
                input.email,
                input.identity.hostCandidateId,
                input.identity.hostUserId,
                input.identity.platformCandidateId,
                input.identity.workspace,
                input.lastSeenAt,
            ]);
        },

        async hasPrepContexts(candidateProfileId) {
            const result = await client.query(`
                select exists (
                  select 1
                  from public.candidate_role_preparation_profiles
                  where candidate_profile_id = $1
                    and status in ('active', 'paused')
                ) as has_prep_contexts
            `, [candidateProfileId]);

            return result.rows[0]?.has_prep_contexts === true;
        },

        async createSession(input) {
            const result = await client.query(`
                with inserted_session as (
                  insert into public.candidate_launch_sessions (
                    candidate_profile_id,
                    provider,
                    issuer,
                    subject,
                    launch_token_id,
                    launch_token_fingerprint,
                    launch_token_expires_at,
                    platform_candidate_id,
                    job_collection_id,
                    source_surface,
                    host_domain,
                    launch_context_snapshot_json,
                    expires_at
                  )
                  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
                  on conflict do nothing
                  returning candidate_launch_session_id, candidate_profile_id, expires_at
                ), inserted_setup_context as (
                  insert into public.candidate_launch_setup_contexts (
                    candidate_launch_session_id,
                    candidate_profile_id,
                    source_platform,
                    job_collection_id,
                    requirement_id,
                    target_role,
                    job_description_snapshot,
                    job_description_hash,
                    expires_at
                  )
                  select
                    session.candidate_launch_session_id,
                    session.candidate_profile_id,
                    $14,
                    $15,
                    $16,
                    $17,
                    $18,
                    $19,
                    session.expires_at
                  from inserted_session session
                  where $14::text is not null
                  returning candidate_launch_session_id
                )
                select session.candidate_launch_session_id
                from inserted_session session
                where $14::text is null
                   or exists (select 1 from inserted_setup_context)
            `, [
                input.candidateProfileId,
                input.provider,
                input.issuer,
                input.subject,
                input.launchTokenId,
                input.launchTokenFingerprint,
                input.launchTokenExpiresAt,
                input.launchContext.candidateId,
                input.launchContext.jobCollectionId,
                input.launchContext.sourceSurface,
                input.launchContext.hostDomain,
                input.launchContext,
                input.expiresAt,
                input.trustedSetupContext?.sourcePlatform ?? null,
                input.trustedSetupContext?.jobCollectionId ?? null,
                input.trustedSetupContext?.requirementId ?? null,
                input.trustedSetupContext?.targetRole ?? null,
                input.trustedSetupContext?.jobDescription ?? null,
                input.trustedSetupContext?.jobDescriptionHash ?? null,
            ]);

            const sessionId = readString(result.rows[0]?.candidate_launch_session_id);
            return sessionId
                ? { ok: true, sessionId }
                : { ok: false, reason: "replayed_token" };
        },
    };
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}
