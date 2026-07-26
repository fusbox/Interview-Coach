import { createHash } from "node:crypto";

import { z } from "zod";

import {
    EVIDENCE_FIRST_RUNTIME_POLICY,
    UNIVERSAL_CRITERION_IDS,
    candidateSafeFeedbackProjectionSchema,
    createEvaluatorFingerprint,
    evidenceFirstEvaluatorResolvedConfigurationManifestSchema,
    type EvidenceFirstEvaluatorProfile,
} from "./evidence-first-evaluator-contract";
import {
    EvidenceFirstEvaluatorRuntimeError,
    runEvidenceFirstEvaluator,
    type AcceptedEvidenceFirstEvaluatorRun,
    type EvidenceFirstEvaluatorRuntimeAdapters,
} from "./evidence-first-evaluator-runtime";
import { containsEvidenceFirstFeedbackForbiddenLanguage } from "./evidence-first-evaluator";
import {
    CANDIDATE_EVALUATOR_GOLDEN_SUITE_VERSION,
    candidateEvaluatorGoldenCases,
    type CandidateEvaluatorGoldenCase,
} from "./candidate-evaluator-golden-suite";
import {
    GOOGLE_EVIDENCE_FIRST_MODEL,
    GOOGLE_EVIDENCE_FIRST_PROFILE_ENV,
    GOOGLE_EVIDENCE_FIRST_PROFILE_ID,
    GOOGLE_EVIDENCE_FIRST_PROVIDER,
    GOOGLE_GENAI_API_KEY_ENV,
    createGoogleEvidenceFirstEvaluatorFromEnvironment,
    type GoogleEvidenceFirstEnvironment,
} from "./google-evidence-first-evaluator";

export const CANDIDATE_EVALUATOR_LIVE_TEST_ENV = "CANDIDATE_EVALUATOR_LIVE_TEST" as const;

const tokenUsageSchema = z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
}).strict();

const stageAttemptSchema = z.object({
    stage: z.enum(["evidence_extraction", "verification", "feedback_composition"]),
    attempt: z.number().int().positive(),
    timeoutMs: z.number().int().positive(),
    outcome: z.enum(["accepted", "failed", "rejected"]),
    latencyMs: z.number().int().nonnegative(),
    errorCode: z.string().trim().min(1).optional(),
    failureClass: z.enum([
        "timeout",
        "rate_limited",
        "provider_5xx",
        "provider_4xx",
        "misconfigured",
        "safety_blocked",
        "unknown",
        "invalid_schema",
        "validation_rejected",
    ]).optional(),
    tokenUsage: tokenUsageSchema.optional(),
}).strict();

const validationFactSchema = z.object({
    id: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
    passed: z.boolean(),
    expected: z.array(z.string().trim().min(1).max(120)).max(16),
    actual: z.array(z.string().trim().min(1).max(120)).max(16),
}).strict();

const acceptedSummarySchema = z.object({
    answerUsability: z.enum([
        "usable",
        "thin",
        "off_topic",
        "non_answer",
        "transcription_unclear",
        "sensitive_disclosure",
    ]),
    observableMarkers: z.object({
        answeredQuestion: z.boolean(),
        hasDirectAnswer: z.boolean(),
        hasExample: z.boolean(),
        hasSpecificDetails: z.boolean(),
        hasPersonalAction: z.boolean(),
        hasOutcomeOrTakeaway: z.boolean(),
        hasTradeoffOrConstraint: z.boolean(),
        hasRoleRelevantSkillSignal: z.boolean(),
        isOverlyLong: z.boolean(),
        isVeryShort: z.boolean(),
    }).strict(),
    sensitiveContentFlags: z.array(z.string().trim().min(1).max(80)).max(8),
    technicalAccuracy: z.object({
        status: z.enum(["supported", "contradicted", "not_assessed"]),
        referenceConceptIds: z.array(z.string().trim().min(1).max(120)).max(16),
    }).strict(),
    criteria: z.array(z.object({
        criterionId: z.enum(UNIVERSAL_CRITERION_IDS),
        applicability: z.enum(["observed", "not_elicited", "insufficient_data", "unscoreable"]),
        band: z.enum(["emerging", "clear", "strong"]).optional(),
    }).strict()).length(UNIVERSAL_CRITERION_IDS.length),
    patternGap: z.object({
        id: z.string().trim().min(1).max(80),
        severity: z.enum(["low", "medium", "high"]),
        source: z.enum(["answer_usability", "category_lens", "criterion_appraisal"]),
    }).strict(),
    verification: z.object({
        required: z.boolean(),
        reasons: z.array(z.string().trim().min(1).max(80)).max(16),
        supported: z.boolean().nullable(),
        recommendedAction: z.enum(["accept", "re_extract", "insufficient_signal"]).nullable(),
    }).strict(),
    intervention: z.enum([
        "affirm_and_continue",
        "polish_then_continue",
        "revise_answer",
        "professional_reframe",
        "build_missing_signal",
    ]),
    candidateProjection: candidateSafeFeedbackProjectionSchema,
}).strict();

const liveValidationCaseBaseSchema = z.object({
    caseId: z.string().regex(/^[a-z][a-z0-9_]{2,79}$/),
    title: z.string().trim().min(1).max(120),
    category: z.enum(["screening", "behavioral", "culture_fit", "case_scenario", "technical_role_specific"]),
    inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    stages: z.array(stageAttemptSchema).max(5),
    validations: z.array(validationFactSchema).min(1).max(48),
    goldenPassed: z.boolean(),
});

