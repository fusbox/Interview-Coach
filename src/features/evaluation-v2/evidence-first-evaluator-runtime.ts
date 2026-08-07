import { z } from "zod";

import {
    EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
    EVIDENCE_FIRST_PROMPT_BUNDLE_VERSION,
    evidenceFirstModelStageDescriptorSchema,
    EVIDENCE_FIRST_RUNTIME_POLICY,
    candidateSafeFeedbackProjectionSchema,
    createEvidenceExtractorTask,
    createEvidenceVerifierTask,
    criterionAppraisalSchema,
    evidenceExtractionOutputSchema,
    evidenceVerificationOutputSchema,
    feedbackCompositionOutputSchema,
    patternGapSchema,
    type EvidenceFirstEvaluationCase,
    type EvidenceFirstEvaluatorProfile,
    type EvidenceFirstModelStageDescriptor,
} from "./evidence-first-evaluator-contract";
import {
    createFeedbackComposerTask,
    resolveEvidenceVerification,
    validateAndAppraiseEvidence,
    validateFeedbackComposition,
    type AcceptedEvidenceFirstAppraisal,
    type EvidenceFirstAppraisalResult,
} from "./evidence-first-evaluator";

export type EvidenceFirstRuntimeStage = "evidence_extraction" | "verification" | "feedback_composition";
export type EvidenceFirstAdapterFailureClass =
    | "timeout"
    | "rate_limited"
    | "provider_5xx"
    | "provider_4xx"
    | "misconfigured"
    | "invalid_schema"
    | "safety_blocked"
    | "unknown";

export type EvidenceFirstStageAdapterResult = {
    value: unknown;
    tokenUsage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
};

export type EvidenceFirstStageAdapter<TTask> = {
    descriptor: EvidenceFirstModelStageDescriptor;
    invoke: (input: {
        task: TTask;
        attempt: number;
        timeoutMs: number;
        signal: AbortSignal;
    }) => Promise<EvidenceFirstStageAdapterResult>;
};

export type EvidenceFirstEvaluatorRuntimeAdapters = {
    evidenceExtractor: EvidenceFirstStageAdapter<ReturnType<typeof createEvidenceExtractorTask>>;
    verifier?: EvidenceFirstStageAdapter<ReturnType<typeof createEvidenceVerifierTask>>;
    feedbackComposer: EvidenceFirstStageAdapter<ReturnType<typeof createFeedbackComposerTask>>;
};

export class EvidenceFirstAdapterError extends Error {
    readonly failureClass: EvidenceFirstAdapterFailureClass;
    readonly safeCode: string;

    constructor(input: {
        failureClass: EvidenceFirstAdapterFailureClass;
        safeCode: string;
    }) {
        const safeCode = /^[A-Z][A-Z0-9_]{0,79}$/.test(input.safeCode)
            ? input.safeCode
            : "PROVIDER_UNCLASSIFIED_FAILURE";
        super(safeCode);
        this.name = "EvidenceFirstAdapterError";
        this.failureClass = input.failureClass;
        this.safeCode = safeCode;
    }
}

export class EvidenceFirstEvaluatorRuntimeError extends Error {
    readonly disposition: "failed" | "rejected";
    readonly errorCode: string;
    readonly stage: EvidenceFirstRuntimeStage | "configuration" | "runtime";
    readonly retryableByNewRun: boolean;
    readonly attempts: EvidenceFirstStageAttemptRecord[];

    constructor(input: {
        disposition: "failed" | "rejected";
        errorCode: string;
        stage: EvidenceFirstRuntimeStage | "configuration" | "runtime";
        retryableByNewRun: boolean;
        attempts: EvidenceFirstStageAttemptRecord[];
    }) {
        super(input.errorCode);
        this.name = "EvidenceFirstEvaluatorRuntimeError";
        this.disposition = input.disposition;
        this.errorCode = input.errorCode;
        this.stage = input.stage;
        this.retryableByNewRun = input.retryableByNewRun;
        this.attempts = input.attempts;
    }
}

const tokenUsageSchema = z.object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
}).strict();

