import type { CandidateAnswerAnalysisProviderResult } from "./candidate-answer-analysis-adapter";

export type CandidateFeedbackInteractionStageId =
    | "acknowledgement"
    | "content_coaching"
    | "delivery_coaching"
    | "next_step";

export type CandidateFeedbackActionKind =
    | "explore_feedback"
    | "show_next_feedback_stage"
    | "skip_to_next_question"
    | "skip_to_finish_session"
    | "continue_to_next_question"
    | "finish_session"
    | "retry_answer"
    | "pause_session";

export type CandidateFeedbackTransition =
    | "show_feedback_stage"
    | "advance_to_next_question"
    | "finish_session"
    | "retry_current_question"
    | "pause_session";

export type CandidateFeedbackAction = {
    kind: CandidateFeedbackActionKind;
    label: string;
    emphasis: "primary" | "secondary" | "utility";
    transition: CandidateFeedbackTransition;
    targetStageId?: CandidateFeedbackInteractionStageId;
};

export type CandidateFeedbackInteractionStage = {
    id: CandidateFeedbackInteractionStageId;
    label: string;
    title: string;
    body: string;
    actions: CandidateFeedbackAction[];
};

export type CandidateFeedbackInteraction = {
    status: "feedback_interaction_ready";
    answer: CandidateAnswerAnalysisProviderResult["answer"];
    stages: CandidateFeedbackInteractionStage[];
    globalActions: CandidateFeedbackAction[];
};

export type CandidateFeedbackActionEvent = {
    status: "feedback_action_selected";
    answer: CandidateAnswerAnalysisProviderResult["answer"];
    stageId: CandidateFeedbackInteractionStageId;
    actionKind: CandidateFeedbackActionKind;
    transition: CandidateFeedbackTransition;
    targetStageId?: CandidateFeedbackInteractionStageId;
    selectedAt: string;
};

type CandidateFeedbackPulse = {
    title?: string;
    body?: string;
};

type CandidateFeedbackPlan = {
    intervention?: {
        type?: string;
    };
};

type CandidateFeedbackNextAction = {
    actionType?: string;
};

type CandidateFeedbackInteractionAnalysis = CandidateAnswerAnalysisProviderResult & {
    contentPulse?: CandidateFeedbackPulse;
    deliveryPulse?: CandidateFeedbackPulse | null;
    feedbackPlan?: CandidateFeedbackPlan;
    nextAction?: CandidateFeedbackNextAction;
    recommendation?: string;
};

type CreateCandidateFeedbackInteractionInput = {
    analysisSnapshot: CandidateAnswerAnalysisProviderResult;
    isLastQuestion: boolean;
};

const retryPrimaryInterventions = new Set([
    "repair_foundation",
    "sharpen_signal",
    "redo_answer",
]);

export function createCandidateFeedbackInteraction({
    analysisSnapshot,
    isLastQuestion,
}: CreateCandidateFeedbackInteractionInput): CandidateFeedbackInteraction {
    const analysis = analysisSnapshot as CandidateFeedbackInteractionAnalysis;
    const stageDrafts = createStageDrafts(analysis);
    const stages = stageDrafts.map((stage, index) => ({
        ...stage,
        actions: createStageActions({
            currentStageId: stage.id,
            nextStageId: stageDrafts[index + 1]?.id,
            isLastStage: index === stageDrafts.length - 1,
            isLastQuestion,
            shouldRetryBePrimary: shouldRetryBePrimary(analysis),
            shouldPauseBePrimary: shouldPauseBePrimary(analysis),
        }),
    }));

    return {
        status: "feedback_interaction_ready",
        answer: analysisSnapshot.answer,
        stages,
        globalActions: [
            {
                kind: "pause_session",
                label: "Pause session",
                emphasis: "utility",
                transition: "pause_session",
            },
        ],
    };
}

export function createCandidateFeedbackActionEvent({
    interaction,
    stageId,
    action,
    selectedAt,
}: {
    interaction: CandidateFeedbackInteraction;
    stageId: CandidateFeedbackInteractionStageId;
    action: CandidateFeedbackAction;
    selectedAt: string;
}): CandidateFeedbackActionEvent {
    return {
        status: "feedback_action_selected",
        answer: interaction.answer,
        stageId,
        actionKind: action.kind,
        transition: action.transition,
        targetStageId: action.targetStageId,
        selectedAt,
    };
}