const acceptedCaseSchema = liveValidationCaseBaseSchema.extend({
    outcome: z.literal("accepted"),
    metrics: z.object({
        latencyMs: z.number().int().nonnegative(),
        tokenUsage: tokenUsageSchema,
    }).strict(),
    acceptedSummary: acceptedSummarySchema,
}).strict();

const failedCaseSchema = liveValidationCaseBaseSchema.extend({
    outcome: z.enum(["failed", "rejected"]),
    failure: z.object({
        stage: z.enum(["evidence_extraction", "verification", "feedback_composition", "configuration", "runtime"]),
        errorCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,79}$/),
        retryableByNewRun: z.boolean(),
    }).strict(),
}).strict();

export const candidateEvaluatorLiveValidationCaseSchema = z.discriminatedUnion("outcome", [
    acceptedCaseSchema,
    failedCaseSchema,
]);

const suiteValidationSchema = validationFactSchema;

export const candidateEvaluatorLiveValidationArtifactSchema = z.object({
    status: z.literal("candidate_evaluator_live_validation_artifact"),
    schemaVersion: z.literal(1),
    suiteVersion: z.literal(CANDIDATE_EVALUATOR_GOLDEN_SUITE_VERSION),
    artifactId: z.string().regex(/^live_eval_[a-f0-9]{16}$/),
    generatedAt: z.string().datetime(),
    profile: z.object({
        provider: z.string().trim().min(1).max(160),
        profileId: z.string().trim().min(1).max(160),
        model: z.string().trim().min(1).max(160),
        configurationFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
        configurationManifest: evidenceFirstEvaluatorResolvedConfigurationManifestSchema,
    }).strict(),
    privacy: z.object({
        sourceCases: z.literal("synthetic_fixed_cases"),
        candidateIdentity: z.literal("not_present"),
        candidateDatabase: z.literal("not_read"),
        providerInputText: z.literal("not_captured"),
        assembledPrompt: z.literal("not_captured"),
        rawProviderOutput: z.literal("not_captured"),
        credentials: z.literal("not_captured"),
    }).strict(),
    summary: z.object({
        requestedCases: z.number().int().positive(),
        acceptedCases: z.number().int().nonnegative(),
        failedCases: z.number().int().nonnegative(),
        rejectedCases: z.number().int().nonnegative(),
        passedCases: z.number().int().nonnegative(),
        gatePassed: z.boolean(),
    }).strict(),
    cases: z.array(candidateEvaluatorLiveValidationCaseSchema).min(1),
    suiteValidations: z.array(suiteValidationSchema).min(1),
    retention: z.object({
        durableCandidateRows: z.literal("not_written"),
        reviewArtifact: z.literal("local_ignored_json"),
    }).strict(),
}).strict().superRefine((artifact, context) => {
    if (
        artifact.profile.configurationFingerprint
        !== createEvaluatorFingerprint(artifact.profile.configurationManifest)
    ) {
        context.addIssue({
            code: "custom",
            path: ["profile", "configurationFingerprint"],
            message: "Configuration fingerprint must match the captured manifest.",
        });
    }
    const manifest = artifact.profile.configurationManifest;
    if (artifact.profile.profileId !== manifest.profileId) {
        context.addIssue({
            code: "custom",
            path: ["profile", "profileId"],
            message: "Artifact profile id must match the configuration manifest.",
        });
    }
    if (manifest.stages.some((stage) => stage.provider !== artifact.profile.provider)) {
        context.addIssue({
            code: "custom",
            path: ["profile", "provider"],
            message: "Artifact provider must match every stage in this schema version.",
        });
    }
    if (manifest.stages.some((stage) => stage.model !== artifact.profile.model)) {
        context.addIssue({
            code: "custom",
            path: ["profile", "model"],
            message: "Artifact model must match every stage in this schema version.",
        });
    }
    if (new Set(artifact.cases.map((item) => item.caseId)).size !== artifact.cases.length) {
        context.addIssue({ code: "custom", path: ["cases"], message: "Case ids must be unique." });
    }
    for (let index = 0; index < artifact.cases.length; index += 1) {
        const item = artifact.cases[index];
        if (
            item.outcome === "accepted"
            && item.acceptedSummary.candidateProjection.inputFingerprint !== item.inputFingerprint
        ) {
            context.addIssue({
                code: "custom",
                path: ["cases", index, "acceptedSummary", "candidateProjection", "inputFingerprint"],
                message: "Candidate projection must map to the case input fingerprint.",
            });
        }
    }

    const acceptedCases = artifact.cases.filter((item) => item.outcome === "accepted").length;
    const failedCases = artifact.cases.filter((item) => item.outcome === "failed").length;
    const rejectedCases = artifact.cases.filter((item) => item.outcome === "rejected").length;
    const passedCases = artifact.cases.filter((item) => item.goldenPassed).length;
    const gatePassed = passedCases === artifact.cases.length
        && artifact.suiteValidations.every((validation) => validation.passed);
    const expectedSummary = {
        requestedCases: artifact.cases.length,
        acceptedCases,
        failedCases,
        rejectedCases,
        passedCases,
        gatePassed,
    };
    for (const [key, value] of Object.entries(expectedSummary)) {
        if (artifact.summary[key as keyof typeof expectedSummary] !== value) {
            context.addIssue({
                code: "custom",
                path: ["summary", key],
                message: "Summary must be derived from case and suite validation facts.",
            });
        }
    }
});