const evaluatorProfileSchema = z.object({
    profileId: z.string().trim().min(1),
    evaluatorVersion: z.literal(EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION),
    promptBundleVersion: z.literal(EVIDENCE_FIRST_PROMPT_BUNDLE_VERSION),
    serviceMode: z.string().trim().min(1),
    adapterVersion: z.string().trim().min(1),
    evidenceExtractor: evidenceFirstModelStageDescriptorSchema,
    feedbackComposer: evidenceFirstModelStageDescriptorSchema,
    verifier: evidenceFirstModelStageDescriptorSchema.optional(),
}).strict();

export const COMPATIBLE_PERSISTED_EVIDENCE_FIRST_PROMPT_BUNDLE_VERSIONS = [
    "candidate_evidence_first_prompts_v14",
    EVIDENCE_FIRST_PROMPT_BUNDLE_VERSION,
] as const;

const compatiblePersistedEvaluatorProfileSchema = evaluatorProfileSchema.extend({
    promptBundleVersion: z.enum(COMPATIBLE_PERSISTED_EVIDENCE_FIRST_PROMPT_BUNDLE_VERSIONS),
});

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

export const acceptedEvidenceFirstEvaluatorRunSchema = z.object({
    status: z.literal("evidence_first_evaluator_run_accepted"),
    schemaVersion: z.literal(1),
    contractVersion: z.literal(EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION),
    evaluationRunId: z.string().trim().min(1),
    inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    requestedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    profile: evaluatorProfileSchema,
    accepted: z.object({
        extraction: evidenceExtractionOutputSchema,
        criteria: z.array(criterionAppraisalSchema).min(1),
        patternGap: patternGapSchema,
        verification: z.object({
            required: z.boolean(),
            reasons: z.array(z.string().trim().min(1).max(80)).max(16),
            output: evidenceVerificationOutputSchema.nullable(),
        }).strict(),
        feedback: feedbackCompositionOutputSchema,
        candidateProjection: candidateSafeFeedbackProjectionSchema,
    }).strict(),
    stages: z.array(stageAttemptSchema).min(2).max(5),
    metrics: z.object({
        latencyMs: z.number().int().nonnegative(),
        tokenUsage: tokenUsageSchema,
    }).strict(),
    retention: z.object({
        assembledPrompt: z.literal("not_captured"),
        rawProviderOutput: z.literal("not_captured"),
    }).strict(),
}).strict();

export const compatiblePersistedAcceptedEvidenceFirstEvaluatorRunSchema = acceptedEvidenceFirstEvaluatorRunSchema.extend({
    profile: compatiblePersistedEvaluatorProfileSchema,
});

export type EvidenceFirstStageAttemptRecord = z.infer<typeof stageAttemptSchema>;
export type AcceptedEvidenceFirstEvaluatorRun = z.infer<typeof acceptedEvidenceFirstEvaluatorRunSchema>;
export type CompatiblePersistedAcceptedEvidenceFirstEvaluatorRun = z.infer<
    typeof compatiblePersistedAcceptedEvidenceFirstEvaluatorRunSchema
>;

type RuntimeDependencies = {
    nowMs?: () => number;
};

