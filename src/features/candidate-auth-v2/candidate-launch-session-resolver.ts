import type { CandidateLaunchContext } from "./candidate-launch-context";
import type {
    CandidateHostLaunchHandoff,
    CandidateHostLaunchProvider,
    CandidateHostLaunchWorkspace,
} from "./host-launch-contract";

export type CandidateLaunchIdentityKey = {
    provider: CandidateHostLaunchProvider;
    issuer: string;
    subject: string;
    hostCandidateId: string | null;
    hostUserId: string | null;
    platformCandidateId: string;
    workspace: CandidateHostLaunchWorkspace;
};

export type CandidateLaunchProfileRecord = {
    candidateProfileId: string;
};

export type CandidateLaunchSessionRecord = {
    sessionId: string;
};

export type CandidateLaunchSessionContextSnapshot = {
    candidateId: string;
    jobCollectionId: string;
    sourceSurface: string;
    hostDomain: string | null;
};

export type CandidateLaunchSessionRepository = {
    findProfileByIdentity: (identity: CandidateLaunchIdentityKey) => Promise<CandidateLaunchProfileRecord | null>;
    createProfileFromLaunch: (input: {
        authSubject: string;
        workspace: CandidateHostLaunchWorkspace;
        email: string;
        displayName: string | null;
        platformCandidateId: string;
        platformUserId: string | null;
        companyId: string | null;
    }) => Promise<CandidateLaunchProfileRecord | null>;
    upsertIdentity: (input: {
        candidateProfileId: string;
        identity: CandidateLaunchIdentityKey;
        email: string;
        lastSeenAt: string;
    }) => Promise<void>;
    createSession: (input: {
        candidateProfileId: string;
        provider: CandidateHostLaunchProvider;
        issuer: string;
        subject: string;
        expiresAt: string;
        launchContext: CandidateLaunchSessionContextSnapshot;
    }) => Promise<CandidateLaunchSessionRecord | null>;
};

export type CandidateLaunchSessionResolverDependencies = {
    handoff: CandidateHostLaunchHandoff;
    launchContext: CandidateLaunchContext;
    launchedAt: string;
    expiresAt: string;
    repository: CandidateLaunchSessionRepository;
};

export type CandidateLaunchSessionResolutionFailureReason =
    | "identity_context_mismatch"
    | "profile_not_resolved"
    | "session_not_created";

export type CandidateLaunchSessionResolutionResult =
    | {
        ok: true;
        session: {
            candidateProfileId: string;
            sessionId: string;
        };
    }
    | {
        ok: false;
        reason: CandidateLaunchSessionResolutionFailureReason;
    };

export async function resolveCandidateLaunchSession(
    dependencies: CandidateLaunchSessionResolverDependencies,
): Promise<CandidateLaunchSessionResolutionResult> {
    const { handoff, launchContext, launchedAt, expiresAt, repository } = dependencies;
    if (hasIdentityContextMismatch(handoff, launchContext)) {
        return fail("identity_context_mismatch");
    }

    const identity = toIdentityKey(handoff, launchContext);
    let profile = await repository.findProfileByIdentity(identity);
    if (!profile) {
        profile = await repository.createProfileFromLaunch({
            authSubject: `${handoff.workspace}:${handoff.subject}`,
            workspace: handoff.workspace,
            email: firstNonEmpty(handoff.email, launchContext.candidate.email) ?? "",
            displayName: firstNonEmpty(handoff.displayName, launchContext.candidate.displayName),
            platformCandidateId: launchContext.candidate.candidateId,
            platformUserId: launchContext.candidate.userId,
            companyId: launchContext.candidate.companyId,
        });
        if (!profile) {
            return fail("profile_not_resolved");
        }

        await repository.upsertIdentity({
            candidateProfileId: profile.candidateProfileId,
            identity,
            email: firstNonEmpty(handoff.email, launchContext.candidate.email) ?? "",
            lastSeenAt: launchedAt,
        });
    }

    const session = await repository.createSession({
        candidateProfileId: profile.candidateProfileId,
        provider: handoff.provider,
        issuer: handoff.issuer,
        subject: handoff.subject,
        expiresAt,
        launchContext: toSessionContextSnapshot(launchContext),
    });
    if (!session) {
        return fail("session_not_created");
    }

    return {
        ok: true,
        session: {
            candidateProfileId: profile.candidateProfileId,
            sessionId: session.sessionId,
        },
    };
}

function toIdentityKey(
    handoff: CandidateHostLaunchHandoff,
    launchContext: CandidateLaunchContext,
): CandidateLaunchIdentityKey {
    return {
        provider: handoff.provider,
        issuer: handoff.issuer,
        subject: handoff.subject,
        hostCandidateId: handoff.externalIds.hostCandidateId,
        hostUserId: handoff.externalIds.hostUserId,
        platformCandidateId: launchContext.candidate.candidateId,
        workspace: handoff.workspace,
    };
}

function hasIdentityContextMismatch(
    handoff: CandidateHostLaunchHandoff,
    launchContext: CandidateLaunchContext,
) {
    const hostCandidateId = firstNonEmpty(
        handoff.externalIds.hostCandidateId,
        handoff.externalIds.rangamWorksId,
        handoff.externalIds.talentArborId,
    );

    return Boolean(hostCandidateId && hostCandidateId !== launchContext.candidate.candidateId);
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
    for (const value of values) {
        const normalized = value?.trim();
        if (normalized) {
            return normalized;
        }
    }

    return null;
}

function toSessionContextSnapshot(
    launchContext: CandidateLaunchContext,
): CandidateLaunchSessionContextSnapshot {
    return {
        candidateId: launchContext.candidate.candidateId,
        jobCollectionId: launchContext.job.jobCollectionId,
        sourceSurface: launchContext.source.sourceSurface,
        hostDomain: launchContext.source.hostDomain,
    };
}

function fail(reason: CandidateLaunchSessionResolutionFailureReason): CandidateLaunchSessionResolutionResult {
    return {
        ok: false,
        reason,
    };
}
