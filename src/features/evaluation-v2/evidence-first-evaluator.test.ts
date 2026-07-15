import { describe, expect, it } from "vitest";

import {
    createEvidenceFirstEvaluationCase,
    createEvidenceExtractorTask,
    createSafeEvaluatorTelemetryEvent,
    type EvidenceExtractionOutput,
    type EvidenceFirstEvaluationCase,
} from "./evidence-first-evaluator-contract";
import {
    createEvidenceFirstQaCaseCapture,
    createEvidenceFirstQaRunCapture,
    createFeedbackComposerTask,
    resolveEvidenceVerification,
    validateAndAppraiseEvidence,
    validateFeedbackComposition,
    type AcceptedEvidenceFirstAppraisal,
} from "./evidence-first-evaluator";

describe("evidence-first evaluator contract", () => {
    it("fixes one immutable answer-attempt input while excluding identity from the provider task", () => {
        const evaluationCase = createCase({
            answerText: "I can start two weeks after an offer.",
            category: "screening",
        });

        const task = createEvidenceExtractorTask(evaluationCase);

        expect(evaluationCase.answerAttemptId).toBe("attempt-1");
        expect(evaluationCase.inputFingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(JSON.stringify(task.input)).not.toContain("attempt-1");
        expect(JSON.stringify(task.input)).not.toMatch(/candidateProfileId|email|displayName|token|cookie/i);
    });

    it("validates nonblank source text without mutating exact answer offsets", () => {
        const evaluationCase = createCase({ answerText: "  I resolved it.  " });

        expect(evaluationCase.providerInput.answer.text).toBe("  I resolved it.  ");
        expect(createSpan(evaluationCase.providerInput.answer.text, "I resolved it.", "direct_answer", "direct"))
            .toMatchObject({ start: 2, end: 16 });
    });

    it("rejects provider input that exceeds the evaluator answer budget", () => {
        expect(() => createCase({ answerText: "a".repeat(20_001) })).toThrow();
    });

    it("rejects evidence whose quote and offsets do not exactly map to the submitted answer", () => {
        const evaluationCase = createCase({ answerText: "I resolved the issue." });
        const extraction = createExtraction(evaluationCase, {
            evidenceSpans: [{
                id: "span-1",
                marker: "direct_answer",
                quote: "resolved the issue",
                start: 0,
                end: 18,
            }],
        });

        expect(validateAndAppraiseEvidence({ evaluationCase, value: extraction })).toMatchObject({
            disposition: "rejected",
            issues: expect.arrayContaining([{ code: "evidence_span_not_exact", path: "span-1" }]),
        });
    });

    it("does not penalize a short, sufficient screening answer for evidence the question did not elicit", () => {
        const answerText = "I can start two weeks after an offer.";
        const evaluationCase = createCase({ answerText, category: "screening" });
        const direct = createSpan(answerText, "I can start two weeks after an offer.", "direct_answer", "direct");
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: {
                answeredQuestion: true,
                hasDirectAnswer: true,
                isVeryShort: true,
            },
            evidenceSpans: [direct],
            categorySignals: [{
                id: "has_logistics_clarity",
                status: "observed",
                evidenceSpanIds: [direct.id],
            }],
        });

        const result = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(result.disposition).toBe("accepted");
        if (result.disposition !== "accepted") {
            throw new Error("Expected accepted appraisal.");
        }
        expect(findCriterion(result, "answer_focus")).toMatchObject({ applicability: "observed", band: "strong" });
        expect(findCriterion(result, "organization")).toMatchObject({ applicability: "observed", band: "strong" });
        expect(findCriterion(result, "evidence_specificity")).toMatchObject({ applicability: "not_elicited" });
        expect(findCriterion(result, "evidence_specificity")).not.toHaveProperty("band");
    });

    it("preserves a behavioral team result while identifying the missing personal action", () => {
        const answerText = "We worked together to fix the issue and the customer was happy.";
        const evaluationCase = createCase({ answerText, category: "behavioral" });
        const context = createSpan(answerText, "We worked together to fix the issue", "example", "context");
        const direct = createSpan(answerText, "We worked together to fix the issue", "direct_answer", "direct");
        const resultSpan = createSpan(answerText, "the customer was happy", "outcome", "result");
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: {
                answeredQuestion: true,
                hasDirectAnswer: true,
                hasExample: true,
                hasOutcomeOrTakeaway: true,
            },
            evidenceSpans: [direct, context, resultSpan],
            categorySignals: [
                { id: "has_context", status: "observed", evidenceSpanIds: [context.id] },
                { id: "has_personal_action", status: "not_observed", evidenceSpanIds: [] },
                { id: "has_result", status: "observed", evidenceSpanIds: [resultSpan.id] },
            ],
        });

        const result = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(result).toMatchObject({
            disposition: "accepted",
            patternGap: {
                id: "missing_personal_action",
                source: "category_lens",
            },
        });
    });

    it("detects a scenario answer that jumps to a recommendation before framing the problem", () => {
        const answerText = "I would ask the team to move faster and work overtime.";
        const evaluationCase = createCase({ answerText, category: "case_scenario" });
        const direct = createSpan(answerText, answerText, "direct_answer", "direct");
        const recommendation = createSpan(answerText, "ask the team to move faster", "recommendation", "recommendation");
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: { answeredQuestion: true, hasDirectAnswer: true },
            evidenceSpans: [direct, recommendation],
            categorySignals: [
                { id: "has_problem_framing", status: "not_observed", evidenceSpanIds: [] },
                { id: "has_recommendation", status: "observed", evidenceSpanIds: [recommendation.id] },
            ],
        });

        expect(validateAndAppraiseEvidence({ evaluationCase, value: extraction })).toMatchObject({
            disposition: "accepted",
            patternGap: { id: "missing_problem_framing", source: "category_lens" },
        });
    });

    it("keeps generic culture language evidence-based instead of inferring personality", () => {
        const answerText = "I like positive teams where everyone communicates and supports each other.";
        const evaluationCase = createCase({ answerText, category: "culture_fit" });
        const direct = createSpan(answerText, answerText, "direct_answer", "direct");
        const motivation = createSpan(answerText, "positive teams", "motivation", "motivation");
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: { answeredQuestion: true, hasDirectAnswer: true },
            evidenceSpans: [direct, motivation],
            categorySignals: [
                { id: "has_motivation", status: "observed", evidenceSpanIds: [motivation.id] },
                { id: "has_specific_example", status: "not_observed", evidenceSpanIds: [] },
            ],
        });

        expect(validateAndAppraiseEvidence({ evaluationCase, value: extraction })).toMatchObject({
            disposition: "accepted",
            patternGap: { id: "generic_motivation", source: "category_lens" },
        });
    });

    it("keeps technical role-skill evidence unscoreable when no versioned reference exists", () => {
        const answerText = "An index is a lookup structure. It can speed reads but adds write cost.";
        const evaluationCase = createCase({ answerText, category: "technical_role_specific" });
        const direct = createSpan(answerText, "An index is a lookup structure.", "direct_answer", "direct");
        const detail = createSpan(answerText, "lookup structure", "specific_detail", "detail");
        const tradeoff = createSpan(answerText, "adds write cost", "tradeoff", "tradeoff");
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: {
                answeredQuestion: true,
                hasDirectAnswer: true,
                hasTradeoffOrConstraint: true,
                hasSpecificDetails: true,
            },
            evidenceSpans: [direct, detail, tradeoff],
            categorySignals: [
                { id: "has_direct_technical_answer", status: "observed", evidenceSpanIds: [direct.id] },
                { id: "has_reasoning", status: "not_observed", evidenceSpanIds: [] },
                { id: "has_tradeoff", status: "observed", evidenceSpanIds: [tradeoff.id] },
            ],
        });

        const result = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(result.disposition).toBe("accepted");
        if (result.disposition !== "accepted") {
            throw new Error("Expected accepted appraisal.");
        }
        expect(findCriterion(result, "role_skill_signal")).toEqual({
            criterionId: "role_skill_signal",
            applicability: "unscoreable",
            evidenceSpanIds: [],
            reasonCode: "technical_reference_not_supplied",
        });
    });

    it("requires verification before coaching from a contradicted technical claim", () => {
        const answerText = "Indexing encrypts the database so searches are more secure.";
        const evaluationCase = createCase({
            answerText,
            category: "technical_role_specific",
            technicalReference: {
                source: "curated",
                version: "database-indexing-v1",
                expectedConcepts: [{ id: "lookup_structure", description: "An index is a lookup structure." }],
                acceptableAlternatives: [],
                commonMisconceptions: ["An index encrypts the database."],
            },
        });
        const direct = createSpan(answerText, answerText, "direct_answer", "direct");
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: { answeredQuestion: true, hasDirectAnswer: true },
            evidenceSpans: [direct],
            categorySignals: [
                { id: "has_direct_technical_answer", status: "observed", evidenceSpanIds: [direct.id] },
                { id: "has_correct_concept", status: "not_observed", evidenceSpanIds: [] },
            ],
            technicalAccuracy: {
                status: "contradicted",
                referenceConceptIds: ["lookup_structure"],
                evidenceSpanIds: [direct.id],
            },
        });

        const pending = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(pending).toMatchObject({
            disposition: "verification_required",
            verificationReasons: ["technical_accuracy_contradicted"],
        });
        if (pending.disposition !== "verification_required") {
            throw new Error("Expected verification gate.");
        }
        const accepted = resolveEvidenceVerification({
            pending,
            value: {
                status: "evidence_verification_output",
                schemaVersion: 1,
                inputFingerprint: evaluationCase.inputFingerprint,
                supported: true,
                issueCodes: [],
                recommendedAction: "accept",
            },
        });
        expect(accepted.disposition).toBe("accepted");
    });

    it("routes a sensitive disclosure to a privacy reframe rather than a low band", () => {
        const answerText = "I left because I had a medical issue and needed time away.";
        const evaluationCase = createCase({ answerText, category: "screening" });
        const sensitive = createSpan(answerText, "I had a medical issue", "context", "sensitive");
        const extraction = createExtraction(evaluationCase, {
            answerUsability: { status: "sensitive_disclosure", reasonCode: "private_health_detail" },
            evidenceSpans: [sensitive],
            sensitiveContentFlags: ["health_or_disability_disclosure"],
        });

        const result = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(result).toMatchObject({
            disposition: "accepted",
            patternGap: { id: "privacy_reframe" },
        });
        if (result.disposition !== "accepted") {
            throw new Error("Expected accepted privacy appraisal.");
        }
        expect(result.criteria.every((criterion) => (
            criterion.applicability === "insufficient_data" && typeof criterion.band === "undefined"
        ))).toBe(true);
        const composerTask = createFeedbackComposerTask({ evaluationCase, appraisal: result });
        expect(composerTask.input.acceptedEvidenceSpans).toEqual([]);
        expect(JSON.stringify(composerTask.input)).not.toContain("medical issue");
    });

    it("rejects an extractor that attempts a protected or style-based inference", () => {
        const evaluationCase = createCase({ answerText: "I would call the customer back." });
        const extraction = createExtraction(evaluationCase, {
            unsafeInferenceFlags: ["accent"],
        });

        expect(validateAndAppraiseEvidence({ evaluationCase, value: extraction })).toMatchObject({
            disposition: "rejected",
            issues: [{ code: "unsafe_inference", path: "accent" }],
        });
    });

    it("rejects observable marker claims that are not grounded in an exact span", () => {
        const evaluationCase = createCase({ answerText: "I called the customer back." });
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: { answeredQuestion: true, hasPersonalAction: true },
        });

        expect(validateAndAppraiseEvidence({ evaluationCase, value: extraction })).toMatchObject({
            disposition: "rejected",
            issues: [{ code: "observable_marker_missing_span", path: "hasPersonalAction" }],
        });
    });

    it("rejects unsupported praise and score language before candidate projection", () => {
        const { evaluationCase, appraisal } = createAcceptedBehavioralAppraisal();
        const feedback = createFeedback(evaluationCase, appraisal, {
            primaryStrength: "That was a strong 5/5 answer.",
            primaryStrengthSpanIds: [],
        });

        expect(validateFeedbackComposition({ evaluationCase, appraisal, value: feedback })).toMatchObject({
            status: "feedback_rejected",
            issues: expect.arrayContaining([
                { code: "unsupported_strength_claim" },
                expect.objectContaining({ code: "candidate_feedback_forbidden_language" }),
            ]),
        });
    });

    it("projects only validated candidate-safe coaching and keeps the hidden plan internal", () => {
        const { evaluationCase, appraisal } = createAcceptedBehavioralAppraisal();
        const evidenceSpanId = appraisal.evidence.evidenceSpans[0].id;
        const feedback = createFeedback(evaluationCase, appraisal, {
            primaryStrength: "You gave a concrete example from your own work.",
            primaryStrengthSpanIds: [evidenceSpanId],
        });

        const result = validateFeedbackComposition({ evaluationCase, appraisal, value: feedback });

        expect(result.status).toBe("feedback_accepted");
        if (result.status !== "feedback_accepted") {
            throw new Error("Expected accepted feedback.");
        }
        expect(result.candidateProjection).toMatchObject({
            status: "candidate_safe_feedback",
            primaryStrength: "You gave a concrete example from your own work.",
        });
        expect(result.candidateProjection).not.toHaveProperty("feedbackPlan");
        expect(JSON.stringify(result.candidateProjection)).not.toMatch(/score|\d\s*\/\s*5/i);
        expect(createFeedbackComposerTask({ evaluationCase, appraisal }).input).not.toHaveProperty("answer.text");
    });

    it("emits metadata-only evaluator telemetry without answer, JD, resume, or prompt content", () => {
        const event = createSafeEvaluatorTelemetryEvent({
            evaluationRunId: "run-1",
            answerAttemptId: "attempt-1",
            inputFingerprint: "a".repeat(64),
            stage: "evidence_extraction",
            outcome: "completed",
            descriptor: { provider: "provider", model: "model", promptVersion: "prompt-v1" },
            latencyMs: 420,
            tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        expect(event).toMatchObject({
            event: "candidate_evaluator_stage_finished",
            provider: "provider",
            model: "model",
            promptVersion: "prompt-v1",
        });
        expect(JSON.stringify(event)).not.toMatch(/answerText|jobDescription|resumeText|systemPolicy|promptContent/);
    });

    it("captures a reproducible restricted QA case and parsed run without an app-source axis or raw prompts", () => {
        const { evaluationCase, appraisal } = createAcceptedBehavioralAppraisal();
        const evidenceSpanId = appraisal.evidence.evidenceSpans[0].id;
        const validatedFeedback = validateFeedbackComposition({
            evaluationCase,
            appraisal,
            value: createFeedback(evaluationCase, appraisal, {
                primaryStrength: "You grounded the answer in a work example.",
                primaryStrengthSpanIds: [evidenceSpanId],
            }),
        });
        if (validatedFeedback.status !== "feedback_accepted") {
            throw new Error("Expected accepted feedback fixture.");
        }
        const qaCase = createEvidenceFirstQaCaseCapture(evaluationCase);
        const run = createEvidenceFirstQaRunCapture({
            runId: "run-1",
            qaCase,
            profile: {
                profileId: "pipeline-a",
                evaluatorVersion: "candidate_evidence_first_v1",
                promptBundleVersion: "candidate_evidence_first_prompts_v1",
                evidenceExtractor: { provider: "provider", model: "extractor", promptVersion: "extract-v1" },
                feedbackComposer: { provider: "provider", model: "composer", promptVersion: "compose-v1" },
            },
            appraisal,
            feedback: validatedFeedback,
            requestedAt: "2026-07-14T12:00:01.000Z",
            completedAt: "2026-07-14T12:00:02.000Z",
        });

        expect(qaCase.evaluatorInput.answer.text).toBe(evaluationCase.providerInput.answer.text);
        expect(qaCase.privacy).toEqual({
            candidateIdentity: "excluded",
            sourceTextAccess: "restricted_qa_content",
            containsResumeText: false,
        });
        expect(run.retention).toEqual({ assembledPrompt: "not_captured", rawProviderOutput: "not_captured" });
        expect(JSON.stringify(run)).not.toMatch(/sourceApp|appName|candidateProfileId|email|displayName/);
    });
});

