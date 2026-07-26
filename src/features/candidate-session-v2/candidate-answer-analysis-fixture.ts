import {
    EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
    EVIDENCE_FIRST_PROMPT_BUNDLE_VERSION,
    createEvaluatorRunDescriptor,
    type EvidenceExtractionOutput,
    type EvidenceFirstEvaluatorProfile,
    type FeedbackCompositionOutput,
    type PatternGap,
} from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import {
    runEvidenceFirstEvaluator,
    type AcceptedEvidenceFirstEvaluatorRun,
    type EvidenceFirstEvaluatorRuntimeAdapters,
} from "@/features/evaluation-v2/evidence-first-evaluator-runtime";

import {
    createCandidateAnswerAnalysisProjectionFromEvaluatorRun,
    createCandidateAnswerEvidenceFirstEvaluationCase,
    type CandidateAnswerAnalysisProviderRequest,
    type CandidateAnswerAnalysisProviderResult,
} from "./candidate-answer-analysis-adapter";

const deterministicFixtureGeneration = {
    mode: "deterministic",
    structuredOutput: true,
} as const;

export const candidateAnswerAnalysisFixtureProfile: EvidenceFirstEvaluatorProfile = {
    profileId: "deterministic_local_fixture_v1",
    evaluatorVersion: EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
    promptBundleVersion: EVIDENCE_FIRST_PROMPT_BUNDLE_VERSION,
    serviceMode: "local_fixture",
    adapterVersion: "candidate_answer_analysis_fixture_v2",
    evidenceExtractor: {
        provider: "deterministic_local_fixture",
        model: "fixture_evidence_extractor_v1",
        promptVersion: "fixture_evidence_extractor_prompt_v2",
        responseSchemaVersion: "evidence_extraction_output_v1",
        generation: deterministicFixtureGeneration,
    },
    verifier: {
        provider: "deterministic_local_fixture",
        model: "fixture_evidence_verifier_v1",
        promptVersion: "fixture_evidence_verifier_prompt_v1",
        responseSchemaVersion: "evidence_verification_output_v1",
        generation: deterministicFixtureGeneration,
    },
    feedbackComposer: {
        provider: "deterministic_local_fixture",
        model: "fixture_feedback_composer_v1",
        promptVersion: "fixture_feedback_composer_prompt_v1",
        responseSchemaVersion: "feedback_composition_output_v1",
        generation: deterministicFixtureGeneration,
    },
} as const;

export const candidateAnswerAnalysisFixtureRunMetadata = createEvaluatorRunDescriptor(
    candidateAnswerAnalysisFixtureProfile,
);

