import { createHash } from "node:crypto";
import { z } from "zod";

export const AI_EVAL_SCENARIO_SCHEMA_VERSION = "ai_eval_scenario_v1" as const;
export const AI_EVAL_SCENARIO_SUITE_VERSION = "evidence_first_scenario_baseline_v2" as const;
export const AI_EVAL_SCENARIO_BASELINE_VERSION_NUMBER = 2;
export const AI_EVAL_SCENARIO_RETENTION_DAYS = 30;

export const AI_EVAL_SCENARIO_KINDS = ["atomic_answer", "round_journey"] as const;
export const AI_EVAL_SCENARIO_AUDIENCES = ["candidate_led", "invited", "both"] as const;
export const AI_EVAL_SCENARIO_ROLE_FAMILIES = [
    "frontline_warehouse",
    "customer_service",
    "healthcare_support",
    "skilled_trade_field_work",
    "sales",
    "administrative_operations",
    "people_management",
    "technical_professional",
] as const;
export const AI_EVAL_SCENARIO_RESUME_CONTEXTS = [
    "absent",
    "directly_relevant",
    "transferable",
    "sparse",
    "distracting_non_authoritative",
] as const;
export const AI_EVAL_SCENARIO_OUTPUT_LAYERS = [
    "evaluator_diagnostics",
    "session_coaching",
    "transcript_evidence",
    "coach_update",
    "invited_completion",
    "candidate_dashboard",
] as const;
export const AI_EVAL_SCENARIO_RUN_STATES = [
    "queued",
    "running",
    "partial",
    "completed",
    "failed",
    "cancelled_before_start",
] as const;
export const AI_EVAL_SCENARIO_CASE_STATES = ["queued", "running", "completed", "failed"] as const;
export const AI_EVAL_SCENARIO_ASSERTION_RESULTS = ["pass", "fail", "review_required"] as const;

const stableKey = z.string().regex(/^[a-z][a-z0-9_]{2,79}$/);
const boundedText = (max: number) => z.string().trim().min(1).max(max);
const interviewStageSchema = z.enum([
    "practice_only",
    "screening",
    "first_interview",
    "follow_up",
    "final_interview",
]);
const questionCategorySchema = z.enum([
    "screening",
    "behavioral",
    "culture_fit",
    "case_scenario",
    "technical_role_specific",
]);
const candidateAnswerModeSchema = z.enum(["text", "voice"]);

const roleContextSchema = z.object({
    roleFamily: z.enum(AI_EVAL_SCENARIO_ROLE_FAMILIES),
    targetRole: boundedText(160),
    jobDescription: boundedText(8_000),
    processedResumeText: z.string().trim().max(8_000).nullable(),
    resumeContext: z.enum(AI_EVAL_SCENARIO_RESUME_CONTEXTS),
    interviewStage: interviewStageSchema,
}).strict();

const questionSchema = z.object({
    lineageKey: stableKey,
    category: questionCategorySchema,
    text: boundedText(1_000),
    plannedPurpose: boundedText(1_000),
}).strict();

const priorAttemptSchema = z.object({
    posture: z.enum(["improved", "unchanged", "regressed", "mixed"]),
    answerText: boundedText(8_000),
    answerMode: candidateAnswerModeSchema,
}).strict();