function createStageDrafts(analysis: CandidateFeedbackInteractionAnalysis): Omit<CandidateFeedbackInteractionStage, "actions">[] {
    const stages: Omit<CandidateFeedbackInteractionStage, "actions">[] = [
        {
            id: "acknowledgement",
            label: "Coach read",
            title: "First, here is what I heard.",
            body: analysis.coachFeedback.acknowledgement,
        },
        {
            id: "content_coaching",
            label: "Answer coaching",
            title: analysis.contentPulse?.title ?? "What to strengthen",
            body: analysis.contentPulse?.body ?? analysis.coachFeedback.observation,
        },
    ];

    if (analysis.deliveryPulse?.body) {
        stages.push({
            id: "delivery_coaching",
            label: "Delivery coaching",
            title: analysis.deliveryPulse.title ?? "How it came across",
            body: analysis.deliveryPulse.body,
        });
    }

    stages.push({
        id: "next_step",
        label: "Next step",
        title: "What to do next",
        body: analysis.recommendation ?? analysis.coachFeedback.nextPracticeFocus,
    });

    return stages;
}

function createStageActions({
    currentStageId,
    nextStageId,
    isLastStage,
    isLastQuestion,
    shouldRetryBePrimary,
    shouldPauseBePrimary,
}: {
    currentStageId: CandidateFeedbackInteractionStageId;
    nextStageId?: CandidateFeedbackInteractionStageId;
    isLastStage: boolean;
    isLastQuestion: boolean;
    shouldRetryBePrimary: boolean;
    shouldPauseBePrimary: boolean;
}): CandidateFeedbackAction[] {
    if (!isLastStage && nextStageId) {
        return [
            {
                kind: currentStageId === "acknowledgement" ? "explore_feedback" : "show_next_feedback_stage",
                label: currentStageId === "acknowledgement" ? "Explore feedback" : "Next",
                emphasis: "primary",
                transition: "show_feedback_stage",
                targetStageId: nextStageId,
            },
            createSkipAction(isLastQuestion),
        ];
    }

    if (shouldPauseBePrimary) {
        return [
            {
                kind: "pause_session",
                label: "Pause session",
                emphasis: "primary",
                transition: "pause_session",
            },
            createContinueOrFinishAction(isLastQuestion, "secondary"),
            createRetryAction("utility"),
        ];
    }

    if (shouldRetryBePrimary) {
        return [
            createRetryAction("primary"),
            createContinueOrFinishAction(isLastQuestion, "secondary"),
        ];
    }

    return [
        createContinueOrFinishAction(isLastQuestion, "primary"),
        createRetryAction("secondary"),
    ];
}

function createSkipAction(isLastQuestion: boolean): CandidateFeedbackAction {
    if (isLastQuestion) {
        return {
            kind: "skip_to_finish_session",
            label: "Skip and finish session",
            emphasis: "secondary",
            transition: "finish_session",
        };
    }

    return {
        kind: "skip_to_next_question",
        label: "Skip and continue to next question",
        emphasis: "secondary",
        transition: "advance_to_next_question",
    };
}

function createContinueOrFinishAction(
    isLastQuestion: boolean,
    emphasis: CandidateFeedbackAction["emphasis"],
): CandidateFeedbackAction {
    if (isLastQuestion) {
        return {
            kind: "finish_session",
            label: "Finish session",
            emphasis,
            transition: "finish_session",
        };
    }

    return {
        kind: "continue_to_next_question",
        label: "Continue to next question",
        emphasis,
        transition: "advance_to_next_question",
    };
}

function createRetryAction(emphasis: CandidateFeedbackAction["emphasis"]): CandidateFeedbackAction {
    return {
        kind: "retry_answer",
        label: "Retry my answer",
        emphasis,
        transition: "retry_current_question",
    };
}

function shouldRetryBePrimary(analysis: CandidateFeedbackInteractionAnalysis) {
    if (analysis.nextAction?.actionType === "redo_answer") {
        return true;
    }

    const interventionType = analysis.feedbackPlan?.intervention?.type;
    return Boolean(interventionType && retryPrimaryInterventions.has(interventionType));
}

function shouldPauseBePrimary(analysis: CandidateFeedbackInteractionAnalysis) {
    return analysis.nextAction?.actionType === "pause_session";
}
