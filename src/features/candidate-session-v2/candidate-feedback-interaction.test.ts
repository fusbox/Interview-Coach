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
        answerAttemptId: "11111111-1111-4111-8111-111111111111",
        attemptNumber: 1,
        trigger: "initial_submit",
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
                answerAttemptId: "11111111-1111-4111-8111-111111111111",
                attemptNumber: 1,
                trigger: "initial_submit",
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

    it("does not offer retry when a legacy analysis lacks immutable attempt identity", () => {
        const interaction = createCandidateFeedbackInteraction({
            analysisSnapshot: {
                ...baseAnalysisSnapshot,
                answer: {
                    slotId: "slot-1",
                    questionIndex: 0,
                },
            },
            isLastQuestion: false,
        });

        expect(interaction.stages.flatMap((stage) => stage.actions))
            .not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: "retry_answer" })]));
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

    it("renders only candidate-safe evidence-first coaching and carries immutable attempt identity", () => {
        const interaction = createCandidateFeedbackInteraction({
            analysisSnapshot: {
                ...baseAnalysisSnapshot,
                answer: {
                    slotId: "slot-1",
                    questionIndex: 0,
                    answerAttemptId: "attempt-1",
                    attemptNumber: 1,
                    trigger: "initial_submit",
                },
                coachFeedback: {
                    acknowledgement: "Legacy acknowledgement must not render.",
                    observation: "Legacy score-shaped observation must not render.",
                    nextPracticeFocus: "Legacy recommendation must not render.",
                },
                evidenceFirst: {
                    contractVersion: "candidate_evidence_first_v2",
                    inputFingerprint: "a".repeat(64),
                    candidateFeedback: {
                        status: "candidate_safe_feedback",
                        schemaVersion: 1,
                        inputFingerprint: "a".repeat(64),
                        acknowledgement: "You made your action easy to find.",
                        primaryStrength: "Your answer clearly names what you did.",
                        biggestUpgrade: "Add what changed because of your action.",
                        redoPrompt: "Try it again and close with the result.",
                        patternSuggestion: {
                            patternName: "Action to result",
                            steps: ["Name your action", "Close with the result"],
                        },
                        deliveryNote: null,
                    },
                    interaction: {
                        intervention: "revise_answer",
                    },
                },
            },
            isLastQuestion: false,
        });

        expect(interaction.answer.answerAttemptId).toBe("attempt-1");
        expect(interaction.stages.map((stage) => stage.body)).toEqual([
            "You made your action easy to find.",
            "Your answer clearly names what you did.",
            "Try it again and close with the result.",
        ]);
        expect(interaction.stages[1].guidance).toEqual([
            {
                label: "Try next",
                body: "Add what changed because of your action.",
            },
            {
                label: "Action to result",
                body: "Use this structure when you try the answer again.",
                steps: ["Name your action", "Close with the result"],
            },
        ]);
        expect(interaction.stages.at(-1)?.actions[0]).toMatchObject({
            kind: "retry_answer",
            emphasis: "primary",
        });
        expect(JSON.stringify(interaction)).not.toContain("Legacy");
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
                answerAttemptId: "11111111-1111-4111-8111-111111111111",
                attemptNumber: 1,
                trigger: "initial_submit",
            },
            stageId: "next_step",
            actionKind: "retry_answer",
            transition: "retry_current_question",
            targetStageId: undefined,
            selectedAt: "2026-07-10T17:21:00.000Z",
        });
    });
});
