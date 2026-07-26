import type { CandidateSetupPayload } from "@/features/candidate-setup-v2/candidate-setup-contract";
import {
    EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
    candidateSafeFeedbackProjectionSchema,
    createEvidenceFirstEvaluationCase,
    criterionAppraisalSchema,
    evidenceExtractionOutputSchema,
    feedbackCompositionOutputSchema,
    patternGapSchema,
    type CandidateSafeFeedbackProjection,
    type CriterionAppraisal,
    type EvidenceExtractionOutput,
    type EvidenceFirstEvaluationCase,
    type FeedbackCompositionOutput,
    type PatternGap,
} from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import type { AcceptedEvidenceFirstEvaluatorRun } from "@/features/evaluation-v2/evidence-first-evaluator-runtime";
import {
    deriveQuestionPreparedness,
    questionPreparednessResultSchema,
    type QuestionPreparednessResult,
} from "@/features/evaluation-v2/question-preparedness";

import type { CandidateAnswerAnalysisRequest, CandidateAnswerMode } from "./candidate-answer-lifecycle";
import {
    candidateQuestionPlanCategoryDetails,
    type CandidateQuestionPlanCategory,
} from "./candidate-question-plan";

export type CandidateAnswerAnalysisProviderName = "candidate_v2_answer_evaluator";

export type CandidateAnswerAnalysisSetupSnapshot = CandidateSetupPayload & {
    createdAt: string;
};

export type CandidateAnswerAnalysisQuestion = {
    slotId: string;
    index: number;
    category: CandidateQuestionPlanCategory;
    questionText: string;
    plannedPurpose?: string;
};

export type CandidateAnswerAnalysisProviderRequest = {
    status: "answer_analysis_provider_requested";
    provider: CandidateAnswerAnalysisProviderName;
    requestedAt: string;
    answer: {
        slotId: string;
        questionIndex: number;
        mode: CandidateAnswerMode;
        text: string;
        submittedAt: string;
        answerAttemptId?: string;
        attemptNumber?: number;
        trigger?: "initial_submit" | "feedback_retry";
    };
    question: {
        slotId: string;
        questionIndex: number;
        category: CandidateQuestionPlanCategory;
        questionText: string;
        plannedPurpose: string;
    };
    setupContext: {
        targetRole: string;
        jobDescription: string;
        resumeText: string | null;
        interviewStage: CandidateSetupPayload["interviewStage"];
        questionCount: number;
    };
    technicalReference?: EvidenceFirstEvaluationCase["providerInput"]["technicalReference"];
    voiceMarkers?: EvidenceFirstEvaluationCase["providerInput"]["voiceMarkers"];
};

export type CandidateAnswerAnalysisCoachFeedback = {
    acknowledgement: string;
    observation: string;
    nextPracticeFocus: string;
};

export type CandidateEvidenceFirstAnalysisSnapshot = {
    contractVersion: typeof EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION;
    inputFingerprint: string;
    candidateFeedback: CandidateSafeFeedbackProjection;
    interaction: {
        intervention: FeedbackCompositionOutput["feedbackPlan"]["intervention"];
    };
    appraisal: {
        answerUsability: EvidenceExtractionOutput["answerUsability"];
        technicalAccuracy: {
            status: EvidenceExtractionOutput["technicalAccuracy"]["status"];
        };
        criteria: CandidateEvidenceFirstCriterionAppraisal[];
        questionPreparedness: QuestionPreparednessResult;
        patternGap: PatternGap;
    };
};

export type CandidateEvidenceFirstCriterionAppraisal = Omit<CriterionAppraisal, "evidenceSpanIds">;

export type CandidateAnswerAnalysisProviderResult = {
    status: "answer_analysis_provider_result";
    provider: CandidateAnswerAnalysisProviderName;
    analyzedAt: string;
    answer: {
        slotId: string;
        questionIndex: number;
        answerAttemptId?: string;
        attemptNumber?: number;
        trigger?: "initial_submit" | "feedback_retry";
    };
    coachFeedback: CandidateAnswerAnalysisCoachFeedback;
    evidenceFirst: CandidateEvidenceFirstAnalysisSnapshot;
};

