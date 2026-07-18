import {
    resolveCandidateLaunchContext,
    type CandidateLaunchContextLookupInput,
} from "./candidate-launch-context";
import { createCandidateLaunchSessionRepository } from "./candidate-launch-session-repository";
import { resolveCandidateLaunchSession } from "./candidate-launch-session-resolver";
import type { CandidateHostLaunchHandoff } from "./host-launch-contract";
import {
    CANDIDATE_HOST_LAUNCH_DEFAULT_SESSION_TTL_SECONDS,
    CANDIDATE_HOST_LAUNCH_MAX_SESSION_TTL_SECONDS,
} from "./host-launch-contract";
import type { CandidateHostLaunchRouteDependencies } from "./host-launch-route";
import {
    createCandidateProductionHostLaunchVerifier,
    getCandidateProductionHostLaunchConfigStatus,
    type CandidateProductionHostLaunchTelemetryReason,
} from "./production-host-launch-verifier";
import {
    createTalentArborMssqlLaunchContextLookup,
    getTalentArborMssqlConfigStatus,
    type TalentArborLaunchContextLookup,
    type TalentArborMssqlConfig,
} from "./talentarbor-mssql-runtime";
import { createCandidatePostgresQueryClient } from "./candidate-postgres-runtime";

export const CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV = "DATABASE_URL";
export const CANDIDATE_HOST_LAUNCH_SESSION_TTL_SECONDS_ENV = "CANDIDATE_HOST_LAUNCH_SESSION_TTL_SECONDS";

type CandidateHostLaunchRuntimeEnv = Record<string, string | undefined>;

export function createCandidateProductionHostLaunchRouteDependencies({
    env = process.env,
    now,
    createTalentArborLookup = createDefaultTalentArborLookup,
    onVerificationDiagnostic,
}: {
    env?: CandidateHostLaunchRuntimeEnv;
    now: Date;
    createTalentArborLookup?: (config: TalentArborMssqlConfig) => TalentArborLaunchContextLookup;
    onVerificationDiagnostic?: (reason: CandidateProductionHostLaunchTelemetryReason) => void;
}): CandidateHostLaunchRouteDependencies | null {
    const verifierConfig = getCandidateProductionHostLaunchConfigStatus(env);
    const talentArborConfig = getTalentArborMssqlConfigStatus(env);
    const databaseUrl = env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    const sessionTtlSeconds = readSessionTtlSeconds(env[CANDIDATE_HOST_LAUNCH_SESSION_TTL_SECONDS_ENV]);

    if (
        !verifierConfig.ok
        || verifierConfig.expectedWorkspace !== "talentarbor"
        || !talentArborConfig.ok
        || !databaseUrl
        || sessionTtlSeconds === null
    ) {
        return null;
    }

    const verifyConfiguredToken = createCandidateProductionHostLaunchVerifier(env, {
        onDiagnostic: onVerificationDiagnostic,
    });
    const sessionRepository = createCandidateLaunchSessionRepository(createCandidatePostgresQueryClient(databaseUrl));
    const lookupLaunchContext = createTalentArborLookup(talentArborConfig.config);

    return {
        sessionTtlSeconds,
        verifyLaunchToken(token) {
            return verifyConfiguredToken(token, now);
        },
        async resolveCandidateProfile(handoff, source) {
            const lookupInput = toLaunchContextLookupInput(handoff);
            if (!lookupInput) {
                return { ok: false, reason: "invalid_identity" };
            }

            const launchContext = await resolveCandidateLaunchContext({
                input: lookupInput,
                lookupLaunchContext,
            });
            if (!launchContext.ok) {
                return { ok: false, reason: "invalid_identity" };
            }

            const session = await resolveCandidateLaunchSession({
                handoff,
                launchContext: launchContext.context,
                launchedAt: now.toISOString(),
                sessionExpiresAt: source.sessionExpiresAt,
                launchTokenExpiresAt: source.launchTokenExpiresAt,
                launchTokenId: source.tokenId,
                launchTokenFingerprint: source.tokenFingerprint,
                repository: sessionRepository,
            });

            return session.ok
                ? { ok: true, ...session.session }
                : {
                    ok: false,
                    reason: session.reason === "replayed_token" ? "replayed_token" : "invalid_identity",
                };
        },
    };
}

function createDefaultTalentArborLookup(config: TalentArborMssqlConfig) {
    return createTalentArborMssqlLaunchContextLookup({ config });
}

function toLaunchContextLookupInput(
    handoff: CandidateHostLaunchHandoff,
): CandidateLaunchContextLookupInput | null {
    if (!handoff.launchContextHint.candidateId) {
        return null;
    }

    return {
        candidateId: handoff.launchContextHint.candidateId,
        jobCollectionId: handoff.launchContextHint.jobCollectionId,
        hostDomain: handoff.launchContextHint.hostDomain,
        sourceSurface: handoff.launchContextHint.sourceSurface,
    };
}

function readSessionTtlSeconds(value: string | undefined) {
    if (value === undefined) {
        return CANDIDATE_HOST_LAUNCH_DEFAULT_SESSION_TTL_SECONDS;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= CANDIDATE_HOST_LAUNCH_MAX_SESSION_TTL_SECONDS
        ? parsed
        : null;
}
