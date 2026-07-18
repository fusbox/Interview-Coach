import {
    CANDIDATE_HOST_LAUNCH_REQUEST_ID_HEADER,
    CANDIDATE_HOST_LAUNCH_SESSION_COOKIE,
    CANDIDATE_HOST_LAUNCH_TOKEN_PARAM,
} from "./host-launch-route";

const MAX_LAUNCH_URL_LENGTH = 16_384;
const REQUEST_TIMEOUT_MS = 15_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CANDIDATE_HOST_LAUNCH_ACCEPTANCE_CASES = [
    "identity-new",
    "identity-returning",
    "job-owned",
    "replay-setup",
    "replay-dashboard",
    "expired",
    "wrong-product",
    "wrong-issuer",
    "wrong-source-portal",
    "unowned-job",
] as const;

export type CandidateHostLaunchAcceptanceCase = typeof CANDIDATE_HOST_LAUNCH_ACCEPTANCE_CASES[number];
export type CandidateHostLaunchCanonicalRoute = "setup" | "dashboard" | "other" | "none";

export type CandidateHostLaunchAcceptanceFailureCode =
    | "network_error"
    | "unexpected_status"
    | "missing_request_id"
    | "cache_control_not_no_store"
    | "referrer_policy_not_no_referrer"
    | "redirect_not_same_origin"
    | "redirect_contains_query"
    | "unexpected_entry_route"
    | "session_cookie_missing"
    | "session_cookie_present_on_rejection"
    | "session_cookie_missing_http_only"
    | "session_cookie_missing_same_site_lax"
    | "session_cookie_wrong_path"
    | "session_cookie_missing_expiry"
    | "session_cookie_missing_secure"
    | "destination_redirect_contains_token"
    | "destination_unreachable"
    | "replay_was_accepted"
    | "replay_request_id_reused";

export class CandidateHostLaunchAcceptanceInputError extends Error {
    constructor(public readonly code:
        | "invalid_case"
        | "invalid_launch_url"
        | "launch_url_too_long"
        | "https_required"
        | "invalid_launch_path"
        | "invalid_launch_query") {
        super(code);
        this.name = "CandidateHostLaunchAcceptanceInputError";
    }
}

export type CandidateHostLaunchAcceptanceReport = {
    schemaVersion: "candidate_host_launch_acceptance_v1";
    caseId: CandidateHostLaunchAcceptanceCase;
    target: {
        protocol: "https" | "http-local";
    };
    expectedOutcome: "accepted" | "rejected";
    requiresDiagnosticCorrelation: boolean;
    firstExchange: CandidateHostLaunchExchangeMetadata;
    destination: CandidateHostLaunchDestinationMetadata | null;
    replayExchange: CandidateHostLaunchExchangeMetadata | null;
    failures: CandidateHostLaunchAcceptanceFailureCode[];
    passed: boolean;
};

export type CandidateHostLaunchExchangeMetadata = {
    status: number | null;
    requestId: string | null;
    route: CandidateHostLaunchCanonicalRoute;
    sameOriginRedirect: boolean;
    redirectHasQuery: boolean;
    cacheControlNoStore: boolean;
    referrerPolicyNoReferrer: boolean;
    sessionCookie: {
        present: boolean;
        httpOnly: boolean;
        sameSiteLax: boolean;
        candidatePath: boolean;
        hasExpiry: boolean;
        secure: boolean;
    };
};

