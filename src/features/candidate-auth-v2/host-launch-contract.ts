export const CANDIDATE_HOST_LAUNCH_PRODUCT = "interview-coach";
export const CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT = "/candidate/dashboard";

const candidateLaunchRedirectAllowlist = new Set([
    "/candidate/dashboard",
    "/candidate/setup",
]);

export type CandidateHostLaunchWorkspace = "talentarbor" | "rangamworks";
export type CandidateHostLaunchProvider = "talentarbor_launch" | "rangamworks_launch";

export type CandidateHostLaunchTokenPayload = {
    issuer: string;
    subject: string;
    email: string;
    displayName?: string | null;
    workspace: CandidateHostLaunchWorkspace;
    product: string;
    expiresAt: string;
    issuedAt?: string | null;
    hostCandidateId?: string | null;
    hostUserId?: string | null;
    talentArborId?: string | null;
    rangamWorksId?: string | null;
    jobCollectionId?: string | null;
    hostDomain?: string | null;
    sourceSurface?: string | null;
};

export type CandidateHostLaunchHandoff = {
    provider: CandidateHostLaunchProvider;
    issuer: string;
    subject: string;
    email: string;
    displayName: string | null;
    workspace: CandidateHostLaunchWorkspace;
    externalIds: {
        hostCandidateId: string | null;
        hostUserId: string | null;
        talentArborId: string | null;
        rangamWorksId: string | null;
    };
    launchContextHint: {
        candidateId: string | null;
        jobCollectionId: string | null;
        hostDomain: string | null;
        sourceSurface: string;
    };
};

export type CandidateHostLaunchSession = {
    candidateProfileId: string;
    sessionId: string;
    expiresAt: string;
};

export type CandidateHostLaunchFailureReason =
    | "missing_token"
    | "invalid_signature"
    | "invalid_product"
    | "expired_token"
    | "invalid_identity";

export type CandidateHostLaunchResult =
    | {
        ok: true;
        redirectTo: string;
        session: CandidateHostLaunchSession;
    }
    | {
        ok: false;
        reason: CandidateHostLaunchFailureReason;
        redirectTo: string;
    };

export type CandidateHostLaunchDependencies = {
    token: string | null | undefined;
    now: Date;
    requestedRedirect?: string | null;
    verifyLaunchToken: (token: string) => Promise<CandidateHostLaunchTokenPayload | null>;
    resolveCandidateProfile: (handoff: CandidateHostLaunchHandoff, source: {
        expiresAt: string;
        issuedAt: string | null;
    }) => Promise<{
        candidateProfileId: string;
        sessionId: string;
    } | null>;
};

export async function createCandidateHostLaunchSession({
    token,
    now,
    requestedRedirect,
    verifyLaunchToken,
    resolveCandidateProfile,
}: CandidateHostLaunchDependencies): Promise<CandidateHostLaunchResult> {
    const normalizedToken = token?.trim();
    const redirectTo = normalizeCandidateLaunchRedirect(requestedRedirect);

    if (!normalizedToken) {
        return failCandidateLaunch("missing_token");
    }

    const payload = await verifyLaunchToken(normalizedToken);
    if (!payload) {
        return failCandidateLaunch("invalid_signature");
    }

    if (payload.product !== CANDIDATE_HOST_LAUNCH_PRODUCT) {
        return failCandidateLaunch("invalid_product");
    }

    if (isExpired(payload.expiresAt, now)) {
        return failCandidateLaunch("expired_token");
    }

    const handoff = toCandidateHostLaunchHandoff(payload);
    if (!handoff) {
        return failCandidateLaunch("invalid_identity");
    }

    const session = await resolveCandidateProfile(handoff, {
        expiresAt: payload.expiresAt,
        issuedAt: payload.issuedAt ?? null,
    });
    if (!session) {
        return failCandidateLaunch("invalid_identity");
    }

    return {
        ok: true,
        redirectTo,
        session: {
            candidateProfileId: session.candidateProfileId,
            sessionId: session.sessionId,
            expiresAt: payload.expiresAt,
        },
    };
}

export function normalizeCandidateLaunchRedirect(path: string | null | undefined) {
    if (!path || !candidateLaunchRedirectAllowlist.has(path)) {
        return CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT;
    }

    return path;
}

function toCandidateHostLaunchHandoff(payload: CandidateHostLaunchTokenPayload): CandidateHostLaunchHandoff | null {
    const email = payload.email.trim();
    const subject = payload.subject.trim();
    const issuer = payload.issuer.trim();

    if (!email || !subject || !issuer) {
        return null;
    }

    return {
        provider: payload.workspace === "rangamworks" ? "rangamworks_launch" : "talentarbor_launch",
        issuer,
        subject,
        email,
        displayName: payload.displayName?.trim() || null,
        workspace: payload.workspace,
        externalIds: {
            hostCandidateId: payload.hostCandidateId?.trim() || null,
            hostUserId: payload.hostUserId?.trim() || null,
            talentArborId: payload.talentArborId?.trim() || null,
            rangamWorksId: payload.rangamWorksId?.trim() || null,
        },
        launchContextHint: {
            candidateId: firstNonEmpty(payload.hostCandidateId, payload.talentArborId, payload.rangamWorksId),
            jobCollectionId: payload.jobCollectionId?.trim() || null,
            hostDomain: payload.hostDomain?.trim() || null,
            sourceSurface: payload.sourceSurface?.trim() || "UNKNOWN",
        },
    };
}

function isExpired(expiresAt: string, now: Date) {
    const expiresAtMs = Date.parse(expiresAt);
    return Number.isNaN(expiresAtMs) || expiresAtMs <= now.getTime();
}

function failCandidateLaunch(reason: CandidateHostLaunchFailureReason): CandidateHostLaunchResult {
    return {
        ok: false,
        reason,
        redirectTo: CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT,
    };
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
