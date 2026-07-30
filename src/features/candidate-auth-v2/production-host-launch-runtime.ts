import {
    resolveCandidateLaunchContext,
    type CandidateLaunchContext,
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
import { createCandidateResumeTextArtifactRepository } from "@/features/candidate-setup-v2/candidate-resume-text-artifact-repository";

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
    const queryClient = createCandidatePostgresQueryClient(databaseUrl);
    const sessionRepository = createCandidateLaunchSessionRepository(queryClient);
    const resumeRepository = createCandidateResumeTextArtifactRepository(queryClient);
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

            if (!session.ok) {
                return {
                    ok: false,
                    reason: session.reason === "replayed_token" ? "replayed_token" : "invalid_identity",
                };
            }

            await stageTrustedHostResume({
                candidateProfileId: session.session.candidateProfileId,
                launchContext: launchContext.context,
                resumeRepository,
                now,
            });

            return { ok: true, ...session.session };
        },
    };
}

async function stageTrustedHostResume({
    candidateProfileId,
    launchContext,
    resumeRepository,
    now,
}: {
    candidateProfileId: string;
    launchContext: CandidateLaunchContext;
    resumeRepository: ReturnType<typeof createCandidateResumeTextArtifactRepository>;
    now: Date;
}) {
    const resumePlainText = launchContext.resumePlainText?.trim();
    if (!resumePlainText) {
        return;
    }

    try {
        await resumeRepository.createOrRecoverReviewArtifact({
            candidateProfileId,
            source: "trusted_host",
            text: resumePlainText,
            candidateLabel: launchContext.candidate.displayName,
            now,
        });
    } catch {
        // Resume prefetch is best-effort and must never fail the launch exchange.
        console.warn("[candidate-host-launch] trusted-host resume staging skipped");
    }
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
        requirementId: handoff.launchContextHint.requirementId,
        talentChannelId: handoff.launchContextHint.talentChannelId,
        clientId: handoff.launchContextHint.clientId,
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
