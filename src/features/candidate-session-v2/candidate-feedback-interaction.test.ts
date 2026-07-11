import { describe, expect, it } from "vitest";

import type { CandidateAnswerAnalysisProviderResult } from "./candidate-answer-analysis-adapter";
import {
    createCandidateFeedbackActionEvent,
    createCandidateFeedbackInteraction,
} from "./candidate-feedback-interaction";

const baseAnalysisSnapshot: CandidateAnswerAnalysisProviderResult = {
    status: "answer_analysis_provider_result",
    provider: "candidate_v2_answer_evaluator",
    analyzedAt: "2026-07-10T17:20:00.000Z",
    answer: {
        slotId: "slot-1",
        questionIndex: 0,
    },
    coachFeedback: {
        acknowledgement: "You gave a concrete example from your work.",
        observation: "The answer would be stronger if you named the result of your action.",
        nextPracticeFocus: "Add what changed after you handled the situation.",
    },
    evidence: [
        {
            criterionId: "answer_specificity",
            applicability: "observed",
            score: 3,
        },
    ],
};

describe("candidate feedback interaction contract", () => {
    it("creates a staged feedback contract from the current minimal V2 analysis snapshot", () => {
        const interaction = createCandidateFeedbackInteraction({
            analysisSnapshot: baseAnalysisSnapshot,
            isLastQuestion: false,
        });

        expect(interaction).toMatchObject({
            status: "feedback_interaction_ready",
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
            },
            stages: [
                {
                    id: "acknowledgement",
                    title: "First, here is what I heard.",
                    body: "You gave a concrete example from your work.",
                    actions: [
                        {
                            kind: "explore_feedback",
                            label: "Explore feedback",
                            emphasis: "primary",
                            transition: "show_feedback_stage",
                            targetStageId: "content_coaching",
                        },
                        {
                            kind: "skip_to_next_question",
                            label: "Skip and continue to next question",
                            emphasis: "secondary",
                            transition: "advance_to_next_question",
                        },
                    ],
                },
                {
                    id: "content_coaching",
                    title: "What to strengthen",
                    body: "The answer would be stronger if you named the result of your action.",
                },
                {
                    id: "next_step",
                    title: "What to do next",
                    body: "Add what changed after you handled the situation.",
                    actions: [
                        {
                            kind: "continue_to_next_question",
                            label: "Continue to next question",
                            emphasis: "primary",
                            transition: "advance_to_next_question",
                        },
                        {
                            kind: "retry_answer",
                            label: "Retry my answer",
                            emphasis: "secondary",
                            transition: "retry_current_question",
                        },
                    ],
                },
            ],
            globalActions: [
                {
                    kind: "pause_session",
                    label: "Pause session",
                    emphasis: "utility",
                    transition: "pause_session",
                },
            ],
        });
    });

    it("accepts richer future analysis pulses without changing the interaction grammar", () => {
        const interaction = createCandidateFeedbackInteraction({
            analysisSnapshot: {
                ...baseAnalysisSnapshot,
                contentPulse: {
                    title: "Make the example easier to follow",
                    body: "Start with the situation, then name the action you took and the result.",
                },
                deliveryPulse: {
                    title: "Keep the pace steady",
                    body: "Your answer can stay conversational while still naming the sequence clearly.",
                },
                recommendation: "Try the answer once more with the result included.",
            } as CandidateAnswerAnalysisProviderResult,
            isLastQuestion: false,
        });

        expect(interaction.stages.map((stage) => stage.id)).toEqual([
            "acknowledgement",
            "content_coaching",
            "delivery_coaching",
            "next_step",
        ]);
        expect(interaction.stages[1]).toMatchObject({
            title: "Make the example easier to follow",
            body: "Start with the situation, then name the action you took and the result.",
            actions: [
                {
                    kind: "show_next_feedback_stage",
                    label: "Next",
                    targetStageId: "delivery_coaching",
                },
                {
                    kind: "skip_to_next_question",
                },
            ],
        });
        expect(interaction.stages[2]).toMatchObject({
            title: "Keep the pace steady",
            body: "Your answer can stay conversational while still naming the sequence clearly.",
            actions: [
                {
                    kind: "show_next_feedback_stage",
                    label: "Next",
                    targetStageId: "next_step",
                },
                {
                    kind: "skip_to_next_question",
                },
            ],
        });
        expect(interaction.stages[3].body).toBe("Try the answer once more with the result included.");
    });

    it("makes retry primary only at the final next-step stage when coaching recommends revision", () => {
        const interaction = createCandidateFeedbackInteraction({
            analysisSnapshot: {
                ...baseAnalysisSnapshot,
                nextAction: {
                    actionType: "redo_answer",
                },
            } as CandidateAnswerAnalysisProviderResult,
            isLastQuestion: false,
        });

        expect(interaction.stages.at(-1)?.actions).toEqual([
            {
                kind: "retry_answer",
                label: "Retry my answer",
                emphasis: "primary",
                transition: "retry_current_question",
            },
            {
                kind: "continue_to_next_question",
                label: "Continue to next question",
                emphasis: "secondary",
                transition: "advance_to_next_question",
            },
        ]);
    });

    it("turns continue and skip actions into finish actions on the last question", () => {
        const interaction = createCandidateFeedbackInteraction({
            analysisSnapshot: baseAnalysisSnapshot,
            isLastQuestion: true,
        });

        expect(interaction.stages[0].actions[1]).toEqual({
            kind: "skip_to_finish_session",
            label: "Skip and finish session",
            emphasis: "secondary",
            transition: "finish_session",
        });
        expect(interaction.stages.at(-1)?.actions[0]).toEqual({
            kind: "finish_session",
            label: "Finish session",
            emphasis: "primary",
            transition: "finish_session",
        });
    });

    it("creates a stable action event for the next persistence boundary", () => {
        const interaction = createCandidateFeedbackInteraction({
            analysisSnapshot: baseAnalysisSnapshot,
            isLastQuestion: false,
        });
        const finalStage = interaction.stages.at(-1);
        const retryAction = finalStage?.actions.find((action) => action.kind === "retry_answer");

        expect(finalStage).toBeDefined();
        expect(retryAction).toBeDefined();
        expect(createCandidateFeedbackActionEvent({
            interaction,
            stageId: finalStage!.id,
            action: retryAction!,
            selectedAt: "2026-07-10T17:21:00.000Z",
        })).toEqual({
            status: "feedback_action_selected",
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
            },
            stageId: "next_step",
            actionKind: "retry_answer",
            transition: "retry_current_question",
            targetStageId: undefined,
            selectedAt: "2026-07-10T17:21:00.000Z",
        });
    });
});
