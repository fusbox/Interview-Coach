import { createHash } from "crypto";

export const CANDIDATE_HOST_LAUNCH_PRODUCT = "interview-coach";
export const CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT = "/candidate/dashboard";
export const CANDIDATE_HOST_LAUNCH_MAX_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const CANDIDATE_HOST_LAUNCH_DEFAULT_SESSION_TTL_SECONDS =
    CANDIDATE_HOST_LAUNCH_MAX_SESSION_TTL_SECONDS;

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
    issuedAt: string;
    tokenId?: string | null;
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
    | "invalid_identity"
    | "replayed_token"
    | "invalid_session_policy";

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
        launchTokenExpiresAt: string;
        issuedAt: string;
        tokenId: string | null;
        tokenFingerprint: string;
        sessionExpiresAt: string;
    }) => Promise<
        | {
            ok: true;
            candidateProfileId: string;
            sessionId: string;
            entryRoute?: string;
        }
        | {
            ok: false;
            reason: "invalid_identity" | "replayed_token";
        }
    >;
    sessionTtlSeconds?: number;
};

export async function createCandidateHostLaunchSession({
    token,
    now,
    requestedRedirect,
    verifyLaunchToken,
    resolveCandidateProfile,
    sessionTtlSeconds = CANDIDATE_HOST_LAUNCH_DEFAULT_SESSION_TTL_SECONDS,
}: CandidateHostLaunchDependencies): Promise<CandidateHostLaunchResult> {
    const normalizedToken = token?.trim();
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

    if (
        !Number.isInteger(sessionTtlSeconds)
        || sessionTtlSeconds <= 0
        || sessionTtlSeconds > CANDIDATE_HOST_LAUNCH_MAX_SESSION_TTL_SECONDS
    ) {
        return failCandidateLaunch("invalid_session_policy");
    }

    const sessionExpiresAt = new Date(now.getTime() + sessionTtlSeconds * 1000).toISOString();
    const session = await resolveCandidateProfile(handoff, {
        launchTokenExpiresAt: payload.expiresAt,
        issuedAt: payload.issuedAt,
        tokenId: payload.tokenId?.trim() || null,
        tokenFingerprint: fingerprintLaunchToken(normalizedToken),
        sessionExpiresAt,
    });
    if (!session.ok) {
        return failCandidateLaunch(session.reason);
    }

    return {
        ok: true,
        redirectTo: normalizeCandidateLaunchRedirect(session.entryRoute ?? requestedRedirect),
        session: {
            candidateProfileId: session.candidateProfileId,
            sessionId: session.sessionId,
            expiresAt: sessionExpiresAt,
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

function fingerprintLaunchToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
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
