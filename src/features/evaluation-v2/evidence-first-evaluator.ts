import {
    EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
    EVIDENCE_FIRST_PROMPT_BUNDLE_VERSION,
    EVIDENCE_CATEGORY_SIGNAL_IDS,
    FEEDBACK_COMPOSER_SYSTEM_POLICY,
    UNIVERSAL_CRITERION_IDS,
    createEvaluatorRunDescriptor,
    evidenceExtractionOutputSchema,
    evidenceVerificationOutputSchema,
    feedbackCompositionOutputSchema,
    type CriterionAppraisal,
    type CandidateSafeFeedbackProjection,
    type EvidenceExtractionOutput,
    type EvidenceFirstEvaluationCase,
    type EvidenceFirstEvaluatorProfile,
    type EvidenceFirstEvaluatorResolvedConfigurationManifest,
    type EvidenceVerificationOutput,
    type FeedbackCompositionOutput,
    type PatternGap,
    type UniversalCriterionId,
} from "./evidence-first-evaluator-contract";

export const EVIDENCE_FIRST_FEEDBACK_FORBIDDEN_PATTERNS = [
    /\b(?:i|we|the coach)\s+(?:would\s+)?(?:score|grade|rate|rank)(?:d|s|ing)?\b/i,
    /\b(?:your|this|the)\s+(?:answer|response)\s+(?:(?:is|was|would be)\s+)?(?:scored|graded|rated|ranked|passes?|passed|fails?|failed)\b/i,
    /\b(?:score|grade|rating)\s*(?:of|:|=)\s*\d+(?:\.\d+)?\s*(?:\/\s*\d+|%|points?)?\b/i,
    /\b\d+(?:\.\d+)?\s*\/\s*(?:5|10|100)\b/i,
    /\b(?:pass|fail)(?:ed|s|ing)?\s+(?:the\s+)?(?:answer|response|interview)\b/i,
    /\b(?:your|this|the)\s+(?:answer|response)\s+(?:(?:is|was|seems|felt)\s+)?(?:weak|bad)\b|\b(?:weak|bad)\s+(?:answer|response)\b|\bweakness(?:es)?\b/i,
    /\bmost candidates\b|\bother candidates\b|\bcompared (?:with|to)\b/i,
    /\bpercentile\b/i,
    /\baccent\b|\bnative fluency\b|\bnative speaker\b|\benglish proficiency\b/i,
    /\bpersonality\b|\bcharisma\b|\bappearance\b/i,
    /\brace\b|\breligion\b|\bnational origin\b|\bgender expression\b|\bfamily status\b|\bage\b/i,
    /\byou seem (?:young|old|anxious|confident|shy|introverted|extroverted)\b/i,
] as const;

type QuestionCategory = EvidenceFirstEvaluationCase["providerInput"]["question"]["category"];
type EvidenceSpan = EvidenceExtractionOutput["evidenceSpans"][number];

export type EvidenceValidationIssue = {
    code: string;
    path?: string;
};

export type EvidenceFirstAppraisal = {
    status: "evidence_first_appraisal";
    schemaVersion: 1;
    inputFingerprint: string;
    evidence: EvidenceExtractionOutput;
    criteria: CriterionAppraisal[];
    patternGap: PatternGap;
};

export type AcceptedEvidenceFirstAppraisal = EvidenceFirstAppraisal & {
    disposition: "accepted";
};

export type EvidenceFirstAppraisalResult =
    | AcceptedEvidenceFirstAppraisal
    | (EvidenceFirstAppraisal & {
        disposition: "verification_required";
        verificationReasons: string[];
    })
    | {
        status: "evidence_first_appraisal_rejected";
        schemaVersion: 1;
        inputFingerprint: string;
        disposition: "rejected";
        reExtractable: boolean;
        issues: EvidenceValidationIssue[];
    };

export type FeedbackValidationResult =
    | {
        status: "feedback_accepted";
        feedback: FeedbackCompositionOutput;
        candidateProjection: CandidateSafeFeedbackProjection;
    }
    | {
        status: "feedback_rejected";
        issues: EvidenceValidationIssue[];
    };

export type EvidenceFirstQaCaseCapture = {
    status: "evidence_first_qa_case";
    schemaVersion: 1;
    caseId: string;
    answerAttemptId: string;
    inputFingerprint: string;
    evaluatorInput: EvidenceFirstEvaluationCase["providerInput"];
    privacy: {
        candidateIdentity: "excluded";
        sourceTextAccess: "restricted_qa_content";
        containsResumeText: boolean;
    };
};

export type EvidenceFirstQaRunCapture = {
    status: "evidence_first_qa_run";
    schemaVersion: 1;
    runId: string;
    caseId: string;
    inputFingerprint: string;
    profile: EvidenceFirstEvaluatorProfile;
    configurationManifest: EvidenceFirstEvaluatorResolvedConfigurationManifest;
    configurationFingerprint: string;
    requestedAt: string;
    completedAt: string;
    accepted: {
        evidence: EvidenceExtractionOutput;
        criteria: CriterionAppraisal[];
        patternGap: PatternGap;
        verification: {
            required: boolean;
            reasons: string[];
            output: EvidenceVerificationOutput | null;
        };
        feedback: FeedbackCompositionOutput;
        candidateProjection: CandidateSafeFeedbackProjection;
    };
    metrics?: {
        latencyMs?: number;
        tokenUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    };
    retention: {
        assembledPrompt: "not_captured";
        rawProviderOutput: "not_captured";
    };
};

