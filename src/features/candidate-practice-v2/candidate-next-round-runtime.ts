import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { createCandidatePracticeSessionRepository } from "@/features/candidate-session-v2/candidate-practice-session-repository";

import {
    loadCandidateNextRoundBuilder,
    mutateCandidateNextRoundBuilder,
    type CandidateNextRoundBuilderMutation,
} from "./candidate-next-round-builder-service";
import { launchCandidateNextRoundDraft } from "./candidate-next-round-draft-launch";
import { createCandidateNextRoundDraftLaunchRepository } from "./candidate-next-round-draft-launch-repository";
import { createCandidateNextRoundDraftRepository } from "./candidate-next-round-draft-repository";

export type CandidateNextRoundRuntimeQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export function createCandidateNextRoundRuntime(databaseUrl: string) {
    const queryClient = createLazyPostgresQueryClient(databaseUrl);
    const draftRepository = createCandidateNextRoundDraftRepository(queryClient);
    const practiceSessionRepository = createCandidatePracticeSessionRepository(queryClient);
    const launchRepository = createCandidateNextRoundDraftLaunchRepository(queryClient);

    return {
        queryClient,
        loadBuilder(input: { candidateProfileId: string; roleProfileId: string }) {
            return loadCandidateNextRoundBuilder({
                ...input,
                draftRepository,
                practiceSessionRepository,
            });
        },
        mutateBuilder(input: {
            candidateProfileId: string;
            roleProfileId: string;
            candidateNextRoundDraftId: string;
            expectedVersion: number;
            mutation: CandidateNextRoundBuilderMutation;
        }) {
            return mutateCandidateNextRoundBuilder({
                ...input,
                draftRepository,
                practiceSessionRepository,
            });
        },
        async launchBuilder(input: {
            candidateProfileId: string;
            roleProfileId: string;
            candidateNextRoundDraftId: string;
            expectedVersion: number;
        }) {
            const practiceSessions = await practiceSessionRepository.listPracticeSessionsForCandidateRoleProfile({
                candidateProfileId: input.candidateProfileId,
                roleProfileId: input.roleProfileId,
            });
            return launchCandidateNextRoundDraft({
                ...input,
                practiceSessions,
                draftRepository,
                launchRepository,
            });
        },
    };
}

export async function resolveCandidateNextRoundProfileId(
    cookieHeader: string | null,
    client: CandidateNextRoundRuntimeQueryClient,
) {
    const devIdentity = resolveCandidateDevHostLaunchCookieIdentity(cookieHeader);
    if (devIdentity) {
        return devIdentity.candidateProfileId;
    }

    const candidateLaunchSessionId = readCookieValue(cookieHeader, CANDIDATE_HOST_LAUNCH_SESSION_COOKIE);
    if (!candidateLaunchSessionId) {
        return null;
    }

    const result = await client.query(`
        select candidate_profile_id
        from public.candidate_launch_sessions
        where candidate_launch_session_id = $1
          and revoked_at is null
          and expires_at > now()
        limit 1
    `, [candidateLaunchSessionId]);

    return readString(result.rows[0]?.candidate_profile_id);
}

function createLazyPostgresQueryClient(databaseUrl: string): CandidateNextRoundRuntimeQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-next-round",
            });
            return pool.query(sql, values);
        },
    };
}

function readCookieValue(cookieHeader: string | null, name: string) {
    if (!cookieHeader) {
        return null;
    }

    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRuntimeSslConfig(databaseUrl: string) {
    const sslMode = readUrlSslMode(databaseUrl);
    if (sslMode === "disable") {
        return false;
    }
    if (sslMode) {
        return {
            rejectUnauthorized: sslMode === "verify-ca" || sslMode === "verify-full",
        };
    }
    return undefined;
}

function readUrlSslMode(databaseUrl: string) {
    try {
        return new URL(databaseUrl).searchParams.get("sslmode")?.toLowerCase() ?? null;
    } catch {
        return null;
    }
}
