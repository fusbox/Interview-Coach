import { createHash } from "node:crypto";

import { z } from "zod";

import {
    createEvaluatorRunDescriptor,
} from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import {
    GOOGLE_EVIDENCE_FIRST_PROFILE_ID,
    GOOGLE_EVIDENCE_FIRST_PROVIDER,
    GOOGLE_GENAI_API_KEY_ENV,
    createGoogleGemini25FlashEvaluatorProfile,
} from "@/features/evaluation-v2/google-evidence-first-evaluator";
import {
    CANDIDATE_COACH_UPDATE_PROVIDER_ENV,
} from "@/features/candidate-dashboard-v2/candidate-coach-update-runtime";
import {
    GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_FINGERPRINT,
    GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID,
    GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ENV,
    GOOGLE_CANDIDATE_COACH_UPDATE_PROVIDER,
} from "@/features/candidate-dashboard-v2/google-candidate-coach-update";

import type { AiEvalScenario } from "./ai-eval-scenario-contract";

export const AI_EVAL_LIVE_GATE_VERSION = "ai_eval_scenario_live_gate_v1" as const;
export const AI_EVAL_LIVE_COST_PREVIEW_VERSION = "ai_eval_live_cost_preview_v1" as const;
export const AI_EVAL_LIVE_ENABLED_ENV = "AI_EVAL_SCENARIO_LIVE_ENABLED" as const;
export const AI_EVAL_LIVE_INPUT_RATE_ENV = "AI_EVAL_SCENARIO_INPUT_USD_PER_MILLION_TOKENS" as const;
export const AI_EVAL_LIVE_OUTPUT_RATE_ENV = "AI_EVAL_SCENARIO_OUTPUT_USD_PER_MILLION_TOKENS" as const;
export const AI_EVAL_LIVE_MAX_COST_ENV = "AI_EVAL_SCENARIO_MAX_ESTIMATED_COST_USD" as const;
export const AI_EVAL_LIVE_MAX_CALLS_ENV = "AI_EVAL_SCENARIO_MAX_CALLS" as const;
export const AI_EVAL_LIVE_CONCURRENCY_ENV = "AI_EVAL_SCENARIO_LIVE_CONCURRENCY" as const;

const answerDescriptor = createEvaluatorRunDescriptor(createGoogleGemini25FlashEvaluatorProfile());

export const AI_EVAL_LIVE_PROFILE_ID = [
    GOOGLE_EVIDENCE_FIRST_PROFILE_ID,
    GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID,
].join("+");

export const AI_EVAL_LIVE_CONFIGURATION_FINGERPRINT = hashJson({
    answerEvaluator: answerDescriptor.configurationFingerprint,
    coachUpdate: GOOGLE_CANDIDATE_COACH_UPDATE_CONFIGURATION_FINGERPRINT,
});

export type AiEvalScenarioVersionInput = {
    scenarioVersionId: string;
    inputFingerprint: string;
    versionNumber: number;
    scenario: AiEvalScenario;
};

export type AiEvalLiveExecutionPolicy = {
    enabled: boolean;
    ready: boolean;
    reasons: string[];
    inputUsdPerMillionTokens: number | null;
    outputUsdPerMillionTokens: number | null;
    maxEstimatedCostUsd: number | null;
    maxCalls: number | null;
    concurrency: number;
    profileId: string;
    configurationFingerprint: string;
};

export const aiEvalLiveCostPreviewSchema = z.object({
    version: z.literal(AI_EVAL_LIVE_COST_PREVIEW_VERSION),
    selectionFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    requestedCaseCount: z.number().int().positive(),
    expandedCaseCount: z.number().int().positive(),
    dependencyCaseCount: z.number().int().nonnegative(),
    atomicCaseCount: z.number().int().nonnegative(),
    journeyCaseCount: z.number().int().nonnegative(),
    profileId: z.string().trim().min(1),
    configurationFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    calls: z.object({
        minimum: z.number().int().positive(),
        maximum: z.number().int().positive(),
    }).strict(),
    tokens: z.object({
        maximumInput: z.number().int().nonnegative(),
        maximumOutput: z.number().int().nonnegative(),
    }).strict(),
    pricing: z.object({
        currency: z.literal("USD"),
        source: z.literal("operator_configured"),
        inputUsdPerMillionTokens: z.number().nonnegative(),
        outputUsdPerMillionTokens: z.number().nonnegative(),
    }).strict(),
    maximumEstimatedCostUsd: z.number().nonnegative(),
    limits: z.object({
        maxCalls: z.number().int().positive(),
        maxEstimatedCostUsd: z.number().positive(),
    }).strict(),
    withinLimits: z.boolean(),
}).strict();

export type AiEvalLiveCostPreview = z.infer<typeof aiEvalLiveCostPreviewSchema>;