export type CandidateHostLaunchDestinationMetadata = {
    status: number | null;
    route: CandidateHostLaunchCanonicalRoute;
    redirectRoute: CandidateHostLaunchCanonicalRoute;
    redirectHasQuery: boolean;
    redirectContainsToken: boolean;
    reachable: boolean;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type AcceptanceCasePolicy = {
    expectedOutcome: "accepted" | "rejected";
    expectedRoute: CandidateHostLaunchCanonicalRoute;
    replay: boolean;
};

const casePolicies: Record<CandidateHostLaunchAcceptanceCase, AcceptanceCasePolicy> = {
    "identity-new": { expectedOutcome: "accepted", expectedRoute: "setup", replay: false },
    "identity-returning": { expectedOutcome: "accepted", expectedRoute: "dashboard", replay: false },
    "job-owned": { expectedOutcome: "accepted", expectedRoute: "setup", replay: false },
    "replay-setup": { expectedOutcome: "accepted", expectedRoute: "setup", replay: true },
    "replay-dashboard": { expectedOutcome: "accepted", expectedRoute: "dashboard", replay: true },
    expired: { expectedOutcome: "rejected", expectedRoute: "dashboard", replay: false },
    "wrong-product": { expectedOutcome: "rejected", expectedRoute: "dashboard", replay: false },
    "wrong-issuer": { expectedOutcome: "rejected", expectedRoute: "dashboard", replay: false },
    "wrong-source-portal": { expectedOutcome: "rejected", expectedRoute: "dashboard", replay: false },
    "unowned-job": { expectedOutcome: "rejected", expectedRoute: "dashboard", replay: false },
};

export async function inspectCandidateHostLaunchAcceptance({
    caseId,
    launchUrl,
    allowLocalHttp = false,
    fetchImpl = fetch,
}: {
    caseId: CandidateHostLaunchAcceptanceCase;
    launchUrl: string;
    allowLocalHttp?: boolean;
    fetchImpl?: FetchLike;
}): Promise<CandidateHostLaunchAcceptanceReport> {
    const policy = casePolicies[caseId];
    if (!policy) {
        throw new CandidateHostLaunchAcceptanceInputError("invalid_case");
    }

    const url = parseLaunchUrl(launchUrl, allowLocalHttp);
    const failures: CandidateHostLaunchAcceptanceFailureCode[] = [];
    const first = await inspectExchange(url, fetchImpl);
    assessExchange({
        exchange: first.metadata,
        expectedOutcome: policy.expectedOutcome,
        expectedRoute: policy.expectedRoute,
        requireSecure: url.protocol === "https:",
        failures,
    });

    let destination: CandidateHostLaunchDestinationMetadata | null = null;
    if (policy.expectedOutcome === "accepted" && first.cookieHeader && first.locationUrl) {
        destination = await inspectDestination(first.locationUrl, first.cookieHeader, fetchImpl);
        if (!destination.reachable) {
            failures.push("destination_unreachable");
        }
        if (destination.redirectContainsToken) {
            failures.push("destination_redirect_contains_token");
        }
    }

    let replayExchange: CandidateHostLaunchExchangeMetadata | null = null;
    if (policy.replay && first.metadata.sessionCookie.present) {
        const replay = await inspectExchange(url, fetchImpl);
        replayExchange = replay.metadata;
        if (replay.metadata.sessionCookie.present) {
            failures.push("replay_was_accepted");
        }
        if (replay.metadata.requestId && replay.metadata.requestId === first.metadata.requestId) {
            failures.push("replay_request_id_reused");
        }
        assessExchange({
            exchange: replay.metadata,
            expectedOutcome: "rejected",
            expectedRoute: "dashboard",
            requireSecure: url.protocol === "https:",
            failures,
            omitCookiePresentFailure: true,
        });
    }

    return {
        schemaVersion: "candidate_host_launch_acceptance_v1",
        caseId,
        target: {
            protocol: url.protocol === "https:" ? "https" : "http-local",
        },
        expectedOutcome: policy.expectedOutcome,
        requiresDiagnosticCorrelation: policy.expectedOutcome === "rejected" || policy.replay,
        firstExchange: first.metadata,
        destination,
        replayExchange,
        failures: Array.from(new Set(failures)),
        passed: failures.length === 0,
    };
}

export function isCandidateHostLaunchAcceptanceCase(
    value: string,
): value is CandidateHostLaunchAcceptanceCase {
    return CANDIDATE_HOST_LAUNCH_ACCEPTANCE_CASES.includes(value as CandidateHostLaunchAcceptanceCase);
}

function parseLaunchUrl(raw: string, allowLocalHttp: boolean) {
    const normalized = raw.trim();
    if (!normalized || normalized.length > MAX_LAUNCH_URL_LENGTH) {
        throw new CandidateHostLaunchAcceptanceInputError(
            normalized.length > MAX_LAUNCH_URL_LENGTH ? "launch_url_too_long" : "invalid_launch_url",
        );
    }

    let url: URL;
    try {
        url = new URL(normalized);
    } catch {
        throw new CandidateHostLaunchAcceptanceInputError("invalid_launch_url");
    }

    const isLocalHttp = url.protocol === "http:"
        && allowLocalHttp
        && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "0.0.0.0");
    if (url.protocol !== "https:" && !isLocalHttp) {
        throw new CandidateHostLaunchAcceptanceInputError("https_required");
    }
    if (url.username || url.password || url.hash) {
        throw new CandidateHostLaunchAcceptanceInputError("invalid_launch_url");
    }
    if (url.pathname !== "/candidate/launch") {
        throw new CandidateHostLaunchAcceptanceInputError("invalid_launch_path");
    }

    const queryKeys = Array.from(url.searchParams.keys());
    const tokens = url.searchParams.getAll(CANDIDATE_HOST_LAUNCH_TOKEN_PARAM);
    if (
        queryKeys.length !== 1
        || queryKeys[0] !== CANDIDATE_HOST_LAUNCH_TOKEN_PARAM
        || tokens.length !== 1
        || !tokens[0]?.trim()
    ) {
        throw new CandidateHostLaunchAcceptanceInputError("invalid_launch_query");
    }

    return url;
}

