import {
    createCandidateCoachUpdateRuntimeFromEnvironment,
} from "@/features/candidate-dashboard-v2/candidate-coach-update-runtime-selection";
import {
    CANDIDATE_COACH_UPDATE_PROVIDER_OUTPUT_VERSION,
    CANDIDATE_COACH_UPDATE_PROVIDER_REQUEST_VERSION,
    CandidateCoachUpdateRuntimeError,
    type CandidateCoachUpdateSynthesisRuntimeResult,
} from "@/features/candidate-dashboard-v2/candidate-coach-update-runtime";
import {
    parseCandidateCoachUpdateContent,
    validateCandidateCoachUpdateContent,
} from "@/features/candidate-dashboard-v2/candidate-coach-update-artifact";
import { createCandidateAnswerAnalysisGoogleRuntime } from "@/features/candidate-session-v2/candidate-answer-analysis-google-runtime";
import {
    EvidenceFirstEvaluatorRuntimeError,
    parseAcceptedEvidenceFirstEvaluatorRun,
} from "@/features/evaluation-v2/evidence-first-evaluator-runtime";

import {
    AI_EVAL_LIVE_CONFIGURATION_FINGERPRINT,
    AI_EVAL_LIVE_PROFILE_ID,
    parseAiEvalLiveCostPreview,
    readAiEvalLiveExecutionPolicy,
} from "./ai-eval-live-run-contract";
import {
    createAiEvalScenarioExecutor,
    type AiEvalScenarioEvaluatorMetadata,
} from "./ai-eval-scenario-fixture-executor";
import type {
    AiEvalScenarioLiveOperation,
    AiEvalScenarioRunDetail,
    createAiEvalScenarioRepository,
} from "./ai-eval-scenario-repository";

type AiEvalScenarioRepository = ReturnType<typeof createAiEvalScenarioRepository>;