export function createEvidenceFirstQaCaseCapture(
    evaluationCase: EvidenceFirstEvaluationCase,
): EvidenceFirstQaCaseCapture {
    return {
        status: "evidence_first_qa_case",
        schemaVersion: 1,
        caseId: `evidence-first:${evaluationCase.answerAttemptId}:${evaluationCase.inputFingerprint}`,
        answerAttemptId: evaluationCase.answerAttemptId,
        inputFingerprint: evaluationCase.inputFingerprint,
        evaluatorInput: evaluationCase.providerInput,
        privacy: {
            candidateIdentity: "excluded",
            sourceTextAccess: "restricted_qa_content",
            containsResumeText: Boolean(evaluationCase.providerInput.roleContext.resumeText),
        },
    };
}

export function createEvidenceFirstQaRunCapture(input: {
    runId: string;
    qaCase: EvidenceFirstQaCaseCapture;
    profile: EvidenceFirstEvaluatorProfile;
    appraisal: AcceptedEvidenceFirstAppraisal;
    feedback: Extract<FeedbackValidationResult, { status: "feedback_accepted" }>;
    requestedAt: string;
    completedAt: string;
    verification?: { reasons: string[]; output: EvidenceVerificationOutput };
    metrics?: EvidenceFirstQaRunCapture["metrics"];
}): EvidenceFirstQaRunCapture {
    assertMatchingFingerprint(input.qaCase.inputFingerprint, input.appraisal.inputFingerprint);
    assertMatchingFingerprint(input.qaCase.inputFingerprint, input.feedback.feedback.inputFingerprint);
    const descriptor = createEvaluatorRunDescriptor(input.profile);

    return {
        status: "evidence_first_qa_run",
        schemaVersion: 1,
        runId: input.runId,
        caseId: input.qaCase.caseId,
        inputFingerprint: input.qaCase.inputFingerprint,
        profile: input.profile,
        configurationManifest: descriptor.configurationManifest,
        configurationFingerprint: descriptor.configurationFingerprint,
        requestedAt: input.requestedAt,
        completedAt: input.completedAt,
        accepted: {
            evidence: input.appraisal.evidence,
            criteria: input.appraisal.criteria,
            patternGap: input.appraisal.patternGap,
            verification: input.verification
                ? { required: true, reasons: input.verification.reasons, output: input.verification.output }
                : { required: false, reasons: [], output: null },
            feedback: input.feedback.feedback,
            candidateProjection: input.feedback.candidateProjection,
        },
        ...(input.metrics ? { metrics: input.metrics } : {}),
        retention: {
            assembledPrompt: "not_captured",
            rawProviderOutput: "not_captured",
        },
    };
}

export function validateAndAppraiseEvidence(input: {
    evaluationCase: EvidenceFirstEvaluationCase;
    value: unknown;
}): EvidenceFirstAppraisalResult {
    const parsed = evidenceExtractionOutputSchema.safeParse(input.value);
    if (!parsed.success) {
        return rejectEvidence(input.evaluationCase.inputFingerprint, [{ code: "invalid_extraction_schema" }], true);
    }

    const evidence = parsed.data;
    const issues = validateEvidenceFacts(input.evaluationCase, evidence);
    if (issues.length > 0) {
        return rejectEvidence(
            input.evaluationCase.inputFingerprint,
            issues,
            issues.every((issue) => RE_EXTRACTABLE_EVIDENCE_ISSUES.has(issue.code)),
        );
    }

    if (evidence.unsafeInferenceFlags.length > 0) {
        return rejectEvidence(
            input.evaluationCase.inputFingerprint,
            evidence.unsafeInferenceFlags.map((flag) => ({
                code: "unsafe_inference",
                path: flag,
            })),
            false,
        );
    }

    const criteria = appraiseCriteria(evidence, input.evaluationCase.providerInput.question.category);
    const patternGap = detectPatternGap(evidence, input.evaluationCase.providerInput.question.category, criteria);
    const appraisal: EvidenceFirstAppraisal = {
        status: "evidence_first_appraisal",
        schemaVersion: 1,
        inputFingerprint: input.evaluationCase.inputFingerprint,
        evidence,
        criteria,
        patternGap,
    };
    const verificationReasons = getVerificationReasons(input.evaluationCase, appraisal);

    return verificationReasons.length > 0
        ? { ...appraisal, disposition: "verification_required", verificationReasons }
        : { ...appraisal, disposition: "accepted" };
}

