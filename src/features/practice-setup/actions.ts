"use server";

import { resolveLocalCandidateAuthHandoff } from "@/lib/server/candidate/candidate-dev-auth-resolver";
import { resolveCandidateProfileFromIdentity } from "@/lib/server/candidate/candidate-profile-repository";
import { transitionCandidatePracticeDraftToGenerating } from "@/lib/server/candidate/candidate-practice-draft-repository";
import { createCandidateSessionFromDraft } from "@/lib/server/candidate/candidate-session-creation-service";

export type StartPracticeGenerationActionResult =
    | {
        ok: true;
        practiceDraftId: string;
        sessionId: string;
        resumeTargetScreen: "session_entry";
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
        return { ok: false, error: "Practice draft was not found." };
    }

    const sessionResult = await createCandidateSessionFromDraft({
        candidateProfileId: profile.candidateProfileId,
        practiceDraftId: draft.practiceDraftId,
    });

    if (!sessionResult.ok) {
        return sessionResult;
    }

    return {
        ok: true,
        practiceDraftId: sessionResult.practiceDraftId,
        sessionId: sessionResult.sessionId,
        resumeTargetScreen: sessionResult.resumeTargetScreen,
    };
}