export type CandidateEvaluatorLiveValidationArtifact = z.infer<
    typeof candidateEvaluatorLiveValidationArtifactSchema
>;
export type CandidateEvaluatorLiveValidationCase = z.infer<
    typeof candidateEvaluatorLiveValidationCaseSchema
>;

const comparisonFlagSchema = z.enum([
    "missing_case",
    "different_case_input",
    "baseline_gate_failed",
    "candidate_gate_failed",
    "candidate_safety_regression",
    "golden_regression",
    "latency_regression",
    "token_regression",
    "needs_human_review",
]);

const comparisonVariantSchema = z.object({
    outcome: z.enum(["accepted", "failed", "rejected", "missing"]),
    goldenPassed: z.boolean(),
    latencyMs: z.number().int().nonnegative().nullable(),
    tokenUsage: tokenUsageSchema.nullable(),
    candidateProjection: candidateSafeFeedbackProjectionSchema.nullable(),
}).strict();

export const candidateEvaluatorLiveComparisonArtifactSchema = z.object({
    status: z.literal("candidate_evaluator_live_comparison_artifact"),
    schemaVersion: z.literal(1),
    suiteVersion: z.literal(CANDIDATE_EVALUATOR_GOLDEN_SUITE_VERSION),
    comparisonId: z.string().regex(/^live_compare_[a-f0-9]{16}$/),
    generatedAt: z.string().datetime(),
    mode: z.enum(["same_profile_repeatability", "profile_ab"]),
    baseline: z.object({
        artifactId: z.string().regex(/^live_eval_[a-f0-9]{16}$/),
        profileId: z.string().trim().min(1),
        configurationFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    }).strict(),
    candidate: z.object({
        artifactId: z.string().regex(/^live_eval_[a-f0-9]{16}$/),
        profileId: z.string().trim().min(1),
        configurationFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    }).strict(),
    summary: z.object({
        comparableCases: z.number().int().nonnegative(),
        totalCases: z.number().int().positive(),
        comparisonReady: z.boolean(),
        flags: z.array(comparisonFlagSchema),
        preference: z.literal("not_reviewed"),
    }).strict(),
    cases: z.array(z.object({
        caseId: z.string().trim().min(1),
        inputFingerprint: z.string().trim().min(1),
        comparable: z.boolean(),
        baseline: comparisonVariantSchema,
        candidate: comparisonVariantSchema,
        deltas: z.object({
            latencyMs: z.number().int().nullable(),
            totalTokens: z.number().int().nullable(),
        }).strict(),
        flags: z.array(comparisonFlagSchema),
        judgment: z.object({
            preference: z.literal("not_reviewed"),
            reason: z.null(),
        }).strict(),
    }).strict()).min(1),
    privacy: z.object({
        providerInputText: z.literal("not_present"),
        rawProviderOutput: z.literal("not_present"),
        credentials: z.literal("not_present"),
        candidateIdentity: z.literal("not_present"),
    }).strict(),
}).strict();

export type CandidateEvaluatorLiveComparisonArtifact = z.infer<
    typeof candidateEvaluatorLiveComparisonArtifactSchema
>;

export class CandidateEvaluatorLiveValidationGuardError extends Error {
    readonly safeCode: string;

    constructor(safeCode: string) {
        super(safeCode);
        this.name = "CandidateEvaluatorLiveValidationGuardError";
        this.safeCode = safeCode;
    }
}

type LiveEvaluatorAssembly = {
    profile: EvidenceFirstEvaluatorProfile;
    runMetadata: {
        configurationFingerprint: string;
        configurationManifest: z.infer<typeof evidenceFirstEvaluatorResolvedConfigurationManifestSchema>;
    };
    adapters: EvidenceFirstEvaluatorRuntimeAdapters;
};

type LiveValidationEnvironment = GoogleEvidenceFirstEnvironment & {
    CANDIDATE_EVALUATOR_LIVE_TEST?: string;
    [key: string]: string | undefined;
};