export function resolveEvidenceVerification(input: {
    pending: Extract<EvidenceFirstAppraisalResult, { disposition: "verification_required" }>;
    value: unknown;
}): AcceptedEvidenceFirstAppraisal | Extract<EvidenceFirstAppraisalResult, { disposition: "rejected" }> {
    const parsed = evidenceVerificationOutputSchema.safeParse(input.value);
    if (!parsed.success || parsed.data.inputFingerprint !== input.pending.inputFingerprint) {
        return rejectEvidence(input.pending.inputFingerprint, [{ code: "invalid_verification_output" }]);
    }

    if (!parsed.data.supported || parsed.data.recommendedAction !== "accept") {
        return rejectEvidence(
            input.pending.inputFingerprint,
            parsed.data.issueCodes.length > 0
                ? parsed.data.issueCodes.map((code) => ({ code: `verification_${code}` }))
                : [{ code: "verification_rejected" }],
            parsed.data.recommendedAction === "re_extract",
        );
    }

    return {
        status: input.pending.status,
        schemaVersion: input.pending.schemaVersion,
        inputFingerprint: input.pending.inputFingerprint,
        evidence: input.pending.evidence,
        criteria: input.pending.criteria,
        patternGap: input.pending.patternGap,
        disposition: "accepted",
    };
}

export function createFeedbackComposerTask(input: {
    evaluationCase: EvidenceFirstEvaluationCase;
    appraisal: AcceptedEvidenceFirstAppraisal;
}) {
    assertMatchingFingerprint(input.evaluationCase.inputFingerprint, input.appraisal.inputFingerprint);

    return {
        task: "compose_candidate_feedback" as const,
        contractVersion: EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
        promptVersion: EVIDENCE_FIRST_PROMPT_BUNDLE_VERSION,
        systemPolicy: FEEDBACK_COMPOSER_SYSTEM_POLICY,
        inputFingerprint: input.evaluationCase.inputFingerprint,
        input: {
            question: input.evaluationCase.providerInput.question,
            role: {
                targetRole: input.evaluationCase.providerInput.roleContext.targetRole,
                interviewStage: input.evaluationCase.providerInput.roleContext.interviewStage,
            },
            answerUsability: input.appraisal.evidence.answerUsability,
            acceptedEvidenceSpans: input.appraisal.evidence.answerUsability.status === "sensitive_disclosure"
                ? []
                : input.appraisal.evidence.evidenceSpans,
            missingEvidence: input.appraisal.evidence.missingEvidence,
            sensitiveContentFlags: input.appraisal.evidence.sensitiveContentFlags,
            criteria: input.appraisal.criteria,
            patternGap: input.appraisal.patternGap,
            voiceMarkers: input.evaluationCase.providerInput.voiceMarkers,
        },
    };
}

export function validateFeedbackComposition(input: {
    evaluationCase: EvidenceFirstEvaluationCase;
    appraisal: AcceptedEvidenceFirstAppraisal;
    value: unknown;
}): FeedbackValidationResult {
    const parsed = feedbackCompositionOutputSchema.safeParse(input.value);
    if (!parsed.success) {
        return { status: "feedback_rejected", issues: [{ code: "invalid_feedback_schema" }] };
    }

    const feedback = parsed.data;
    const issues: EvidenceValidationIssue[] = [];
    if (
        feedback.inputFingerprint !== input.evaluationCase.inputFingerprint
        || feedback.inputFingerprint !== input.appraisal.inputFingerprint
    ) {
        issues.push({ code: "feedback_input_mismatch" });
    }

    const spanIds = new Set(input.appraisal.evidence.evidenceSpans.map((span) => span.id));
    for (const spanId of [
        ...feedback.claimEvidence.acknowledgementSpanIds,
        ...feedback.claimEvidence.primaryStrengthSpanIds,
    ]) {
        if (!spanIds.has(spanId)) {
            issues.push({ code: "feedback_unknown_evidence_span", path: spanId });
        }
    }

    if (feedback.candidateFeedback.primaryStrength && feedback.claimEvidence.primaryStrengthSpanIds.length === 0) {
        issues.push({ code: "unsupported_strength_claim" });
    }
    if (!feedback.candidateFeedback.primaryStrength && feedback.claimEvidence.primaryStrengthSpanIds.length > 0) {
        issues.push({ code: "orphaned_strength_evidence" });
    }
    if (
        input.appraisal.evidence.answerUsability.status === "sensitive_disclosure"
        && feedback.candidateFeedback.primaryStrength
    ) {
        issues.push({ code: "sensitive_disclosure_cannot_support_strength_claim" });
    }

    validateFeedbackAnchor(input.appraisal, feedback, issues);
    validateInterventionCompleteness(feedback, issues);
    validateDeliveryNote(input.evaluationCase, feedback, issues);
    validateCandidateLanguage(feedback.candidateFeedback, issues);

    if (issues.length > 0) {
        return { status: "feedback_rejected", issues: dedupeIssues(issues) };
    }

    return {
        status: "feedback_accepted",
        feedback,
        candidateProjection: {
            status: "candidate_safe_feedback",
            schemaVersion: 1,
            inputFingerprint: feedback.inputFingerprint,
            acknowledgement: feedback.candidateFeedback.acknowledgement,
            primaryStrength: feedback.candidateFeedback.primaryStrength,
            biggestUpgrade: feedback.candidateFeedback.biggestUpgrade,
            redoPrompt: feedback.candidateFeedback.redoPrompt,
            patternSuggestion: feedback.candidateFeedback.patternSuggestion,
            deliveryNote: feedback.candidateFeedback.deliveryNote,
        },
    };
}

