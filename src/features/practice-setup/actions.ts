"use server";

import { resolveLocalCandidateAuthHandoff } from "@/lib/server/candidate/candidate-dev-auth-resolver";
import { resolveCandidateProfileFromIdentity } from "@/lib/server/candidate/candidate-profile-repository";
import { transitionCandidatePracticeDraftToGenerating } from "@/lib/server/candidate/candidate-practice-draft-repository";

export type StartPracticeGenerationActionResult =
    | {
        ok: true;
        practiceDraftId: string;
        resumeTargetScreen: "practice_generating";
    }
    | {
        ok: false;
        error: string;
    };

export async function startPracticeGenerationAction(practiceDraftId: string): Promise<StartPracticeGenerationActionResult> {
    const normalizedPracticeDraftId = practiceDraftId.trim();
    if (!normalizedPracticeDraftId) {
        return { ok: false, error: "Practice draft is required." };
    }

    const handoff = await resolveLocalCandidateAuthHandoff();
    if (!handoff) {
        return { ok: false, error: "Candidate session is required." };
    }

    const profile = await resolveCandidateProfileFromIdentity(handoff);
    const draft = await transitionCandidatePracticeDraftToGenerating({
        candidateProfileId: profile.candidateProfileId,
        practiceDraftId: normalizedPracticeDraftId,
    });

    if (!draft) {
        return { ok: false, error: "Practice draft is no longer editable." };
    }

    return {
        ok: true,
        practiceDraftId: draft.practiceDraftId,
        resumeTargetScreen: "practice_generating",
    };
}
