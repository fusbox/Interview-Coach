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
    guidance?: Array<{
        label: string;
        body: string;
        steps?: string[];
    }>;
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

type CreateCandidateFeedbackInteractionInput = {
    analysisSnapshot: CandidateAnswerAnalysisProviderResult;
    isLastQuestion: boolean;
};

const retryPrimaryInterventions = new Set([
    "revise_answer",
    "professional_reframe",
    "build_missing_signal",
]);

export function createCandidateFeedbackInteraction({
    analysisSnapshot,
    isLastQuestion,
}: CreateCandidateFeedbackInteractionInput): CandidateFeedbackInteraction {
    const stageDrafts = createStageDrafts(analysisSnapshot);
    const stages = stageDrafts.map((stage, index) => ({
        ...stage,
        actions: createStageActions({
            currentStageId: stage.id,
            nextStageId: stageDrafts[index + 1]?.id,
            isLastStage: index === stageDrafts.length - 1,
            isLastQuestion,
            shouldRetryBePrimary: shouldRetryBePrimary(analysisSnapshot),
            canRetry: Boolean(analysisSnapshot.answer.answerAttemptId),
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

export function findCandidateFeedbackAction(input: {
    interaction: CandidateFeedbackInteraction;
    stageId: CandidateFeedbackInteractionStageId;
    actionKind: CandidateFeedbackActionKind;
}) {
    const stage = input.interaction.stages.find((candidateStage) => candidateStage.id === input.stageId);
    return [
        ...(stage?.actions ?? []),
        ...input.interaction.globalActions,
    ].find((action) => action.kind === input.actionKind) ?? null;
}

export function isCandidateFeedbackActionEventAllowed(input: {
    interaction: CandidateFeedbackInteraction;
    event: CandidateFeedbackActionEvent;
}) {
    const action = findCandidateFeedbackAction({
        interaction: input.interaction,
        stageId: input.event.stageId,
        actionKind: input.event.actionKind,
    });

    return Boolean(
        action
        && action.transition === input.event.transition
        && action.targetStageId === input.event.targetStageId
    );
}

function createStageDrafts(
    analysis: CandidateAnswerAnalysisProviderResult,
): Omit<CandidateFeedbackInteractionStage, "actions">[] {
    const feedback = analysis.evidenceFirst.candidateFeedback;
    const acknowledgement = feedback.acknowledgement;
    const primaryStrength = feedback.primaryStrength;
    const biggestUpgrade = feedback.biggestUpgrade;
    const redoPrompt = feedback.redoPrompt;
    const nextStepBody = redoPrompt
        ?? biggestUpgrade
        ?? "Carry the same clear approach into the next question.";
    const contentBody = readDistinctFeedbackText(primaryStrength, [
        acknowledgement,
        nextStepBody,
    ]) ?? readDistinctFeedbackText(biggestUpgrade, [
        acknowledgement,
        nextStepBody,
    ]);
    const guidance: NonNullable<CandidateFeedbackInteractionStage["guidance"]> = [];
    const distinctBiggestUpgrade = readDistinctFeedbackText(biggestUpgrade, [
        acknowledgement,
        contentBody,
        nextStepBody,
    ]);
    if (distinctBiggestUpgrade) {
        guidance.push({
            label: "Try next",
            body: distinctBiggestUpgrade,
        });
    }
    if (feedback.patternSuggestion) {
        guidance.push({
            label: feedback.patternSuggestion.patternName,
            body: "Use this structure when you try the answer again.",
            steps: feedback.patternSuggestion.steps,
        });
    }

    const stages: Omit<CandidateFeedbackInteractionStage, "actions">[] = [{
        id: "acknowledgement",
        label: "Coach read",
        title: "First, here is what I heard.",
        body: acknowledgement,
    }];

    if (contentBody) {
        stages.push({
            id: "content_coaching",
            label: "Answer coaching",
            title: isSameFeedbackText(contentBody, primaryStrength)
                ? "What is working"
                : "One useful focus",
            body: contentBody,
            ...(guidance.length > 0 ? { guidance } : {}),
        });
    }

    if (feedback.deliveryNote) {
        stages.push({
            id: "delivery_coaching",
            label: "Delivery coaching",
            title: "How it came across",
            body: feedback.deliveryNote.message,
        });
    }

    stages.push({
        id: "next_step",
        label: "Next step",
        title: redoPrompt ? "Try the answer again" : "Carry this forward",
        body: nextStepBody,
        ...(!contentBody && guidance.length > 0 ? { guidance } : {}),
    });

    return stages;
}

function readDistinctFeedbackText(
    candidate: string | null | undefined,
    existing: Array<string | null | undefined>,
) {
    if (!candidate) return null;
    return existing.some((value) => isSameFeedbackText(candidate, value)) ? null : candidate;
}

function isSameFeedbackText(left: string | null | undefined, right: string | null | undefined) {
    if (!left || !right) return false;
    return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function createStageActions({
    currentStageId,
    nextStageId,
    isLastStage,
    isLastQuestion,
    shouldRetryBePrimary,
    canRetry,
}: {
    currentStageId: CandidateFeedbackInteractionStageId;
    nextStageId?: CandidateFeedbackInteractionStageId;
    isLastStage: boolean;
    isLastQuestion: boolean;
    shouldRetryBePrimary: boolean;
    canRetry: boolean;
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

    if (shouldRetryBePrimary && canRetry) {
        return [
            createRetryAction("primary"),
            createContinueOrFinishAction(isLastQuestion, "secondary"),
        ];
    }

    return [
        createContinueOrFinishAction(isLastQuestion, "primary"),
        ...(canRetry ? [createRetryAction("secondary")] : []),
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

function shouldRetryBePrimary(analysis: CandidateAnswerAnalysisProviderResult) {
    return retryPrimaryInterventions.has(analysis.evidenceFirst.interaction.intervention);
}
