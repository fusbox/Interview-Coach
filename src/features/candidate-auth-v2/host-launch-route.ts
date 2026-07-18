import { randomUUID } from "node:crypto";

import {
    createCandidateHostLaunchSession,
    type CandidateHostLaunchFailureReason,
    type CandidateHostLaunchDependencies,
} from "./host-launch-contract";

export const CANDIDATE_HOST_LAUNCH_TOKEN_PARAM = "token";
export const CANDIDATE_HOST_LAUNCH_NEXT_PARAM = "next";
export const CANDIDATE_HOST_LAUNCH_SESSION_COOKIE = "ic_candidate_launch_session";
export const CANDIDATE_HOST_LAUNCH_REQUEST_ID_HEADER = "X-Interview-Coach-Request-Id";

export type CandidateHostLaunchRouteDiagnostic =
    | {
        requestId: string;
        phase: "exchange";
        outcome: "accepted";
        entryRoute: string;
    }
    | {
        requestId: string;
        phase: "exchange";
        outcome: "rejected";
        reason: CandidateHostLaunchFailureReason;
    };

export type CandidateHostLaunchRouteDependencies = Pick<
    CandidateHostLaunchDependencies,
    "verifyLaunchToken" | "resolveCandidateProfile"
> & Pick<CandidateHostLaunchDependencies, "sessionTtlSeconds">;

export async function handleCandidateHostLaunchRequest({
    requestUrl,
    now,
    verifyLaunchToken,
    resolveCandidateProfile,
    sessionTtlSeconds,
    requestId = randomUUID(),
    onDiagnostic,
}: CandidateHostLaunchRouteDependencies & {
    requestUrl: string;
    now: Date;
    requestId?: string;
    onDiagnostic?: (diagnostic: CandidateHostLaunchRouteDiagnostic) => void;
}): Promise<Response> {
    const url = new URL(requestUrl);
    const result = await createCandidateHostLaunchSession({
        token: url.searchParams.get(CANDIDATE_HOST_LAUNCH_TOKEN_PARAM),
        requestedRedirect: url.searchParams.get(CANDIDATE_HOST_LAUNCH_NEXT_PARAM),
        now,
        verifyLaunchToken,
        resolveCandidateProfile,
        sessionTtlSeconds,
    });
    const response = new Response(null, {
        status: 302,
        headers: {
            "Cache-Control": "no-store",
            [CANDIDATE_HOST_LAUNCH_REQUEST_ID_HEADER]: requestId,
            Location: result.redirectTo,
            "Referrer-Policy": "no-referrer",
        },
    });

    if (result.ok) {
        emitDiagnostic(onDiagnostic, {
            requestId,
            phase: "exchange",
            outcome: "accepted",
            entryRoute: result.redirectTo,
        });
        response.headers.append("Set-Cookie", serializeLaunchSessionCookie({
            sessionId: result.session.sessionId,
            expiresAt: result.session.expiresAt,
            secure: url.protocol === "https:",
        }));
    } else {
        emitDiagnostic(onDiagnostic, {
            requestId,
            phase: "exchange",
            outcome: "rejected",
            reason: result.reason,
        });
    }

    return response;
}

function emitDiagnostic(
    onDiagnostic: ((diagnostic: CandidateHostLaunchRouteDiagnostic) => void) | undefined,
    diagnostic: CandidateHostLaunchRouteDiagnostic,
) {
    try {
        onDiagnostic?.(diagnostic);
    } catch {
        // Launch correctness must not depend on observability delivery.
    }
}

function serializeLaunchSessionCookie({
    sessionId,
    expiresAt,
    secure,
}: {
    sessionId: string;
    expiresAt: string;
    secure: boolean;
}) {
    const parts = [
        `${CANDIDATE_HOST_LAUNCH_SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
        "Path=/candidate",
        "HttpOnly",
        "SameSite=Lax",
        `Expires=${new Date(expiresAt).toUTCString()}`,
    ];

    if (secure) {
        parts.splice(4, 0, "Secure");
    }

    return parts.join("; ");
}
