import { cookies } from "next/headers";

import { CandidateSetupExperience } from "@/features/candidate-setup-v2/CandidateSetupExperience";
import { CANDIDATE_HOST_LAUNCH_SESSION_COOKIE } from "@/features/candidate-auth-v2/host-launch-route";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { createCandidatePostgresQueryClient } from "@/features/candidate-auth-v2/candidate-postgres-runtime";
import { resolveCandidateDevHostLaunchCookieIdentity } from "@/features/candidate-auth-v2/dev-host-launch-cookie-identity";
import { createCandidateSetupResumeSelectionRepository } from "@/features/candidate-setup-v2/candidate-setup-resume-selection-repository";
import type { CandidateResumeTextArtifact } from "@/features/candidate-setup-v2/candidate-resume-text-artifact-repository";
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
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (devIdentity) {
        const draftOwnerKey = createCandidateSetupDraftOwnerKey(devIdentity.candidateProfileId, null);
        const initialResumeArtifact = databaseUrl
            ? await recoverCandidateSetupResumeArtifact(databaseUrl, devIdentity.candidateProfileId, draftOwnerKey)
            : null;
        return <CandidateSetupExperience
            draftOwnerKey={draftOwnerKey}
            initialResumeArtifact={initialResumeArtifact}
        />;
    }

    const candidateLaunchSessionId = cookieStore.get(CANDIDATE_HOST_LAUNCH_SESSION_COOKIE)?.value?.trim();
    if (!candidateLaunchSessionId || !databaseUrl) {
        return <CandidateSetupExperience />;
    }

    const entry = await createCandidateSetupEntryRepository(
        createCandidatePostgresQueryClient(databaseUrl),
    ).resolveLaunchEntry(candidateLaunchSessionId);
    if (!entry) {
        throw new Error("Candidate setup access could not be verified.");
    }

    const draftOwnerKey = createCandidateSetupDraftOwnerKey(entry.candidateProfileId, entry.trustedSetupContext);
    const initialResumeArtifact = await recoverCandidateSetupResumeArtifact(
        databaseUrl,
        entry.candidateProfileId,
        draftOwnerKey,
    );

    return <CandidateSetupExperience
        draftOwnerKey={draftOwnerKey}
        initialResumeArtifact={initialResumeArtifact}
        trustedSetupContext={entry.trustedSetupContext}
    />;
}

async function recoverCandidateSetupResumeArtifact(
    databaseUrl: string,
    candidateProfileId: string,
    setupOwnerKey: string,
) {
    const artifact = await createCandidateSetupResumeSelectionRepository(
        createCandidatePostgresQueryClient(databaseUrl),
    ).recoverActiveSelection({ candidateProfileId, setupOwnerKey });
    return artifact ? toCandidateResumeReviewArtifact(artifact) : null;
}

function toCandidateResumeReviewArtifact(artifact: CandidateResumeTextArtifact) {
    return {
        artifactId: artifact.artifactId,
        version: artifact.version,
        revision: artifact.revision,
        source: artifact.source,
        candidateLabel: artifact.candidateLabel,
        normalizedText: artifact.normalizedText,
        piiRedactionCounts: artifact.piiRedactionCounts,
        reviewState: artifact.reviewState === "accepted" ? "accepted" as const : "awaiting_review" as const,
        createdAt: artifact.createdAt,
        acceptedAt: artifact.acceptedAt,
    };
}