export function createAiEvalScenarioLiveExecutor(input: {
    repository: Pick<
        AiEvalScenarioRepository,
        "claimLiveOperation" | "completeLiveOperation" | "failLiveOperation"
    >;
    run: AiEvalScenarioRunDetail;
    workerId: string;
    env: Record<string, string | undefined>;
    now?: () => string;
}) {
    const policy = readAiEvalLiveExecutionPolicy(input.env);
    const preview = parseAiEvalLiveCostPreview(input.run.costPreview);
    if (!policy.ready || !preview || !preview.withinLimits) {
        throw new Error("AI_EVAL_LIVE_EXECUTION_NOT_READY");
    }
    if (input.run.executionMode !== "credentialed_live"
        || input.run.profileId !== AI_EVAL_LIVE_PROFILE_ID
        || input.run.configurationFingerprint !== AI_EVAL_LIVE_CONFIGURATION_FINGERPRINT
        || preview.profileId !== policy.profileId
        || preview.configurationFingerprint !== policy.configurationFingerprint
        || preview.pricing.inputUsdPerMillionTokens !== policy.inputUsdPerMillionTokens
        || preview.pricing.outputUsdPerMillionTokens !== policy.outputUsdPerMillionTokens
        || preview.limits.maxCalls !== policy.maxCalls
        || preview.limits.maxEstimatedCostUsd !== policy.maxEstimatedCostUsd) {
        throw new Error("AI_EVAL_LIVE_EXECUTION_CONFIGURATION_DRIFT");
    }

    const answerRuntime = createCandidateAnswerAnalysisGoogleRuntime({ env: input.env });
    const coachUpdateRuntime = createCandidateCoachUpdateRuntimeFromEnvironment({
        env: input.env,
        explicitLocalDev: false,
    });
    if (!answerRuntime || !coachUpdateRuntime
        || answerRuntime.runMetadata.configurationFingerprint === ""
        || coachUpdateRuntime.metadata.configurationFingerprint === "") {
        throw new Error("AI_EVAL_LIVE_RUNTIME_UNAVAILABLE");
    }

    const evaluatorMetadata: AiEvalScenarioEvaluatorMetadata = {
        provider: answerRuntime.runMetadata.provider,
        modelName: answerRuntime.runMetadata.modelName,
        promptVersion: answerRuntime.runMetadata.promptVersion,
        evaluatorVersion: answerRuntime.runMetadata.evaluatorVersion,
        configurationManifest: answerRuntime.runMetadata.configurationManifest,
        configurationFingerprint: answerRuntime.runMetadata.configurationFingerprint,
    };

    return createAiEvalScenarioExecutor({
        scenarioLibrary: input.run.cases.map((runCase) => runCase.scenario),
        dependencies: {
            now: input.now ?? (() => new Date().toISOString()),
            async evaluateAtomic({ request, operationKey }) {
                const operation = await claimOperation({
                    repository: input.repository,
                    runId: input.run.runId,
                    operationKey,
                    operationKind: "answer_evaluation",
                    inputFingerprint: answerRuntime.createInputFingerprint(request),
                    profileId: answerRuntime.runMetadata.modelName,
                    configurationFingerprint: answerRuntime.runMetadata.configurationFingerprint,
                    workerId: input.workerId,
                });
                const recovered = readAcceptedEvaluation(operation);
                if (recovered) return { acceptedRun: recovered, metadata: evaluatorMetadata };
                assertClaimed(operation, input.workerId);
                try {
                    const acceptedRun = await answerRuntime.requestAnswerAnalysis(request, {
                        evaluationRunId: `scenario-live:${input.run.runId}:${operation.liveOperationId}:${operation.attemptCount}`,
                    });
                    const completed = await input.repository.completeLiveOperation({
                        liveOperationId: operation.liveOperationId,
                        workerId: input.workerId,
                        claimGeneration: operation.claimGeneration,
                        acceptedOutput: { acceptedRun },
                    });
                    if (!completed) throw new Error("AI_EVAL_LIVE_OPERATION_CHECKPOINT_LOST");
                    return { acceptedRun, metadata: evaluatorMetadata };
                } catch (error) {
                    if (error instanceof Error && error.message === "AI_EVAL_LIVE_OPERATION_CHECKPOINT_LOST") throw error;
                    const failure = safeEvaluatorFailure(error);
                    await input.repository.failLiveOperation({
                        liveOperationId: operation.liveOperationId,
                        workerId: input.workerId,
                        claimGeneration: operation.claimGeneration,
                        retryable: failure.retryable,
                        failure: failure.metadata,
                    });
                    throw new Error(failure.code);
                }
            },
            async synthesizeCoachUpdate({ synthesisInput, operationKey }) {
                const operation = await claimOperation({
                    repository: input.repository,
                    runId: input.run.runId,
                    operationKey,
                    operationKind: "coach_update",
                    inputFingerprint: synthesisInput.synthesisInputFingerprint,
                    profileId: coachUpdateRuntime.metadata.profileId,
                    configurationFingerprint: coachUpdateRuntime.metadata.configurationFingerprint,
                    workerId: input.workerId,
                });
                const recovered = readAcceptedCoachUpdate(operation, synthesisInput);
                if (recovered) return { result: recovered, metadata: coachUpdateRuntime.metadata };
                assertClaimed(operation, input.workerId);
                try {
                    const result = await coachUpdateRuntime.synthesize(synthesisInput);
                    const completed = await input.repository.completeLiveOperation({
                        liveOperationId: operation.liveOperationId,
                        workerId: input.workerId,
                        claimGeneration: operation.claimGeneration,
                        acceptedOutput: { result },
                    });
                    if (!completed) throw new Error("AI_EVAL_LIVE_OPERATION_CHECKPOINT_LOST");
                    return { result, metadata: coachUpdateRuntime.metadata };
                } catch (error) {
                    if (error instanceof Error && error.message === "AI_EVAL_LIVE_OPERATION_CHECKPOINT_LOST") throw error;
                    const failure = safeCoachUpdateFailure(error);
                    await input.repository.failLiveOperation({
                        liveOperationId: operation.liveOperationId,
                        workerId: input.workerId,
                        claimGeneration: operation.claimGeneration,
                        retryable: failure.retryable,
                        failure: failure.metadata,
                    });
                    throw new Error(failure.code);
                }
            },
        },
    });
}

async function claimOperation(input: {
    repository: Pick<AiEvalScenarioRepository, "claimLiveOperation">;
} & Parameters<AiEvalScenarioRepository["claimLiveOperation"]>[0]) {
    const { repository, ...claimInput } = input;
    const operation = await repository.claimLiveOperation(claimInput);
    if (!operation) throw new Error("AI_EVAL_LIVE_OPERATION_NOT_CLAIMABLE");
    return operation;
}