const providerName: CandidateAnswerAnalysisProviderName = "candidate_v2_answer_evaluator";

export function createCandidateAnswerAnalysisProviderRequest({
    request,
    question,
    setupSnapshot,
}: {
    request: CandidateAnswerAnalysisRequest;
    question: CandidateAnswerAnalysisQuestion;
    setupSnapshot: CandidateAnswerAnalysisSetupSnapshot;
}): CandidateAnswerAnalysisProviderRequest {
    const answer = request.answerSubmission;

    if (answer.slotId !== question.slotId || answer.questionIndex !== question.index) {
        throw new Error("Answer analysis provider request must map to the submitted answer slot.");
    }

    return {
        status: "answer_analysis_provider_requested",
        provider: providerName,
        requestedAt: request.requestedAt,
        answer: {
            slotId: answer.slotId,
            questionIndex: answer.questionIndex,
            mode: answer.mode,
            text: answer.text,
            submittedAt: answer.submittedAt,
            ...(answer.answerAttemptId ? { answerAttemptId: answer.answerAttemptId } : {}),
            ...(answer.attemptNumber ? { attemptNumber: answer.attemptNumber } : {}),
            ...(answer.trigger ? { trigger: answer.trigger } : {}),
        },
        question: {
            slotId: question.slotId,
            questionIndex: question.index,
            category: question.category,
            questionText: question.questionText,
            plannedPurpose: question.plannedPurpose
                ?? candidateQuestionPlanCategoryDetails[question.category].purpose,
        },
        setupContext: {
            targetRole: setupSnapshot.targetRole,
            jobDescription: setupSnapshot.jobDescription,
            resumeText: setupSnapshot.resumeText,
            interviewStage: setupSnapshot.interviewStage,
            questionCount: setupSnapshot.questionCount,
        },
    };
}

export function createCandidateAnswerEvidenceFirstEvaluationCase(
    request: CandidateAnswerAnalysisProviderRequest,
): EvidenceFirstEvaluationCase {
    if (!request.answer.answerAttemptId || !request.answer.attemptNumber || !request.answer.trigger) {
        throw new Error("Evidence-first analysis requires immutable answer-attempt identity.");
    }

    return createEvidenceFirstEvaluationCase({
        answerAttemptId: request.answer.answerAttemptId,
        question: {
            slotId: request.question.slotId,
            questionIndex: request.question.questionIndex,
            category: request.question.category,
            questionText: request.question.questionText,
            plannedPurpose: request.question.plannedPurpose,
        },
        answer: {
            mode: request.answer.mode,
            text: request.answer.text,
            submittedAt: request.answer.submittedAt,
        },
        roleContext: {
            targetRole: request.setupContext.targetRole,
            interviewStage: request.setupContext.interviewStage,
            jobDescription: request.setupContext.jobDescription,
            resumeText: request.setupContext.resumeText?.trim() || null,
        },
        technicalReference: request.technicalReference ?? null,
        voiceMarkers: request.voiceMarkers ?? null,
    });
}

export function parseCandidateAnswerAnalysisProviderResult(
    value: unknown,
    request: CandidateAnswerAnalysisRequest,
): CandidateAnswerAnalysisProviderResult | null {
    const parsed = parseStoredCandidateAnswerAnalysisProviderResult(value);
    if (!parsed) {
        return null;
    }

    if (
        parsed.answer.slotId !== request.answerSubmission.slotId
        || parsed.answer.questionIndex !== request.answerSubmission.questionIndex
        || (
            request.answerSubmission.answerAttemptId
            && parsed.answer.answerAttemptId !== request.answerSubmission.answerAttemptId
        )
    ) {
        return null;
    }

    return parsed;
}

