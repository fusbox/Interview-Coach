"use server";

import { resolveLocalCandidateAuthHandoff } from "@/lib/server/candidate/candidate-dev-auth-resolver";
import { resolveCandidateProfileFromIdentity } from "@/lib/server/candidate/candidate-profile-repository";
import {
    createCandidatePracticeDraft,
    transitionCandidatePracticeDraftToGenerating,
    updateCandidatePracticeDraftIntake,
    updateCandidatePracticeDraftSetup,
} from "@/lib/server/candidate/candidate-practice-draft-repository";
import { createCandidateSessionFromDraft } from "@/lib/server/candidate/candidate-session-creation-service";

import {
    safeParsePracticeSetupInput,
    safeParsePracticeSetupIntakeInput,
    type PracticeSetupInput,
    type PracticeSetupIntakeInput,
} from "./practice-setup-schema";

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

export type StartPracticeGenerationActionInput = {
    practiceDraftId?: string | null;
    setup: PracticeSetupInput;
    intakeResponses: PracticeSetupIntakeInput;
};

export async function startPracticeGenerationAction(input: StartPracticeGenerationActionInput): Promise<StartPracticeGenerationActionResult> {
    const setupResult = safeParsePracticeSetupInput(input.setup);
    if (!setupResult.success) {
        return { ok: false, error: "Review the highlighted fields before starting practice." };
    }

    const intakeResult = safeParsePracticeSetupIntakeInput(input.intakeResponses);
    if (!intakeResult.success) {
        return { ok: false, error: "Review the personalization fields before starting practice." };
    }

    const handoff = await resolveLocalCandidateAuthHandoff();
    if (!handoff) {
        return { ok: false, error: "Candidate session is required." };
    }

    const profile = await resolveCandidateProfileFromIdentity(handoff);
    const normalizedPracticeDraftId = input.practiceDraftId?.trim() || null;
    let practiceDraftId = normalizedPracticeDraftId;

    if (practiceDraftId) {
        const updatedDraft = await updateCandidatePracticeDraftSetup({
            candidateProfileId: profile.candidateProfileId,
            practiceDraftId,
            ...setupResult.data,
        });

        if (!updatedDraft) {
            return { ok: false, error: "Practice draft was not found." };
        }
    } else {
        const createdDraft = await createCandidatePracticeDraft({
            candidateProfileId: profile.candidateProfileId,
            ...setupResult.data,
        });
        practiceDraftId = createdDraft.practiceDraftId;
    }

    const updatedIntake = await updateCandidatePracticeDraftIntake({
        candidateProfileId: profile.candidateProfileId,
        practiceDraftId,
        intakeResponses: intakeResult.data,
    });

    if (!updatedIntake) {
        return { ok: false, error: "Practice draft was not found." };
    }

    const draft = await transitionCandidatePracticeDraftToGenerating({
        candidateProfileId: profile.candidateProfileId,
        practiceDraftId,
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
