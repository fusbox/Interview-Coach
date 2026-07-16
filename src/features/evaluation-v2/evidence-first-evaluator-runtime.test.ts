import { describe, expect, it, vi } from "vitest";

import {
    EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
    EVIDENCE_FIRST_PROMPT_BUNDLE_VERSION,
    createEvidenceFirstEvaluationCase,
    type EvidenceExtractionOutput,
    type EvidenceFirstEvaluatorProfile,
    type FeedbackCompositionOutput,
} from "./evidence-first-evaluator-contract";
import {
    EvidenceFirstAdapterError,
    EvidenceFirstEvaluatorRuntimeError,
    parseAcceptedEvidenceFirstEvaluatorRun,
    runEvidenceFirstEvaluator,
    type EvidenceFirstEvaluatorRuntimeAdapters,
} from "./evidence-first-evaluator-runtime";

const deterministicGeneration = { mode: "deterministic", structuredOutput: true } as const;

const profile: EvidenceFirstEvaluatorProfile = {
    profileId: "runtime-test-v1",
    evaluatorVersion: EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
    promptBundleVersion: EVIDENCE_FIRST_PROMPT_BUNDLE_VERSION,
    serviceMode: "test",
    adapterVersion: "runtime_test_v1",
    evidenceExtractor: {
        provider: "test",
        model: "extractor",
        promptVersion: "extract-v1",
        responseSchemaVersion: "extract-schema-v1",
        generation: deterministicGeneration,
    },
    verifier: {
        provider: "test",
        model: "verifier",
        promptVersion: "verify-v1",
        responseSchemaVersion: "verify-schema-v1",
        generation: deterministicGeneration,
    },
    feedbackComposer: {
        provider: "test",
        model: "composer",
        promptVersion: "compose-v1",
        responseSchemaVersion: "compose-schema-v1",
        generation: deterministicGeneration,
    },
};

