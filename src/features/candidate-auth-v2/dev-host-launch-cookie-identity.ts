import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "./host-launch-route";
import {
    CANDIDATE_DEV_HOST_LAUNCH_FIXTURES,
    isCandidateDevHostLaunchEnabled,
} from "./dev-host-launch";

export type CandidateDevHostLaunchCookieIdentity = {
    candidateProfileId: string;
};

export function resolveCandidateDevHostLaunchCookieIdentity(cookieHeader: string | null): CandidateDevHostLaunchCookieIdentity | null {
    if (!isCandidateDevHostLaunchEnabled()) {
        return null;
    }

    const candidateLaunchSessionId = readCookieValue(cookieHeader, CANDIDATE_HOST_LAUNCH_SESSION_COOKIE);
    if (!candidateLaunchSessionId?.startsWith("dev-host-launch-")) {
        return null;
    }

    const hostCandidateId = candidateLaunchSessionId.slice("dev-host-launch-".length);
    const fixture = Object.values(CANDIDATE_DEV_HOST_LAUNCH_FIXTURES)
        .find((candidateFixture) => candidateFixture.candidateId === hostCandidateId);

    return fixture
        ? {
            candidateProfileId: fixture.candidateProfileId,
        }
        : null;
}

function readCookieValue(cookieHeader: string | null, name: string) {
    if (!cookieHeader) {
        return null;
    }

    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));

    if (!cookie) {
        return null;
    }

    return decodeURIComponent(cookie.slice(name.length + 1));
}