export async function runEvidenceFirstEvaluator(input: {
    evaluationRunId: string;
    evaluationCase: EvidenceFirstEvaluationCase;
    profile: EvidenceFirstEvaluatorProfile;
    adapters: EvidenceFirstEvaluatorRuntimeAdapters;
    requestedAt: string;
    dependencies?: RuntimeDependencies;
}): Promise<AcceptedEvidenceFirstEvaluatorRun> {
    const profile = evaluatorProfileSchema.parse(input.profile);
    const requestedAtMs = Date.parse(input.requestedAt);
    if (!input.evaluationRunId.trim() || Number.isNaN(requestedAtMs)) {
        throw runtimeError("failed", "INVALID_RUNTIME_INPUT", "configuration", false, []);
    }
    assertAdapterConfiguration(profile, input.adapters);

    const nowMs = input.dependencies?.nowMs ?? (() => performance.now());
    const runtimeStartedAt = nowMs();
    const attempts: EvidenceFirstStageAttemptRecord[] = [];
    const tokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    const remainingBudgetMs = () => Math.max(
        0,
        EVIDENCE_FIRST_RUNTIME_POLICY.totalBudgetMs - Math.max(0, nowMs() - runtimeStartedAt),
    );

    let appraisal = await extractAndAppraise({
        evaluationCase: input.evaluationCase,
        adapter: input.adapters.evidenceExtractor,
        attempts,
        tokenUsage,
        remainingBudgetMs,
        nowMs,
    });

    let verification: AcceptedEvidenceFirstEvaluatorRun["accepted"]["verification"] = {
        required: false,
        reasons: [],
        output: null,
    };
    if (appraisal.disposition === "verification_required") {
        const pending = appraisal;
        const adapter = input.adapters.verifier;
        if (!adapter) {
            throw runtimeError("failed", "VERIFIER_NOT_CONFIGURED", "configuration", false, attempts);
        }
        const task = createEvidenceVerifierTask({
            evaluationCase: input.evaluationCase,
            extraction: pending.evidence,
            criteria: pending.criteria,
            patternGap: pending.patternGap,
            verificationReasons: pending.verificationReasons,
        });
        let response: EvidenceFirstStageAdapterResult;
        try {
            response = await invokeStage({
                stage: "verification",
                stagePolicy: EVIDENCE_FIRST_RUNTIME_POLICY.stages.verification,
                adapter,
                task,
                attempt: 1,
                attempts,
                tokenUsage,
                remainingBudgetMs,
                nowMs,
            });
        } catch (error) {
            if (error instanceof EvidenceFirstEvaluatorRuntimeError) throw error;
            const adapterError = normalizeAdapterError(error);
            throw runtimeError(
                adapterError.failureClass === "safety_blocked" ? "rejected" : "failed",
                adapterError.safeCode,
                "verification",
                isAdapterFailureRetryableByNewRun(adapterError.failureClass),
                attempts,
            );
        }
        const resolved = resolveEvidenceVerification({ pending, value: response.value });
        if (resolved.disposition === "rejected") {
            replaceLastAttempt(attempts, {
                outcome: "rejected",
                errorCode: firstIssueCode(resolved.issues, "VERIFICATION_REJECTED"),
                failureClass: "validation_rejected",
            });
            throw runtimeError(
                "rejected",
                firstIssueCode(resolved.issues, "VERIFICATION_REJECTED"),
                "verification",
                resolved.reExtractable,
                attempts,
            );
        }
        appraisal = resolved;
        verification = {
            required: true,
            reasons: pending.verificationReasons,
            output: evidenceVerificationOutputSchema.parse(response.value),
        };
    }

    const feedback = await composeFeedback({
        evaluationCase: input.evaluationCase,
        appraisal,
        adapter: input.adapters.feedbackComposer,
        attempts,
        tokenUsage,
        remainingBudgetMs,
        nowMs,
    });
    const latencyMs = Math.max(0, Math.round(nowMs() - runtimeStartedAt));
    if (latencyMs > EVIDENCE_FIRST_RUNTIME_POLICY.totalBudgetMs) {
        throw runtimeError("failed", "EVALUATOR_BUDGET_EXHAUSTED", "runtime", true, attempts);
    }

    return acceptedEvidenceFirstEvaluatorRunSchema.parse({
        status: "evidence_first_evaluator_run_accepted",
        schemaVersion: 1,
        contractVersion: EVIDENCE_FIRST_EVALUATOR_CONTRACT_VERSION,
        evaluationRunId: input.evaluationRunId,
        inputFingerprint: input.evaluationCase.inputFingerprint,
        requestedAt: new Date(requestedAtMs).toISOString(),
        completedAt: new Date(requestedAtMs + latencyMs).toISOString(),
        profile,
        accepted: {
            extraction: appraisal.evidence,
            criteria: appraisal.criteria,
            patternGap: appraisal.patternGap,
            verification,
            feedback: feedback.feedback,
            candidateProjection: feedback.candidateProjection,
        },
        stages: attempts,
        metrics: { latencyMs, tokenUsage },
        retention: {
            assembledPrompt: "not_captured",
            rawProviderOutput: "not_captured",
        },
    });
}