export function parseStoredCandidateAnswerAnalysisProviderResult(
    value: unknown,
): CandidateAnswerAnalysisProviderResult | null {
    if (!isObject(value) || value.status !== "answer_analysis_provider_result" || value.provider !== providerName) {
        return null;
    }

    const analyzedAt = readNonEmptyString(value.analyzedAt);
    const answer = parseAnswerReference(value.answer);
    const coachFeedback = parseCoachFeedback(value.coachFeedback);
    const evidenceFirst = parseEvidenceFirstSnapshot(value.evidenceFirst);

    if (
        !analyzedAt
        || !answer
        || !coachFeedback
        || !evidenceFirst
    ) {
        return null;
    }

    return {
        status: "answer_analysis_provider_result",
        provider: providerName,
        analyzedAt,
        answer,
        coachFeedback,
        evidenceFirst,
    };
}

export function createCandidateAnswerAnalysisProjectionFromEvaluatorRun(input: {
    run: AcceptedEvidenceFirstEvaluatorRun;
    answer: CandidateAnswerAnalysisProviderResult["answer"];
}): CandidateAnswerAnalysisProviderResult {
    return createCandidateAnswerAnalysisProjectionFromAcceptedFeedback({
        analyzedAt: input.run.completedAt,
        answer: input.answer,
        candidateFeedback: input.run.accepted.candidateProjection,
        intervention: input.run.accepted.feedback.feedbackPlan.intervention,
        appraisal: {
            answerUsability: input.run.accepted.extraction.answerUsability,
            technicalAccuracy: {
                status: input.run.accepted.extraction.technicalAccuracy.status,
            },
            criteria: input.run.accepted.criteria,
            patternGap: input.run.accepted.patternGap,
        },
    });
}

export function createCandidateAnswerAnalysisProjectionFromAcceptedFeedback(input: {
    analyzedAt: string;
    answer: CandidateAnswerAnalysisProviderResult["answer"];
    candidateFeedback: CandidateSafeFeedbackProjection;
    intervention: FeedbackCompositionOutput["feedbackPlan"]["intervention"];
    appraisal: {
        answerUsability: EvidenceExtractionOutput["answerUsability"];
        technicalAccuracy: {
            status: EvidenceExtractionOutput["technicalAccuracy"]["status"];
        };
        criteria: CriterionAppraisal[];
        patternGap: PatternGap;
    };
}): CandidateAnswerAnalysisProviderResult {
    const candidateFeedback = input.candidateFeedback;
    return {
        status: "answer_analysis_provider_result",
        provider: providerName,
        analyzedAt: input.analyzedAt,
        answer: input.answer,
        coachFeedback: {
            acknowledgement: candidateFeedback.acknowledgement,
            observation: candidateFeedback.primaryStrength
                ?? candidateFeedback.biggestUpgrade
                ?? candidateFeedback.acknowledgement,
            nextPracticeFocus: candidateFeedback.redoPrompt
                ?? candidateFeedback.biggestUpgrade
                ?? "Carry the same clear structure into the next answer.",
        },
        evidenceFirst: {
            contractVersion: EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
            inputFingerprint: candidateFeedback.inputFingerprint,
            candidateFeedback,
            interaction: {
                intervention: input.intervention,
            },
            appraisal: {
                answerUsability: input.appraisal.answerUsability,
                technicalAccuracy: input.appraisal.technicalAccuracy,
                criteria: input.appraisal.criteria.map((criterion) => ({
                    criterionId: criterion.criterionId,
                    applicability: criterion.applicability,
                    ...(criterion.band ? { band: criterion.band } : {}),
                    reasonCode: criterion.reasonCode,
                })),
                questionPreparedness: deriveQuestionPreparedness({
                    answerUsability: input.appraisal.answerUsability,
                    technicalAccuracy: input.appraisal.technicalAccuracy,
                    criteria: input.appraisal.criteria,
                }),
                patternGap: input.appraisal.patternGap,
            },
        },
    };
}

