import { resolveLocalCandidateAuthHandoff } from "./candidate-dev-auth-resolver";
import { withCandidateRouteMetrics } from "./candidate-observability";
import { resolveCandidateProfileFromIdentity } from "./candidate-profile-repository";
import { PRACTICE_SETUP_LIMITS } from "@/features/practice-setup/practice-setup-schema";
import type { InterviewStage } from "@/lib/server/services/question-plan-service";
import {
    findCandidatePracticeDraftById,
    findLatestEditableCandidatePracticeDraft,
    listEditableCandidatePracticeDraftSummaries,
    type CandidatePracticeDraftSummary,
} from "./candidate-practice-draft-repository";

export type RestoredPracticeSetupDraft = {
    practiceDraftId: string;
    availableDrafts: CandidatePracticeDraftSummary[];
    initialValues: {
        targetRole: string;
        jobDescription: string | null;
        resumeText: string | null;
        interviewType: "behavioral" | "technical" | "case" | "screening" | "general" | null;
        interviewStage: InterviewStage;
        questionCount: number;
    };
};

export async function loadPracticeSetupDraftForCurrentCandidate(selectedPracticeDraftId?: string | null): Promise<RestoredPracticeSetupDraft | null> {
    return withCandidateRouteMetrics({
        route: "/practice",
        operation: "load_practice_setup",
        load: async () => {
            const handoff = await resolveLocalCandidateAuthHandoff();
            if (!handoff) {
                return null;
            }

            const profile = await resolveCandidateProfileFromIdentity(handoff);
            const normalizedSelectedPracticeDraftId = selectedPracticeDraftId?.trim() || null;
            const [draft, availableDrafts] = await Promise.all([
                normalizedSelectedPracticeDraftId
                    ? findCandidatePracticeDraftById({
                        candidateProfileId: profile.candidateProfileId,
                        practiceDraftId: normalizedSelectedPracticeDraftId,
                    })
                    : findLatestEditableCandidatePracticeDraft(profile.candidateProfileId),
                listEditableCandidatePracticeDraftSummaries(profile.candidateProfileId),
            ]);
            if (!draft) {
                return null;
            }
            const intakeResponses = draft.intakeResponses ?? {
                confidenceLevel: null,
                interviewType: null,
                interviewStage: "not_sure",
                timeline: null,
                concerns: null,
                practiceFocus: [],
            };

            return {
                practiceDraftId: draft.practiceDraftId,
                availableDrafts,
                initialValues: {
                    targetRole: draft.targetRole,
                    jobDescription: draft.jobDescription,
                    resumeText: draft.resumeContext.pastedText || draft.resumeContext.extractedText || null,
                    interviewType: intakeResponses.interviewType,
                    interviewStage: intakeResponses.interviewStage,
                    questionCount: PRACTICE_SETUP_LIMITS.questionCountDefault,
                },
            };
        },
    });
}