const expectedBehaviorSchema = z.object({
    allowedUsability: z.array(boundedText(80)).min(1).max(8),
    markerValues: z.record(z.string(), z.boolean()).default({}),
    categorySignalStatuses: z.record(
        z.string(),
        z.array(z.enum(["observed", "not_observed", "not_applicable", "unscoreable"])).min(1).max(4),
    ).default({}),
    requiredSensitiveFlags: z.array(boundedText(120)).max(12).default([]),
    technicalAccuracy: z.string().trim().max(80).nullable().default(null),
    verificationRequired: z.boolean().nullable().default(null),
    allowedInterventions: z.array(z.enum([
        "affirm_and_continue",
        "polish_then_continue",
        "revise_answer",
        "professional_reframe",
        "build_missing_signal",
    ])).max(5).default([]),
    allowedPatternGapIds: z.array(boundedText(80)).max(12).default([]),
    criterionAppraisals: z.record(z.string(), z.object({
        allowedApplicability: z.array(z.enum(["observed", "insufficient_data", "not_elicited", "unscoreable"]))
            .min(1).max(4),
        allowedBands: z.array(z.enum(["emerging", "clear", "strong"])).min(1).max(3).nullable().default(null),
    }).strict()).default({}),
    primaryStrength: z.enum(["present", "absent"]).nullable().default(null),
    deliveryNote: z.enum(["present", "absent"]).nullable().default(null),
    requiredCoachingConcepts: z.array(boundedText(240)).max(12).default([]),
    forbiddenCoachingConcepts: z.array(boundedText(240)).max(24).default([]),
    expectedAssertion: z.enum(AI_EVAL_SCENARIO_ASSERTION_RESULTS).default("review_required"),
}).strict();

const scenarioBase = z.object({
    schemaVersion: z.literal(AI_EVAL_SCENARIO_SCHEMA_VERSION),
    scenarioKey: stableKey,
    title: boundedText(200),
    rationale: boundedText(2_000),
    tags: z.array(stableKey).min(1).max(32),
    audiences: z.array(z.enum(AI_EVAL_SCENARIO_AUDIENCES)).min(1).max(3),
    intendedOutputLayers: z.array(z.enum(AI_EVAL_SCENARIO_OUTPUT_LAYERS)).min(1)
        .refine((value) => new Set(value).size === value.length, "Output layers must be unique."),
});

export const aiEvalAtomicAnswerScenarioSchema = scenarioBase.extend({
    kind: z.literal("atomic_answer"),
    roleContext: roleContextSchema,
    question: questionSchema,
    answer: z.object({
        text: boundedText(8_000),
        mode: candidateAnswerModeSchema,
    }).strict(),
    technicalReference: z.string().trim().max(8_000).nullable(),
    priorAttempts: z.array(priorAttemptSchema).max(8),
    expected: expectedBehaviorSchema,
}).strict().superRefine((value, context) => {
    if (value.roleContext.resumeContext === "absent" && value.roleContext.processedResumeText !== null) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["roleContext", "processedResumeText"],
            message: "Absent resume context cannot include processed resume text.",
        });
    }
    if (value.roleContext.resumeContext !== "absent" && !value.roleContext.processedResumeText) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["roleContext", "processedResumeText"],
            message: "The selected resume context requires synthetic processed resume text.",
        });
    }
});

export const aiEvalRoundJourneyScenarioSchema = scenarioBase.extend({
    kind: z.literal("round_journey"),
    prepContextKey: stableKey,
    targetRole: boundedText(160),
    posture: z.enum(["first_practice", "repeat_practice"]),
    atomicCaseKeys: z.array(stableKey).min(1).max(20)
        .refine((value) => new Set(value).size === value.length, "Journey case keys must be unique."),
    expected: z.object({
        progression: z.enum(["first_practice", "improved", "unchanged", "regressed", "mixed"]),
        primaryFocus: boundedText(500),
        requiredCoachUpdateConcepts: z.array(boundedText(240)).max(12),
        forbiddenCoachUpdateConcepts: z.array(boundedText(240)).max(24),
        expectedAssertion: z.enum(AI_EVAL_SCENARIO_ASSERTION_RESULTS).default("review_required"),
    }).strict(),
}).strict();

export const aiEvalScenarioSchema = z.discriminatedUnion("kind", [
    aiEvalAtomicAnswerScenarioSchema,
    aiEvalRoundJourneyScenarioSchema,
]);

