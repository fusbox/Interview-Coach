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
                select candidate_profile_id
                from public.candidate_identities
                where provider = $1
                  and issuer = $2
                  and subject = $3
                  and platform_candidate_id = $4
                limit 1
            `, [
                identity.provider,
                identity.issuer,
                identity.subject,
                identity.platformCandidateId,
            ]);

            const candidateProfileId = readString(result.rows[0]?.candidate_profile_id);
            return candidateProfileId ? { candidateProfileId } : null;
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
                returning candidate_profile_id
            `, [
                input.authSubject,
                input.email,
                input.displayName,
                input.workspace,
            ]);

            const candidateProfileId = readString(result.rows[0]?.candidate_profile_id);
            return candidateProfileId ? { candidateProfileId } : null;
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

        async createSession(input) {
            const result = await client.query(`
                insert into public.candidate_launch_sessions (
                  candidate_profile_id,
                  provider,
                  issuer,
                  subject,
                  platform_candidate_id,
                  job_collection_id,
                  source_surface,
                  host_domain,
                  launch_context_snapshot_json,
                  expires_at
                )
                values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
                returning candidate_launch_session_id
            `, [
                input.candidateProfileId,
                input.provider,
                input.issuer,
                input.subject,
                input.launchContext.candidateId,
                input.launchContext.jobCollectionId,
                input.launchContext.sourceSurface,
                input.launchContext.hostDomain,
                input.launchContext,
                input.expiresAt,
            ]);

            const sessionId = readString(result.rows[0]?.candidate_launch_session_id);
            return sessionId ? { sessionId } : null;
        },
    };
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}