function parseAnswerReference(value: unknown): CandidateAnswerAnalysisProviderResult["answer"] | null {
    if (!isObject(value)) {
        return null;
    }

    const slotId = readNonEmptyString(value.slotId);
    if (
        !slotId
        || typeof value.questionIndex !== "number"
        || !Number.isInteger(value.questionIndex)
        || value.questionIndex < 0
    ) {
        return null;
    }

    const answerAttemptId = readNonEmptyString(value.answerAttemptId);
    const attemptNumber = readPositiveInteger(value.attemptNumber);
    const trigger = value.trigger === "initial_submit" || value.trigger === "feedback_retry"
        ? value.trigger
        : null;
    const hasAttemptMetadata = Boolean(answerAttemptId || attemptNumber || trigger);
    if (hasAttemptMetadata && (!answerAttemptId || !attemptNumber || !trigger)) {
        return null;
    }

    return {
        slotId,
        questionIndex: value.questionIndex,
        ...(hasAttemptMetadata ? {
            answerAttemptId: answerAttemptId!,
            attemptNumber: attemptNumber!,
            trigger: trigger!,
        } : {}),
    };
}

function parseEvidenceFirstSnapshot(value: unknown): CandidateEvidenceFirstAnalysisSnapshot | null {
    if (!isObject(value) || value.contractVersion !== EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION) {
        return null;
    }

    const inputFingerprint = readNonEmptyString(value.inputFingerprint);
    const candidateFeedback = candidateSafeFeedbackProjectionSchema.safeParse(value.candidateFeedback);
    const explicitInteraction = isObject(value.interaction)
        ? feedbackCompositionOutputSchema.shape.feedbackPlan.shape.intervention.safeParse(value.interaction.intervention)
        : null;
    const intervention = explicitInteraction?.success
        ? explicitInteraction.data
        : null;
    const appraisal = parseCandidateEvidenceFirstAppraisal(value.appraisal);
    if (
        !inputFingerprint
        || !candidateFeedback.success
        || !intervention
        || !appraisal
        || candidateFeedback.data.inputFingerprint !== inputFingerprint
    ) {
        return null;
    }

    return {
        contractVersion: EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
        inputFingerprint,
        candidateFeedback: candidateFeedback.data,
        interaction: { intervention },
        appraisal,
    };
}

function parseCandidateEvidenceFirstAppraisal(
    value: unknown,
): CandidateEvidenceFirstAnalysisSnapshot["appraisal"] | null {
    if (!isObject(value) || !isObject(value.technicalAccuracy)) {
        return null;
    }
    const answerUsability = evidenceExtractionOutputSchema.shape.answerUsability.safeParse(value.answerUsability);
    const technicalAccuracyStatus = evidenceExtractionOutputSchema.shape.technicalAccuracy.shape.status.safeParse(
        value.technicalAccuracy.status,
    );
    const criteria = Array.isArray(value.criteria)
        ? value.criteria.map((criterion) => criterionAppraisalSchema.omit({ evidenceSpanIds: true }).safeParse(criterion))
        : [];
    const patternGap = patternGapSchema.safeParse(value.patternGap);
    if (
        !answerUsability.success
        || !technicalAccuracyStatus.success
        || criteria.length === 0
        || criteria.some((criterion) => !criterion.success)
        || !patternGap.success
    ) {
        return null;
    }
    const parsedCriteria = criteria.map((criterion) => criterion.data!);
    const questionPreparedness = questionPreparednessResultSchema.safeParse(value.questionPreparedness);
    const resolvedQuestionPreparedness = questionPreparedness.success
        ? questionPreparedness.data
        : deriveQuestionPreparedness({
            answerUsability: answerUsability.data,
            technicalAccuracy: { status: technicalAccuracyStatus.data },
            criteria: parsedCriteria,
        });

    return {
        answerUsability: answerUsability.data,
        technicalAccuracy: { status: technicalAccuracyStatus.data },
        criteria: parsedCriteria,
        questionPreparedness: resolvedQuestionPreparedness,
        patternGap: patternGap.data,
    };
}

function parseCoachFeedback(value: unknown): CandidateAnswerAnalysisCoachFeedback | null {
    if (!isObject(value)) {
        return null;
    }

    const acknowledgement = readNonEmptyString(value.acknowledgement);
    const observation = readNonEmptyString(value.observation);
    const nextPracticeFocus = readNonEmptyString(value.nextPracticeFocus);

    if (!acknowledgement || !observation || !nextPracticeFocus) {
        return null;
    }

    return {
        acknowledgement,
        observation,
        nextPracticeFocus,
    };
}

function readNonEmptyString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPositiveInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