export function parseAcceptedEvidenceFirstEvaluatorRun(
    value: unknown,
): AcceptedEvidenceFirstEvaluatorRun | null {
    const parsed = acceptedEvidenceFirstEvaluatorRunSchema.safeParse(value);
    if (!parsed.success) return null;

    return hasValidAcceptedRunIntegrity(parsed.data) ? parsed.data : null;
}

export function parseCompatiblePersistedAcceptedEvidenceFirstEvaluatorRun(
    value: unknown,
): CompatiblePersistedAcceptedEvidenceFirstEvaluatorRun | null {
    const parsed = compatiblePersistedAcceptedEvidenceFirstEvaluatorRunSchema.safeParse(value);
    if (!parsed.success) return null;

    return hasValidAcceptedRunIntegrity(parsed.data) ? parsed.data : null;
}

function hasValidAcceptedRunIntegrity(
    run: CompatiblePersistedAcceptedEvidenceFirstEvaluatorRun,
) {
    const fingerprints = [
        run.accepted.extraction.inputFingerprint,
        run.accepted.feedback.inputFingerprint,
        run.accepted.candidateProjection.inputFingerprint,
        ...(run.accepted.verification.output ? [run.accepted.verification.output.inputFingerprint] : []),
    ];
    if (fingerprints.some((fingerprint) => fingerprint !== run.inputFingerprint)) return false;
    if (run.accepted.verification.required !== Boolean(run.accepted.verification.output)) return false;
    if (!run.accepted.verification.required && run.accepted.verification.reasons.length > 0) return false;
    if (
        run.accepted.verification.required
        && (
            run.accepted.verification.reasons.length === 0
            || !run.accepted.verification.output?.supported
            || run.accepted.verification.output.recommendedAction !== "accept"
        )
    ) return false;
    return hasValidAcceptedRunTimeline(run) && hasValidStageSequence(run);
}

function hasValidAcceptedRunTimeline(run: CompatiblePersistedAcceptedEvidenceFirstEvaluatorRun) {
    const requestedAt = Date.parse(run.requestedAt);
    const completedAt = Date.parse(run.completedAt);
    const elapsed = completedAt - requestedAt;
    return elapsed >= 0
        && elapsed === run.metrics.latencyMs
        && elapsed <= EVIDENCE_FIRST_RUNTIME_POLICY.totalBudgetMs;
}

function hasValidStageSequence(run: CompatiblePersistedAcceptedEvidenceFirstEvaluatorRun) {
    const stageOrder: Record<EvidenceFirstRuntimeStage, number> = {
        evidence_extraction: 0,
        verification: 1,
        feedback_composition: 2,
    };
    let priorRank = -1;
    for (const attempt of run.stages) {
        const rank = stageOrder[attempt.stage];
        if (rank < priorRank) return false;
        priorRank = rank;
        if (attempt.outcome === "accepted" && (attempt.errorCode || attempt.failureClass)) return false;
        if (attempt.outcome !== "accepted" && (!attempt.errorCode || !attempt.failureClass)) return false;
    }

    const expectedStages: EvidenceFirstRuntimeStage[] = run.accepted.verification.required
        ? ["evidence_extraction", "verification", "feedback_composition"]
        : ["evidence_extraction", "feedback_composition"];
    if (!run.accepted.verification.required && run.stages.some((attempt) => attempt.stage === "verification")) {
        return false;
    }
    if (run.accepted.verification.required && !run.profile.verifier) return false;

    for (const stage of expectedStages) {
        const attempts = run.stages.filter((attempt) => attempt.stage === stage);
        const policy = EVIDENCE_FIRST_RUNTIME_POLICY.stages[stage === "evidence_extraction"
            ? "evidenceExtraction"
            : stage === "feedback_composition"
                ? "feedbackComposition"
                : "verification"];
        if (
            attempts.length === 0
            || attempts.length > policy.maxAttempts
            || attempts.some((attempt, index) => (
                attempt.attempt !== index + 1
                || attempt.timeoutMs > policy.timeoutMs
            ))
            || attempts.at(-1)?.outcome !== "accepted"
        ) {
            return false;
        }
    }
    return true;
}

