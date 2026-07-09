import {
    CANDIDATE_DEV_HOST_LAUNCH_FIXTURES,
    CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV,
    isCandidateDevHostLaunchEnabled,
    mintCandidateDevHostLaunchToken,
} from "@/features/candidate-auth-v2/dev-host-launch";
import { normalizeCandidateLaunchRedirect } from "@/features/candidate-auth-v2/host-launch-contract";
import {
    CANDIDATE_HOST_LAUNCH_NEXT_PARAM,
    CANDIDATE_HOST_LAUNCH_TOKEN_PARAM,
} from "@/features/candidate-auth-v2/host-launch-route";

export async function GET(request: Request) {
    if (!isCandidateDevHostLaunchEnabled()) {
        return new Response(null, { status: 404 });
    }

    const secret = process.env[CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV]?.trim();
    if (!secret) {
        return new Response(null, { status: 404 });
    }

    const requestUrl = new URL(request.url);
    const fixture = requestUrl.searchParams.get("candidate") === "alternate"
        ? CANDIDATE_DEV_HOST_LAUNCH_FIXTURES.alternate
        : CANDIDATE_DEV_HOST_LAUNCH_FIXTURES.primary;
    const token = await mintCandidateDevHostLaunchToken({
        fixture,
        secret,
        now: new Date(),
    });
    const launchSearchParams = new URLSearchParams();
    launchSearchParams.set(CANDIDATE_HOST_LAUNCH_TOKEN_PARAM, token);
    launchSearchParams.set(
        CANDIDATE_HOST_LAUNCH_NEXT_PARAM,
        normalizeCandidateLaunchRedirect(requestUrl.searchParams.get(CANDIDATE_HOST_LAUNCH_NEXT_PARAM)),
    );

    return new Response(null, {
        status: 302,
        headers: {
            Location: `/candidate/launch?${launchSearchParams.toString()}`,
        },
    });
}
