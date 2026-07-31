import { hashAppSessionToken } from "@/features/app-auth-v2/app-session";
import type { CandidatePostgresQueryClient } from "./candidate-postgres-runtime";
import { resolveCandidateDevHostLaunchCookieIdentity } from "./dev-host-launch-cookie-identity";
import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "./host-launch-route";

export const CANDIDATE_APP_SESSION_COOKIE = "ic_candidate_app_session";

export type CandidateRouteAccess =
    | {
        source: "app_account";
        candidateProfileId: string;
        appUserId: string;
    }
    | {
        source: "host_launch";
        candidateProfileId: string;
        candidateLaunchSessionId: string;
    }
    | {
        source: "dev_host_launch";
        candidateProfileId: string;
        candidateLaunchSessionId: string;
    };

export async function resolveCandidateRouteAccess(
    cookieHeader: string | null,
    client: CandidatePostgresQueryClient,
): Promise<CandidateRouteAccess | null> {
    const appSessionCookie = readCookie(cookieHeader, CANDIDATE_APP_SESSION_COOKIE);
    if (appSessionCookie.present) {
        return appSessionCookie.value
            ? resolveAppAccountAccess(appSessionCookie.value, client)
            : null;
    }

    const candidateLaunchSessionId = readCookie(
        cookieHeader,
        CANDIDATE_HOST_LAUNCH_SESSION_COOKIE,
    ).value;
    const devIdentity = resolveCandidateDevHostLaunchCookieIdentity(cookieHeader);
    if (devIdentity && candidateLaunchSessionId) {
        return {
            source: "dev_host_launch",
            candidateProfileId: devIdentity.candidateProfileId,
            candidateLaunchSessionId,
        };
    }

    if (!candidateLaunchSessionId) {
        return null;
    }

    const result = await client.query(`
        select session.candidate_profile_id
        from public.candidate_launch_sessions session
        join public.candidate_profiles profile
          on profile.candidate_profile_id = session.candidate_profile_id
         and profile.status = 'active'
         and profile.app_user_id is null
        where session.candidate_launch_session_id = $1
          and session.revoked_at is null
          and session.expires_at > now()
        limit 1
    `, [candidateLaunchSessionId]);
    const candidateProfileId = readString(result.rows[0]?.candidate_profile_id);

    return candidateProfileId
        ? {
            source: "host_launch",
            candidateProfileId,
            candidateLaunchSessionId,
        }
        : null;
}

async function resolveAppAccountAccess(
    sessionToken: string,
    client: CandidatePostgresQueryClient,
): Promise<CandidateRouteAccess | null> {
    const result = await client.query(`
        with valid_access as (
          select
            session.session_id,
            app_user.user_id,
            profile.candidate_profile_id
          from public.app_sessions session
          join public.app_users app_user
            on app_user.user_id = session.user_id
           and app_user.status = 'active'
           -- ponytail: email verification temporarily disabled for signup/login testing.
           -- Re-enable by uncommenting the line below once SMTP delivery is confirmed.
           -- and app_user.email_verified_at is not null
          join public.app_user_roles app_role
            on app_role.user_id = app_user.user_id
           and app_role.role = 'candidate'
          join public.candidate_profiles profile
            on profile.app_user_id = app_user.user_id
           and profile.workspace = 'interview_coach'
           and profile.status = 'active'
          where session.session_token_hash = $1
            and session.revoked_at is null
            and session.expires_at > now()
          limit 1
        ), touched_session as (
          update public.app_sessions session
          set last_seen_at = now()
          from valid_access access
          where session.session_id = access.session_id
            and (
              session.last_seen_at is null
              or session.last_seen_at < now() - interval '5 minutes'
            )
          returning session.session_id
        )
        select user_id, candidate_profile_id
        from valid_access
        limit 1
    `, [hashAppSessionToken(sessionToken)]);
    const appUserId = readString(result.rows[0]?.user_id);
    const candidateProfileId = readString(result.rows[0]?.candidate_profile_id);

    return appUserId && candidateProfileId
        ? {
            source: "app_account",
            appUserId,
            candidateProfileId,
        }
        : null;
}

function readCookie(
    cookieHeader: string | null,
    name: string,
): { present: boolean; value: string | null } {
    if (!cookieHeader) return { present: false, value: null };
    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));
    if (!cookie) return { present: false, value: null };
    const encodedValue = cookie.slice(name.length + 1);
    if (!encodedValue) return { present: true, value: null };

    try {
        return { present: true, value: decodeURIComponent(encodedValue) || null };
    } catch {
        return { present: true, value: null };
    }
}

function readString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}
