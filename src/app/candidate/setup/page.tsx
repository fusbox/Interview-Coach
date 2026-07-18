import { cookies } from "next/headers";

import { CandidateSetupExperience } from "@/features/candidate-setup-v2/CandidateSetupExperience";
import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { createCandidatePostgresQueryClient } from "@/features/candidate-auth-v2/candidate-postgres-runtime";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import {
    createCandidateSetupDraftOwnerKey,
    createCandidateSetupEntryRepository,
} from "@/features/candidate-setup-v2/candidate-setup-entry-context";

export default async function CandidateSetupPage() {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll()
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");
    const devIdentity = resolveCandidateDevHostLaunchCookieIdentity(cookieHeader);
    if (devIdentity) {
        return <CandidateSetupExperience draftOwnerKey={`candidate:${devIdentity.candidateProfileId}`} />;
    }

    const candidateLaunchSessionId = cookieStore.get(CANDIDATE_HOST_LAUNCH_SESSION_COOKIE)?.value?.trim();
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!candidateLaunchSessionId || !databaseUrl) {
        return <CandidateSetupExperience />;
    }

    const entry = await createCandidateSetupEntryRepository(
        createCandidatePostgresQueryClient(databaseUrl),
    ).resolveLaunchEntry(candidateLaunchSessionId);
    if (!entry) {
        throw new Error("Candidate setup access could not be verified.");
    }

    return <CandidateSetupExperience
        draftOwnerKey={createCandidateSetupDraftOwnerKey(
            entry.candidateProfileId,
            entry.trustedSetupContext,
        )}
        trustedSetupContext={entry.trustedSetupContext}
    />;
}