function validateEvidenceFacts(
    evaluationCase: EvidenceFirstEvaluationCase,
    evidence: EvidenceExtractionOutput,
) {
    const issues: EvidenceValidationIssue[] = [];
    if (evidence.inputFingerprint !== evaluationCase.inputFingerprint) {
        issues.push({ code: "extraction_input_mismatch" });
    }
    if (evidence.questionCategory !== evaluationCase.providerInput.question.category) {
        issues.push({ code: "extraction_category_mismatch" });
    }

    const spanIds = new Set<string>();
    for (const span of evidence.evidenceSpans) {
        if (spanIds.has(span.id)) {
            issues.push({ code: "duplicate_evidence_span_id", path: span.id });
        }
        spanIds.add(span.id);
        if (
            span.end <= span.start
            || evaluationCase.providerInput.answer.text.slice(span.start, span.end) !== span.quote
        ) {
            issues.push({ code: "evidence_span_not_exact", path: span.id });
        }
    }
    validateObservableMarkerGrounding(evidence, issues);

    const allowedSignalIds = new Set<string>(EVIDENCE_CATEGORY_SIGNAL_IDS[evidence.questionCategory]);
    const categorySignalIds = new Set<string>();
    for (const signal of evidence.categorySignals) {
        if (!allowedSignalIds.has(signal.id)) {
            issues.push({ code: "category_signal_not_allowed", path: signal.id });
        }
        if (categorySignalIds.has(signal.id)) {
            issues.push({ code: "duplicate_category_signal_id", path: signal.id });
        }
        categorySignalIds.add(signal.id);
        if (signal.status === "observed" && signal.evidenceSpanIds.length === 0) {
            issues.push({ code: "observed_signal_requires_evidence", path: signal.id });
        }
        if (signal.status !== "observed" && signal.evidenceSpanIds.length > 0) {
            issues.push({ code: "unobserved_signal_has_evidence", path: signal.id });
        }
        validateEvidenceReferences(signal.evidenceSpanIds, spanIds, issues, signal.id);
    }

    const technical = evidence.technicalAccuracy;
    const technicalReference = evaluationCase.providerInput.technicalReference;
    if (technical.status !== "not_assessed" && !technicalReference) {
        issues.push({ code: "technical_claim_without_reference" });
    }
    if (technical.status !== "not_assessed" && evidence.questionCategory !== "technical_role_specific") {
        issues.push({ code: "technical_claim_outside_technical_category" });
    }
    if (technical.status === "not_assessed" && (
        technical.referenceConceptIds.length > 0 || technical.evidenceSpanIds.length > 0
    )) {
        issues.push({ code: "unassessed_technical_claim_has_evidence" });
    }
    if (technical.status !== "not_assessed" && (
        technical.referenceConceptIds.length === 0 || technical.evidenceSpanIds.length === 0
    )) {
        issues.push({ code: "technical_claim_missing_support" });
    }
    if (technicalReference) {
        const knownConceptIds = new Set(technicalReference.expectedConcepts.map((concept) => concept.id));
        for (const conceptId of technical.referenceConceptIds) {
            if (!knownConceptIds.has(conceptId)) {
                issues.push({ code: "unknown_technical_reference_concept", path: conceptId });
            }
        }
    }
    validateEvidenceReferences(technical.evidenceSpanIds, spanIds, issues, "technicalAccuracy");

    return dedupeIssues(issues);
}

function appraiseCriteria(evidence: EvidenceExtractionOutput, category: QuestionCategory): CriterionAppraisal[] {
    if (evidence.answerUsability.status === "sensitive_disclosure") {
        return UNIVERSAL_CRITERION_IDS.map((criterionId) => insufficientCriterion(
            criterionId,
            "privacy_reframe_required",
        ));
    }
    if (evidence.answerUsability.status === "non_answer") {
        return UNIVERSAL_CRITERION_IDS.map((criterionId) => insufficientCriterion(criterionId, "non_answer"));
    }
    if (evidence.answerUsability.status === "transcription_unclear") {
        return UNIVERSAL_CRITERION_IDS.map((criterionId) => insufficientCriterion(
            criterionId,
            "transcription_unclear",
        ));
    }
    if (evidence.answerUsability.status === "off_topic") {
        return UNIVERSAL_CRITERION_IDS.map((criterionId) => (
            criterionId === "answer_focus"
                ? observedCriterion(criterionId, "emerging", evidence, ["direct_answer"], "off_topic")
                : insufficientCriterion(criterionId, "off_topic_no_relevant_evidence")
        ));
    }

    return [
        appraiseAnswerFocus(evidence),
        appraiseOrganization(evidence, category),
        appraiseEvidenceSpecificity(evidence, category),
        appraiseRoleSkillSignal(evidence, category),
        appraiseImpactJudgmentTakeaway(evidence, category),
    ];
}

function appraiseAnswerFocus(evidence: EvidenceExtractionOutput): CriterionAppraisal {
    const markers = evidence.observableMarkers;
    const band = markers.answeredQuestion && markers.hasDirectAnswer && !markers.isOverlyLong
        ? "strong"
        : markers.answeredQuestion
            ? "clear"
            : "emerging";
    return observedCriterion("answer_focus", band, evidence, ["direct_answer"], `answer_focus_${band}`);
}

