export const AI_EVAL_SURFACES = ["answer_coaching", "coach_update", "question_wording"] as const;
export type AiEvalSurface = typeof AI_EVAL_SURFACES[number];

export const AI_EVAL_SOURCE_KINDS = [
    "candidate_answer_evaluation",
    "invited_answer_evaluation",
    "candidate_coach_update",
    "candidate_question_wording",
    "recruiter_question_wording",
] as const;
export type AiEvalSourceKind = typeof AI_EVAL_SOURCE_KINDS[number];

export type AiEvalAudience = "candidate_led" | "invited" | "recruiter_invite";
export type AiEvalSelectionReason = "production_sample" | "provider_failure" | "manual" | "golden" | "incident";
export type AiEvalWorkItemLifecycle =
    | "queued"
    | "in_review"
    | "reviewed"
    | "remediation_in_progress"
    | "verified"
    | "closed";
export type AiEvalPriority = "low" | "normal" | "high" | "urgent";

export type AiEvalWorkItem = {
    workItemId: string;
    surface: AiEvalSurface;
    sourceKind: AiEvalSourceKind;
    audience: AiEvalAudience;
    selectionReason: AiEvalSelectionReason;
    lifecycleState: AiEvalWorkItemLifecycle;
    priority: AiEvalPriority;
    assignedOperatorUserId: string | null;
    sourceLifecycleState: string;
    sourceFailureCode: string | null;
    interviewStage: string | null;
    questionCategory: string | null;
    provider: string | null;
    modelName: string | null;
    profileId: string | null;
    promptVersion: string | null;
    evaluatorVersion: string | null;
    configurationFingerprint: string | null;
    sourceOccurredAt: string;
    revision: number;
};

export type AiEvalWorkItemDetail = AiEvalWorkItem & {
    sourcePayload: Record<string, unknown>;
};

export type AiEvalEligibleSource = {
    sourceId: string;
    sourceKind: AiEvalSourceKind;
    surface: AiEvalSurface;
    audience: AiEvalAudience;
    sourceLifecycleState: string;
    sourceFailureCode: string | null;
    interviewStage: string | null;
    questionCategory: string | null;
    provider: string | null;
    modelName: string | null;
    profileId: string | null;
    promptVersion: string | null;
    evaluatorVersion: string | null;
    configurationFingerprint: string | null;
    sourceOccurredAt: string;
};

export type AiEvalLayerJudgment =
    | "correct"
    | "partly_correct"
    | "incorrect"
    | "not_applicable"
    | "unable_to_assess";
export type AiEvalReviewDisposition =
    | "acceptable"
    | "acceptable_with_observation"
    | "needs_improvement"
    | "unsafe_or_blocking"
    | "unable_to_assess";
export type AiEvalSeverity = "informational" | "minor" | "major" | "blocking";
export type AiEvalConfidence = "low" | "medium" | "high";

export type AiEvalReview = {
    reviewId: string;
    workItemId: string;
    reviewerUserId: string;
    rubricVersion: string;
    lifecycleState: "draft" | "submitted";
    disposition: AiEvalReviewDisposition | null;
    severity: AiEvalSeverity | null;
    confidence: AiEvalConfidence | null;
    layerJudgments: Record<string, AiEvalLayerJudgment>;
    reviewSummary: string | null;
    revision: number;
    submittedAt: string | null;
};

export type AiEvalFindingLayer =
    | "source_context"
    | "answer_usability"
    | "evidence_span"
    | "observable_marker"
    | "category_signal"
    | "criterion_appraisal"
    | "technical_accuracy"
    | "pattern_gap"
    | "verification"
    | "feedback_composition"
    | "candidate_projection"
    | "coach_update"
    | "question_wording"
    | "question_set"
    | "schema_lifecycle"
    | "safety";

export type AiEvalFailureLabel = {
    version: string;
    label: string;
    layer: AiEvalFindingLayer;
    description: string;
};

