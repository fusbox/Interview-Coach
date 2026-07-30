import {
    resolveCandidateLaunchContext,
    type CandidateLaunchContextLookupInput,
    type CandidateLaunchContextRow,
} from "./candidate-launch-context";
import {
    resolveCandidateLaunchSession,
    type CandidateLaunchSessionRepository,
} from "./candidate-launch-session-resolver";
import {
    createCandidateHostLaunchSession,
    type CandidateHostLaunchHandoff,
    type CandidateHostLaunchResult,
    type CandidateHostLaunchTokenPayload,
} from "./host-launch-contract";

export type CandidateHostLaunchOrchestrationDependencies = {
    token: string | null | undefined;
    now: Date;
    requestedRedirect?: string | null;
    sessionTtlSeconds?: number;
    verifyLaunchToken: (token: string) => Promise<CandidateHostLaunchTokenPayload | null>;
    lookupLaunchContext: (input: CandidateLaunchContextLookupInput) => Promise<CandidateLaunchContextRow>;
    sessionRepository: CandidateLaunchSessionRepository;
};

export async function createCandidateHostLaunchOrchestration(
    dependencies: CandidateHostLaunchOrchestrationDependencies,
): Promise<CandidateHostLaunchResult> {
    const {
        token,
        now,
        requestedRedirect,
        sessionTtlSeconds,
        verifyLaunchToken,
        lookupLaunchContext,
        sessionRepository,
    } = dependencies;

    return createCandidateHostLaunchSession({
        token,
        now,
        requestedRedirect,
        sessionTtlSeconds,
        verifyLaunchToken,
        async resolveCandidateProfile(handoff, source) {
            const input = toLaunchContextLookupInput(handoff);
            if (!input) {
                return { ok: false, reason: "invalid_identity" };
            }

            const launchContext = await resolveCandidateLaunchContext({
                input,
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
    });
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