function appraiseOrganization(evidence: EvidenceExtractionOutput, category: QuestionCategory): CriterionAppraisal {
    const signalCount = countObservedSignals(evidence, organizationSignals(category));
    const strongThreshold = category === "screening" ? 0 : 3;
    const band = category === "screening"
        ? evidence.observableMarkers.hasDirectAnswer && !evidence.observableMarkers.isOverlyLong
            ? "strong"
            : evidence.observableMarkers.answeredQuestion
                ? "clear"
                : "emerging"
        : signalCount >= strongThreshold
            ? "strong"
            : signalCount >= 2
                ? "clear"
                : "emerging";
    return observedCriterion(
        "organization",
        band,
        evidence,
        ["context", "personal_action", "outcome", "reasoning", "priority", "recommendation", "next_step"],
        `organization_${category}_${band}`,
    );
}

function appraiseEvidenceSpecificity(
    evidence: EvidenceExtractionOutput,
    category: QuestionCategory,
): CriterionAppraisal {
    const markers = evidence.observableMarkers;
    if (
        category === "screening"
        && markers.hasDirectAnswer
        && markers.isVeryShort
        && !markers.hasExample
        && !markers.hasSpecificDetails
    ) {
        return notElicitedCriterion("evidence_specificity", "screening_brevity_sufficient");
    }
    const count = [markers.hasExample, markers.hasSpecificDetails, markers.hasPersonalAction].filter(Boolean).length;
    const band = count >= 3 ? "strong" : count >= 1 ? "clear" : "emerging";
    return observedCriterion(
        "evidence_specificity",
        band,
        evidence,
        ["example", "specific_detail", "personal_action"],
        `evidence_specificity_${band}`,
    );
}

function appraiseRoleSkillSignal(
    evidence: EvidenceExtractionOutput,
    category: QuestionCategory,
): CriterionAppraisal {
    if (category === "technical_role_specific" && evidence.technicalAccuracy.status === "not_assessed") {
        return {
            criterionId: "role_skill_signal",
            applicability: "unscoreable",
            evidenceSpanIds: [],
            reasonCode: "technical_reference_not_supplied",
        };
    }
    if (category === "technical_role_specific") {
        const band = evidence.technicalAccuracy.status === "contradicted"
            ? "emerging"
            : hasObservedSignal(evidence, "has_reasoning") && hasObservedSignal(evidence, "has_practical_application")
                ? "strong"
                : "clear";
        return observedCriterion(
            "role_skill_signal",
            band,
            evidence,
            ["role_skill_signal", "reasoning", "practical_application"],
            `technical_role_skill_${band}`,
        );
    }
    const band = evidence.observableMarkers.hasRoleRelevantSkillSignal
        ? evidence.observableMarkers.hasSpecificDetails || evidence.observableMarkers.hasPersonalAction
            ? "strong"
            : "clear"
        : "emerging";
    return observedCriterion(
        "role_skill_signal",
        band,
        evidence,
        ["role_skill_signal", "personal_action", "reasoning", "practical_application", "role_connection"],
        `role_skill_signal_${band}`,
    );
}

function appraiseImpactJudgmentTakeaway(
    evidence: EvidenceExtractionOutput,
    category: QuestionCategory,
): CriterionAppraisal {
    const signals = impactSignals(category);
    const signalCount = countObservedSignals(evidence, signals);
    if (
        category === "screening"
        && signalCount === 0
        && !evidence.observableMarkers.hasOutcomeOrTakeaway
        && !evidence.observableMarkers.hasTradeoffOrConstraint
    ) {
        return notElicitedCriterion("impact_judgment_takeaway", "screening_takeaway_not_elicited");
    }
    const strongThreshold = category === "case_scenario" ? 3 : 2;
    const band = signalCount >= strongThreshold
        ? "strong"
        : signalCount >= 1 || evidence.observableMarkers.hasOutcomeOrTakeaway
            ? "clear"
            : "emerging";
    return observedCriterion(
        "impact_judgment_takeaway",
        band,
        evidence,
        ["outcome", "takeaway", "tradeoff", "recommendation", "next_step", "learning", "self_awareness"],
        `impact_judgment_${category}_${band}`,
    );
}

