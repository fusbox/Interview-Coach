import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import type { CandidatePostgresQueryClient } from "@/features/candidate-auth-v2/candidate-postgres-runtime";
import {
    createCandidateSetupDraftOwnerKey,
    createCandidateSetupEntryRepository,
} from "./candidate-setup-entry-context";

export type CandidateSetupRouteIdentity = {
    candidateProfileId: string;
    setupOwnerKey: string;
};

export async function resolveCandidateSetupRouteIdentity(
    request: Request,
    client: CandidatePostgresQueryClient,
): Promise<CandidateSetupRouteIdentity | null> {
    const cookieHeader = request.headers.get("Cookie");
    const devIdentity = resolveCandidateDevHostLaunchCookieIdentity(cookieHeader);
    if (devIdentity) {
        return {
            candidateProfileId: devIdentity.candidateProfileId,
            setupOwnerKey: createCandidateSetupDraftOwnerKey(devIdentity.candidateProfileId, null),
        };
    }

    const candidateLaunchSessionId = readCookieValue(cookieHeader, CANDIDATE_HOST_LAUNCH_SESSION_COOKIE);
    if (!candidateLaunchSessionId) {
        return null;
    }
    const entry = await createCandidateSetupEntryRepository(client).resolveLaunchEntry(candidateLaunchSessionId);
    return entry
        ? {
            candidateProfileId: entry.candidateProfileId,
            setupOwnerKey: createCandidateSetupDraftOwnerKey(entry.candidateProfileId, entry.trustedSetupContext),
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
    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}
