import { resolveLocalCandidateAuthHandoff } from "./candidate-dev-auth-resolver";
import { resolveCandidateProfileFromIdentity } from "./candidate-profile-repository";
import { findLatestEditableCandidatePracticeDraft } from "./candidate-practice-draft-repository";

export type RestoredPracticeSetupDraft = {
    practiceDraftId: string;
    initialValues: {
        targetRole: string;
        jobDescription: string | null;
        resumeText: string | null;
    };
};

export async function loadPracticeSetupDraftForCurrentCandidate(): Promise<RestoredPracticeSetupDraft | null> {
    const handoff = await resolveLocalCandidateAuthHandoff();
    if (!handoff) {
        return null;
    }

    const profile = await resolveCandidateProfileFromIdentity(handoff);
    const draft = await findLatestEditableCandidatePracticeDraft(profile.candidateProfileId);
    if (!draft) {
        return null;
    }

    return {
        practiceDraftId: draft.practiceDraftId,
        initialValues: {
            targetRole: draft.targetRole,
            jobDescription: draft.jobDescription,
            resumeText: draft.resumeContext.pastedText || draft.resumeContext.extractedText || null,
        },
    };
}
