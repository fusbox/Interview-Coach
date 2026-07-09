import {
    createCandidateHostLaunchSession,
    type CandidateHostLaunchDependencies,
} from "./host-launch-contract";

export const CANDIDATE_HOST_LAUNCH_TOKEN_PARAM = "token";
export const CANDIDATE_HOST_LAUNCH_NEXT_PARAM = "next";
export const CANDIDATE_HOST_LAUNCH_SESSION_COOKIE = "ic_candidate_launch_session";

export type CandidateHostLaunchRouteDependencies = Pick<
    CandidateHostLaunchDependencies,
    "verifyLaunchToken" | "resolveCandidateProfile"
>;

export async function handleCandidateHostLaunchRequest({
    requestUrl,
    now,
    verifyLaunchToken,
    resolveCandidateProfile,
}: CandidateHostLaunchRouteDependencies & {
    requestUrl: string;
    now: Date;
}): Promise<Response> {
    const url = new URL(requestUrl);
    const result = await createCandidateHostLaunchSession({
        token: url.searchParams.get(CANDIDATE_HOST_LAUNCH_TOKEN_PARAM),
        requestedRedirect: url.searchParams.get(CANDIDATE_HOST_LAUNCH_NEXT_PARAM),
        now,
        verifyLaunchToken,
        resolveCandidateProfile,
    });
    const response = new Response(null, {
        status: 302,
        headers: {
            Location: result.redirectTo,
        },
    });

    if (result.ok) {
        response.headers.append("Set-Cookie", serializeLaunchSessionCookie({
            sessionId: result.session.sessionId,
            expiresAt: result.session.expiresAt,
            secure: url.protocol === "https:",
        }));
    }

    return response;
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