export function readAiEvalLiveExecutionPolicy(
    env: Record<string, string | undefined>,
): AiEvalLiveExecutionPolicy {
    const reasons: string[] = [];
    const enabled = env[AI_EVAL_LIVE_ENABLED_ENV]?.trim().toLowerCase() === "true";
    if (!enabled) reasons.push("LIVE_EXECUTION_NOT_ENABLED");
    if (env.CANDIDATE_ANSWER_ANALYSIS_PROVIDER !== GOOGLE_EVIDENCE_FIRST_PROVIDER) {
        reasons.push("ANSWER_EVALUATOR_PROVIDER_NOT_LIVE");
    }
    if (env.CANDIDATE_ANSWER_ANALYSIS_PROFILE !== GOOGLE_EVIDENCE_FIRST_PROFILE_ID) {
        reasons.push("ANSWER_EVALUATOR_PROFILE_MISMATCH");
    }
    if (env[CANDIDATE_COACH_UPDATE_PROVIDER_ENV] !== GOOGLE_CANDIDATE_COACH_UPDATE_PROVIDER) {
        reasons.push("COACH_UPDATE_PROVIDER_NOT_LIVE");
    }
    if (env[GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ENV] !== GOOGLE_CANDIDATE_COACH_UPDATE_PROFILE_ID) {
        reasons.push("COACH_UPDATE_PROFILE_MISMATCH");
    }
    if (!env[GOOGLE_GENAI_API_KEY_ENV]?.trim()) reasons.push("PROVIDER_CREDENTIAL_MISSING");

    const inputRate = positiveNumber(env[AI_EVAL_LIVE_INPUT_RATE_ENV]);
    const outputRate = positiveNumber(env[AI_EVAL_LIVE_OUTPUT_RATE_ENV]);
    const maxCost = positiveNumber(env[AI_EVAL_LIVE_MAX_COST_ENV]);
    const maxCalls = positiveInteger(env[AI_EVAL_LIVE_MAX_CALLS_ENV]);
    const concurrency = boundedInteger(env[AI_EVAL_LIVE_CONCURRENCY_ENV], 1, 4) ?? 1;
    if (inputRate === null) reasons.push("INPUT_TOKEN_RATE_MISSING");
    if (outputRate === null) reasons.push("OUTPUT_TOKEN_RATE_MISSING");
    if (maxCost === null) reasons.push("MAX_ESTIMATED_COST_MISSING");
    if (maxCalls === null) reasons.push("MAX_CALLS_MISSING");

    return {
        enabled,
        ready: reasons.length === 0,
        reasons,
        inputUsdPerMillionTokens: inputRate,
        outputUsdPerMillionTokens: outputRate,
        maxEstimatedCostUsd: maxCost,
        maxCalls,
        concurrency,
        profileId: AI_EVAL_LIVE_PROFILE_ID,
        configurationFingerprint: AI_EVAL_LIVE_CONFIGURATION_FINGERPRINT,
    };
}

export function resolveAiEvalScenarioSelection<T extends AiEvalScenarioVersionInput>(input: {
    requested: readonly T[];
    available: readonly T[];
}) {
    const selected = new Map(input.requested.map((version) => [version.scenarioVersionId, version]));
    const latestByKey = new Map<string, T>();
    for (const version of input.available) {
        const current = latestByKey.get(version.scenario.scenarioKey);
        if (!current || version.versionNumber > current.versionNumber) {
            latestByKey.set(version.scenario.scenarioKey, version);
        }
    }
    const missingDependencies: string[] = [];
    for (const version of input.requested) {
        if (version.scenario.kind !== "round_journey") continue;
        for (const scenarioKey of version.scenario.atomicCaseKeys) {
            const dependency = latestByKey.get(scenarioKey);
            if (!dependency || dependency.scenario.kind !== "atomic_answer") {
                missingDependencies.push(scenarioKey);
                continue;
            }
            selected.set(dependency.scenarioVersionId, dependency);
        }
    }
    const requestedIds = new Set(input.requested.map((version) => version.scenarioVersionId));
    const versions = Array.from(selected.values()).sort((left, right) => (
        requestedIds.has(left.scenarioVersionId) === requestedIds.has(right.scenarioVersionId)
            ? left.scenario.scenarioKey.localeCompare(right.scenario.scenarioKey)
            : requestedIds.has(left.scenarioVersionId) ? -1 : 1
    ));
    return {
        versions,
        dependencyCaseCount: versions.filter((version) => !requestedIds.has(version.scenarioVersionId)).length,
        missingDependencies: Array.from(new Set(missingDependencies)).sort(),
    };
}