export async function runCandidateEvaluatorLiveValidation(input: {
    env: LiveValidationEnvironment;
    confirmedLiveProvider: boolean;
    dependencies?: {
        now?: () => Date;
        createEvaluator?: (env: LiveValidationEnvironment) => LiveEvaluatorAssembly;
        runEvaluator?: typeof runEvidenceFirstEvaluator;
    };
}): Promise<CandidateEvaluatorLiveValidationArtifact> {
    assertCandidateEvaluatorLiveValidationEnabled(input);

    const now = input.dependencies?.now ?? (() => new Date());
    const createEvaluator = input.dependencies?.createEvaluator ?? createPinnedGoogleEvaluator;
    const runEvaluator = input.dependencies?.runEvaluator ?? runEvidenceFirstEvaluator;
    const evaluator = createEvaluator(input.env);
    assertPinnedEvaluator(evaluator);

    const generatedAt = now().toISOString();
    const caseResults: CandidateEvaluatorLiveValidationCase[] = [];

    for (let index = 0; index < candidateEvaluatorGoldenCases.length; index += 1) {
        const goldenCase = candidateEvaluatorGoldenCases[index];
        const requestedAt = now().toISOString();
        try {
            const run = await runEvaluator({
                evaluationRunId: `qa-live:${CANDIDATE_EVALUATOR_GOLDEN_SUITE_VERSION}:${goldenCase.caseId}:${index + 1}`,
                evaluationCase: goldenCase.evaluationCase,
                profile: evaluator.profile,
                adapters: evaluator.adapters,
                requestedAt,
            });
            caseResults.push(createAcceptedCaseResult(goldenCase, run));
        } catch (error) {
            caseResults.push(createFailedCaseResult(goldenCase, error));
        }
    }

    const suiteValidations = createSuiteValidations(caseResults);
    const acceptedCases = caseResults.filter((result) => result.outcome === "accepted").length;
    const failedCases = caseResults.filter((result) => result.outcome === "failed").length;
    const rejectedCases = caseResults.filter((result) => result.outcome === "rejected").length;
    const passedCases = caseResults.filter((result) => result.goldenPassed).length;
    const gatePassed = passedCases === caseResults.length
        && suiteValidations.every((validation) => validation.passed);
    const artifactId = createArtifactId("live_eval", {
        generatedAt,
        suiteVersion: CANDIDATE_EVALUATOR_GOLDEN_SUITE_VERSION,
        configurationFingerprint: evaluator.runMetadata.configurationFingerprint,
        cases: caseResults.map((result) => ({
            caseId: result.caseId,
            inputFingerprint: result.inputFingerprint,
            outcome: result.outcome,
        })),
    });

    const artifact = candidateEvaluatorLiveValidationArtifactSchema.parse({
        status: "candidate_evaluator_live_validation_artifact",
        schemaVersion: 1,
        suiteVersion: CANDIDATE_EVALUATOR_GOLDEN_SUITE_VERSION,
        artifactId,
        generatedAt,
        profile: {
            provider: GOOGLE_EVIDENCE_FIRST_PROVIDER,
            profileId: GOOGLE_EVIDENCE_FIRST_PROFILE_ID,
            model: GOOGLE_EVIDENCE_FIRST_MODEL,
            configurationFingerprint: evaluator.runMetadata.configurationFingerprint,
            configurationManifest: evaluator.runMetadata.configurationManifest,
        },
        privacy: {
            sourceCases: "synthetic_fixed_cases",
            candidateIdentity: "not_present",
            candidateDatabase: "not_read",
            providerInputText: "not_captured",
            assembledPrompt: "not_captured",
            rawProviderOutput: "not_captured",
            credentials: "not_captured",
        },
        summary: {
            requestedCases: caseResults.length,
            acceptedCases,
            failedCases,
            rejectedCases,
            passedCases,
            gatePassed,
        },
        cases: caseResults,
        suiteValidations,
        retention: {
            durableCandidateRows: "not_written",
            reviewArtifact: "local_ignored_json",
        },
    });
    const prohibitedKeys = findProhibitedLiveArtifactKeys(artifact);
    const credential = input.env[GOOGLE_GENAI_API_KEY_ENV]?.trim();
    if (
        prohibitedKeys.length > 0
        || (credential && JSON.stringify(artifact).includes(credential))
    ) {
        throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_ARTIFACT_PRIVACY_VIOLATION");
    }
    return artifact;
}

export function assertCandidateEvaluatorLiveValidationEnabled(input: {
    env: LiveValidationEnvironment;
    confirmedLiveProvider: boolean;
}) {
    if (!input.confirmedLiveProvider) {
        throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_CLI_CONFIRMATION_REQUIRED");
    }
    if (input.env[CANDIDATE_EVALUATOR_LIVE_TEST_ENV] !== "true") {
        throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_FLAG_REQUIRED");
    }
    if (input.env.CANDIDATE_ANSWER_ANALYSIS_PROVIDER !== GOOGLE_EVIDENCE_FIRST_PROVIDER) {
        throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_PROVIDER_MISMATCH");
    }
    if (input.env[GOOGLE_EVIDENCE_FIRST_PROFILE_ENV] !== GOOGLE_EVIDENCE_FIRST_PROFILE_ID) {
        throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_PROFILE_MISMATCH");
    }
    if (!input.env[GOOGLE_GENAI_API_KEY_ENV]?.trim()) {
        throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_CREDENTIAL_REQUIRED");
    }
}