function assertClaimed(operation: AiEvalScenarioLiveOperation, workerId: string) {
    if (operation.lifecycleState !== "running" || operation.claimWorkerId !== workerId) {
        throw new Error("AI_EVAL_LIVE_OPERATION_NOT_CLAIMED");
    }
}

function readAcceptedEvaluation(operation: AiEvalScenarioLiveOperation) {
    if (operation.lifecycleState !== "completed") return null;
    const accepted = parseAcceptedEvidenceFirstEvaluatorRun(operation.acceptedOutput?.acceptedRun);
    if (!accepted || accepted.inputFingerprint !== operation.inputFingerprint) {
        throw new Error("AI_EVAL_LIVE_EVALUATION_CHECKPOINT_INVALID");
    }
    return accepted;
}

function readAcceptedCoachUpdate(
    operation: AiEvalScenarioLiveOperation,
    synthesisInput: Parameters<typeof validateCandidateCoachUpdateContent>[0]["input"],
): CandidateCoachUpdateSynthesisRuntimeResult | null {
    if (operation.lifecycleState !== "completed") return null;
    const result = operation.acceptedOutput?.result;
    const content = isObject(result) ? parseCandidateCoachUpdateContent(result.content) : null;
    const validation = isObject(result) ? parseCoachUpdateValidation(result.validation) : null;
    if (!isObject(result) || !content || !validation) {
        throw new Error("AI_EVAL_LIVE_COACH_UPDATE_CHECKPOINT_INVALID");
    }
    if (!validateCandidateCoachUpdateContent({ input: synthesisInput, content })) {
        throw new Error("AI_EVAL_LIVE_COACH_UPDATE_CHECKPOINT_INVALID");
    }
    return {
        content,
        validation,
    };
}

function parseCoachUpdateValidation(value: unknown): CandidateCoachUpdateSynthesisRuntimeResult["validation"] | null {
    if (!isObject(value)
        || value.providerRequestVersion !== CANDIDATE_COACH_UPDATE_PROVIDER_REQUEST_VERSION
        || value.providerOutputVersion !== CANDIDATE_COACH_UPDATE_PROVIDER_OUTPUT_VERSION
        || !isNonnegativeInteger(value.timeoutMs)
        || value.transportAttemptCount !== 1
        || !isNonnegativeInteger(value.latencyMs)
        || value.rawOutputStored !== false
        || value.promptStored !== false
        || !isObject(value.tokenUsage)
        || !isNullableNonnegativeInteger(value.tokenUsage.inputTokens)
        || !isNullableNonnegativeInteger(value.tokenUsage.outputTokens)) {
        return null;
    }
    return value as CandidateCoachUpdateSynthesisRuntimeResult["validation"];
}

function safeEvaluatorFailure(error: unknown) {
    if (error instanceof EvidenceFirstEvaluatorRuntimeError) {
        return {
            code: error.errorCode,
            retryable: error.retryableByNewRun,
            metadata: {
                kind: "evidence_first_evaluator_failure",
                errorCode: error.errorCode,
                disposition: error.disposition,
                stage: error.stage,
                retryable: error.retryableByNewRun,
                attempts: error.attempts,
            },
        };
    }
    return {
        code: "AI_EVAL_LIVE_EVALUATOR_UNKNOWN_FAILURE",
        retryable: true,
        metadata: {
            kind: "evidence_first_evaluator_failure",
            errorCode: "AI_EVAL_LIVE_EVALUATOR_UNKNOWN_FAILURE",
            retryable: true,
        },
    };
}

function safeCoachUpdateFailure(error: unknown) {
    if (error instanceof CandidateCoachUpdateRuntimeError) {
        return {
            code: error.errorCode,
            retryable: error.retryable,
            metadata: {
                kind: "coach_update_failure",
                errorCode: error.errorCode,
                lifecycleState: error.lifecycleState,
                retryable: error.retryable,
            },
        };
    }
    return {
        code: "AI_EVAL_LIVE_COACH_UPDATE_UNKNOWN_FAILURE",
        retryable: true,
        metadata: {
            kind: "coach_update_failure",
            errorCode: "AI_EVAL_LIVE_COACH_UPDATE_UNKNOWN_FAILURE",
            retryable: true,
        },
    };
}

function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonnegativeInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNullableNonnegativeInteger(value: unknown) {
    return value === null || isNonnegativeInteger(value);
}