async function extractAndAppraise(input: {
    evaluationCase: EvidenceFirstEvaluationCase;
    adapter: EvidenceFirstEvaluatorRuntimeAdapters["evidenceExtractor"];
    attempts: EvidenceFirstStageAttemptRecord[];
    tokenUsage: MutableTokenUsage;
    remainingBudgetMs: () => number;
    nowMs: () => number;
}): Promise<Extract<EvidenceFirstAppraisalResult, { disposition: "accepted" | "verification_required" }>> {
    const stagePolicy = EVIDENCE_FIRST_RUNTIME_POLICY.stages.evidenceExtraction;
    for (let attempt = 1; attempt <= stagePolicy.maxAttempts; attempt += 1) {
        let response: EvidenceFirstStageAdapterResult;
        try {
            response = await invokeStage({
                stage: "evidence_extraction",
                stagePolicy,
                adapter: input.adapter,
                task: createEvidenceExtractorTask(input.evaluationCase),
                attempt,
                attempts: input.attempts,
                tokenUsage: input.tokenUsage,
                remainingBudgetMs: input.remainingBudgetMs,
                nowMs: input.nowMs,
            });
        } catch (error) {
            if (error instanceof EvidenceFirstEvaluatorRuntimeError) throw error;
            const adapterError = normalizeAdapterError(error);
            const mayRetry = (stagePolicy.retryableFailures as readonly string[]).includes(adapterError.failureClass)
                && attempt < stagePolicy.maxAttempts
                && input.remainingBudgetMs() > 0;
            if (mayRetry) continue;
            throw runtimeError(
                adapterError.failureClass === "safety_blocked" ? "rejected" : "failed",
                adapterError.safeCode,
                "evidence_extraction",
                isAdapterFailureRetryableByNewRun(adapterError.failureClass),
                input.attempts,
            );
        }
        const appraisal = validateAndAppraiseEvidence({ evaluationCase: input.evaluationCase, value: response.value });
        if (appraisal.disposition !== "rejected") return appraisal;

        const errorCode = firstIssueCode(appraisal.issues, "EVIDENCE_REJECTED");
        replaceLastAttempt(input.attempts, {
            outcome: "rejected",
            errorCode,
            failureClass: appraisal.issues.some((issue) => issue.code === "invalid_extraction_schema")
                ? "invalid_schema"
                : "validation_rejected",
        });
        if (!appraisal.reExtractable || attempt >= stagePolicy.maxAttempts) {
            throw runtimeError("rejected", errorCode, "evidence_extraction", appraisal.reExtractable, input.attempts);
        }
    }
    throw runtimeError("failed", "EVIDENCE_EXTRACTION_EXHAUSTED", "evidence_extraction", true, input.attempts);
}