describe("evidence-first evaluator runtime", () => {
    it("runs accepted stages through provider-neutral ports and retains only parsed artifacts and metadata", async () => {
        const evaluationCase = createCase();
        const extractor = vi.fn(async ({ task }: AdapterCall) => ({
            value: createExtraction(task.inputFingerprint, evaluationCase.providerInput.answer.text),
            tokenUsage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
        }));
        const composer = vi.fn(async ({ task }: AdapterCall) => ({
            value: createFeedback(task.inputFingerprint, readPatternGapId(task.input)),
            tokenUsage: { inputTokens: 8, outputTokens: 6 },
        }));

        const result = await runEvidenceFirstEvaluator({
            evaluationRunId: "run-1",
            evaluationCase,
            profile,
            adapters: createAdapters(extractor, composer),
            requestedAt: "2026-07-16T12:00:00.000Z",
        });

        expect(extractor).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, timeoutMs: 12_000 }));
        expect(composer).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, timeoutMs: 12_000 }));
        expect(result).toMatchObject({
            status: "evidence_first_evaluator_run_accepted",
            evaluationRunId: "run-1",
            inputFingerprint: evaluationCase.inputFingerprint,
            metrics: { tokenUsage: { inputTokens: 18, outputTokens: 10, totalTokens: 28 } },
            retention: { assembledPrompt: "not_captured", rawProviderOutput: "not_captured" },
        });
        expect(result.stages.map((stage) => stage.stage)).toEqual([
            "evidence_extraction",
            "feedback_composition",
        ]);
        expect(JSON.stringify(result.stages)).not.toContain(evaluationCase.providerInput.answer.text);
        expect(parseAcceptedEvidenceFirstEvaluatorRun(JSON.parse(JSON.stringify(result)))).toEqual(result);
    });

    it("owns retry count and retries one retryable extractor transport failure", async () => {
        const evaluationCase = createCase();
        const extractor = vi.fn()
            .mockRejectedValueOnce(new EvidenceFirstAdapterError({
                failureClass: "rate_limited",
                safeCode: "PROVIDER_RATE_LIMITED",
            }))
            .mockResolvedValueOnce({
                value: createExtraction(evaluationCase.inputFingerprint, evaluationCase.providerInput.answer.text),
            });

        const result = await runEvidenceFirstEvaluator({
            evaluationRunId: "run-retry",
            evaluationCase,
            profile,
            adapters: createAdapters(extractor, async ({ task }) => ({
                value: createFeedback(task.inputFingerprint, readPatternGapId(task.input)),
            })),
            requestedAt: "2026-07-16T12:00:00.000Z",
        });

        expect(extractor).toHaveBeenCalledTimes(2);
        expect(result.stages.slice(0, 2)).toMatchObject([
            { stage: "evidence_extraction", attempt: 1, outcome: "failed", failureClass: "rate_limited" },
            { stage: "evidence_extraction", attempt: 2, outcome: "accepted" },
        ]);
    });

    it("permits one bounded re-extraction for an allowlisted exact-span failure", async () => {
        const evaluationCase = createCase();
        const invalid = createExtraction(evaluationCase.inputFingerprint, evaluationCase.providerInput.answer.text);
        invalid.evidenceSpans[0] = { ...invalid.evidenceSpans[0], start: 1 };
        const extractor = vi.fn()
            .mockResolvedValueOnce({ value: invalid })
            .mockResolvedValueOnce({
                value: createExtraction(evaluationCase.inputFingerprint, evaluationCase.providerInput.answer.text),
            });

        const result = await runEvidenceFirstEvaluator({
            evaluationRunId: "run-reextract",
            evaluationCase,
            profile,
            adapters: createAdapters(extractor, async ({ task }) => ({
                value: createFeedback(task.inputFingerprint, readPatternGapId(task.input)),
            })),
            requestedAt: "2026-07-16T12:00:00.000Z",
        });

        expect(extractor).toHaveBeenCalledTimes(2);
        expect(result.stages[0]).toMatchObject({
            outcome: "rejected",
            errorCode: "EVIDENCE_SPAN_NOT_EXACT",
            failureClass: "validation_rejected",
        });
    });

    it("does not retry a fingerprint mismatch or persist candidate feedback", async () => {
        const evaluationCase = createCase();
        const extractor = vi.fn(async () => ({
            value: createExtraction("b".repeat(64), evaluationCase.providerInput.answer.text),
        }));
        const composer = vi.fn();

        await expect(runEvidenceFirstEvaluator({
            evaluationRunId: "run-mismatch",
            evaluationCase,
            profile,
            adapters: createAdapters(extractor, composer),
            requestedAt: "2026-07-16T12:00:00.000Z",
        })).rejects.toMatchObject({
            disposition: "rejected",
            errorCode: "EXTRACTION_INPUT_MISMATCH",
            retryableByNewRun: false,
        });
        expect(extractor).toHaveBeenCalledOnce();
        expect(composer).not.toHaveBeenCalled();
    });

    it("uses the structured verifier once when deterministic appraisal requires it", async () => {
        const evaluationCase = createTechnicalCase();
        const verifier = vi.fn(async ({ task }: AdapterCall) => ({
            value: {
                status: "evidence_verification_output",
                schemaVersion: 1,
                inputFingerprint: task.inputFingerprint,
                supported: true,
                issueCodes: [],
                recommendedAction: "accept",
            },
        }));
        const adapters = createAdapters(
            async () => ({ value: createTechnicalExtraction(evaluationCase.inputFingerprint, evaluationCase.providerInput.answer.text) }),
            async ({ task }) => ({ value: createFeedback(task.inputFingerprint, readPatternGapId(task.input)) }),
        );
        adapters.verifier = { descriptor: profile.verifier!, invoke: verifier };

        const result = await runEvidenceFirstEvaluator({
            evaluationRunId: "run-verify",
            evaluationCase,
            profile,
            adapters,
            requestedAt: "2026-07-16T12:00:00.000Z",
        });

        expect(verifier).toHaveBeenCalledOnce();
        expect(verifier).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, timeoutMs: 12_000 }));
        expect(verifier.mock.calls[0][0].task).toMatchObject({
            task: "verify_answer_evidence",
            input: {
                reviewTriggers: ["technical_reference_coverage_partial"],
            },
        });
        expect(result.accepted.verification).toMatchObject({ required: true, output: { supported: true } });
    });

    it("enforces the aggregate budget before a later stage can start", async () => {
        const evaluationCase = createCase();
        let elapsed = 0;
        const composer = vi.fn();
        const adapters = createAdapters(async () => {
            elapsed = 45_001;
            return { value: createExtraction(evaluationCase.inputFingerprint, evaluationCase.providerInput.answer.text) };
        }, composer);

        await expect(runEvidenceFirstEvaluator({
            evaluationRunId: "run-budget",
            evaluationCase,
            profile,
            adapters,
            requestedAt: "2026-07-16T12:00:00.000Z",
            dependencies: { nowMs: () => elapsed },
        })).rejects.toEqual(expect.objectContaining({
            disposition: "failed",
            errorCode: "EVALUATOR_BUDGET_EXHAUSTED",
            stage: "feedback_composition",
        } satisfies Partial<EvidenceFirstEvaluatorRuntimeError>));
        expect(composer).not.toHaveBeenCalled();
    });

    it("rejects a stored run when a nested candidate projection fingerprint is changed", async () => {
        const evaluationCase = createCase();
        const result = await runEvidenceFirstEvaluator({
            evaluationRunId: "run-parse",
            evaluationCase,
            profile,
            adapters: createAdapters(
                async () => ({ value: createExtraction(evaluationCase.inputFingerprint, evaluationCase.providerInput.answer.text) }),
                async ({ task }) => ({ value: createFeedback(task.inputFingerprint, readPatternGapId(task.input)) }),
            ),
            requestedAt: "2026-07-16T12:00:00.000Z",
        });
        const changed = structuredClone(result);
        changed.accepted.candidateProjection.inputFingerprint = "c".repeat(64);

        expect(parseAcceptedEvidenceFirstEvaluatorRun(changed)).toBeNull();
    });
});

