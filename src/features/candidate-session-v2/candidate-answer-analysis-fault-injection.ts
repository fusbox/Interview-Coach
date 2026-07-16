import {
    EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
    EVIDENCE_FIRST_PROMPT_BUNDLE_VERSION,
    createEvaluatorRunDescriptor,
    type EvidenceExtractionOutput,
    type EvidenceFirstEvaluatorProfile,
} from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import {
    EvidenceFirstAdapterError,
    runEvidenceFirstEvaluator,
    type AcceptedEvidenceFirstEvaluatorRun,
    type EvidenceFirstEvaluatorRuntimeAdapters,
    type EvidenceFirstStageAdapterResult,
} from "@/features/evaluation-v2/evidence-first-evaluator-runtime";

import type { CandidateAnswerAnalysisProviderRequest } from "./candidate-answer-analysis-adapter";
import {
    candidateAnswerAnalysisFixtureProfile,
    candidateAnswerAnalysisFixtureRunMetadata,
    createFixtureEvidenceFirstEvaluationCase,
    createFixtureEvidenceFirstEvaluatorAdapters,
    runFixtureEvidenceFirstEvaluator,
} from "./candidate-answer-analysis-fixture";

export const CANDIDATE_ANSWER_ANALYSIS_FAULT_MODE_ENV = "CANDIDATE_ANSWER_ANALYSIS_FAULT_MODE";

export const CANDIDATE_ANSWER_ANALYSIS_FAULT_MODES = [
    "success",
    "timeout_once",
    "rate_limited_once",
    "provider_5xx_once",
    "provider_unavailable_once",
    "misconfigured_once",
    "invalid_extraction_schema_once",
    "fingerprint_mismatch_once",
    "span_mismatch_once",
    "unsafe_inference_once",
    "verifier_rejected_once",
    "invalid_feedback_schema_once",
] as const;

export type CandidateAnswerAnalysisFaultMode = typeof CANDIDATE_ANSWER_ANALYSIS_FAULT_MODES[number];

export type CandidateAnswerAnalysisDevelopmentRuntime = {
    runMetadata: ReturnType<typeof createEvaluatorRunDescriptor>;
    createInputFingerprint: (request: CandidateAnswerAnalysisProviderRequest) => string;
    requestAnswerAnalysis: (
        request: CandidateAnswerAnalysisProviderRequest,
        context?: { evaluationRunId: string },
    ) => Promise<AcceptedEvidenceFirstEvaluatorRun>;
};

const MAX_FAULTED_INPUTS = 256;
const faultedInputs = new Set<string>();

export function createCandidateAnswerAnalysisDevelopmentRuntime({
    env,
    explicitLocalDev,
}: {
    env: Record<string, string | undefined>;
    explicitLocalDev: boolean;
}): CandidateAnswerAnalysisDevelopmentRuntime | null {
    if (!explicitLocalDev || env.NODE_ENV === "production") return null;

    const provider = env.CANDIDATE_ANSWER_ANALYSIS_PROVIDER?.trim().toLowerCase();
    if (provider === "fixture") {
        return {
            runMetadata: candidateAnswerAnalysisFixtureRunMetadata,
            createInputFingerprint: createFixtureInputFingerprint,
            requestAnswerAnalysis: (request, context) => runFixtureEvidenceFirstEvaluator(request, {
                evaluationRunId: context?.evaluationRunId,
            }),
        };
    }
    if (provider !== "fault") return null;

    const mode = readCandidateAnswerAnalysisFaultMode(env[CANDIDATE_ANSWER_ANALYSIS_FAULT_MODE_ENV]);
    if (!mode) return null;
    const profile = createFaultInjectionProfile(mode);
    return {
        runMetadata: createEvaluatorRunDescriptor(profile),
        createInputFingerprint: createFixtureInputFingerprint,
        requestAnswerAnalysis: (request, context) => runFaultInjectedCandidateAnswerAnalysis(request, {
            evaluationRunId: context?.evaluationRunId,
            mode,
            profile,
        }),
    };
}

export async function runFaultInjectedCandidateAnswerAnalysis(
    request: CandidateAnswerAnalysisProviderRequest,
    input: {
        evaluationRunId?: string;
        mode: CandidateAnswerAnalysisFaultMode;
        profile?: EvidenceFirstEvaluatorProfile;
    },
): Promise<AcceptedEvidenceFirstEvaluatorRun> {
    const evaluationRunId = input.evaluationRunId
        ?? `fault:${request.answer.answerAttemptId ?? request.answer.slotId}`;
    const profile = input.profile ?? createFaultInjectionProfile(input.mode);
    const { evaluationCase, adapters: fixtureAdapters } = createFixtureEvidenceFirstEvaluatorAdapters(
        request,
        profile,
    );
    const faultKey = `${input.mode}:${evaluationCase.inputFingerprint}`;
    const faultThisRun = input.mode !== "success" && !faultedInputs.has(faultKey);
    if (faultThisRun) rememberFaultedInput(faultKey);

    return runEvidenceFirstEvaluator({
        evaluationRunId,
        evaluationCase,
        profile,
        adapters: createFaultInjectionAdapters({
            mode: input.mode,
            faultThisRun,
            fixtureAdapters,
        }),
        requestedAt: request.requestedAt,
    });
}

export function resetCandidateAnswerAnalysisFaultInjectionState() {
    faultedInputs.clear();
}

function rememberFaultedInput(faultKey: string) {
    if (faultedInputs.size >= MAX_FAULTED_INPUTS) {
        const oldestFaultKey = faultedInputs.values().next().value;
        if (oldestFaultKey) faultedInputs.delete(oldestFaultKey);
    }
    faultedInputs.add(faultKey);
}