async function inspectExchange(url: URL, fetchImpl: FetchLike) {
    const response = await safeFetch(fetchImpl, url);
    if (!response) {
        return {
            metadata: emptyExchangeMetadata(),
            cookieHeader: null,
            locationUrl: null,
        };
    }

    const locationUrl = readSafeLocation(response.headers.get("location"), url);
    const cookieHeader = readSessionCookie(response.headers);
    const metadata: CandidateHostLaunchExchangeMetadata = {
        status: response.status,
        requestId: readRequestId(response.headers),
        route: locationUrl ? categorizeRoute(locationUrl.pathname) : "none",
        sameOriginRedirect: Boolean(locationUrl && locationUrl.origin === url.origin),
        redirectHasQuery: Boolean(locationUrl?.search),
        cacheControlNoStore: hasHeaderDirective(response.headers.get("cache-control"), "no-store"),
        referrerPolicyNoReferrer: response.headers.get("referrer-policy")?.trim().toLowerCase() === "no-referrer",
        sessionCookie: inspectSessionCookie(cookieHeader),
    };
    await discardResponseBody(response);

    return {
        metadata,
        cookieHeader: metadata.sessionCookie.present ? cookieHeader : null,
        locationUrl,
    };
}

async function inspectDestination(locationUrl: URL, cookieHeader: string, fetchImpl: FetchLike) {
    const response = await safeFetch(fetchImpl, locationUrl, {
        headers: {
            Cookie: cookieHeader.split(";", 1)[0],
        },
    });
    if (!response) {
        return emptyDestinationMetadata(locationUrl.pathname);
    }

    const nextLocation = readSafeLocation(response.headers.get("location"), locationUrl);
    const metadata: CandidateHostLaunchDestinationMetadata = {
        status: response.status,
        route: categorizeRoute(locationUrl.pathname),
        redirectRoute: nextLocation ? categorizeRoute(nextLocation.pathname) : "none",
        redirectHasQuery: Boolean(nextLocation?.search),
        redirectContainsToken: nextLocation?.searchParams.has(CANDIDATE_HOST_LAUNCH_TOKEN_PARAM) ?? false,
        reachable: response.status >= 200 && response.status < 400,
    };
    await discardResponseBody(response);
    return metadata;
}

