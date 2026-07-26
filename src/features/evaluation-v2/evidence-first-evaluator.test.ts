import { describe, expect, it } from "vitest";

import {
    UNIVERSAL_CRITERION_IDS,
    createEvidenceFirstEvaluationCase,
    createEvidenceExtractorTask,
    createEvaluatorRunDescriptor,
    createSafeEvaluatorTelemetryEvent,
    type EvidenceExtractionOutput,
    type EvidenceFirstEvaluationCase,
} from "./evidence-first-evaluator-contract";
import {
    createEvidenceFirstQaCaseCapture,
    createEvidenceFirstQaRunCapture,
    createFeedbackComposerTask,
    containsEvidenceFirstFeedbackForbiddenLanguage,
    resolveCoachingCompletionDirective,
    resolveEvidenceVerification,
    validateAndAppraiseEvidence,
    validateFeedbackComposition,
    type AcceptedEvidenceFirstAppraisal,
} from "./evidence-first-evaluator";

describe("evidence-first evaluator contract", () => {
    it("does not reject score-like language when it faithfully recapitulates candidate-provided context", () => {
        expect(containsEvidenceFirstFeedbackForbiddenLanguage(
            "You scored 100% on the required safety assessment.",
            "I scored 100% on the required safety assessment.",
        )).toBe(false);
        expect(containsEvidenceFirstFeedbackForbiddenLanguage(
            "You scored 100% on this practice.",
            "I completed the required safety assessment.",
        )).toBe(true);
        expect(containsEvidenceFirstFeedbackForbiddenLanguage(
            "Answer directly without discussing your family status.",
            "I left my last role because of a change in my family status.",
        )).toBe(false);
    });

    it("fingerprints the complete resolved stage configuration without content or credentials", () => {
        const profile = createModelProfile();
        const descriptor = createEvaluatorRunDescriptor(profile);
        const changedDescriptor = createEvaluatorRunDescriptor({
            ...profile,
            feedbackComposer: {
                ...profile.feedbackComposer,
                generation: {
                    ...profile.feedbackComposer.generation,
                    temperature: 0.3,
                },
            },
        });

        expect(descriptor.configurationManifest).toMatchObject({
            configurationStatus: "resolved",
            profileId: "google_gemini_2_5_flash_v1",
            serviceMode: "gemini_api",
            stages: [
                { stage: "evidence_extraction", responseSchemaVersion: "evidence_extraction_output_v1" },
                { stage: "verification", responseSchemaVersion: "evidence_verification_output_v1" },
                { stage: "feedback_composition", responseSchemaVersion: "feedback_composition_output_v1" },
            ],
        });
        expect(descriptor.configurationFingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(changedDescriptor.configurationFingerprint).not.toBe(descriptor.configurationFingerprint);
        expect(JSON.stringify(descriptor.configurationManifest)).not.toMatch(/apiKey|secret|answerText|resumeText/i);
    });

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
        expect(task.input.allowedCategorySignalIds).toEqual([
            "has_role_connection",
            "has_next_step_readiness",
            "has_logistics_clarity",
            "has_professional_boundary",
        ]);
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
        const logistics = createSpan(answerText, "I can start two weeks after an offer.", "next_step", "logistics");
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: {
                answeredQuestion: true,
                hasDirectAnswer: false,
                isVeryShort: true,
            },
            evidenceSpans: [logistics],
            categorySignals: [{
                id: "has_logistics_clarity",
                status: "observed",
                evidenceSpanIds: [logistics.id],
            }],
        });

        const result = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(result.disposition).toBe("accepted");
        if (result.disposition !== "accepted") {
            throw new Error("Expected accepted appraisal.");
        }
        expect(findCriterion(result, "answer_focus")).toMatchObject({ applicability: "observed", band: "clear" });
        expect(findCriterion(result, "organization")).toMatchObject({ applicability: "observed", band: "clear" });
        expect(findCriterion(result, "evidence_specificity")).toMatchObject({ applicability: "not_elicited" });
        expect(findCriterion(result, "evidence_specificity")).not.toHaveProperty("band");
        expect(findCriterion(result, "role_skill_signal")).toMatchObject({ applicability: "not_elicited" });
        expect(result.patternGap).toMatchObject({ id: "polish_answer_focus", severity: "low" });
    });

    it("does not promote a thin answer from isolated direct-answer evidence", () => {
        const answerText = "I work hard.";
        const evaluationCase = createCase({ answerText, category: "screening" });
        const direct = createSpan(answerText, answerText, "direct_answer", "direct");
        const extraction = createExtraction(evaluationCase, {
            answerUsability: { status: "thin", reasonCode: "too_little_supporting_evidence" },
            observableMarkers: {
                answeredQuestion: true,
                hasDirectAnswer: true,
                isVeryShort: true,
            },
            evidenceSpans: [direct],
        });

        const result = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(result.disposition).toBe("accepted");
        if (result.disposition !== "accepted") {
            throw new Error("Expected accepted thin-answer appraisal.");
        }
        expect(result.criteria).toHaveLength(UNIVERSAL_CRITERION_IDS.length);
        expect(result.criteria).toEqual(expect.arrayContaining(
            UNIVERSAL_CRITERION_IDS.map((criterionId) => expect.objectContaining({
                criterionId,
                applicability: "observed",
                band: "emerging",
                reasonCode: "thin_answer_insufficient_evidence",
            })),
        ));
    });

    it("normalizes a provider-authored usable generic preference to thin when no development evidence exists", () => {
        const answerText = "I like positive teams where everyone communicates and supports each other.";
        const evaluationCase = createCase({ answerText, category: "culture_fit" });
        const direct = createSpan(answerText, answerText, "direct_answer", "direct");
        const detail = createSpan(answerText, "positive teams", "specific_detail", "detail");
        const extraction = createExtraction(evaluationCase, {
            answerUsability: { status: "usable", reasonCode: "provider_usable" },
            observableMarkers: {
                answeredQuestion: true,
                hasDirectAnswer: true,
                hasSpecificDetails: true,
                isVeryShort: true,
            },
            evidenceSpans: [direct, detail],
            categorySignals: [
                { id: "has_motivation", status: "observed", evidenceSpanIds: [direct.id] },
                { id: "has_self_awareness", status: "observed", evidenceSpanIds: [direct.id] },
            ],
        });

        const result = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(result.disposition).toBe("accepted");
        if (result.disposition !== "accepted") {
            throw new Error("Expected normalized thin appraisal.");
        }
        expect(result.evidence.answerUsability).toEqual({
            status: "thin",
            reasonCode: "code_thin_without_development_evidence",
        });
        expect(result.criteria.every((criterion) => (
            criterion.applicability === "observed" && criterion.band === "emerging"
        ))).toBe(true);
        expect(resolveCoachingCompletionDirective(result)).toMatchObject({
            posture: "remediate",
            intervention: "build_missing_signal",
        });
    });

    it("derives completion posture from the code-owned question-preparedness band", () => {
        const { appraisal } = createAcceptedBehavioralAppraisal();
        const withBands = (bands: Array<"strong" | "clear" | "emerging">): AcceptedEvidenceFirstAppraisal => ({
            ...appraisal,
            criteria: appraisal.criteria.map((criterion, index) => ({
                ...criterion,
                applicability: "observed",
                band: bands[index] ?? "strong",
            })),
        });

        expect(resolveCoachingCompletionDirective(withBands(["strong", "strong", "strong", "strong", "strong"])))
            .toMatchObject({ posture: "move_on", intervention: "affirm_and_continue" });
        expect(resolveCoachingCompletionDirective(withBands(["strong", "clear", "strong", "strong", "strong"])))
            .toMatchObject({ posture: "move_on", intervention: "affirm_and_continue" });
        expect(resolveCoachingCompletionDirective(withBands(["strong", "clear", "emerging", "clear", "clear"])))
            .toMatchObject({ posture: "polish", intervention: "polish_then_continue" });
        expect(resolveCoachingCompletionDirective(withBands(["clear", "emerging", "emerging", "clear", "emerging"])))
            .toMatchObject({ posture: "remediate", intervention: "revise_answer" });
    });

    it("keeps technical role skill emerging for a thin answer without a trusted reference", () => {
        const answerText = "It makes queries faster.";
        const evaluationCase = createCase({ answerText, category: "technical_role_specific" });
        const direct = createSpan(answerText, answerText, "direct_answer", "direct");
        const extraction = createExtraction(evaluationCase, {
            answerUsability: { status: "thin", reasonCode: "too_little_technical_evidence" },
            observableMarkers: {
                answeredQuestion: true,
                hasDirectAnswer: true,
                isVeryShort: true,
            },
            evidenceSpans: [direct],
            categorySignals: [{
                id: "has_direct_technical_answer",
                status: "observed",
                evidenceSpanIds: [direct.id],
            }],
        });

        const result = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(result.disposition).toBe("accepted");
        if (result.disposition !== "accepted") {
            throw new Error("Expected accepted thin technical appraisal.");
        }
        expect(findCriterion(result, "role_skill_signal")).toEqual({
            criterionId: "role_skill_signal",
            applicability: "observed",
            band: "emerging",
            evidenceSpanIds: [],
            reasonCode: "thin_answer_insufficient_evidence",
        });
        expect(findCriterion(result, "answer_focus")).toMatchObject({
            applicability: "observed",
            band: "emerging",
        });
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
            observableMarkers: {
                answeredQuestion: true,
                hasDirectAnswer: true,
                hasRoleRelevantSkillSignal: true,
            },
            evidenceSpans: [direct, recommendation],
            categorySignals: [
                { id: "has_problem_framing", status: "not_observed", evidenceSpanIds: [] },
                { id: "has_recommendation", status: "observed", evidenceSpanIds: [recommendation.id] },
            ],
        });

        const result = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(result).toMatchObject({
            disposition: "accepted",
            patternGap: { id: "missing_problem_framing", source: "category_lens" },
        });
        expect(result.disposition).toBe("accepted");
        if (result.disposition !== "accepted") {
            throw new Error("Expected accepted appraisal.");
        }
        expect(findCriterion(result, "role_skill_signal")).toMatchObject({
            applicability: "observed",
            band: "emerging",
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

    it("appraises technical role-skill evidence independently when no versioned reference exists", () => {
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
                hasRoleRelevantSkillSignal: true,
            },
            evidenceSpans: [direct, detail, tradeoff],
            categorySignals: [
                { id: "has_direct_technical_answer", status: "observed", evidenceSpanIds: [direct.id] },
                { id: "has_relevant_role_knowledge", status: "observed", evidenceSpanIds: [detail.id] },
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
            applicability: "observed",
            band: "clear",
            evidenceSpanIds: [direct.id, detail.id],
            reasonCode: "technical_role_skill_clear",
        });
        expect(result.evidence.technicalAccuracy.status).toBe("not_assessed");
    });

    it("recognizes a strong applied role-skill answer without claiming technical correctness", () => {
        const answerText = "I compare each label with the work order, scan the lot number, and hold any mismatch while I verify the approved procedure.";
        const evaluationCase = createCase({ answerText, category: "technical_role_specific" });
        const direct = createSpan(answerText, "I compare each label with the work order", "direct_answer", "direct");
        const knowledge = createSpan(answerText, "compare each label with the work order", "role_skill_signal", "knowledge");
        const application = createSpan(answerText, "scan the lot number", "practical_application", "application");
        const verification = createSpan(
            answerText,
            "hold any mismatch while I verify the approved procedure",
            "reasoning",
            "verification",
        );
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: {
                answeredQuestion: true,
                hasDirectAnswer: true,
                hasRoleRelevantSkillSignal: true,
            },
            evidenceSpans: [direct, knowledge, application, verification],
            categorySignals: [
                { id: "has_direct_technical_answer", status: "observed", evidenceSpanIds: [direct.id] },
                { id: "has_relevant_role_knowledge", status: "observed", evidenceSpanIds: [knowledge.id] },
                { id: "has_reasoning", status: "observed", evidenceSpanIds: [verification.id] },
                { id: "has_practical_application", status: "observed", evidenceSpanIds: [application.id] },
                { id: "has_verification_awareness", status: "observed", evidenceSpanIds: [verification.id] },
            ],
        });

        const result = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(result.disposition).toBe("accepted");
        if (result.disposition !== "accepted") throw new Error("Expected accepted technical appraisal.");
        expect(findCriterion(result, "role_skill_signal")).toMatchObject({
            applicability: "observed",
            band: "strong",
            reasonCode: "technical_role_skill_strong",
        });
        expect(result.evidence.technicalAccuracy.status).toBe("not_assessed");
    });

    it("does not infer role skill from resume context when the answer lacks role evidence", () => {
        const answerText = "I would try my best and ask someone what to do.";
        const evaluationCase = createCase({
            answerText,
            category: "technical_role_specific",
            resumeText: "Five years of warehouse quality inspection experience.",
        });
        const direct = createSpan(answerText, answerText, "direct_answer", "direct");
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: { answeredQuestion: true, hasDirectAnswer: true },
            evidenceSpans: [direct],
            categorySignals: [
                { id: "has_direct_technical_answer", status: "observed", evidenceSpanIds: [direct.id] },
                { id: "has_relevant_role_knowledge", status: "not_observed", evidenceSpanIds: [] },
                { id: "has_practical_application", status: "not_observed", evidenceSpanIds: [] },
            ],
        });

        const result = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(result.disposition).toBe("accepted");
        if (result.disposition !== "accepted") throw new Error("Expected accepted technical appraisal.");
        expect(findCriterion(result, "role_skill_signal")).toMatchObject({
            applicability: "observed",
            band: "emerging",
        });
        expect(result.patternGap.id).toBe("missing_role_specific_evidence");
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
        const roleKnowledge = createSpan(
            answerText,
            "Indexing encrypts the database",
            "role_skill_signal",
            "role-knowledge",
        );
        const reasoning = createSpan(
            answerText,
            "so searches are more secure",
            "reasoning",
            "reasoning",
        );
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: {
                answeredQuestion: true,
                hasDirectAnswer: true,
                hasRoleRelevantSkillSignal: true,
            },
            evidenceSpans: [direct, roleKnowledge, reasoning],
            categorySignals: [
                { id: "has_direct_technical_answer", status: "observed", evidenceSpanIds: [direct.id] },
                { id: "has_relevant_role_knowledge", status: "observed", evidenceSpanIds: [roleKnowledge.id] },
                { id: "has_reasoning", status: "observed", evidenceSpanIds: [reasoning.id] },
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
        expect(pending.criteria.find((criterion) => criterion.criterionId === "organization")).toMatchObject({
            applicability: "observed",
            band: "clear",
            reasonCode: "organization_technical_role_specific_clear",
        });
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

    it("does not promote impact judgment from the same technical evidence that is contradicted", () => {
        const answerText = "An index encrypts table data. It improves every operation without adding storage or slowing writes.";
        const evaluationCase = createCase({
            answerText,
            category: "technical_role_specific",
            technicalReference: {
                source: "curated",
                version: "database-indexing-v1",
                expectedConcepts: [
                    { id: "lookup_structure", description: "An index is a separate lookup structure." },
                    { id: "write_storage_tradeoff", description: "Indexes use storage and add write-maintenance cost." },
                ],
                acceptableAlternatives: [],
                commonMisconceptions: [
                    "An index encrypts table data.",
                    "An index has no storage or write cost.",
                ],
            },
        });
        const direct = createSpan(answerText, "An index encrypts table data.", "direct_answer", "direct");
        const tradeoff = createSpan(
            answerText,
            "without adding storage or slowing writes",
            "tradeoff",
            "tradeoff",
        );
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: {
                answeredQuestion: true,
                hasDirectAnswer: true,
                hasTradeoffOrConstraint: true,
            },
            evidenceSpans: [direct, tradeoff],
            categorySignals: [
                { id: "has_direct_technical_answer", status: "observed", evidenceSpanIds: [direct.id] },
                { id: "has_tradeoff", status: "observed", evidenceSpanIds: [tradeoff.id] },
            ],
            technicalAccuracy: {
                status: "contradicted",
                referenceConceptIds: ["lookup_structure", "write_storage_tradeoff"],
                evidenceSpanIds: [direct.id, tradeoff.id],
            },
        });

        const pending = validateAndAppraiseEvidence({ evaluationCase, value: extraction });

        expect(pending.disposition).toBe("verification_required");
        if (pending.disposition !== "verification_required") {
            throw new Error("Expected verification gate.");
        }
        expect(pending.criteria.find((criterion) => (
            criterion.criterionId === "impact_judgment_takeaway"
        ))).toEqual({
            criterionId: "impact_judgment_takeaway",
            applicability: "observed",
            band: "emerging",
            evidenceSpanIds: [tradeoff.id],
            reasonCode: "impact_judgment_technical_role_specific_emerging",
        });
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

    it("accepts whole-answer category evidence without inventing an exact span", () => {
        const evaluationCase = createCase({
            answerText: "I coordinated with the team so the work stayed on schedule.",
            category: "behavioral",
        });
        const extraction = createExtraction(evaluationCase, {
            observableMarkers: {
                hasExample: true,
            },
            categorySignals: [{
                id: "has_context",
                status: "observed",
                evidenceSpanIds: [],
            }],
        });

        expect(validateAndAppraiseEvidence({ evaluationCase, value: extraction })).toMatchObject({
            disposition: "accepted",
            evidence: {
                categorySignals: [{
                    id: "has_context",
                    status: "observed",
                    evidenceSpanIds: [],
                }],
            },
        });
    });

    it("rejects exact evidence attached to a signal that was not observed", () => {
        const answerText = "I coordinated with the team.";
        const evaluationCase = createCase({ answerText, category: "behavioral" });
        const context = createSpan(answerText, answerText, "context", "context");
        const extraction = createExtraction(evaluationCase, {
            evidenceSpans: [context],
            categorySignals: [{
                id: "has_context",
                status: "not_observed",
                evidenceSpanIds: [context.id],
            }],
        });

        expect(validateAndAppraiseEvidence({ evaluationCase, value: extraction })).toMatchObject({
            disposition: "rejected",
            issues: [{ code: "unobserved_signal_has_evidence", path: "has_context" }],
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

    it("rejects delivery-mechanics advice outside the voice-only delivery note", () => {
        const { evaluationCase, appraisal } = createAcceptedBehavioralAppraisal();
        const clearAppraisal: AcceptedEvidenceFirstAppraisal = {
            ...appraisal,
            criteria: appraisal.criteria.map((criterion) => ({
                ...criterion,
                applicability: "observed",
                band: "clear",
            })),
        };
        const feedback = createFeedback(evaluationCase, clearAppraisal, {
            primaryStrength: null,
            primaryStrengthSpanIds: [],
            biggestUpgrade: "Practice speaking clearly and at a steady pace.",
        });

        expect(validateFeedbackComposition({
            evaluationCase,
            appraisal: clearAppraisal,
            value: feedback,
        })).toMatchObject({
            status: "feedback_rejected",
            issues: expect.arrayContaining([{ code: "delivery_guidance_outside_delivery_note" }]),
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
            descriptor: {
                provider: "provider",
                model: "model",
                promptVersion: "prompt-v1",
                responseSchemaVersion: "extract-schema-v1",
                generation: { mode: "deterministic", structuredOutput: true },
            },
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
                evaluatorVersion: "candidate_evidence_first_v2",
                promptBundleVersion: "candidate_evidence_first_prompts_v14",
                serviceMode: "test",
                adapterVersion: "test_adapter_v1",
                evidenceExtractor: {
                    provider: "provider",
                    model: "extractor",
                    promptVersion: "extract-v1",
                    responseSchemaVersion: "extract-schema-v1",
                    generation: { mode: "deterministic", structuredOutput: true },
                },
                feedbackComposer: {
                    provider: "provider",
                    model: "composer",
                    promptVersion: "compose-v1",
                    responseSchemaVersion: "compose-schema-v1",
                    generation: { mode: "deterministic", structuredOutput: true },
                },
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
        expect(run.configurationManifest).toMatchObject({
            configurationStatus: "resolved",
            profileId: "pipeline-a",
        });
        expect(run.configurationFingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(JSON.stringify(run)).not.toMatch(/sourceApp|appName|candidateProfileId|email|displayName/);
    });
});

function createModelProfile() {
    const model = "gemini-2.5-flash";
    const provider = "google_genai";
    return {
        profileId: "google_gemini_2_5_flash_v1",
        evaluatorVersion: "candidate_evidence_first_v2" as const,
        promptBundleVersion: "candidate_evidence_first_prompts_v14" as const,
        serviceMode: "gemini_api",
        adapterVersion: "google_genai_evidence_first_adapter_v1",
        evidenceExtractor: {
            provider,
            model,
            promptVersion: "candidate_evidence_extraction_google_v1",
            responseSchemaVersion: "evidence_extraction_output_v1",
            generation: {
                mode: "model" as const,
                reasoningPosture: "low" as const,
                thinkingBudget: 512,
                includeThoughts: false as const,
                temperature: 0,
                maxOutputTokens: 4096,
                candidateCount: 1 as const,
                seed: 0,
                structuredOutput: true as const,
            },
        },
        verifier: {
            provider,
            model,
            promptVersion: "candidate_evidence_verification_google_v1",
            responseSchemaVersion: "evidence_verification_output_v1",
            generation: {
                mode: "model" as const,
                reasoningPosture: "medium" as const,
                thinkingBudget: 1024,
                includeThoughts: false as const,
                temperature: 0,
                maxOutputTokens: 1536,
                candidateCount: 1 as const,
                seed: 0,
                structuredOutput: true as const,
            },
        },
        feedbackComposer: {
            provider,
            model,
            promptVersion: "candidate_feedback_composition_google_v1",
            responseSchemaVersion: "feedback_composition_output_v1",
            generation: {
                mode: "model" as const,
                reasoningPosture: "low" as const,
                thinkingBudget: 512,
                includeThoughts: false as const,
                temperature: 0.2,
                maxOutputTokens: 2048,
                candidateCount: 1 as const,
                seed: 0,
                structuredOutput: true as const,
            },
        },
    };
}

function createCase(input: {
    answerText: string;
    category?: EvidenceFirstEvaluationCase["providerInput"]["question"]["category"];
    technicalReference?: EvidenceFirstEvaluationCase["providerInput"]["technicalReference"];
    resumeText?: string | null;
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
            resumeText: input.resumeText ?? null,
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
        biggestUpgrade?: string;
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
            biggestUpgrade: overrides.biggestUpgrade ?? "Make the result and what you learned easier to recognize.",
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
