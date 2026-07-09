import { Pool } from "pg";

import {
    resolveCandidateLaunchContext,
    type CandidateLaunchContextLookupInput,
} from "./candidate-launch-context";
import { createCandidateLaunchSessionRepository } from "./candidate-launch-session-repository";
import { resolveCandidateLaunchSession } from "./candidate-launch-session-resolver";
import type { CandidateHostLaunchHandoff } from "./host-launch-contract";
import type { CandidateHostLaunchRouteDependencies } from "./host-launch-route";
import {
    createCandidateProductionHostLaunchVerifier,
    getCandidateProductionHostLaunchConfigStatus,
} from "./production-host-launch-verifier";

export const CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV = "DATABASE_URL";

type CandidateHostLaunchRuntimeEnv = Record<string, string | undefined>;

type LazyQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export function createCandidateProductionHostLaunchRouteDependencies({
    env = process.env,
    now,
}: {
    env?: CandidateHostLaunchRuntimeEnv;
    now: Date;
}): CandidateHostLaunchRouteDependencies | null {
    const verifierConfig = getCandidateProductionHostLaunchConfigStatus(env);
    const databaseUrl = env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();

    if (!verifierConfig.ok || !databaseUrl) {
        return null;
    }

    const verifyConfiguredToken = createCandidateProductionHostLaunchVerifier(env);
    const sessionRepository = createCandidateLaunchSessionRepository(createLazyPostgresQueryClient(databaseUrl));

    return {
        verifyLaunchToken(token) {
            return verifyConfiguredToken(token, now);
        },
        async resolveCandidateProfile(handoff, source) {
            const lookupInput = toLaunchContextLookupInput(handoff);
            if (!lookupInput) {
                return null;
            }

            const launchContext = await resolveCandidateLaunchContext({
                input: lookupInput,
                lookupLaunchContext: async () => null,
            });
            if (!launchContext.ok) {
                return null;
            }

            const session = await resolveCandidateLaunchSession({
                handoff,
                launchContext: launchContext.context,
                launchedAt: now.toISOString(),
                expiresAt: source.expiresAt,
                repository: sessionRepository,
            });

            return session.ok ? session.session : null;
        },
    };
}

function toLaunchContextLookupInput(
    handoff: CandidateHostLaunchHandoff,
): CandidateLaunchContextLookupInput | null {
    if (!handoff.launchContextHint.candidateId || !handoff.launchContextHint.jobCollectionId) {
        return null;
    }

    return {
        candidateId: handoff.launchContextHint.candidateId,
        jobCollectionId: handoff.launchContextHint.jobCollectionId,
        hostDomain: handoff.launchContextHint.hostDomain,
        sourceSurface: handoff.launchContextHint.sourceSurface,
    };
}

function createLazyPostgresQueryClient(databaseUrl: string): LazyQueryClient {
    let pool: Pool | null = null;

    return {
        query(sql, values) {
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-host-launch",
            });
            return pool.query(sql, values);
        },
    };
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