async function composeFeedback(input: {
    evaluationCase: EvidenceFirstEvaluationCase;
    appraisal: AcceptedEvidenceFirstAppraisal;
    adapter: EvidenceFirstEvaluatorRuntimeAdapters["feedbackComposer"];
    attempts: EvidenceFirstStageAttemptRecord[];
    tokenUsage: MutableTokenUsage;
    remainingBudgetMs: () => number;
    nowMs: () => number;
}) {
    const stagePolicy = EVIDENCE_FIRST_RUNTIME_POLICY.stages.feedbackComposition;
    let repairIssueCodes: readonly string[] | undefined;
    for (let attempt = 1; attempt <= stagePolicy.maxAttempts; attempt += 1) {
        let response: EvidenceFirstStageAdapterResult;
        try {
            response = await invokeStage({
                stage: "feedback_composition",
                stagePolicy,
                adapter: input.adapter,
                task: createFeedbackComposerTask({
                    evaluationCase: input.evaluationCase,
                    appraisal: input.appraisal,
                    repairIssueCodes,
                }),
                attempt,
                attempts: input.attempts,
                tokenUsage: input.tokenUsage,
                remainingBudgetMs: input.remainingBudgetMs,
                nowMs: input.nowMs,
            });
        } catch (error) {
            if (error instanceof EvidenceFirstEvaluatorRuntimeError) throw error;
            const adapterError = normalizeAdapterError(error);
            const mayRetry = (stagePolicy.retryableFailures as readonly string[]).includes(adapterError.failureClass)
                && attempt < stagePolicy.maxAttempts
                && input.remainingBudgetMs() > 0;
            if (mayRetry) continue;
            throw runtimeError(
                adapterError.failureClass === "safety_blocked" ? "rejected" : "failed",
                adapterError.safeCode,
                "feedback_composition",
                isAdapterFailureRetryableByNewRun(adapterError.failureClass),
                input.attempts,
            );
        }
        const feedback = validateFeedbackComposition({
            evaluationCase: input.evaluationCase,
            appraisal: input.appraisal,
            value: response.value,
        });
        if (feedback.status === "feedback_accepted") return feedback;

        const errorCode = firstIssueCode(feedback.issues, "FEEDBACK_REJECTED");
        const invalidSchema = feedback.issues.every((issue) => issue.code === "invalid_feedback_schema");
        replaceLastAttempt(input.attempts, {
            outcome: "rejected",
            errorCode,
            failureClass: invalidSchema ? "invalid_schema" : "validation_rejected",
        });
        const repairableIssueCodes = feedback.issues
            .map((issue) => issue.code)
            .filter(isRepairableFeedbackLanguageIssue);
        const mayRepair = repairableIssueCodes.length > 0
            && repairableIssueCodes.length === feedback.issues.length
            && attempt < stagePolicy.maxAttempts
            && input.remainingBudgetMs() > 0;
        if (mayRepair) {
            repairIssueCodes = repairableIssueCodes;
            continue;
        }
        if (!invalidSchema || attempt >= stagePolicy.maxAttempts) {
            throw runtimeError("rejected", errorCode, "feedback_composition", false, input.attempts);
        }
    }
    throw runtimeError("failed", "FEEDBACK_COMPOSITION_EXHAUSTED", "feedback_composition", true, input.attempts);
}

function isRepairableFeedbackLanguageIssue(code: string) {
    return code === "candidate_feedback_ungrounded_technical_correctness"
        || code === "candidate_feedback_ungrounded_exact_technical_fact_request";
}

type MutableTokenUsage = { inputTokens: number; outputTokens: number; totalTokens: number };

async function invokeStage<TTask>(input: {
    stage: EvidenceFirstRuntimeStage;
    stagePolicy: { timeoutMs: number; maxAttempts: number; retryableFailures: readonly string[] };
    adapter: EvidenceFirstStageAdapter<TTask>;
    task: TTask;
    attempt: number;
    attempts: EvidenceFirstStageAttemptRecord[];
    tokenUsage: MutableTokenUsage;
    remainingBudgetMs: () => number;
    nowMs: () => number;
}): Promise<EvidenceFirstStageAdapterResult> {
    const remaining = Math.floor(input.remainingBudgetMs());
    if (remaining <= 0) {
        throw runtimeError("failed", "EVALUATOR_BUDGET_EXHAUSTED", input.stage, true, input.attempts);
    }
    const timeoutMs = Math.min(input.stagePolicy.timeoutMs, remaining);
    const startedAt = input.nowMs();
    try {
        const response = await invokeWithTimeout(input.adapter, input.task, input.attempt, timeoutMs);
        const latencyMs = Math.max(0, Math.round(input.nowMs() - startedAt));
        const normalizedTokens = normalizeTokenUsage(response.tokenUsage);
        addTokenUsage(input.tokenUsage, normalizedTokens);
        input.attempts.push({
            stage: input.stage,
            attempt: input.attempt,
            timeoutMs,
            outcome: "accepted",
            latencyMs,
            ...(normalizedTokens ? { tokenUsage: normalizedTokens } : {}),
        });
        return response;
    } catch (error) {
        const adapterError = normalizeAdapterError(error);
        const latencyMs = Math.max(0, Math.round(input.nowMs() - startedAt));
        input.attempts.push({
            stage: input.stage,
            attempt: input.attempt,
            timeoutMs,
            outcome: "failed",
            latencyMs,
            errorCode: adapterError.safeCode,
            failureClass: adapterError.failureClass,
        });
        throw adapterError;
    }
}