function createCase(input: {
    answerText: string;
    category?: EvidenceFirstEvaluationCase["providerInput"]["question"]["category"];
    technicalReference?: EvidenceFirstEvaluationCase["providerInput"]["technicalReference"];
}) {
    return createEvidenceFirstEvaluationCase({
        answerAttemptId: "attempt-1",
        question: {
            slotId: "q1",
            questionIndex: 0,
            category: input.category ?? "behavioral",
            questionText: "Tell me about your approach.",
            plannedPurpose: "Practice a role-relevant answer.",
        },
        answer: {
            mode: "text",
            text: input.answerText,
            submittedAt: "2026-07-14T12:00:00.000Z",
        },
        roleContext: {
            targetRole: "Customer Service Representative",
            interviewStage: "first_interview",
            jobDescription: "Support customers, document issues, and follow through.",
            resumeText: null,
        },
        technicalReference: input.technicalReference,
    });
}

function createExtraction(
    evaluationCase: EvidenceFirstEvaluationCase,
    overrides: Partial<Omit<EvidenceExtractionOutput, "observableMarkers" | "answerUsability">> & {
        observableMarkers?: Partial<EvidenceExtractionOutput["observableMarkers"]>;
        answerUsability?: EvidenceExtractionOutput["answerUsability"];
    } = {},
): EvidenceExtractionOutput {
    return {
        status: "evidence_extraction_output",
        schemaVersion: 1,
        inputFingerprint: evaluationCase.inputFingerprint,
        questionCategory: evaluationCase.providerInput.question.category,
        answerUsability: overrides.answerUsability ?? { status: "usable", reasonCode: "answer_available" },
        observableMarkers: {
            answeredQuestion: false,
            hasDirectAnswer: false,
            hasExample: false,
            hasSpecificDetails: false,
            hasPersonalAction: false,
            hasOutcomeOrTakeaway: false,
            hasTradeoffOrConstraint: false,
            hasRoleRelevantSkillSignal: false,
            isOverlyLong: false,
            isVeryShort: false,
            ...overrides.observableMarkers,
        },
        evidenceSpans: overrides.evidenceSpans ?? [],
        categorySignals: overrides.categorySignals ?? [],
        technicalAccuracy: overrides.technicalAccuracy ?? {
            status: "not_assessed",
            referenceConceptIds: [],
            evidenceSpanIds: [],
        },
        missingEvidence: overrides.missingEvidence ?? [],
        sensitiveContentFlags: overrides.sensitiveContentFlags ?? [],
        unsafeInferenceFlags: overrides.unsafeInferenceFlags ?? [],
    };
}