export function createCandidateEvaluatorLiveComparison(input: {
    baseline: unknown;
    candidate: unknown;
    generatedAt?: string;
}): CandidateEvaluatorLiveComparisonArtifact {
    const baseline = candidateEvaluatorLiveValidationArtifactSchema.parse(input.baseline);
    const candidate = candidateEvaluatorLiveValidationArtifactSchema.parse(input.candidate);
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const baselineById = new Map(baseline.cases.map((item) => [item.caseId, item]));
    const candidateById = new Map(candidate.cases.map((item) => [item.caseId, item]));
    const caseIds = Array.from(new Set([
        ...Array.from(baselineById.keys()),
        ...Array.from(candidateById.keys()),
    ])).sort();

    const cases = caseIds.map((caseId) => {
        const baselineCase = baselineById.get(caseId);
        const candidateCase = candidateById.get(caseId);
        const sameInput = Boolean(
            baselineCase
            && candidateCase
            && baselineCase.inputFingerprint === candidateCase.inputFingerprint,
        );
        const flags: z.infer<typeof comparisonFlagSchema>[] = [];
        if (!baselineCase || !candidateCase) flags.push("missing_case");
        if (baselineCase && candidateCase && !sameInput) flags.push("different_case_input");
        if (baselineCase && !baselineCase.goldenPassed) flags.push("baseline_gate_failed");
        if (candidateCase && !candidateCase.goldenPassed) flags.push("candidate_gate_failed");
        if (isSafetyRegression(baselineCase, candidateCase)) flags.push("candidate_safety_regression");
        if (baselineCase?.goldenPassed && candidateCase && !candidateCase.goldenPassed) flags.push("golden_regression");
        if (isLatencyRegression(baselineCase, candidateCase)) flags.push("latency_regression");
        if (isTokenRegression(baselineCase, candidateCase)) flags.push("token_regression");
        flags.push("needs_human_review");

        const baselineVariant = createComparisonVariant(baselineCase);
        const candidateVariant = createComparisonVariant(candidateCase);
        return {
            caseId,
            inputFingerprint: baselineCase?.inputFingerprint ?? candidateCase?.inputFingerprint ?? "missing",
            comparable: sameInput,
            baseline: baselineVariant,
            candidate: candidateVariant,
            deltas: {
                latencyMs: bothNumbers(baselineVariant.latencyMs, candidateVariant.latencyMs)
                    ? candidateVariant.latencyMs! - baselineVariant.latencyMs!
                    : null,
                totalTokens: bothTokenUsage(baselineVariant.tokenUsage, candidateVariant.tokenUsage)
                    ? candidateVariant.tokenUsage!.totalTokens - baselineVariant.tokenUsage!.totalTokens
                    : null,
            },
            flags: Array.from(new Set(flags)),
            judgment: { preference: "not_reviewed" as const, reason: null },
        };
    });

    const summaryFlagSet = new Set(cases.flatMap((item) => item.flags));
    if (!baseline.summary.gatePassed) summaryFlagSet.add("baseline_gate_failed");
    if (!candidate.summary.gatePassed) summaryFlagSet.add("candidate_gate_failed");
    const summaryFlags = Array.from(summaryFlagSet);
    const comparableCases = cases.filter((item) => item.comparable).length;
    const comparisonReady = comparableCases === cases.length
        && baseline.summary.gatePassed
        && candidate.summary.gatePassed;
    const mode = baseline.profile.configurationFingerprint === candidate.profile.configurationFingerprint
        ? "same_profile_repeatability" as const
        : "profile_ab" as const;
    const comparisonId = createArtifactId("live_compare", {
        generatedAt,
        baseline: baseline.artifactId,
        candidate: candidate.artifactId,
    });

    return candidateEvaluatorLiveComparisonArtifactSchema.parse({
        status: "candidate_evaluator_live_comparison_artifact",
        schemaVersion: 1,
        suiteVersion: CANDIDATE_EVALUATOR_GOLDEN_SUITE_VERSION,
        comparisonId,
        generatedAt,
        mode,
        baseline: {
            artifactId: baseline.artifactId,
            profileId: baseline.profile.profileId,
            configurationFingerprint: baseline.profile.configurationFingerprint,
        },
        candidate: {
            artifactId: candidate.artifactId,
            profileId: candidate.profile.profileId,
            configurationFingerprint: candidate.profile.configurationFingerprint,
        },
        summary: {
            comparableCases,
            totalCases: cases.length,
            comparisonReady,
            flags: summaryFlags,
            preference: "not_reviewed",
        },
        cases,
        privacy: {
            providerInputText: "not_present",
            rawProviderOutput: "not_present",
            credentials: "not_present",
            candidateIdentity: "not_present",
        },
    });
}

export function findProhibitedLiveArtifactKeys(value: unknown): string[] {
    const prohibited = new Set([
        "answerAttemptId",
        "candidateProfileId",
        "candidatePracticeSessionId",
        "roleProfileId",
        "providerInput",
        "answerText",
        "questionText",
        "jobDescription",
        "resumeText",
        "evidenceSpans",
        "apiKey",
        "credentialValue",
        "email",
    ]);
    const found = new Set<string>();

    const visit = (item: unknown) => {
        if (Array.isArray(item)) {
            item.forEach(visit);
            return;
        }
        if (!item || typeof item !== "object") return;
        for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
            if (prohibited.has(key)) found.add(key);
            visit(child);
        }
    };
    visit(value);
    return Array.from(found).sort();
}

function createPinnedGoogleEvaluator(env: LiveValidationEnvironment): LiveEvaluatorAssembly {
    const evaluator = createGoogleEvidenceFirstEvaluatorFromEnvironment({ env });
    if (!evaluator) {
        throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_ASSEMBLY_UNAVAILABLE");
    }
    return evaluator;
}

function assertPinnedEvaluator(evaluator: LiveEvaluatorAssembly) {
    if (
        evaluator.profile.profileId !== GOOGLE_EVIDENCE_FIRST_PROFILE_ID
        || evaluator.runMetadata.configurationManifest.profileId !== GOOGLE_EVIDENCE_FIRST_PROFILE_ID
        || evaluator.profile.evidenceExtractor.provider !== GOOGLE_EVIDENCE_FIRST_PROVIDER
        || evaluator.profile.evidenceExtractor.model !== GOOGLE_EVIDENCE_FIRST_MODEL
        || evaluator.profile.feedbackComposer.provider !== GOOGLE_EVIDENCE_FIRST_PROVIDER
        || evaluator.profile.feedbackComposer.model !== GOOGLE_EVIDENCE_FIRST_MODEL
        || evaluator.profile.verifier?.provider !== GOOGLE_EVIDENCE_FIRST_PROVIDER
        || evaluator.profile.verifier?.model !== GOOGLE_EVIDENCE_FIRST_MODEL
    ) {
        throw new CandidateEvaluatorLiveValidationGuardError("LIVE_EVALUATOR_ASSEMBLY_PROFILE_MISMATCH");
    }
}

