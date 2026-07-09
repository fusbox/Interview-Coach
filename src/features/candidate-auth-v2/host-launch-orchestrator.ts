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
        verifyLaunchToken,
        lookupLaunchContext,
        sessionRepository,
    } = dependencies;

    return createCandidateHostLaunchSession({
        token,
        now,
        requestedRedirect,
        verifyLaunchToken,
        async resolveCandidateProfile(handoff, source) {
            const input = toLaunchContextLookupInput(handoff);
            if (!input) {
                return null;
            }

            const launchContext = await resolveCandidateLaunchContext({
                input,
                lookupLaunchContext,
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
    });
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