function createSpan(
    answerText: string,
    quote: string,
    marker: EvidenceExtractionOutput["evidenceSpans"][number]["marker"],
    id: string,
) {
    const start = answerText.indexOf(quote);
    if (start < 0) {
        throw new Error(`Missing test quote: ${quote}`);
    }
    return { id, marker, quote, start, end: start + quote.length };
}

function findCriterion(appraisal: AcceptedEvidenceFirstAppraisal, criterionId: string) {
    return appraisal.criteria.find((criterion) => criterion.criterionId === criterionId);
}

function createAcceptedBehavioralAppraisal() {
    const answerText = "At my last job, an order was delayed. I called the warehouse and updated the customer. The order arrived the next day.";
    const evaluationCase = createCase({ answerText, category: "behavioral" });
    const context = createSpan(answerText, "At my last job, an order was delayed.", "example", "context");
    const direct = createSpan(answerText, "At my last job, an order was delayed.", "direct_answer", "direct");
    const action = createSpan(answerText, "I called the warehouse and updated the customer.", "personal_action", "action");
    const detail = createSpan(answerText, "called the warehouse", "specific_detail", "detail");
    const roleSignal = createSpan(answerText, "updated the customer", "role_skill_signal", "role-signal");
    const outcome = createSpan(answerText, "The order arrived the next day.", "outcome", "outcome");
    const extraction = createExtraction(evaluationCase, {
        observableMarkers: {
            answeredQuestion: true,
            hasDirectAnswer: true,
            hasExample: true,
            hasSpecificDetails: true,
            hasPersonalAction: true,
            hasOutcomeOrTakeaway: true,
            hasRoleRelevantSkillSignal: true,
        },
        evidenceSpans: [direct, context, action, detail, roleSignal, outcome],
        categorySignals: [
            { id: "has_context", status: "observed", evidenceSpanIds: [context.id] },
            { id: "has_personal_action", status: "observed", evidenceSpanIds: [action.id] },
            { id: "has_result", status: "observed", evidenceSpanIds: [outcome.id] },
        ],
    });
    const appraisal = validateAndAppraiseEvidence({ evaluationCase, value: extraction });
    if (appraisal.disposition !== "accepted") {
        throw new Error("Expected accepted behavioral appraisal fixture.");
    }
    return { evaluationCase, appraisal };
}

function createFeedback(
    evaluationCase: EvidenceFirstEvaluationCase,
    appraisal: AcceptedEvidenceFirstAppraisal,
    overrides: {
        primaryStrength: string | null;
        primaryStrengthSpanIds: string[];
    },
) {
    return {
        status: "feedback_composition_output",
        schemaVersion: 1,
        inputFingerprint: evaluationCase.inputFingerprint,
        feedbackPlan: {
            centralRead: "The answer is relevant and would benefit from one clearer takeaway.",
            signal: { valence: "mixed", detectability: "clear" },
            primaryAnchor: { kind: "pattern_gap", id: appraisal.patternGap.id },
            intervention: "polish_then_continue",
        },
        candidateFeedback: {
            acknowledgement: "You answered with a relevant work example.",
            primaryStrength: overrides.primaryStrength,
            biggestUpgrade: "Make the result and what you learned easier to hear.",
            redoPrompt: null,
            patternSuggestion: {
                patternName: "Context, action, result",
                steps: ["Name the situation", "Explain your action", "End with the result"],
            },
            deliveryNote: null,
        },
        claimEvidence: {
            acknowledgementSpanIds: [],
            primaryStrengthSpanIds: overrides.primaryStrengthSpanIds,
        },
    };
}