function createAcceptedCaseResult(
    goldenCase: CandidateEvaluatorGoldenCase,
    run: AcceptedEvidenceFirstEvaluatorRun,
): CandidateEvaluatorLiveValidationCase {
    const validations = createAcceptedValidations(goldenCase, run);
    return candidateEvaluatorLiveValidationCaseSchema.parse({
        caseId: goldenCase.caseId,
        title: goldenCase.title,
        category: goldenCase.evaluationCase.providerInput.question.category,
        inputFingerprint: goldenCase.evaluationCase.inputFingerprint,
        outcome: "accepted",
        stages: run.stages,
        metrics: run.metrics,
        validations,
        goldenPassed: validations.every((validation) => validation.passed),
        acceptedSummary: {
            answerUsability: run.accepted.extraction.answerUsability.status,
            observableMarkers: run.accepted.extraction.observableMarkers,
            sensitiveContentFlags: run.accepted.extraction.sensitiveContentFlags,
            technicalAccuracy: {
                status: run.accepted.extraction.technicalAccuracy.status,
                referenceConceptIds: run.accepted.extraction.technicalAccuracy.referenceConceptIds,
            },
            criteria: run.accepted.criteria.map((criterion) => ({
                criterionId: criterion.criterionId,
                applicability: criterion.applicability,
                ...(criterion.band ? { band: criterion.band } : {}),
            })),
            patternGap: {
                id: run.accepted.patternGap.id,
                severity: run.accepted.patternGap.severity,
                source: run.accepted.patternGap.source,
            },
            verification: {
                required: run.accepted.verification.required,
                reasons: run.accepted.verification.reasons,
                supported: run.accepted.verification.output?.supported ?? null,
                recommendedAction: run.accepted.verification.output?.recommendedAction ?? null,
            },
            intervention: run.accepted.feedback.feedbackPlan.intervention,
            candidateProjection: run.accepted.candidateProjection,
        },
    });
}

function createFailedCaseResult(
    goldenCase: CandidateEvaluatorGoldenCase,
    error: unknown,
): CandidateEvaluatorLiveValidationCase {
    const runtimeError = error instanceof EvidenceFirstEvaluatorRuntimeError ? error : null;
    const outcome = runtimeError?.disposition ?? "failed";
    const actual = runtimeError ? [outcome, runtimeError.stage, runtimeError.errorCode] : ["failed", "runtime"];
    return candidateEvaluatorLiveValidationCaseSchema.parse({
        caseId: goldenCase.caseId,
        title: goldenCase.title,
        category: goldenCase.evaluationCase.providerInput.question.category,
        inputFingerprint: goldenCase.evaluationCase.inputFingerprint,
        outcome,
        stages: runtimeError?.attempts ?? [],
        validations: [fact("runtime_accepted", false, ["accepted"], actual)],
        goldenPassed: false,
        failure: {
            stage: runtimeError?.stage ?? "runtime",
            errorCode: runtimeError?.errorCode ?? "LIVE_EVALUATOR_UNCLASSIFIED_FAILURE",
            retryableByNewRun: runtimeError?.retryableByNewRun ?? false,
        },
    });
}