function assessExchange({
    exchange,
    expectedOutcome,
    expectedRoute,
    requireSecure,
    failures,
    omitCookiePresentFailure = false,
}: {
    exchange: CandidateHostLaunchExchangeMetadata;
    expectedOutcome: "accepted" | "rejected";
    expectedRoute: CandidateHostLaunchCanonicalRoute;
    requireSecure: boolean;
    failures: CandidateHostLaunchAcceptanceFailureCode[];
    omitCookiePresentFailure?: boolean;
}) {
    if (exchange.status === null) {
        failures.push("network_error");
        return;
    }
    if (exchange.status !== 302) failures.push("unexpected_status");
    if (!exchange.requestId) failures.push("missing_request_id");
    if (!exchange.cacheControlNoStore) failures.push("cache_control_not_no_store");
    if (!exchange.referrerPolicyNoReferrer) failures.push("referrer_policy_not_no_referrer");
    if (!exchange.sameOriginRedirect) failures.push("redirect_not_same_origin");
    if (exchange.redirectHasQuery) failures.push("redirect_contains_query");
    if (exchange.route !== expectedRoute) failures.push("unexpected_entry_route");

    if (expectedOutcome === "rejected") {
        if (exchange.sessionCookie.present && !omitCookiePresentFailure) {
            failures.push("session_cookie_present_on_rejection");
        }
        return;
    }

    if (!exchange.sessionCookie.present) failures.push("session_cookie_missing");
    if (!exchange.sessionCookie.httpOnly) failures.push("session_cookie_missing_http_only");
    if (!exchange.sessionCookie.sameSiteLax) failures.push("session_cookie_missing_same_site_lax");
    if (!exchange.sessionCookie.candidatePath) failures.push("session_cookie_wrong_path");
    if (!exchange.sessionCookie.hasExpiry) failures.push("session_cookie_missing_expiry");
    if (requireSecure && !exchange.sessionCookie.secure) failures.push("session_cookie_missing_secure");
}

async function safeFetch(fetchImpl: FetchLike, input: URL, init: RequestInit = {}) {
    try {
        return await fetchImpl(input, {
            ...init,
            cache: "no-store",
            redirect: "manual",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch {
        return null;
    }
}

function readSafeLocation(value: string | null, base: URL) {
    if (!value) return null;
    try {
        return new URL(value, base);
    } catch {
        return null;
    }
}

function readRequestId(headers: Headers) {
    const value = headers.get(CANDIDATE_HOST_LAUNCH_REQUEST_ID_HEADER)?.trim();
    return value && UUID_PATTERN.test(value) ? value : null;
}

function readSessionCookie(headers: Headers) {
    const cookieHeaders = typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
        : [headers.get("set-cookie")].filter((value): value is string => Boolean(value));

    return cookieHeaders.find((value) => value.trim().startsWith(`${CANDIDATE_HOST_LAUNCH_SESSION_COOKIE}=`)) ?? null;
}

function inspectSessionCookie(value: string | null) {
    const attributes = value?.split(";").map((part) => part.trim().toLowerCase()) ?? [];
    return {
        present: Boolean(value),
        httpOnly: attributes.includes("httponly"),
        sameSiteLax: attributes.includes("samesite=lax"),
        candidatePath: attributes.includes("path=/candidate"),
        hasExpiry: attributes.some((attribute) => attribute.startsWith("expires=")),
        secure: attributes.includes("secure"),
    };
}

function categorizeRoute(pathname: string): CandidateHostLaunchCanonicalRoute {
    if (pathname === "/candidate/setup") return "setup";
    if (pathname === "/candidate/dashboard") return "dashboard";
    return "other";
}

function hasHeaderDirective(value: string | null, directive: string) {
    return value?.split(",").some((part) => part.trim().toLowerCase() === directive) ?? false;
}

async function discardResponseBody(response: Response) {
    try {
        await response.body?.cancel();
    } catch {
        // Body content is intentionally never read or reported.
    }
}

function emptyExchangeMetadata(): CandidateHostLaunchExchangeMetadata {
    return {
        status: null,
        requestId: null,
        route: "none",
        sameOriginRedirect: false,
        redirectHasQuery: false,
        cacheControlNoStore: false,
        referrerPolicyNoReferrer: false,
        sessionCookie: inspectSessionCookie(null),
    };
}

function emptyDestinationMetadata(pathname: string): CandidateHostLaunchDestinationMetadata {
    return {
        status: null,
        route: categorizeRoute(pathname),
        redirectRoute: "none",
        redirectHasQuery: false,
        redirectContainsToken: false,
        reachable: false,
    };
}