const categorySignalIds = {
    behavioral: ["has_context", "has_personal_action", "has_result", "has_learning", "has_constraint"],
    technical_role_specific: [
        "has_direct_technical_answer",
        "has_relevant_role_knowledge",
        "has_reasoning",
        "has_practical_application",
        "has_verification_awareness",
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

export async function createFixtureEvidenceFirstAnswerAnalysis(
    request: CandidateAnswerAnalysisProviderRequest,
    input?: { evaluationRunId?: string },
): Promise<CandidateAnswerAnalysisProviderResult> {
    const run = await runFixtureEvidenceFirstEvaluator(request, input);
    return createCandidateAnswerAnalysisProjectionFromEvaluatorRun({
        run,
        answer: createAnswerReference(request),
    });
}

export async function runFixtureEvidenceFirstEvaluator(
    request: CandidateAnswerAnalysisProviderRequest,
    input?: { evaluationRunId?: string },
): Promise<AcceptedEvidenceFirstEvaluatorRun> {
    const { evaluationCase, adapters } = createFixtureEvidenceFirstEvaluatorAdapters(request);

    return runEvidenceFirstEvaluator({
        evaluationRunId: input?.evaluationRunId
            ?? `fixture:${request.answer.answerAttemptId ?? request.answer.slotId}`,
        evaluationCase,
        profile: candidateAnswerAnalysisFixtureProfile,
        adapters,
        requestedAt: request.requestedAt,
    });
}

export function createFixtureEvidenceFirstEvaluatorAdapters(
    request: CandidateAnswerAnalysisProviderRequest,
    profile: EvidenceFirstEvaluatorProfile = candidateAnswerAnalysisFixtureProfile,
) {
    const evaluationCase = createFixtureEvidenceFirstEvaluationCase(request);
    const adapters: EvidenceFirstEvaluatorRuntimeAdapters = {
        evidenceExtractor: {
            descriptor: profile.evidenceExtractor,
            invoke: async () => ({
                value: createFixtureExtraction(evaluationCase.inputFingerprint, request),
            }),
        },
        verifier: {
            descriptor: profile.verifier!,
            invoke: async () => ({
                value: {
                    status: "evidence_verification_output",
                    schemaVersion: 1,
                    inputFingerprint: evaluationCase.inputFingerprint,
                    supported: true,
                    issueCodes: [],
                    recommendedAction: "accept",
                },
            }),
        },
        feedbackComposer: {
            descriptor: profile.feedbackComposer,
            invoke: async ({ task }) => ({
                value: createFixtureFeedback(
                    evaluationCase.inputFingerprint,
                    task.input.patternGap,
                ),
            }),
        },
    };

    return { evaluationCase, adapters };
}

export function createFixtureEvidenceFirstEvaluationCase(
    request: CandidateAnswerAnalysisProviderRequest,
) {
    return createCandidateAnswerEvidenceFirstEvaluationCase(request);
}

function createFixtureExtraction(
    inputFingerprint: string,
    request: CandidateAnswerAnalysisProviderRequest,
): EvidenceExtractionOutput {
    const answerText = request.answer.text;
    const wordCount = answerText.trim().split(/\s+/).filter(Boolean).length;
    const technicalSignals = request.question.category === "technical_role_specific"
        ? createTechnicalFixtureSignals(answerText, wordCount)
        : null;

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
            hasTradeoffOrConstraint: technicalSignals?.some((signal) => (
                signal.id === "has_tradeoff" && signal.status === "observed"
            )) ?? false,
            hasRoleRelevantSkillSignal: technicalSignals?.some((signal) => (
                signal.id === "has_relevant_role_knowledge" && signal.status === "observed"
            )) ?? false,
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
        categorySignals: technicalSignals ?? categorySignalIds[request.question.category].map((id) => ({
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

function createTechnicalFixtureSignals(answerText: string, wordCount: number): EvidenceExtractionOutput["categorySignals"] {
    const normalized = answerText.toLowerCase();
    const observed = (id: string) => ({
        id,
        status: "observed" as const,
        evidenceSpanIds: ["fixture-direct-answer"],
    });
    const notObserved = (id: string) => ({
        id,
        status: "not_observed" as const,
        evidenceSpanIds: [],
    });
    const hasRoleEvidence = wordCount >= 8;
    const hasReasoning = /\b(because|so that|so |before|after|while|to make sure|in order to)\b/.test(normalized);
    const hasVerification = /\b(check|confirm|verify|review|approved|authorized|procedure|escalat)/.test(normalized);
    const hasTradeoff = /\b(but|tradeoff|risk|instead|while)\b/.test(normalized);

    return [
        observed("has_direct_technical_answer"),
        hasRoleEvidence ? observed("has_relevant_role_knowledge") : notObserved("has_relevant_role_knowledge"),
        hasReasoning ? observed("has_reasoning") : notObserved("has_reasoning"),
        hasRoleEvidence ? observed("has_practical_application") : notObserved("has_practical_application"),
        hasVerification ? observed("has_verification_awareness") : notObserved("has_verification_awareness"),
        hasTradeoff ? observed("has_tradeoff") : notObserved("has_tradeoff"),
    ];
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

function createAnswerReference(
    request: CandidateAnswerAnalysisProviderRequest,
): CandidateAnswerAnalysisProviderResult["answer"] {
    return {
        slotId: request.answer.slotId,
        questionIndex: request.answer.questionIndex,
        ...(request.answer.answerAttemptId && request.answer.attemptNumber && request.answer.trigger ? {
            answerAttemptId: request.answer.answerAttemptId,
            attemptNumber: request.answer.attemptNumber,
            trigger: request.answer.trigger,
        } : {}),
    };
}