export type AiEvalFinding = {
    findingId: string;
    reviewId: string;
    layer: AiEvalFindingLayer;
    failureLabel: string;
    failureLabelVersion: string;
    severity: AiEvalSeverity;
    sourceReference: Record<string, string | number>;
    rationale: string;
    createdAt: string;
};

export type AiEvalRemediationLifecycle =
    | "observed"
    | "triaged"
    | "planned"
    | "changed"
    | "ready_for_recheck"
    | "verified"
    | "wont_fix"
    | "duplicate";

export const AI_EVAL_REMEDIATION_TARGETS = [
    "context_assembly",
    "evidence_extraction",
    "exact_span_validation",
    "marker_derivation",
    "category_signal_lens",
    "criterion_appraisal",
    "pattern_gap_prioritization",
    "technical_reference_policy",
    "verification",
    "feedback_composition",
    "candidate_safe_projection",
    "coach_update_synthesis",
    "question_plan",
    "question_wording",
    "ui_rendering",
    "product_specification",
    "test_coverage",
] as const;

export type AiEvalRemediationTarget = typeof AI_EVAL_REMEDIATION_TARGETS[number];

export const AI_EVAL_REMEDIATION_LIFECYCLES = [
    "observed",
    "triaged",
    "planned",
    "changed",
    "ready_for_recheck",
    "verified",
    "wont_fix",
    "duplicate",
] as const satisfies readonly AiEvalRemediationLifecycle[];

export const AI_EVAL_CHANGE_KINDS = [
    "code",
    "prompt",
    "schema",
    "configuration",
    "reference",
    "product_specification",
    "test",
] as const;
export type AiEvalChangeKind = typeof AI_EVAL_CHANGE_KINDS[number];

export const AI_EVAL_RECHECK_OUTCOMES = ["fixed", "unchanged", "regressed", "unable_to_assess"] as const;
export type AiEvalRecheckOutcome = typeof AI_EVAL_RECHECK_OUTCOMES[number];

export type AiEvalRemediation = {
    remediationId: string;
    ownerOperatorUserId: string;
    lifecycleState: AiEvalRemediationLifecycle;
    targetComponent: AiEvalRemediationTarget;
    title: string;
    hypothesis: string;
    expectedChange: string;
    regressionRisks: string;
    changeKind: AiEvalChangeKind | null;
    changedReference: string | null;
    verificationNote: string | null;
    revision: number;
    findingCount: number;
    regressionCaseCount: number;
    recheckCount: number;
    createdAt: string;
    updatedAt: string;
};

export type AiEvalRemediationFinding = AiEvalFinding & {
    workItemId: string;
    surface: AiEvalSurface;
    sourceKind: AiEvalSourceKind;
    sourceOccurredAt: string;
    regressionCaseId: string | null;
};

export type AiEvalRegressionCase = {
    regressionCaseId: string;
    sourceFindingId: string;
    originalWorkItemId: string;
    surface: AiEvalSurface;
    failureLabel: string;
    failureLabelVersion: string;
    layer: AiEvalFindingLayer;
    latestOutcome: AiEvalRecheckOutcome | null;
    latestVerificationWorkItemId: string | null;
    latestRecheckedAt: string | null;
    createdAt: string;
};

export type AiEvalRecheckCandidate = {
    reviewId: string;
    workItemId: string;
    surface: AiEvalSurface;
    sourceKind: AiEvalSourceKind;
    profileId: string | null;
    configurationFingerprint: string | null;
    sourceOccurredAt: string;
};

export type AiEvalRecheck = {
    recheckId: string;
    remediationId: string;
    regressionCaseId: string;
    verificationReviewId: string;
    verificationWorkItemId: string;
    outcome: AiEvalRecheckOutcome;
    verificationNote: string;
    createdAt: string;
};

export const AI_EVAL_SOURCE_SURFACE: Record<AiEvalSourceKind, AiEvalSurface> = {
    candidate_answer_evaluation: "answer_coaching",
    invited_answer_evaluation: "answer_coaching",
    candidate_coach_update: "coach_update",
    candidate_question_wording: "question_wording",
    recruiter_question_wording: "question_wording",
};
