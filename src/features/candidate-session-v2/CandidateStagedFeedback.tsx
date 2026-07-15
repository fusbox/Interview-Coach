"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import {
    createCandidateFeedbackActionEvent,
    type CandidateFeedbackAction,
    type CandidateFeedbackActionEvent,
    type CandidateFeedbackInteraction,
    type CandidateFeedbackInteractionStageId,
} from "./candidate-feedback-interaction";

type CandidateStagedFeedbackProps = {
    interaction: CandidateFeedbackInteraction;
    savedActionEvent?: CandidateFeedbackActionEvent | null;
    isCompletingSession: boolean;
    completionMessage?: string | null;
    onPersistAction: (event: CandidateFeedbackActionEvent) => Promise<boolean>;
    onAdvanceQuestion: () => void;
    onFinishSession: () => void;
    onRetryAnswer: (sourceAnswerAttemptId: string) => void;
};

export function CandidateStagedFeedback({
    interaction,
    savedActionEvent = null,
    isCompletingSession,
    completionMessage = null,
    onPersistAction,
    onAdvanceQuestion,
    onFinishSession,
    onRetryAnswer,
}: CandidateStagedFeedbackProps) {
    const [activeStageId, setActiveStageId] = useState<CandidateFeedbackInteractionStageId>(() => (
        resolveRecoveredStageId(interaction, savedActionEvent)
    ));
    const [pendingActionKind, setPendingActionKind] = useState<CandidateFeedbackAction["kind"] | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const activeStage = useMemo(
        () => interaction.stages.find((stage) => stage.id === activeStageId) ?? interaction.stages[0],
        [activeStageId, interaction.stages],
    );
    const stageIndex = interaction.stages.findIndex((stage) => stage.id === activeStage.id);

    return (
        <section className="candidate-staged-feedback" aria-labelledby="coach-feedback-title" aria-live="polite">
            <header className="candidate-staged-feedback__header">
                <div>
                    <p className="type-eyebrow">{activeStage.label}</p>
                    <h2 id="coach-feedback-title">{activeStage.title}</h2>
                </div>
                <p className="candidate-staged-feedback__progress" aria-label={`Feedback step ${stageIndex + 1} of ${interaction.stages.length}`}>
                    {stageIndex + 1} / {interaction.stages.length}
                </p>
            </header>

            <p className="candidate-staged-feedback__body">{activeStage.body}</p>

            {activeStage.guidance?.length ? (
                <div className="candidate-staged-feedback__guidance">
                    {activeStage.guidance.map((item) => (
                        <section key={`${item.label}:${item.body}`}>
                            <p className="type-eyebrow">{item.label}</p>
                            <p>{item.body}</p>
                            {item.steps?.length ? (
                                <ol>
                                    {item.steps.map((step) => <li key={step}>{step}</li>)}
                                </ol>
                            ) : null}
                        </section>
                    ))}
                </div>
            ) : null}

            <footer className="candidate-staged-feedback__actions">
                {activeStage.actions.map((action) => (
                    <button
                        className={action.emphasis === "primary"
                            ? "candidate-button candidate-button--primary"
                            : "candidate-button candidate-button--secondary"}
                        type="button"
                        key={`${activeStage.id}:${action.kind}`}
                        disabled={Boolean(pendingActionKind) || isCompletingSession}
                        onClick={() => selectAction(action)}
                    >
                        {action.kind === "retry_answer" ? <RotateCcw size={16} aria-hidden="true" /> : null}
                        {pendingActionKind === action.kind ? "Saving..." : action.label}
                        {action.kind !== "retry_answer" ? <ArrowRight size={16} aria-hidden="true" /> : null}
                    </button>
                ))}
            </footer>

            {actionError ? <p className="planned-session-status" role="alert">{actionError}</p> : null}
            {completionMessage ? <p className="planned-session-status" role="alert">{completionMessage}</p> : null}
        </section>
    );

    async function selectAction(action: CandidateFeedbackAction) {
        setPendingActionKind(action.kind);
        setActionError(null);
        const event = createCandidateFeedbackActionEvent({
            interaction,
            stageId: activeStage.id,
            action,
            selectedAt: new Date().toISOString(),
        });
        const persisted = await onPersistAction(event);
        setPendingActionKind(null);

        if (!persisted) {
            setActionError("I could not save that choice. Try again.");
            return;
        }

        switch (action.transition) {
            case "show_feedback_stage":
                if (action.targetStageId) setActiveStageId(action.targetStageId);
                break;
            case "advance_to_next_question":
                onAdvanceQuestion();
                break;
            case "finish_session":
                onFinishSession();
                break;
            case "retry_current_question":
                if (interaction.answer.answerAttemptId) {
                    onRetryAnswer(interaction.answer.answerAttemptId);
                }
                break;
            case "pause_session":
                break;
        }
    }
}

function resolveRecoveredStageId(
    interaction: CandidateFeedbackInteraction,
    event: CandidateFeedbackActionEvent | null | undefined,
) {
    if (!event || !isSameAnalyzedAnswer(interaction, event)) {
        return interaction.stages[0].id;
    }

    if (
        event.transition === "show_feedback_stage"
        && event.targetStageId
        && interaction.stages.some((stage) => stage.id === event.targetStageId)
    ) {
        return event.targetStageId;
    }

    return interaction.stages.some((stage) => stage.id === event.stageId)
        ? event.stageId
        : interaction.stages[0].id;
}

function isSameAnalyzedAnswer(
    interaction: CandidateFeedbackInteraction,
    event: CandidateFeedbackActionEvent,
) {
    return event.answer.slotId === interaction.answer.slotId
        && event.answer.questionIndex === interaction.answer.questionIndex
        && event.answer.answerAttemptId === interaction.answer.answerAttemptId;
}
