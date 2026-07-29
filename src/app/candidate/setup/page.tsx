import { CandidateSetupExperience } from "@/features/candidate-setup-v2/CandidateSetupExperience";
import { requireCurrentCandidatePageAccess } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { createCandidateSetupResumeSelectionRepository } from "@/features/candidate-setup-v2/candidate-setup-resume-selection-repository";
import type { CandidateResumeTextArtifact } from "@/features/candidate-setup-v2/candidate-resume-text-artifact-repository";
import {
    createCandidateSetupDraftOwnerKey,
    createCandidateSetupEntryRepository,
} from "@/features/candidate-setup-v2/candidate-setup-entry-context";

export default async function CandidateSetupPage() {
    const { access, client } = await requireCurrentCandidatePageAccess("/candidate/setup");
    if (access.source !== "host_launch") {
        const draftOwnerKey = createCandidateSetupDraftOwnerKey(access.candidateProfileId, null);
        const initialResumeArtifact = await recoverCandidateSetupResumeArtifact(
            client,
            access.candidateProfileId,
            draftOwnerKey,
        );
        return <CandidateSetupExperience
            draftOwnerKey={draftOwnerKey}
            initialResumeArtifact={initialResumeArtifact}
            showAccountLogout={access.source === "app_account"}
        />;
    }

    const entry = await createCandidateSetupEntryRepository(client)
        .resolveLaunchEntry(access.candidateLaunchSessionId);
    if (!entry || entry.candidateProfileId !== access.candidateProfileId) {
        throw new Error("Candidate setup access could not be verified.");
    }

    const draftOwnerKey = createCandidateSetupDraftOwnerKey(entry.candidateProfileId, entry.trustedSetupContext);
    const initialResumeArtifact = await recoverCandidateSetupResumeArtifact(
        client,
        entry.candidateProfileId,
        draftOwnerKey,
    );

    return <CandidateSetupExperience
        draftOwnerKey={draftOwnerKey}
        initialResumeArtifact={initialResumeArtifact}
        trustedSetupContext={entry.trustedSetupContext}
        showAccountLogout={false}
    />;
}

async function recoverCandidateSetupResumeArtifact(
    client: Parameters<typeof createCandidateSetupResumeSelectionRepository>[0],
    candidateProfileId: string,
    setupOwnerKey: string,
) {
    const artifact = await createCandidateSetupResumeSelectionRepository(client)
        .recoverActiveSelection({ candidateProfileId, setupOwnerKey });
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