async function invokeWithTimeout<TTask>(
    adapter: EvidenceFirstStageAdapter<TTask>,
    task: TTask,
    attempt: number,
    timeoutMs: number,
) {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
            controller.abort();
            reject(new EvidenceFirstAdapterError({
                failureClass: "timeout",
                safeCode: "PROVIDER_TIMEOUT",
            }));
        }, timeoutMs);
    });

    try {
        return await Promise.race([
            adapter.invoke({ task, attempt, timeoutMs, signal: controller.signal }),
            timeoutPromise,
        ]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

function assertAdapterConfiguration(
    profile: EvidenceFirstEvaluatorProfile,
    adapters: EvidenceFirstEvaluatorRuntimeAdapters,
) {
    const matches = (
        descriptor: EvidenceFirstModelStageDescriptor | undefined,
        adapter: EvidenceFirstStageAdapter<unknown> | undefined,
    ) => descriptor === undefined
        ? adapter === undefined
        : Boolean(
            adapter
            && adapter.descriptor.provider === descriptor.provider
            && adapter.descriptor.model === descriptor.model
            && adapter.descriptor.promptVersion === descriptor.promptVersion
        );

    if (
        !matches(profile.evidenceExtractor, adapters.evidenceExtractor as EvidenceFirstStageAdapter<unknown>)
        || !matches(profile.feedbackComposer, adapters.feedbackComposer as EvidenceFirstStageAdapter<unknown>)
        || !matches(profile.verifier, adapters.verifier as EvidenceFirstStageAdapter<unknown> | undefined)
    ) {
        throw runtimeError("failed", "ADAPTER_PROFILE_MISMATCH", "configuration", false, []);
    }
}

function normalizeAdapterError(error: unknown) {
    return error instanceof EvidenceFirstAdapterError
        ? error
        : new EvidenceFirstAdapterError({ failureClass: "unknown", safeCode: "PROVIDER_UNKNOWN_FAILURE" });
}

function isAdapterFailureRetryableByNewRun(failureClass: EvidenceFirstAdapterFailureClass) {
    return failureClass !== "provider_4xx"
        && failureClass !== "misconfigured"
        && failureClass !== "safety_blocked";
}

function normalizeTokenUsage(value: EvidenceFirstStageAdapterResult["tokenUsage"]) {
    if (!value) return undefined;
    const inputTokens = normalizeTokenCount(value.inputTokens);
    const outputTokens = normalizeTokenCount(value.outputTokens);
    const totalTokens = value.totalTokens === undefined
        ? inputTokens + outputTokens
        : normalizeTokenCount(value.totalTokens);
    return { inputTokens, outputTokens, totalTokens };
}

function normalizeTokenCount(value: number | undefined) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function addTokenUsage(total: MutableTokenUsage, addition?: MutableTokenUsage) {
    if (!addition) return;
    total.inputTokens += addition.inputTokens;
    total.outputTokens += addition.outputTokens;
    total.totalTokens += addition.totalTokens;
}

function replaceLastAttempt(
    attempts: EvidenceFirstStageAttemptRecord[],
    replacement: Pick<EvidenceFirstStageAttemptRecord, "outcome" | "errorCode" | "failureClass">,
) {
    const current = attempts.at(-1);
    if (!current) return;
    attempts[attempts.length - 1] = { ...current, ...replacement };
}

function firstIssueCode(issues: Array<{ code: string }>, fallback: string) {
    return issues[0]?.code.toUpperCase() ?? fallback;
}

function runtimeError(
    disposition: "failed" | "rejected",
    errorCode: string,
    stage: EvidenceFirstEvaluatorRuntimeError["stage"],
    retryableByNewRun: boolean,
    attempts: EvidenceFirstStageAttemptRecord[],
) {
    return new EvidenceFirstEvaluatorRuntimeError({
        disposition,
        errorCode,
        stage,
        retryableByNewRun,
        attempts: [...attempts],
    });
}
