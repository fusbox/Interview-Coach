export type SessionId = string & { readonly __brand: "SessionId" };

export type SharedSessionAudience = "invited_candidate" | "candidate_owned";

export type SharedSessionCandidateIdentity = {
    firstName?: string;
    lastName?: string;
    email?: string;
};

export type SharedSessionInitialConfig = {
    role: string;
    jobDescription?: string;
    candidate?: SharedSessionCandidateIdentity;
};

export type CandidateSessionCompletionLinks = {
    dashboardHref: string;
    summaryHref?: string;
};

export type SessionCompletionTarget = {
    href: string;
    label: string;
    target: "candidate_dashboard" | "session_summary";
};

export type SharedSessionContext = {
    sessionId: SessionId;
    audience: SharedSessionAudience;
    candidateToken?: string;
    initialConfig?: SharedSessionInitialConfig;
    candidateCompletionLinks?: CandidateSessionCompletionLinks;
};

export function parseSessionId(value: unknown): SessionId {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error("Session id is required.");
    }

    return value.trim() as SessionId;
}

export function createCandidateSessionCompletionLinks(
    sessionId: SessionId,
    options: {
        dashboardHref?: string;
        summaryBaseHref?: string;
    } = {},
): CandidateSessionCompletionLinks {
    const dashboardHref = options.dashboardHref ?? "/candidate/dashboard";
    const summaryBaseHref = options.summaryBaseHref ?? "/summary2";

    return {
        dashboardHref,
        summaryHref: `${summaryBaseHref}/${encodeURIComponent(sessionId)}`,
    };
}

export function createSharedSessionContext(input: {
    sessionId: unknown;
    audience: SharedSessionAudience;
    candidateToken?: string;
    initialConfig?: SharedSessionInitialConfig;
    candidateCompletionLinks?: CandidateSessionCompletionLinks;
}): SharedSessionContext {
    const sessionId = parseSessionId(input.sessionId);

    return {
        sessionId,
        audience: input.audience,
        candidateToken: input.candidateToken,
        initialConfig: input.initialConfig,
        candidateCompletionLinks: input.candidateCompletionLinks,
    };
}

export function resolveSessionCompletionTarget(context: SharedSessionContext): SessionCompletionTarget {
    if (context.audience === "candidate_owned") {
        return {
            href: context.candidateCompletionLinks?.dashboardHref ?? "/candidate/dashboard",
            label: "Finish session",
            target: "candidate_dashboard",
        };
    }

    return {
        href:
            context.candidateCompletionLinks?.summaryHref ??
            createCandidateSessionCompletionLinks(context.sessionId).summaryHref ??
            "/summary2",
        label: "View summary",
        target: "session_summary",
    };
}