type AdapterCall = {
    task: { inputFingerprint: string; input: unknown };
    attempt: number;
    timeoutMs: number;
    signal: AbortSignal;
};

function readPatternGapId(value: unknown) {
    if (
        !value
        || typeof value !== "object"
        || Array.isArray(value)
        || !("patternGap" in value)
        || !value.patternGap
        || typeof value.patternGap !== "object"
        || Array.isArray(value.patternGap)
        || !("id" in value.patternGap)
        || typeof value.patternGap.id !== "string"
    ) {
        throw new Error("Expected a structured feedback composer task.");
    }
    return value.patternGap.id;
}

function createAdapters(
    extractor: EvidenceFirstEvaluatorRuntimeAdapters["evidenceExtractor"]["invoke"],
    composer: EvidenceFirstEvaluatorRuntimeAdapters["feedbackComposer"]["invoke"],
): EvidenceFirstEvaluatorRuntimeAdapters {
    return {
        evidenceExtractor: { descriptor: profile.evidenceExtractor, invoke: extractor },
        verifier: {
            descriptor: profile.verifier!,
            invoke: async ({ task }) => ({
                value: {
                    status: "evidence_verification_output",
                    schemaVersion: 1,
                    inputFingerprint: task.inputFingerprint,
                    supported: true,
                    issueCodes: [],
                    recommendedAction: "accept",
                },
            }),
        },
        feedbackComposer: { descriptor: profile.feedbackComposer, invoke: composer },
    };
}

function createCase() {
    return createEvidenceFirstEvaluationCase({
        answerAttemptId: "attempt-1",
        question: {
            slotId: "slot-1",
            questionIndex: 0,
            category: "behavioral",
            questionText: "Tell me about a time you solved a customer problem.",
            plannedPurpose: "Show a clear example and personal action.",
        },
        answer: {
            mode: "text",
            text: "I listened to the customer and explained the next step.",
            submittedAt: "2026-07-16T11:59:00.000Z",
        },
        roleContext: {
            targetRole: "Customer Service Representative",
            interviewStage: "first_interview",
            jobDescription: "Help customers resolve account questions.",
            resumeText: null,
        },
    });
}