function detectPatternGap(
    evidence: EvidenceExtractionOutput,
    category: QuestionCategory,
    criteria: CriterionAppraisal[],
): PatternGap {
    if (evidence.answerUsability.status === "sensitive_disclosure") {
        return patternGap(
            "privacy_reframe",
            "high",
            "Keep the answer professional without sharing private personal details.",
            ["professional reason", "forward-looking transition", "role connection"],
            "answer_usability",
        );
    }
    if (evidence.answerUsability.status === "non_answer" || evidence.answerUsability.status === "off_topic") {
        return patternGap(
            "answer_the_question_first",
            "high",
            "Start with a direct answer to the question before adding context.",
            ["direct answer", "brief support", "role connection"],
            "answer_usability",
        );
    }
    if (evidence.answerUsability.status === "transcription_unclear") {
        return patternGap(
            "capture_clear_answer",
            "high",
            "Capture the answer again before evaluating its content.",
            ["direct answer", "one supporting detail"],
            "answer_usability",
        );
    }

    if (category === "behavioral") {
        if (!hasObservedSignal(evidence, "has_personal_action")) {
            return patternGap(
                "missing_personal_action",
                "high",
                "Make your own role clearer before describing what the team did.",
                ["brief situation", "what I did", "what changed"],
                "category_lens",
            );
        }
        if (!hasObservedSignal(evidence, "has_result")) {
            return patternGap(
                "missing_result",
                "medium",
                "Add what happened because of your action.",
                ["brief situation", "personal action", "result or learning"],
                "category_lens",
            );
        }
    }
    if (category === "technical_role_specific") {
        if (evidence.technicalAccuracy.status === "contradicted") {
            return patternGap(
                "technical_accuracy_contradicted",
                "high",
                "Correct the core concept before adding more detail.",
                ["direct answer", "why it works", "practical example"],
                "category_lens",
            );
        }
        if (!hasObservedSignal(evidence, "has_reasoning")) {
            return patternGap(
                "missing_reasoning",
                "medium",
                "Explain why your answer works, not just what you would do.",
                ["direct answer", "reasoning", "one tradeoff"],
                "category_lens",
            );
        }
    }
    if (category === "case_scenario") {
        if (!hasObservedSignal(evidence, "has_problem_framing")) {
            return patternGap(
                "missing_problem_framing",
                "high",
                "Frame the problem before choosing a solution.",
                ["problem", "first priority", "recommended action"],
                "category_lens",
            );
        }
        if (!hasObservedSignal(evidence, "has_tradeoff")) {
            return patternGap(
                "missing_tradeoff",
                "medium",
                "Compare your recommendation with one alternative.",
                ["problem", "recommendation", "tradeoff", "next step"],
                "category_lens",
            );
        }
    }
    if (category === "culture_fit" && !hasObservedSignal(evidence, "has_specific_example")) {
        return patternGap(
            "generic_motivation",
            "medium",
            "Ground your work preference in one specific experience.",
            ["what matters to me", "specific example", "connection to this role"],
            "category_lens",
        );
    }
    if (category === "screening") {
        if (evidence.observableMarkers.isOverlyLong) {
            return patternGap(
                "too_long_for_screening",
                "medium",
                "Tighten the answer so its main point is easy to place.",
                ["direct answer", "brief support", "role connection"],
                "category_lens",
            );
        }
        if (!hasObservedSignal(evidence, "has_role_connection") && !hasObservedSignal(evidence, "has_logistics_clarity")) {
            return patternGap(
                "missing_role_connection",
                "medium",
                "Connect the answer back to the role or the next step.",
                ["direct answer", "brief support", "role connection"],
                "category_lens",
            );
        }
    }

    const emergingCriterion = criteria.find((criterion) => criterion.band === "emerging");
    if (emergingCriterion) {
        return patternGap(
            `strengthen_${emergingCriterion.criterionId}`,
            "medium",
            "Add one concrete detail that strengthens the answer's clearest gap.",
            ["direct point", "specific evidence", "useful takeaway"],
            "criterion_appraisal",
        );
    }

    return patternGap(
        "reinforce_effective_pattern",
        "low",
        "Keep the answer's effective structure and make the key evidence easy to hear.",
        ["direct point", "supporting evidence", "clear takeaway"],
        "criterion_appraisal",
    );
}

function getVerificationReasons(
    evaluationCase: EvidenceFirstEvaluationCase,
    appraisal: EvidenceFirstAppraisal,
) {
    const reasons: string[] = [];
    if (appraisal.evidence.technicalAccuracy.status === "contradicted") {
        reasons.push("technical_accuracy_contradicted");
    }
    if (
        appraisal.evidence.technicalAccuracy.status !== "not_assessed"
        && evaluationCase.providerInput.technicalReference
        && appraisal.evidence.technicalAccuracy.referenceConceptIds.length
            < evaluationCase.providerInput.technicalReference.expectedConcepts.length
    ) {
        reasons.push("technical_reference_coverage_partial");
    }
    if (
        appraisal.evidence.evidenceSpans.length < 2
        && appraisal.criteria.filter((criterion) => criterion.band === "strong").length >= 3
    ) {
        reasons.push("strong_appraisal_with_sparse_evidence");
    }
    if (
        appraisal.evidence.answerUsability.status === "off_topic"
        && appraisal.criteria.some((criterion) => criterion.band === "strong")
    ) {
        reasons.push("off_topic_with_strong_appraisal");
    }
    return Array.from(new Set(reasons));
}

function validateFeedbackAnchor(
    appraisal: AcceptedEvidenceFirstAppraisal,
    feedback: FeedbackCompositionOutput,
    issues: EvidenceValidationIssue[],
) {
    const anchor = feedback.feedbackPlan.primaryAnchor;
    if (anchor.kind === "criterion" && !appraisal.criteria.some((criterion) => criterion.criterionId === anchor.id)) {
        issues.push({ code: "unknown_feedback_criterion_anchor", path: anchor.id });
    }
    if (anchor.kind === "pattern_gap" && appraisal.patternGap.id !== anchor.id) {
        issues.push({ code: "feedback_pattern_gap_mismatch", path: anchor.id });
    }
    if (
        anchor.kind === "privacy_reframe"
        && appraisal.evidence.answerUsability.status !== "sensitive_disclosure"
    ) {
        issues.push({ code: "privacy_reframe_without_sensitive_disclosure" });
    }
    if (anchor.kind === "privacy_reframe" && anchor.id !== "privacy_reframe") {
        issues.push({ code: "invalid_privacy_reframe_anchor", path: anchor.id });
    }
    if (
        appraisal.evidence.answerUsability.status === "sensitive_disclosure"
        && (anchor.kind !== "privacy_reframe" || anchor.id !== "privacy_reframe")
    ) {
        issues.push({ code: "sensitive_disclosure_requires_privacy_reframe" });
    }
}