export function readCandidateAnswerAnalysisFaultMode(
    value: string | undefined,
): CandidateAnswerAnalysisFaultMode | null {
    const normalized = value?.trim().toLowerCase();
    return CANDIDATE_ANSWER_ANALYSIS_FAULT_MODES.includes(normalized as CandidateAnswerAnalysisFaultMode)
        ? normalized as CandidateAnswerAnalysisFaultMode
        : null;
}

function createFaultInjectionProfile(mode: CandidateAnswerAnalysisFaultMode): EvidenceFirstEvaluatorProfile {
    const provider = "candidate_v2_answer_evaluator_fault_injector";
    return {
        profileId: `deterministic_fault_${mode}_v1`,
        evaluatorVersion: EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
        promptBundleVersion: EVIDENCE_FIRST_PROMPT_BUNDLE_VERSION,
        serviceMode: "fault_injection",
        adapterVersion: "candidate_answer_analysis_fault_injection_v1",
        evidenceExtractor: {
            ...candidateAnswerAnalysisFixtureProfile.evidenceExtractor,
            provider,
        },
        verifier: {
            ...candidateAnswerAnalysisFixtureProfile.verifier!,
            provider,
        },
        feedbackComposer: {
            ...candidateAnswerAnalysisFixtureProfile.feedbackComposer,
            provider,
        },
    };
}

function createFixtureInputFingerprint(request: CandidateAnswerAnalysisProviderRequest) {
    return createFixtureEvidenceFirstEvaluationCase(request).inputFingerprint;
}

function createFaultInjectionAdapters({
    mode,
    faultThisRun,
    fixtureAdapters,
}: {
    mode: CandidateAnswerAnalysisFaultMode;
    faultThisRun: boolean;
    fixtureAdapters: EvidenceFirstEvaluatorRuntimeAdapters;
}): EvidenceFirstEvaluatorRuntimeAdapters {
    return {
        evidenceExtractor: {
            descriptor: fixtureAdapters.evidenceExtractor.descriptor,
            invoke: async (input) => {
                if (!faultThisRun) return fixtureAdapters.evidenceExtractor.invoke(input);
                const transportFailure = createTransportFailure(mode);
                if (transportFailure) throw transportFailure;
                if (mode === "invalid_extraction_schema_once") {
                    return { value: { status: "fault_injected_invalid_extraction" } };
                }

                const result = await fixtureAdapters.evidenceExtractor.invoke(input);
                const extraction = cloneExtraction(result);
                if (mode === "fingerprint_mismatch_once") {
                    extraction.inputFingerprint = "0".repeat(64);
                } else if (mode === "span_mismatch_once") {
                    extraction.evidenceSpans[0] = {
                        ...extraction.evidenceSpans[0],
                        quote: "This text was not in the submitted answer.",
                    };
                } else if (mode === "unsafe_inference_once") {
                    extraction.unsafeInferenceFlags = ["personality"];
                } else if (mode === "verifier_rejected_once") {
                    extraction.categorySignals = extraction.categorySignals.map((signal) => ({
                        ...signal,
                        status: "observed" as const,
                        evidenceSpanIds: [extraction.evidenceSpans[0].id],
                    }));
                    extraction.observableMarkers = {
                        ...extraction.observableMarkers,
                        hasExample: true,
                        hasPersonalAction: true,
                        hasOutcomeOrTakeaway: true,
                        hasTradeoffOrConstraint: true,
                        hasRoleRelevantSkillSignal: true,
                    };
                }
                return { ...result, value: extraction };
            },
        },
        verifier: fixtureAdapters.verifier ? {
            descriptor: fixtureAdapters.verifier.descriptor,
            invoke: async (input) => {
                if (faultThisRun && mode === "verifier_rejected_once") {
                    return {
                        value: {
                            status: "evidence_verification_output",
                            schemaVersion: 1,
                            inputFingerprint: input.task.inputFingerprint,
                            supported: false,
                            issueCodes: ["fault_injected_rejection"],
                            recommendedAction: "insufficient_signal",
                        },
                    };
                }
                return fixtureAdapters.verifier!.invoke(input);
            },
        } : undefined,
        feedbackComposer: {
            descriptor: fixtureAdapters.feedbackComposer.descriptor,
            invoke: async (input) => {
                if (faultThisRun && mode === "invalid_feedback_schema_once") {
                    return { value: { status: "fault_injected_invalid_feedback" } };
                }
                return fixtureAdapters.feedbackComposer.invoke(input);
            },
        },
    };
}

function createTransportFailure(mode: CandidateAnswerAnalysisFaultMode) {
    switch (mode) {
        case "timeout_once":
            return new EvidenceFirstAdapterError({ failureClass: "timeout", safeCode: "PROVIDER_TIMEOUT" });
        case "rate_limited_once":
            return new EvidenceFirstAdapterError({ failureClass: "rate_limited", safeCode: "PROVIDER_RATE_LIMITED" });
        case "provider_5xx_once":
            return new EvidenceFirstAdapterError({ failureClass: "provider_5xx", safeCode: "PROVIDER_5XX" });
        case "provider_unavailable_once":
            return new EvidenceFirstAdapterError({ failureClass: "unknown", safeCode: "PROVIDER_UNAVAILABLE" });
        case "misconfigured_once":
            return new EvidenceFirstAdapterError({ failureClass: "misconfigured", safeCode: "PROVIDER_MISCONFIGURED" });
        default:
            return null;
    }
}

function cloneExtraction(result: EvidenceFirstStageAdapterResult): EvidenceExtractionOutput {
    return JSON.parse(JSON.stringify(result.value)) as EvidenceExtractionOutput;
}