function createAcceptedValidations(
    goldenCase: CandidateEvaluatorGoldenCase,
    run: AcceptedEvidenceFirstEvaluatorRun,
) {
    const extraction = run.accepted.extraction;
    const expectation = goldenCase.expectation;
    const projectionText = flattenCandidateProjection(run.accepted.candidateProjection);
    const spansExact = extraction.evidenceSpans.every((span) => (
        goldenCase.evaluationCase.providerInput.answer.text.slice(span.start, span.end) === span.quote
    ));
    const technicalReferencePresent = Boolean(goldenCase.evaluationCase.providerInput.technicalReference);
    const technicalBoundaryValid = technicalReferencePresent
        || extraction.technicalAccuracy.status === "not_assessed";
    const validations = [
        fact("runtime_accepted", true, ["accepted"], ["accepted"]),
        fact(
            "input_fingerprint_matches",
            run.inputFingerprint === goldenCase.evaluationCase.inputFingerprint,
            [goldenCase.evaluationCase.inputFingerprint],
            [run.inputFingerprint],
        ),
        fact("evidence_spans_are_exact", spansExact, ["true"], [String(spansExact)]),
        fact(
            "unsafe_inference_flags_empty",
            extraction.unsafeInferenceFlags.length === 0,
            ["none"],
            extraction.unsafeInferenceFlags.length ? extraction.unsafeInferenceFlags : ["none"],
        ),
        fact(
            "candidate_language_safe",
            !containsForbiddenCandidateLanguage(
                projectionText,
                goldenCase.evaluationCase.providerInput.answer.text,
            ),
            ["no_forbidden_language"],
            [containsForbiddenCandidateLanguage(
                projectionText,
                goldenCase.evaluationCase.providerInput.answer.text,
            ) ? "forbidden_language_found" : "no_forbidden_language"],
        ),
        fact(
            "technical_reference_boundary",
            technicalBoundaryValid,
            [technicalReferencePresent ? "reference_supplied" : "not_assessed"],
            [extraction.technicalAccuracy.status],
        ),
        fact(
            "retention_markers",
            run.retention.assembledPrompt === "not_captured" && run.retention.rawProviderOutput === "not_captured",
            ["not_captured"],
            [run.retention.assembledPrompt, run.retention.rawProviderOutput],
        ),
        fact(
            "runtime_budget",
            run.metrics.latencyMs <= EVIDENCE_FIRST_RUNTIME_POLICY.totalBudgetMs,
            [`at_most_${EVIDENCE_FIRST_RUNTIME_POLICY.totalBudgetMs}`],
            [String(run.metrics.latencyMs)],
        ),
        fact(
            "answer_usability",
            expectation.allowedUsability.includes(extraction.answerUsability.status),
            [...expectation.allowedUsability],
            [extraction.answerUsability.status],
        ),
    ];

    for (const [marker, expected] of Object.entries(expectation.markerValues ?? {})) {
        const actual = extraction.observableMarkers[marker as keyof typeof extraction.observableMarkers];
        validations.push(fact(`marker_${toFactId(marker)}`, actual === expected, [String(expected)], [String(actual)]));
    }
    for (const [signalId, allowedStatuses] of Object.entries(expectation.categorySignalStatuses ?? {})) {
        const signal = extraction.categorySignals.find((item) => item.id === signalId);
        const actual = signal?.status ?? "missing";
        validations.push(fact(
            `category_signal_${toFactId(signalId)}`,
            Boolean(signal && allowedStatuses.includes(signal.status)),
            [...allowedStatuses],
            [actual],
        ));
    }
    for (const requiredFlag of expectation.requiredSensitiveFlags ?? []) {
        const present = extraction.sensitiveContentFlags.includes(requiredFlag);
        validations.push(fact(
            `sensitive_flag_${toFactId(requiredFlag)}`,
            present,
            [requiredFlag],
            present ? [requiredFlag] : ["missing"],
        ));
    }
    if (expectation.technicalAccuracy) {
        validations.push(fact(
            "technical_accuracy",
            extraction.technicalAccuracy.status === expectation.technicalAccuracy,
            [expectation.technicalAccuracy],
            [extraction.technicalAccuracy.status],
        ));
    }
    if (expectation.verificationRequired !== undefined) {
        validations.push(fact(
            "verification_required",
            run.accepted.verification.required === expectation.verificationRequired,
            [String(expectation.verificationRequired)],
            [String(run.accepted.verification.required)],
        ));
    }
    if (expectation.allowedInterventions) {
        const intervention = run.accepted.feedback.feedbackPlan.intervention;
        validations.push(fact(
            "feedback_intervention",
            expectation.allowedInterventions.includes(intervention),
            [...expectation.allowedInterventions],
            [intervention],
        ));
    }
    if (expectation.allowedPatternGapIds) {
        validations.push(fact(
            "pattern_gap",
            expectation.allowedPatternGapIds.includes(run.accepted.patternGap.id),
            [...expectation.allowedPatternGapIds],
            [run.accepted.patternGap.id],
        ));
    }
    if (expectation.primaryStrength) {
        const present = Boolean(run.accepted.candidateProjection.primaryStrength);
        validations.push(fact(
            "candidate_primary_strength",
            present === (expectation.primaryStrength === "present"),
            [expectation.primaryStrength],
            [present ? "present" : "absent"],
        ));
    }
    if (expectation.deliveryNote) {
        const present = Boolean(run.accepted.candidateProjection.deliveryNote);
        validations.push(fact(
            "candidate_delivery_note",
            present === (expectation.deliveryNote === "present"),
            [expectation.deliveryNote],
            [present ? "present" : "absent"],
        ));
    }
    for (const [criterionId, criterionExpectation] of Object.entries(expectation.criterionAppraisals)) {
        const criterion = run.accepted.criteria.find((item) => item.criterionId === criterionId);
        validations.push(fact(
            `criterion_${toFactId(criterionId)}_applicability`,
            Boolean(criterion && criterionExpectation.allowedApplicability.includes(criterion.applicability)),
            [...criterionExpectation.allowedApplicability],
            [criterion?.applicability ?? "missing"],
        ));
        if (criterion?.applicability === "observed" && criterionExpectation.allowedBands) {
            validations.push(fact(
                `criterion_${toFactId(criterionId)}_band`,
                Boolean(criterion.band && criterionExpectation.allowedBands.includes(criterion.band)),
                [...criterionExpectation.allowedBands],
                [criterion.band ?? "missing"],
            ));
        }
    }
    return validations;
}