function validateInterventionCompleteness(
    feedback: FeedbackCompositionOutput,
    issues: EvidenceValidationIssue[],
) {
    const intervention = feedback.feedbackPlan.intervention;
    const requiresUpgrade = intervention !== "affirm_and_continue";
    const requiresRedo = ["revise_answer", "professional_reframe", "build_missing_signal"].includes(intervention);
    if (requiresUpgrade && !feedback.candidateFeedback.biggestUpgrade) {
        issues.push({ code: "intervention_missing_upgrade" });
    }
    if (requiresRedo && !feedback.candidateFeedback.redoPrompt) {
        issues.push({ code: "intervention_missing_redo_prompt" });
    }
    if (intervention === "affirm_and_continue" && feedback.candidateFeedback.biggestUpgrade) {
        issues.push({ code: "affirm_intervention_has_upgrade" });
    }
    if (
        intervention === "professional_reframe"
        && feedback.feedbackPlan.primaryAnchor.kind !== "privacy_reframe"
    ) {
        issues.push({ code: "professional_reframe_without_privacy_anchor" });
    }
    if (
        feedback.feedbackPlan.primaryAnchor.kind === "privacy_reframe"
        && intervention !== "professional_reframe"
    ) {
        issues.push({ code: "privacy_anchor_without_professional_reframe" });
    }
    if (feedback.feedbackPlan.signal.valence === "strength" && !feedback.candidateFeedback.primaryStrength) {
        issues.push({ code: "strength_signal_without_grounded_strength" });
    }
}

function validateDeliveryNote(
    evaluationCase: EvidenceFirstEvaluationCase,
    feedback: FeedbackCompositionOutput,
    issues: EvidenceValidationIssue[],
) {
    const note = feedback.candidateFeedback.deliveryNote;
    if (!note) {
        return;
    }
    const voiceMarkers = evaluationCase.providerInput.voiceMarkers;
    if (evaluationCase.providerInput.answer.mode !== "voice" || !voiceMarkers) {
        issues.push({ code: "delivery_note_without_voice_evidence" });
        return;
    }
    if (voiceMarkers.fillerWordCount === 0 && voiceMarkers.longPauseCount === 0) {
        issues.push({ code: "delivery_note_without_observed_marker" });
    }
}

function validateCandidateLanguage(
    feedback: FeedbackCompositionOutput["candidateFeedback"],
    issues: EvidenceValidationIssue[],
) {
    const text = [
        feedback.acknowledgement,
        feedback.primaryStrength,
        feedback.biggestUpgrade,
        feedback.redoPrompt,
        feedback.patternSuggestion?.patternName,
        ...(feedback.patternSuggestion?.steps ?? []),
        feedback.deliveryNote?.message,
    ].filter((value): value is string => Boolean(value)).join(" ");
    for (const pattern of EVIDENCE_FIRST_FEEDBACK_FORBIDDEN_PATTERNS) {
        if (pattern.test(text)) {
            issues.push({ code: "candidate_feedback_forbidden_language", path: pattern.source });
        }
    }
}

function observedCriterion(
    criterionId: UniversalCriterionId,
    band: "emerging" | "clear" | "strong",
    evidence: EvidenceExtractionOutput,
    markers: EvidenceSpan["marker"][],
    reasonCode: string,
): CriterionAppraisal {
    return {
        criterionId,
        applicability: "observed",
        band,
        evidenceSpanIds: evidence.evidenceSpans
            .filter((span) => markers.includes(span.marker))
            .map((span) => span.id),
        reasonCode,
    };
}

function insufficientCriterion(criterionId: UniversalCriterionId, reasonCode: string): CriterionAppraisal {
    return {
        criterionId,
        applicability: "insufficient_data",
        evidenceSpanIds: [],
        reasonCode,
    };
}

function notElicitedCriterion(criterionId: UniversalCriterionId, reasonCode: string): CriterionAppraisal {
    return {
        criterionId,
        applicability: "not_elicited",
        evidenceSpanIds: [],
        reasonCode,
    };
}

function patternGap(
    id: string,
    severity: PatternGap["severity"],
    upgrade: string,
    redoPattern: string[],
    source: PatternGap["source"],
): PatternGap {
    return { id, severity, upgrade, redoPattern, source };
}

function organizationSignals(category: QuestionCategory): readonly string[] {
    switch (category) {
        case "behavioral":
            return ["has_context", "has_personal_action", "has_result"];
        case "technical_role_specific":
            return ["has_direct_technical_answer", "has_reasoning", "has_practical_application"];
        case "case_scenario":
            return ["has_problem_framing", "has_priority", "has_recommendation", "has_next_step"];
        case "culture_fit":
            return ["has_motivation", "has_specific_example", "has_role_connection", "has_self_awareness"];
        case "screening":
            return [];
    }
}

