import type { CandidatePostgresQueryClient } from "@/features/candidate-auth-v2/candidate-postgres-runtime";
import { resolveCandidateRouteAccess } from "@/features/candidate-auth-v2/candidate-route-access";
import {
    createCandidateSetupDraftOwnerKey,
    createCandidateSetupEntryRepository,
    type CandidateTrustedSetupContext,
} from "./candidate-setup-entry-context";

export type CandidateSetupRouteIdentity = {
    candidateProfileId: string;
    setupOwnerKey: string;
    accessSource?: "app_account" | "host_launch" | "dev_host_launch";
    candidateLaunchSessionId?: string | null;
    trustedSetupContext?: CandidateTrustedSetupContext | null;
};

export async function resolveCandidateSetupRouteIdentity(
    request: Request,
    client: CandidatePostgresQueryClient,
): Promise<CandidateSetupRouteIdentity | null> {
    const cookieHeader = request.headers.get("Cookie");
    const access = await resolveCandidateRouteAccess(cookieHeader, client);
    if (!access) {
        return null;
    }
    if (access.source !== "host_launch") {
        return {
            candidateProfileId: access.candidateProfileId,
            setupOwnerKey: createCandidateSetupDraftOwnerKey(access.candidateProfileId, null),
            accessSource: access.source,
            // The local dev cookie uses a readable fixture key, not a durable
            // candidate_launch_sessions UUID. It proves fixture access only.
            candidateLaunchSessionId: null,
            trustedSetupContext: null,
        };
    }

    const entry = await createCandidateSetupEntryRepository(client)
        .resolveLaunchEntry(access.candidateLaunchSessionId);
    return entry && entry.candidateProfileId === access.candidateProfileId
        ? {
            candidateProfileId: entry.candidateProfileId,
            setupOwnerKey: createCandidateSetupDraftOwnerKey(entry.candidateProfileId, entry.trustedSetupContext),
            accessSource: access.source,
            candidateLaunchSessionId: entry.candidateLaunchSessionId,
            trustedSetupContext: entry.trustedSetupContext,
        }
        : null;
}