function createSuiteValidations(caseResults: CandidateEvaluatorLiveValidationCase[]) {
    const requiredIds = candidateEvaluatorGoldenCases.map((item) => item.caseId);
    const actualIds = caseResults.map((item) => item.caseId);
    const allCasesPresent = requiredIds.length === actualIds.length
        && requiredIds.every((caseId) => actualIds.includes(caseId));
    const allAccepted = caseResults.every((item) => item.outcome === "accepted");
    const allPassed = caseResults.every((item) => item.goldenPassed);
    const typed = findAcceptedCase(caseResults, "strong_content_typed");
    const voice = findAcceptedCase(caseResults, "strong_content_voice_with_fillers");
    const criteriaMatch = Boolean(typed && voice && coreCriteriaKey(typed) === coreCriteriaKey(voice));
    const voiceHasDeliveryNote = Boolean(voice?.acceptedSummary.candidateProjection.deliveryNote);

    return [
        fact("required_cases_present", allCasesPresent, requiredIds, actualIds),
        fact("all_cases_accepted", allAccepted, ["true"], [String(allAccepted)]),
        fact("all_case_assertions_passed", allPassed, ["true"], [String(allPassed)]),
        fact("voice_core_criteria_match_typed", criteriaMatch, ["true"], [String(criteriaMatch)]),
        fact("voice_delivery_note_is_separate", voiceHasDeliveryNote, ["true"], [String(voiceHasDeliveryNote)]),
    ];
}

function findAcceptedCase(cases: CandidateEvaluatorLiveValidationCase[], caseId: string) {
    const item = cases.find((candidate) => candidate.caseId === caseId);
    return item?.outcome === "accepted" ? item : null;
}

function coreCriteriaKey(item: Extract<CandidateEvaluatorLiveValidationCase, { outcome: "accepted" }>) {
    return JSON.stringify(item.acceptedSummary.criteria.map((criterion) => ({
        criterionId: criterion.criterionId,
        applicability: criterion.applicability,
        band: criterion.band ?? null,
    })));
}

function flattenCandidateProjection(
    projection: AcceptedEvidenceFirstEvaluatorRun["accepted"]["candidateProjection"],
) {
    return [
        projection.acknowledgement,
        projection.primaryStrength,
        projection.biggestUpgrade,
        projection.redoPrompt,
        projection.patternSuggestion?.patternName,
        ...(projection.patternSuggestion?.steps ?? []),
        projection.deliveryNote?.message,
    ].filter((value): value is string => Boolean(value)).join(" ");
}

export function containsForbiddenCandidateLanguage(value: string, sourceText = "") {
    const restrictedProfessionalAdvice = /\b(?:improve your english|medical diagnosis|diagnos(?:e|ed) you|legal advice|lawyer|illegal)\b/i;
    const sourceVocabulary = /\b(?:english|medical|diagnosis|diagnos(?:e|ed)|legal|lawyer|illegal)\b/i;
    return containsEvidenceFirstFeedbackForbiddenLanguage(value, sourceText)
        || (
            restrictedProfessionalAdvice.test(value)
            && !(sourceText && sourceVocabulary.test(sourceText))
        );
}

function fact(id: string, passed: boolean, expected: readonly string[], actual: readonly string[]) {
    return validationFactSchema.parse({ id, passed, expected: [...expected], actual: [...actual] });
}

function toFactId(value: string) {
    return value.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
}

function createComparisonVariant(item: CandidateEvaluatorLiveValidationCase | undefined) {
    if (!item) {
        return { outcome: "missing" as const, goldenPassed: false, latencyMs: null, tokenUsage: null, candidateProjection: null };
    }
    if (item.outcome !== "accepted") {
        return { outcome: item.outcome, goldenPassed: false, latencyMs: null, tokenUsage: null, candidateProjection: null };
    }
    return {
        outcome: "accepted" as const,
        goldenPassed: item.goldenPassed,
        latencyMs: item.metrics.latencyMs,
        tokenUsage: item.metrics.tokenUsage,
        candidateProjection: item.acceptedSummary.candidateProjection,
    };
}

function isSafetyRegression(
    baseline: CandidateEvaluatorLiveValidationCase | undefined,
    candidate: CandidateEvaluatorLiveValidationCase | undefined,
) {
    return validationPassed(baseline, "candidate_language_safe")
        && !validationPassed(candidate, "candidate_language_safe");
}

function validationPassed(item: CandidateEvaluatorLiveValidationCase | undefined, id: string) {
    return Boolean(item?.validations.find((validation) => validation.id === id)?.passed);
}

function isLatencyRegression(
    baseline: CandidateEvaluatorLiveValidationCase | undefined,
    candidate: CandidateEvaluatorLiveValidationCase | undefined,
) {
    if (baseline?.outcome !== "accepted" || candidate?.outcome !== "accepted") return false;
    return candidate.metrics.latencyMs > Math.max(
        baseline.metrics.latencyMs + 1_000,
        Math.round(baseline.metrics.latencyMs * 1.5),
    );
}

function isTokenRegression(
    baseline: CandidateEvaluatorLiveValidationCase | undefined,
    candidate: CandidateEvaluatorLiveValidationCase | undefined,
) {
    if (baseline?.outcome !== "accepted" || candidate?.outcome !== "accepted") return false;
    return candidate.metrics.tokenUsage.totalTokens > Math.max(
        baseline.metrics.tokenUsage.totalTokens + 100,
        Math.round(baseline.metrics.tokenUsage.totalTokens * 1.25),
    );
}

function bothNumbers(left: number | null, right: number | null) {
    return left !== null && right !== null;
}

function bothTokenUsage(
    left: z.infer<typeof tokenUsageSchema> | null,
    right: z.infer<typeof tokenUsageSchema> | null,
) {
    return left !== null && right !== null;
}

function createArtifactId(prefix: "live_eval" | "live_compare", value: unknown) {
    const digest = createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
    return `${prefix}_${digest}`;
}