function impactSignals(category: QuestionCategory): readonly string[] {
    switch (category) {
        case "behavioral":
            return ["has_result", "has_learning"];
        case "technical_role_specific":
            return ["has_tradeoff", "has_practical_application"];
        case "case_scenario":
            return ["has_recommendation", "has_next_step", "has_tradeoff"];
        case "culture_fit":
            return ["has_role_connection", "has_self_awareness", "has_growth_orientation"];
        case "screening":
            return ["has_role_connection", "has_next_step_readiness", "has_logistics_clarity"];
    }
}

function countObservedSignals(evidence: EvidenceExtractionOutput, ids: readonly string[]) {
    return ids.filter((id) => hasObservedSignal(evidence, id)).length;
}

function hasObservedSignal(evidence: EvidenceExtractionOutput, id: string) {
    return evidence.categorySignals.some((signal) => signal.id === id && signal.status === "observed");
}

function validateEvidenceReferences(
    referencedIds: string[],
    knownIds: Set<string>,
    issues: EvidenceValidationIssue[],
    path: string,
) {
    for (const id of referencedIds) {
        if (!knownIds.has(id)) {
            issues.push({ code: "unknown_evidence_span_reference", path: `${path}:${id}` });
        }
    }
}

function validateObservableMarkerGrounding(
    evidence: EvidenceExtractionOutput,
    issues: EvidenceValidationIssue[],
) {
    const requirements: Array<{
        field: keyof EvidenceExtractionOutput["observableMarkers"];
        markers: EvidenceSpan["marker"][];
    }> = [
        { field: "hasDirectAnswer", markers: ["direct_answer"] },
        { field: "hasExample", markers: ["example"] },
        { field: "hasSpecificDetails", markers: ["specific_detail"] },
        { field: "hasPersonalAction", markers: ["personal_action"] },
        { field: "hasOutcomeOrTakeaway", markers: ["outcome", "takeaway", "learning"] },
        { field: "hasTradeoffOrConstraint", markers: ["tradeoff"] },
        { field: "hasRoleRelevantSkillSignal", markers: ["role_skill_signal"] },
    ];

    for (const requirement of requirements) {
        const marked = evidence.evidenceSpans.some((span) => requirement.markers.includes(span.marker))
            || hasCategorySignalGrounding(evidence, requirement.field);
        const observed = evidence.observableMarkers[requirement.field];
        if (observed && !marked) {
            issues.push({ code: "observable_marker_missing_span", path: requirement.field });
        }
        if (!observed && marked) {
            issues.push({ code: "evidence_span_marker_mismatch", path: requirement.field });
        }
    }
}

function hasCategorySignalGrounding(
    evidence: EvidenceExtractionOutput,
    field: keyof EvidenceExtractionOutput["observableMarkers"],
) {
    const observed = (id: string) => hasObservedSignal(evidence, id);
    switch (field) {
        case "hasDirectAnswer":
            return observed("has_direct_technical_answer");
        case "hasExample":
            return (evidence.questionCategory === "behavioral" && observed("has_context"))
                || (evidence.questionCategory === "culture_fit" && observed("has_specific_example"));
        case "hasPersonalAction":
            return observed("has_personal_action");
        case "hasOutcomeOrTakeaway":
            return observed("has_result") || observed("has_learning");
        case "hasTradeoffOrConstraint":
            return observed("has_tradeoff") || observed("has_constraint");
        case "hasRoleRelevantSkillSignal":
            switch (evidence.questionCategory) {
                case "behavioral":
                    return observed("has_personal_action");
                case "technical_role_specific":
                    return observed("has_correct_concept") || observed("has_practical_application");
                case "case_scenario":
                    return observed("has_recommendation") || observed("has_next_step");
                case "culture_fit":
                    return observed("has_role_connection") || observed("has_specific_example");
                case "screening":
                    return observed("has_role_connection");
            }
        default:
            return false;
    }
}

function rejectEvidence(
    inputFingerprint: string,
    issues: EvidenceValidationIssue[],
    reExtractable = false,
): Extract<EvidenceFirstAppraisalResult, { disposition: "rejected" }> {
    return {
        status: "evidence_first_appraisal_rejected",
        schemaVersion: 1,
        inputFingerprint,
        disposition: "rejected",
        reExtractable,
        issues: dedupeIssues(issues),
    };
}

const RE_EXTRACTABLE_EVIDENCE_ISSUES = new Set([
    "duplicate_evidence_span_id",
    "evidence_span_not_exact",
    "observable_marker_missing_span",
    "evidence_span_marker_mismatch",
    "category_signal_not_allowed",
    "duplicate_category_signal_id",
    "observed_signal_requires_evidence",
    "unobserved_signal_has_evidence",
    "unknown_evidence_span",
    "unknown_technical_reference_concept",
    "technical_claim_missing_support",
    "unassessed_technical_claim_has_evidence",
]);

function dedupeIssues(issues: EvidenceValidationIssue[]) {
    return Array.from(
        new Map(issues.map((issue) => [`${issue.code}:${issue.path ?? ""}`, issue])).values(),
    );
}

function assertMatchingFingerprint(expected: string, actual: string) {
    if (expected !== actual) {
        throw new Error("Evaluator appraisal must match the fixed evaluation input.");
    }
}
