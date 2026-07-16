export type SessionAnswerMutationPhase =
    | "idle"
    | "draft_dirty"
    | "draft_saving"
    | "draft_saved"
    | "draft_save_failed"
    | "submitting"
    | "submit_failed"
    | "analyzing"
    | "analysis_pending"
    | "analysis_recoverable"
    | "analysis_failed"
    | "analysis_unavailable"
    | "analysis_ready";

export type SessionAnswerMutationPresentation = {
    message: string;
    tone: "neutral" | "progress" | "success" | "error";
    isAnswerLocked: boolean;
    isBusy: boolean;
    primaryAction:
        | "submit"
        | "retry_submit"
        | "check_analysis"
        | "restore_analysis"
        | "retry_analysis"
        | "continue_without_coaching"
        | null;
    primaryLabel: string | null;
    secondaryAction: "continue_without_coaching" | null;
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
        case "analysis_pending":
            return createPresentation({
                message: "Your answer is saved. I'm still preparing your coaching.",
                tone: "progress",
                isAnswerLocked: true,
                primaryAction: "check_analysis",
                primaryLabel: "Check coaching status",
            });
        case "analysis_recoverable":
            return createPresentation({
                message: "Your answer is saved. Your coaching is ready to reconnect.",
                tone: "progress",
                isAnswerLocked: true,
                primaryAction: "restore_analysis",
                primaryLabel: "Restore coaching",
                secondaryAction: "continue_without_coaching",
            });
        case "analysis_failed":
            return createPresentation({
                message: "Your answer is saved. I couldn't prepare coaching just now.",
                tone: "error",
                isAnswerLocked: true,
                primaryAction: "retry_analysis",
                primaryLabel: "Try coaching again",
                secondaryAction: "continue_without_coaching",
            });
        case "analysis_unavailable":
            return createPresentation({
                message: "Your answer is saved. Coaching isn't available for this answer, but you can keep going.",
                tone: "neutral",
                isAnswerLocked: true,
                primaryAction: "continue_without_coaching",
                primaryLabel: "Continue without coaching",
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
        secondaryAction: overrides.secondaryAction ?? null,
        canRetryDraftSave: overrides.canRetryDraftSave ?? false,
    };
}
