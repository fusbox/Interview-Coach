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
                isCompletingSession={false}
                onPersistAction={async () => true}
                onAdvanceQuestion={vi.fn()}
                onFinishSession={vi.fn()}
                onRetryAnswer={vi.fn()}
            />,
        );

        const dialog = await screen.findByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAccessibleName("Coach feedback");
        expect(document.body).toHaveStyle({ overflow: "hidden" });
        expect(screen.queryByText(interaction.stages[0].label)).not.toBeInTheDocument();
        expect(screen.queryByText(interaction.stages[0].title)).not.toBeInTheDocument();
        expect(screen.getByText(interaction.stages[0].body)).toBeInTheDocument();

        const stageAction = interaction.stages[0].actions.find((action) => (
            action.transition === "show_feedback_stage"
        ));
        if (!stageAction) throw new Error("Expected staged feedback fixture.");

        await user.click(screen.getByRole("button", { name: stageAction.label }));
        const targetStage = interaction.stages.find((stage) => stage.id === stageAction.targetStageId)!;
        await screen.findByText(targetStage.body);
        expect(screen.queryByText(targetStage.label)).not.toBeInTheDocument();
        expect(screen.queryByText(targetStage.title)).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Coach feedback" })).toHaveFocus();
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

    it("applies a durably selected finish transition once on recovery", async () => {
        const interaction = createCandidateFeedbackInteraction({ analysisSnapshot, isLastQuestion: true });
        const action = interaction.stages[0].actions.find((candidate) => candidate.transition === "finish_session")!;
        const onFinishSession = vi.fn();

        render(
            <CandidateStagedFeedback
                interaction={interaction}
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
