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
    const redirectUrl = new URL(result.redirectTo, url.origin);
    const response = new Response(null, {
        status: 302,
        headers: {
            Location: redirectUrl.toString(),
        },
    });

    if (result.ok) {
        response.headers.append("Set-Cookie", serializeLaunchSessionCookie(result.session.sessionId, result.session.expiresAt));
    }

    return response;
}

function serializeLaunchSessionCookie(sessionId: string, expiresAt: string) {
    return [
        `${CANDIDATE_HOST_LAUNCH_SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
        "Path=/candidate",
        "HttpOnly",
        "SameSite=Lax",
        "Secure",
        `Expires=${new Date(expiresAt).toUTCString()}`,
    ].join("; ");
}