function createTechnicalCase() {
    return createEvidenceFirstEvaluationCase({
        answerAttemptId: "attempt-technical",
        question: {
            slotId: "slot-technical",
            questionIndex: 0,
            category: "technical_role_specific",
            questionText: "How do you inspect a finished package?",
            plannedPurpose: "Show job-specific inspection judgment.",
        },
        answer: {
            mode: "text",
            text: "I compare the label to the work order before release.",
            submittedAt: "2026-07-16T11:59:00.000Z",
        },
        roleContext: {
            targetRole: "Quality Control Inspector",
            interviewStage: "first_interview",
            jobDescription: "Inspect labels and finished packaging.",
            resumeText: null,
        },
        technicalReference: {
            source: "curated",
            version: "qc-v1",
            expectedConcepts: [
                { id: "label_match", description: "Compare the label to the work order." },
                { id: "seal_check", description: "Check package seal integrity." },
            ],
            acceptableAlternatives: [],
            commonMisconceptions: [],
        },
    });
}

function createExtraction(inputFingerprint: string, answerText: string): EvidenceExtractionOutput {
    return {
        status: "evidence_extraction_output",
        schemaVersion: 1,
        inputFingerprint,
        questionCategory: "behavioral",
        answerUsability: { status: "usable", reasonCode: "usable_answer" },
        observableMarkers: {
            answeredQuestion: true,
            hasDirectAnswer: true,
            hasExample: false,
            hasSpecificDetails: false,
            hasPersonalAction: false,
            hasOutcomeOrTakeaway: false,
            hasTradeoffOrConstraint: false,
            hasRoleRelevantSkillSignal: false,
            isOverlyLong: false,
            isVeryShort: false,
        },
        evidenceSpans: [{
            id: "direct",
            marker: "direct_answer",
            quote: answerText,
            start: 0,
            end: answerText.length,
        }],
        categorySignals: [
            { id: "has_context", status: "not_observed", evidenceSpanIds: [] },
            { id: "has_personal_action", status: "not_observed", evidenceSpanIds: [] },
            { id: "has_result", status: "not_observed", evidenceSpanIds: [] },
            { id: "has_learning", status: "not_observed", evidenceSpanIds: [] },
            { id: "has_constraint", status: "not_observed", evidenceSpanIds: [] },
        ],
        technicalAccuracy: { status: "not_assessed", referenceConceptIds: [], evidenceSpanIds: [] },
        missingEvidence: ["specific_support"],
        sensitiveContentFlags: [],
        unsafeInferenceFlags: [],
    };
}

function createTechnicalExtraction(inputFingerprint: string, answerText: string): EvidenceExtractionOutput {
    return {
        ...createExtraction(inputFingerprint, answerText),
        questionCategory: "technical_role_specific",
        categorySignals: [
            { id: "has_direct_technical_answer", status: "not_observed", evidenceSpanIds: [] },
            { id: "has_correct_concept", status: "not_observed", evidenceSpanIds: [] },
            { id: "has_reasoning", status: "not_observed", evidenceSpanIds: [] },
            { id: "has_practical_application", status: "not_observed", evidenceSpanIds: [] },
            { id: "has_tradeoff", status: "not_observed", evidenceSpanIds: [] },
        ],
        technicalAccuracy: {
            status: "supported",
            referenceConceptIds: ["label_match"],
            evidenceSpanIds: ["direct"],
        },
    };
}

function createFeedback(inputFingerprint: string, patternGapId: string): FeedbackCompositionOutput {
    return {
        status: "feedback_composition_output",
        schemaVersion: 1,
        inputFingerprint,
        feedbackPlan: {
            centralRead: "The answer is direct and needs one more supporting detail.",
            signal: { valence: "mixed", detectability: "moderate" },
            primaryAnchor: { kind: "pattern_gap", id: patternGapId },
            intervention: "revise_answer",
        },
        candidateFeedback: {
            acknowledgement: "You gave me a direct starting point.",
            primaryStrength: "Your starting point is easy to find.",
            biggestUpgrade: "Add one concrete detail that shows what happened.",
            redoPrompt: "Try it again with the detail and result.",
            patternSuggestion: null,
            deliveryNote: null,
        },
        claimEvidence: {
            acknowledgementSpanIds: ["direct"],
            primaryStrengthSpanIds: ["direct"],
        },
    };
}
