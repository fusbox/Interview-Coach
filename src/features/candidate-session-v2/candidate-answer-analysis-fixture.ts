import {
    createEvidenceFirstEvaluationCase,
    type EvidenceExtractionOutput,
    type FeedbackCompositionOutput,
    type PatternGap,
} from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import {
    validateAndAppraiseEvidence,
    validateFeedbackComposition,
} from "@/features/evaluation-v2/evidence-first-evaluator";

import type {
    CandidateAnswerAnalysisProviderRequest,
    CandidateAnswerAnalysisProviderResult,
} from "./candidate-answer-analysis-adapter";

export const candidateAnswerAnalysisFixtureRunMetadata = {
    provider: "candidate_v2_answer_evaluator",
    modelName: "deterministic_local_fixture",
    promptVersion: "evidence_first_fixture_v1",
    evaluatorVersion: "evidence_first_v1",
} as const;

const categorySignalIds = {
    behavioral: ["has_context", "has_personal_action", "has_result", "has_learning", "has_constraint"],
    technical_role_specific: [
        "has_direct_technical_answer",
        "has_correct_concept",
        "has_reasoning",
        "has_practical_application",
        "has_tradeoff",
    ],
    case_scenario: [
        "has_problem_framing",
        "has_priority",
        "has_stakeholder_awareness",
        "has_tradeoff",
        "has_recommendation",
        "has_next_step",
    ],
    culture_fit: [
        "has_motivation",
        "has_specific_example",
        "has_role_connection",
        "has_self_awareness",
        "has_growth_orientation",
        "has_constructive_framing",
    ],
    screening: [
        "has_role_connection",
        "has_next_step_readiness",
        "has_logistics_clarity",
        "has_professional_boundary",
    ],
} as const;

export function createFixtureEvidenceFirstAnswerAnalysis(
    request: CandidateAnswerAnalysisProviderRequest,
): CandidateAnswerAnalysisProviderResult {
    const evaluationCase = createFixtureEvidenceFirstEvaluationCase(request);
    const extraction = createFixtureExtraction(evaluationCase.inputFingerprint, request);
    const appraisal = validateAndAppraiseEvidence({ evaluationCase, value: extraction });
    if (appraisal.disposition !== "accepted") {
        throw new Error("Fixture evidence did not pass the evidence-first appraisal boundary.");
    }

    const feedbackDraft = createFixtureFeedback(evaluationCase.inputFingerprint, appraisal.patternGap);
    const feedback = validateFeedbackComposition({
        evaluationCase,
        appraisal,
        value: feedbackDraft,
    });
    if (feedback.status !== "feedback_accepted") {
        throw new Error("Fixture feedback did not pass the evidence-first coaching boundary.");
    }

    const candidateFeedback = feedback.candidateProjection;
    return {
        status: "answer_analysis_provider_result",
        provider: candidateAnswerAnalysisFixtureRunMetadata.provider,
        analyzedAt: request.requestedAt,
        answer: {
            slotId: request.answer.slotId,
            questionIndex: request.answer.questionIndex,
            answerAttemptId: request.answer.answerAttemptId,
            attemptNumber: request.answer.attemptNumber,
            trigger: request.answer.trigger,
        },
        coachFeedback: {
            acknowledgement: candidateFeedback.acknowledgement,
            observation: candidateFeedback.primaryStrength
                ?? candidateFeedback.biggestUpgrade
                ?? candidateFeedback.acknowledgement,
            nextPracticeFocus: candidateFeedback.redoPrompt
                ?? candidateFeedback.biggestUpgrade
                ?? "Carry the same clear structure into the next answer.",
        },
        evidence: [],
        evidenceFirst: {
            contractVersion: evaluationCase.contractVersion,
            inputFingerprint: evaluationCase.inputFingerprint,
            feedbackPlan: feedback.feedback.feedbackPlan,
            candidateFeedback,
            criteria: appraisal.criteria,
            patternGap: appraisal.patternGap,
        },
    };
}

export function createFixtureEvidenceFirstEvaluationCase(
    request: CandidateAnswerAnalysisProviderRequest,
) {
    if (!request.answer.answerAttemptId || !request.answer.attemptNumber || !request.answer.trigger) {
        throw new Error("Evidence-first fixture analysis requires immutable answer-attempt identity.");
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
    });
}

function createFixtureExtraction(
    inputFingerprint: string,
    request: CandidateAnswerAnalysisProviderRequest,
): EvidenceExtractionOutput {
    const answerText = request.answer.text;
    const wordCount = answerText.trim().split(/\s+/).filter(Boolean).length;

    return {
        status: "evidence_extraction_output",
        schemaVersion: 1,
        inputFingerprint,
        questionCategory: request.question.category,
        answerUsability: {
            status: wordCount < 8 ? "thin" : "usable",
            reasonCode: wordCount < 8 ? "fixture_thin_answer" : "fixture_usable_answer",
        },
        observableMarkers: {
            answeredQuestion: true,
            hasDirectAnswer: true,
            hasExample: false,
            hasSpecificDetails: false,
            hasPersonalAction: false,
            hasOutcomeOrTakeaway: false,
            hasTradeoffOrConstraint: false,
            hasRoleRelevantSkillSignal: false,
            isOverlyLong: wordCount > 220,
            isVeryShort: wordCount < 12,
        },
        evidenceSpans: [{
            id: "fixture-direct-answer",
            marker: "direct_answer",
            quote: answerText,
            start: 0,
            end: answerText.length,
        }],
        categorySignals: categorySignalIds[request.question.category].map((id) => ({
            id,
            status: "not_observed" as const,
            evidenceSpanIds: [],
        })),
        technicalAccuracy: {
            status: "not_assessed",
            referenceConceptIds: [],
            evidenceSpanIds: [],
        },
        missingEvidence: ["specific_support"],
        sensitiveContentFlags: [],
        unsafeInferenceFlags: [],
    };
}

function createFixtureFeedback(
    inputFingerprint: string,
    patternGap: PatternGap,
): FeedbackCompositionOutput {
    const shouldRetry = patternGap.severity !== "low";

    return {
        status: "feedback_composition_output",
        schemaVersion: 1,
        inputFingerprint,
        feedbackPlan: {
            centralRead: shouldRetry
                ? "The answer has a direct starting point and needs one clearer supporting pattern."
                : "The answer has a usable structure to carry forward.",
            signal: {
                valence: shouldRetry ? "mixed" : "strength",
                detectability: shouldRetry ? "moderate" : "clear",
            },
            primaryAnchor: shouldRetry
                ? { kind: "pattern_gap", id: patternGap.id }
                : { kind: "criterion", id: "answer_focus" },
            intervention: shouldRetry ? "revise_answer" : "affirm_and_continue",
        },
        candidateFeedback: {
            acknowledgement: "You gave me a direct starting point to work with.",
            primaryStrength: "Your response makes its starting point easy to find.",
            biggestUpgrade: shouldRetry ? patternGap.upgrade : null,
            redoPrompt: shouldRetry
                ? `Try it again using this order: ${patternGap.redoPattern.join(", ")}.`
                : null,
            patternSuggestion: shouldRetry ? {
                patternName: "A clearer answer pattern",
                steps: patternGap.redoPattern,
            } : null,
            deliveryNote: null,
        },
        claimEvidence: {
            acknowledgementSpanIds: ["fixture-direct-answer"],
            primaryStrengthSpanIds: ["fixture-direct-answer"],
        },
    };
}
