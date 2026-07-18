import type { CandidateLaunchContext } from "./candidate-launch-context";
import type {
    CandidateHostLaunchHandoff,
    CandidateHostLaunchProvider,
    CandidateHostLaunchWorkspace,
} from "./host-launch-contract";
import {
    createCandidateTrustedSetupContext,
    type CandidateTrustedSetupContext,
} from "@/features/candidate-setup-v2/candidate-setup-entry-context";

export type CandidateLaunchEntryRoute = "/candidate/dashboard" | "/candidate/setup";

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
    platformCandidateId: string | null;
};

export type CandidateLaunchSessionCreationResult =
    | {
        ok: true;
        sessionId: string;
    }
    | {
        ok: false;
        reason: "replayed_token" | "session_not_created";
    };

export type CandidateLaunchSessionContextSnapshot = {
    candidateId: string;
    jobCollectionId: string | null;
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
    refreshProfileFromLaunch: (input: {
        candidateProfileId: string;
        authSubject: string;
        workspace: CandidateHostLaunchWorkspace;
        email: string;
        displayName: string | null;
        platformCandidateId: string;
    }) => Promise<CandidateLaunchProfileRecord | null>;
    upsertIdentity: (input: {
        candidateProfileId: string;
        identity: CandidateLaunchIdentityKey;
        email: string;
        lastSeenAt: string;
    }) => Promise<void>;
    hasPrepContexts: (candidateProfileId: string) => Promise<boolean>;
    createSession: (input: {
        candidateProfileId: string;
        provider: CandidateHostLaunchProvider;
        issuer: string;
        subject: string;
        launchTokenId: string | null;
        launchTokenFingerprint: string;
        launchTokenExpiresAt: string;
        expiresAt: string;
        launchContext: CandidateLaunchSessionContextSnapshot;
        trustedSetupContext: CandidateTrustedSetupContext | null;
    }) => Promise<CandidateLaunchSessionCreationResult>;
};

export type CandidateLaunchSessionResolverDependencies = {
    handoff: CandidateHostLaunchHandoff;
    launchContext: CandidateLaunchContext;
    launchedAt: string;
    sessionExpiresAt: string;
    launchTokenExpiresAt: string;
    launchTokenId: string | null;
    launchTokenFingerprint: string;
    repository: CandidateLaunchSessionRepository;
};

export type CandidateLaunchSessionResolutionFailureReason =
    | "identity_context_mismatch"
    | "profile_not_resolved"
    | "replayed_token"
    | "session_not_created";

export type CandidateLaunchSessionResolutionResult =
    | {
        ok: true;
        session: {
            candidateProfileId: string;
            sessionId: string;
            entryRoute: CandidateLaunchEntryRoute;
        };
    }
    | {
        ok: false;
        reason: CandidateLaunchSessionResolutionFailureReason;
    };

export async function resolveCandidateLaunchSession(
    dependencies: CandidateLaunchSessionResolverDependencies,
): Promise<CandidateLaunchSessionResolutionResult> {
    const {
        handoff,
        launchContext,
        launchedAt,
        sessionExpiresAt,
        launchTokenExpiresAt,
        launchTokenId,
        launchTokenFingerprint,
        repository,
    } = dependencies;
    if (hasIdentityContextMismatch(handoff, launchContext)) {
        return fail("identity_context_mismatch");
    }

    const identity = toIdentityKey(handoff, launchContext);
    const mappedProfile = await repository.findProfileByIdentity(identity);
    if (
        mappedProfile?.platformCandidateId
        && mappedProfile.platformCandidateId !== identity.platformCandidateId
    ) {
        return fail("identity_context_mismatch");
    }

    const email = firstNonEmpty(launchContext.candidate.email, handoff.email) ?? "";
    const profileInput = {
        authSubject: `${handoff.workspace}:${handoff.subject}`,
        workspace: handoff.workspace,
        email,
        displayName: firstNonEmpty(launchContext.candidate.displayName, handoff.displayName),
        platformCandidateId: launchContext.candidate.candidateId,
    };
    const profile = mappedProfile
        ? await repository.refreshProfileFromLaunch({
            candidateProfileId: mappedProfile.candidateProfileId,
            ...profileInput,
        })
        : await repository.createProfileFromLaunch({
            ...profileInput,
            platformUserId: launchContext.candidate.userId,
            companyId: launchContext.candidate.companyId,
        });
    if (!profile) {
        return fail(mappedProfile ? "identity_context_mismatch" : "profile_not_resolved");
    }
    if (mappedProfile && mappedProfile.candidateProfileId !== profile.candidateProfileId) {
        return fail("identity_context_mismatch");
    }

    await repository.upsertIdentity({
        candidateProfileId: profile.candidateProfileId,
        identity,
        email,
        lastSeenAt: launchedAt,
    });

    const trustedSetupContext = launchContext.job
        ? createCandidateTrustedSetupContext({
            workspace: handoff.workspace,
            launchContext,
        })
        : null;
    if (launchContext.job && !trustedSetupContext) {
        return fail("session_not_created");
    }
    const entryRoute: CandidateLaunchEntryRoute = trustedSetupContext
        ? "/candidate/setup"
        : await repository.hasPrepContexts(profile.candidateProfileId)
            ? "/candidate/dashboard"
            : "/candidate/setup";

    const session = await repository.createSession({
        candidateProfileId: profile.candidateProfileId,
        provider: handoff.provider,
        issuer: handoff.issuer,
        subject: handoff.subject,
        launchTokenId,
        launchTokenFingerprint,
        launchTokenExpiresAt,
        expiresAt: sessionExpiresAt,
        launchContext: toSessionContextSnapshot(launchContext),
        trustedSetupContext,
    });
    if (!session.ok) {
        return fail(session.reason);
    }

    return {
        ok: true,
        session: {
            candidateProfileId: profile.candidateProfileId,
            sessionId: session.sessionId,
            entryRoute,
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
        jobCollectionId: launchContext.job?.jobCollectionId ?? null,
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
