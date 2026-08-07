import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createCandidateAnswerAnalysisProviderResultFixture } from "./candidate-answer-analysis-test-fixture";
import {
    createCandidateFeedbackActionEvent,
    createCandidateFeedbackInteraction,
} from "./candidate-feedback-interaction";
import { CandidateStagedFeedback } from "./CandidateStagedFeedback";

describe("candidate staged feedback recovery", () => {
    it("opens as a modal coaching surface and preserves staged navigation", async () => {
        const user = userEvent.setup();
        const interaction = createCandidateFeedbackInteraction({ analysisSnapshot, isLastQuestion: false });

        render(
            <CandidateStagedFeedback
                interaction={interaction}
                {...feedbackSource}
                isCompletingSession={false}
                onPersistAction={async () => true}
                onAdvanceQuestion={vi.fn()}
                onFinishSession={vi.fn()}
                onRetryAnswer={vi.fn()}
            />,
        );

        const dialog = await screen.findByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAccessibleName("Your coaching");
        expect(document.body).toHaveStyle({ overflow: "hidden" });
        expect(screen.getByRole("heading", { name: "Your coaching" })).toHaveClass("sr-only");
        expect(screen.getByRole("heading", { name: interaction.stages[0].title })).toHaveClass("sr-only");
        expect(screen.getByText(interaction.stages[0].body)).toBeInTheDocument();
        expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
        expect(screen.getByText("Behavioral")).toBeInTheDocument();

        await user.click(screen.getByText("Review question and answer"));
        expect(screen.getByText(feedbackSource.question.text)).toBeInTheDocument();
        expect(screen.getByText(feedbackSource.answerText)).toBeInTheDocument();

        const coachAvatar = dialog.querySelector(".candidate-staged-feedback__mark.candidate-coach-avatar");
        expect(coachAvatar).toHaveClass("candidate-coach-avatar--surface-frame");
        expect(coachAvatar?.querySelector(".candidate-coach-avatar__light"))
            .toHaveAttribute("src", "/coach-avatar-surface-light.svg");
        expect(coachAvatar?.querySelector(".candidate-coach-avatar__dark"))
            .toHaveAttribute("src", "/coach-avatar-surface-dark.svg");

        const primaryAction = interaction.stages[0].actions.find((action) => action.emphasis === "primary")!;
        const secondaryAction = interaction.stages[0].actions.find((action) => action.emphasis === "secondary")!;
        expect(screen.getByRole("button", { name: primaryAction.label }))
            .toHaveClass("candidate-button--primary");
        expect(screen.getByRole("button", { name: secondaryAction.label }))
            .toHaveClass("candidate-button--secondary");

        const stageAction = interaction.stages[0].actions.find((action) => (
            action.transition === "show_feedback_stage"
        ));
        if (!stageAction) throw new Error("Expected staged feedback fixture.");

        await user.click(screen.getByRole("button", { name: stageAction.label }));
        const targetStage = interaction.stages.find((stage) => stage.id === stageAction.targetStageId)!;
        await screen.findByText(targetStage.body);
        expect(screen.getByText(interaction.stages[0].body)).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: targetStage.title }))
            .toHaveClass("sr-only");
        expect(screen.getByRole("heading", { name: targetStage.title })).toHaveFocus();
    });

    it("applies a durably selected next-question transition once on recovery", async () => {
        const interaction = createCandidateFeedbackInteraction({ analysisSnapshot, isLastQuestion: false });
        const action = interaction.stages[0].actions.find((candidate) => (
            candidate.transition === "advance_to_next_question"
        ))!;
        const onAdvanceQuestion = vi.fn();

        render(
            <CandidateStagedFeedback
                interaction={interaction}
                {...feedbackSource}
                savedActionEvent={createCandidateFeedbackActionEvent({
                    interaction,
                    stageId: interaction.stages[0].id,
                    action,
                    selectedAt: "2026-07-20T12:00:00.000Z",
                })}
                isCompletingSession={false}
                onPersistAction={async () => true}
                onAdvanceQuestion={onAdvanceQuestion}
                onFinishSession={vi.fn()}
                onRetryAnswer={vi.fn()}
            />,
        );

        await waitFor(() => expect(onAdvanceQuestion).toHaveBeenCalledTimes(1));
    });

    it("recovers forward when a saved navigation event targets a deduplicated stage", async () => {
        const biggestUpgrade = "Mention one specific way you would manage the schedule change.";
        const interaction = createCandidateFeedbackInteraction({
            analysisSnapshot: createCandidateAnswerAnalysisProviderResultFixture({
                evidenceFirst: {
                    candidateFeedback: {
                        acknowledgement: "You confirmed your availability and named a practical constraint.",
                        primaryStrength: null,
                        biggestUpgrade,
                        redoPrompt: null,
                        patternSuggestion: null,
                        deliveryNote: null,
                    },
                    intervention: "polish_then_continue",
                },
            }),
            isLastQuestion: false,
        });

        render(
            <CandidateStagedFeedback
                interaction={interaction}
                {...feedbackSource}
                savedActionEvent={{
                    status: "feedback_action_selected",
                    answer: interaction.answer,
                    stageId: "acknowledgement",
                    actionKind: "explore_feedback",
                    transition: "show_feedback_stage",
                    targetStageId: "content_coaching",
                    selectedAt: "2026-07-20T12:00:00.000Z",
                }}
                isCompletingSession={false}
                onPersistAction={async () => true}
                onAdvanceQuestion={vi.fn()}
                onFinishSession={vi.fn()}
                onRetryAnswer={vi.fn()}
            />,
        );

        expect(await screen.findByText(biggestUpgrade)).toBeInTheDocument();
        expect(screen.getByText("Feedback step 2 of 2: Next step")).toBeInTheDocument();
    });

    it("applies a durably selected finish transition once on recovery", async () => {
        const interaction = createCandidateFeedbackInteraction({ analysisSnapshot, isLastQuestion: true });
        const action = interaction.stages[0].actions.find((candidate) => candidate.transition === "finish_session")!;
        const onFinishSession = vi.fn();

        render(
            <CandidateStagedFeedback
                interaction={interaction}
                {...feedbackSource}
                savedActionEvent={createCandidateFeedbackActionEvent({
                    interaction,
                    stageId: interaction.stages[0].id,
                    action,
                    selectedAt: "2026-07-20T12:00:00.000Z",
                })}
                isCompletingSession={false}
                onPersistAction={async () => true}
                onAdvanceQuestion={vi.fn()}
                onFinishSession={onFinishSession}
                onRetryAnswer={vi.fn()}
            />,
        );

        await waitFor(() => expect(onFinishSession).toHaveBeenCalledTimes(1));
    });
});

const feedbackSource = {
    question: {
        number: 1,
        count: 3,
        categoryLabel: "Behavioral",
        text: "Tell me about a time you improved a difficult process.",
    },
    answerText: "I clarified the handoff, documented the new steps, and reduced rework.",
};

const analysisSnapshot = createCandidateAnswerAnalysisProviderResultFixture({
    analyzedAt: "2026-07-20T11:00:00.000Z",
    answer: {
        slotId: "slot-1",
        questionIndex: 0,
        answerAttemptId: "11111111-1111-4111-8111-111111111111",
        attemptNumber: 1,
        trigger: "initial_submit",
    },
    coachFeedback: {
        acknowledgement: "You answered directly.",
        observation: "Add one specific result.",
        nextPracticeFocus: "Name what changed after your action.",
    },
});
