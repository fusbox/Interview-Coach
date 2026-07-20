import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CandidateAnswerAnalysisProviderResult } from "./candidate-answer-analysis-adapter";
import {
    createCandidateFeedbackActionEvent,
    createCandidateFeedbackInteraction,
} from "./candidate-feedback-interaction";
import { CandidateStagedFeedback } from "./CandidateStagedFeedback";

describe("candidate staged feedback recovery", () => {
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

const analysisSnapshot: CandidateAnswerAnalysisProviderResult = {
    status: "answer_analysis_provider_result",
    provider: "candidate_v2_answer_evaluator",
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
    evidence: [],
};