export function createAiEvalLiveCostPreview(input: {
    requestedCaseCount: number;
    versions: readonly AiEvalScenarioVersionInput[];
    dependencyCaseCount: number;
    policy: AiEvalLiveExecutionPolicy;
}): AiEvalLiveCostPreview {
    if (!input.policy.ready
        || input.policy.inputUsdPerMillionTokens === null
        || input.policy.outputUsdPerMillionTokens === null
        || input.policy.maxEstimatedCostUsd === null
        || input.policy.maxCalls === null) {
        throw new Error(`AI_EVAL_LIVE_POLICY_NOT_READY:${input.policy.reasons.join(",")}`);
    }
    const atomic = input.versions.filter((version): version is AiEvalScenarioVersionInput & {
        scenario: Extract<AiEvalScenarioVersionInput["scenario"], { kind: "atomic_answer" }>;
    } => version.scenario.kind === "atomic_answer");
    const journeys = input.versions.filter((version): version is AiEvalScenarioVersionInput & {
        scenario: Extract<AiEvalScenarioVersionInput["scenario"], { kind: "round_journey" }>;
    } => version.scenario.kind === "round_journey");
    if (atomic.length + journeys.length === 0 || input.requestedCaseCount <= 0) {
        throw new Error("AI_EVAL_LIVE_SELECTION_EMPTY");
    }

    const priorAttemptCount = atomic.reduce(
        (total, version) => total + version.scenario.priorAttempts.length,
        0,
    );
    const minimumCalls = atomic.length * 3 + priorAttemptCount * 2 + journeys.length;
    const maximumCalls = atomic.length * 6 + priorAttemptCount * 5 + journeys.length;
    const maximumInput = atomic.reduce((total, version) => {
        const scenarioTokens = estimateTokens(JSON.stringify(version.scenario));
        const currentAnswerAndCoachUpdate = ((scenarioTokens + 16_000) * 5) + scenarioTokens + 12_000;
        const priorAttemptEvaluations = version.scenario.priorAttempts.length
            * ((scenarioTokens + 16_000) * 5);
        return total + currentAnswerAndCoachUpdate + priorAttemptEvaluations;
    }, 0) + journeys.reduce((total, version) => (
        total + 16_000 + version.scenario.atomicCaseKeys.length * 4_000
    ), 0);
    const maximumOutput = atomic.length * ((5 * 4_096) + 2_048)
        + priorAttemptCount * (5 * 4_096)
        + journeys.length * 2_048;
    const maximumEstimatedCostUsd = roundMoney(
        (maximumInput * input.policy.inputUsdPerMillionTokens
            + maximumOutput * input.policy.outputUsdPerMillionTokens) / 1_000_000,
    );
    const selectionFingerprint = hashJson(input.versions.map((version) => ({
        scenarioVersionId: version.scenarioVersionId,
        inputFingerprint: version.inputFingerprint,
    })));
    const withinLimits = maximumCalls <= input.policy.maxCalls
        && maximumEstimatedCostUsd <= input.policy.maxEstimatedCostUsd;

    return aiEvalLiveCostPreviewSchema.parse({
        version: AI_EVAL_LIVE_COST_PREVIEW_VERSION,
        selectionFingerprint,
        requestedCaseCount: input.requestedCaseCount,
        expandedCaseCount: input.versions.length,
        dependencyCaseCount: input.dependencyCaseCount,
        atomicCaseCount: atomic.length,
        journeyCaseCount: journeys.length,
        profileId: input.policy.profileId,
        configurationFingerprint: input.policy.configurationFingerprint,
        calls: { minimum: minimumCalls, maximum: maximumCalls },
        tokens: { maximumInput, maximumOutput },
        pricing: {
            currency: "USD",
            source: "operator_configured",
            inputUsdPerMillionTokens: input.policy.inputUsdPerMillionTokens,
            outputUsdPerMillionTokens: input.policy.outputUsdPerMillionTokens,
        },
        maximumEstimatedCostUsd,
        limits: {
            maxCalls: input.policy.maxCalls,
            maxEstimatedCostUsd: input.policy.maxEstimatedCostUsd,
        },
        withinLimits,
    });
}

export function parseAiEvalLiveCostPreview(value: unknown) {
    const parsed = aiEvalLiveCostPreviewSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

export function createAiEvalLiveCostPreviewFingerprint(preview: AiEvalLiveCostPreview) {
    return hashJson(aiEvalLiveCostPreviewSchema.parse(preview));
}

function estimateTokens(value: string) {
    return Math.ceil(value.length / 3);
}

function positiveNumber(value: string | undefined) {
    if (!value?.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function positiveInteger(value: string | undefined) {
    if (!value?.trim() || !/^\d+$/.test(value.trim())) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number) {
    const parsed = positiveInteger(value);
    return parsed !== null && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function roundMoney(value: number) {
    return Math.ceil(value * 1_000_000) / 1_000_000;
}

function hashJson(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