export type AiEvalAtomicAnswerScenario = z.infer<typeof aiEvalAtomicAnswerScenarioSchema>;
export type AiEvalRoundJourneyScenario = z.infer<typeof aiEvalRoundJourneyScenarioSchema>;
export type AiEvalScenario = z.infer<typeof aiEvalScenarioSchema>;
export type AiEvalScenarioKind = typeof AI_EVAL_SCENARIO_KINDS[number];
export type AiEvalScenarioOutputLayer = typeof AI_EVAL_SCENARIO_OUTPUT_LAYERS[number];
export type AiEvalScenarioRunState = typeof AI_EVAL_SCENARIO_RUN_STATES[number];
export type AiEvalScenarioAssertionResult = typeof AI_EVAL_SCENARIO_ASSERTION_RESULTS[number];

export type AiEvalScenarioCoverage = {
    categories: string[];
    roleFamilies: string[];
    interviewStages: string[];
    resumeContexts: string[];
    audiences: string[];
    responsePatterns: string[];
    outputLayers: string[];
};

export function parseAiEvalScenario(value: unknown) {
    return aiEvalScenarioSchema.parse(value);
}

export function createAiEvalScenarioFingerprint(value: AiEvalScenario) {
    return hashCanonicalJson(aiEvalScenarioSchema.parse(value));
}

export function createAiEvalScenarioSuiteFingerprint(input: {
    suiteKey: string;
    suiteVersion: string;
    members: Array<{ scenarioKey: string; inputFingerprint: string; ordinal: number }>;
}) {
    return hashCanonicalJson(input);
}

export function createAiEvalScenarioRunRequestFingerprint(input: {
    executionMode: string;
    suiteVersionId: string | null;
    scenarioVersionIds: string[];
    profileId: string;
    configurationFingerprint: string;
    liveExecutionGateVersion?: string;
    costPreviewFingerprint?: string;
}) {
    return hashCanonicalJson({
        ...input,
        scenarioVersionIds: [...input.scenarioVersionIds],
    });
}

export function getAiEvalScenarioCoverage(scenarios: readonly AiEvalScenario[]): AiEvalScenarioCoverage {
    const atomic = scenarios.filter((scenario): scenario is AiEvalAtomicAnswerScenario => scenario.kind === "atomic_answer");
    return {
        categories: unique(atomic.map((scenario) => scenario.question.category)),
        roleFamilies: unique(atomic.map((scenario) => scenario.roleContext.roleFamily)),
        interviewStages: unique(atomic.map((scenario) => scenario.roleContext.interviewStage)),
        resumeContexts: unique(atomic.map((scenario) => scenario.roleContext.resumeContext)),
        audiences: unique(scenarios.flatMap((scenario) => scenario.audiences)),
        responsePatterns: unique(scenarios.flatMap((scenario) => scenario.tags)),
        outputLayers: unique(scenarios.flatMap((scenario) => scenario.intendedOutputLayers)),
    };
}

export function validateAiEvalScenarioCoverage(scenarios: readonly AiEvalScenario[]) {
    const coverage = getAiEvalScenarioCoverage(scenarios);
    const audienceCoverage = coverage.audiences.includes("both")
        ? [...coverage.audiences, "candidate_led", "invited"]
        : coverage.audiences;
    const missing = {
        categories: missingFrom(coverage.categories, questionCategorySchema.options),
        roleFamilies: missingFrom(coverage.roleFamilies, AI_EVAL_SCENARIO_ROLE_FAMILIES),
        interviewStages: missingFrom(coverage.interviewStages, interviewStageSchema.options),
        resumeContexts: missingFrom(coverage.resumeContexts, AI_EVAL_SCENARIO_RESUME_CONTEXTS),
        audiences: missingFrom(audienceCoverage, ["candidate_led", "invited"]),
        outputLayers: missingFrom(coverage.outputLayers, AI_EVAL_SCENARIO_OUTPUT_LAYERS),
    };
    return {
        passed: Object.values(missing).every((values) => values.length === 0),
        coverage,
        missing,
    };
}

function hashCanonicalJson(value: unknown) {
    return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, canonicalize(item)]),
        );
    }
    return value;
}

function unique(values: string[]) {
    return Array.from(new Set(values)).sort();
}

function missingFrom(actual: string[], expected: readonly string[]) {
    const present = new Set(actual);
    return expected.filter((value) => !present.has(value));
}
