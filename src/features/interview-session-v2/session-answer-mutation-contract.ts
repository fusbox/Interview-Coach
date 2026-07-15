export type SessionAnswerMutationPhase =
    | "idle"
    | "draft_dirty"
    | "draft_saving"
    | "draft_saved"
    | "draft_save_failed"
    | "submitting"
    | "submit_failed"
    | "analyzing"
    | "analysis_failed"
    | "analysis_ready";

export type SessionAnswerMutationPresentation = {
    message: string;
    tone: "neutral" | "progress" | "success" | "error";
    isAnswerLocked: boolean;
    isBusy: boolean;
    primaryAction: "submit" | "retry_submit" | "retry_analysis" | null;
    primaryLabel: string | null;
    canRetryDraftSave: boolean;
};

export function getSessionAnswerMutationPresentation(
    phase: SessionAnswerMutationPhase,
): SessionAnswerMutationPresentation {
    switch (phase) {
        case "draft_dirty":
            return createPresentation({
                message: "Changes waiting to save.",
                primaryAction: "submit",
                primaryLabel: "Submit answer",
            });
        case "draft_saving":
            return createPresentation({
                message: "Saving your draft...",
                tone: "progress",
                primaryAction: "submit",
                primaryLabel: "Submit answer",
            });
        case "draft_saved":
            return createPresentation({
                message: "Draft saved.",
                tone: "success",
                primaryAction: "submit",
                primaryLabel: "Submit answer",
            });
        case "draft_save_failed":
            return createPresentation({
                message: "Your latest changes aren't saved yet.",
                tone: "error",
                primaryAction: "submit",
                primaryLabel: "Submit answer",
                canRetryDraftSave: true,
            });
        case "submitting":
            return createPresentation({
                message: "Saving your answer...",
                tone: "progress",
                isAnswerLocked: true,
                isBusy: true,
                primaryAction: "submit",
                primaryLabel: "Saving answer...",
            });
        case "submit_failed":
            return createPresentation({
                message: "I couldn't save your answer. Your draft is still here.",
                tone: "error",
                primaryAction: "retry_submit",
                primaryLabel: "Try submit again",
            });
        case "analyzing":
            return createPresentation({
                message: "Your answer is saved. I'm preparing your coaching...",
                tone: "progress",
                isAnswerLocked: true,
                isBusy: true,
                primaryLabel: "Preparing coaching...",
            });
        case "analysis_failed":
            return createPresentation({
                message: "Your answer is saved. I couldn't prepare coaching just now.",
                tone: "error",
                isAnswerLocked: true,
                primaryAction: "retry_analysis",
                primaryLabel: "Try coaching again",
            });
        case "analysis_ready":
            return createPresentation({
                message: "Answer saved. Coaching is ready.",
                tone: "success",
                isAnswerLocked: true,
            });
        case "idle":
        default:
            return createPresentation({
                message: "Your draft saves as you write.",
                primaryAction: "submit",
                primaryLabel: "Submit answer",
            });
    }
}

function createPresentation(
    overrides: Partial<SessionAnswerMutationPresentation> & Pick<SessionAnswerMutationPresentation, "message">,
): SessionAnswerMutationPresentation {
    return {
        message: overrides.message,
        tone: overrides.tone ?? "neutral",
        isAnswerLocked: overrides.isAnswerLocked ?? false,
        isBusy: overrides.isBusy ?? false,
        primaryAction: overrides.primaryAction ?? null,
        primaryLabel: overrides.primaryLabel ?? null,
        canRetryDraftSave: overrides.canRetryDraftSave ?? false,
    };
}
