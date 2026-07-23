import { createAiEvalScenarioFixtureExecutor } from "./ai-eval-scenario-fixture-executor";
import { createAiEvalScenarioLiveExecutor } from "./ai-eval-scenario-live-executor";
import type {
    AiEvalScenarioRunDetail,
    AiEvalScenarioRunSummary,
    createAiEvalScenarioRepository,
} from "./ai-eval-scenario-repository";
import { readAiEvalLiveExecutionPolicy } from "./ai-eval-live-run-contract";

type AiEvalScenarioRepository = ReturnType<typeof createAiEvalScenarioRepository>;

export async function runNextAiEvalScenarioFixtureJob(input: {
    repository: Pick<
        AiEvalScenarioRepository,
        | "claimNextRun"
        | "loadClaimedRun"
        | "markCaseRunning"
        | "completeLayer"
        | "failLayer"
        | "finalizeCase"
        | "finalizeRun"
    >;
    workerId: string;
}) {
    const claimed = await input.repository.claimNextRun(input.workerId);
    return executeClaimedRun(input.repository, claimed);
}

export async function runAiEvalScenarioFixtureJobById(input: {
    repository: Pick<
        AiEvalScenarioRepository,
        | "claimRun"
        | "loadClaimedRun"
        | "markCaseRunning"
        | "completeLayer"
        | "failLayer"
        | "finalizeCase"
        | "finalizeRun"
    >;
    runId: string;
    workerId: string;
}) {
    const claimed = await input.repository.claimRun(input.runId, input.workerId);
    return executeClaimedRun(input.repository, claimed);
}

export async function runNextAiEvalScenarioLiveJob(input: {
    repository: Pick<
        AiEvalScenarioRepository,
        | "claimNextLiveRun"
        | "loadClaimedRun"
        | "markCaseRunning"
        | "completeLayer"
        | "failLayer"
        | "finalizeCase"
        | "finalizeLiveRun"
        | "claimLiveOperation"
        | "completeLiveOperation"
        | "failLiveOperation"
        | "renewLiveRunClaim"
        | "failLiveRunConfiguration"
    >;
    workerId: string;
    env: Record<string, string | undefined>;
}) {
    const policy = readAiEvalLiveExecutionPolicy(input.env);
    if (!policy.ready) throw new Error(`AI_EVAL_LIVE_WORKER_NOT_READY:${policy.reasons.join(",")}`);
    const claimed = await input.repository.claimNextLiveRun(input.workerId);
    return executeClaimedLiveRun({ ...input, concurrency: policy.concurrency }, claimed);
}

export async function runAiEvalScenarioLiveJobById(input: {
    repository: Pick<
        AiEvalScenarioRepository,
        | "claimLiveRun"
        | "loadClaimedRun"
        | "markCaseRunning"
        | "completeLayer"
        | "failLayer"
        | "finalizeCase"
        | "finalizeLiveRun"
        | "claimLiveOperation"
        | "completeLiveOperation"
        | "failLiveOperation"
        | "renewLiveRunClaim"
        | "failLiveRunConfiguration"
    >;
    runId: string;
    workerId: string;
    env: Record<string, string | undefined>;
}) {
    const policy = readAiEvalLiveExecutionPolicy(input.env);
    if (!policy.ready) throw new Error(`AI_EVAL_LIVE_WORKER_NOT_READY:${policy.reasons.join(",")}`);
    const claimed = await input.repository.claimLiveRun(input.runId, input.workerId);
    return executeClaimedLiveRun({ ...input, concurrency: policy.concurrency }, claimed);
}

async function executeClaimedRun(
    repository: Pick<
        AiEvalScenarioRepository,
        | "loadClaimedRun"
        | "markCaseRunning"
        | "completeLayer"
        | "failLayer"
        | "finalizeCase"
        | "finalizeRun"
    >,
    claimed: AiEvalScenarioRunSummary | null,
) {
    if (!claimed) return { status: "idle" as const };
    if (claimed.executionMode !== "contract_fixture") {
        await repository.finalizeRun(claimed.runId);
        return { status: "unsupported_mode" as const, runId: claimed.runId };
    }

    const detail = await repository.loadClaimedRun(claimed);
    if (!detail) throw new Error("CLAIMED_SCENARIO_RUN_NOT_FOUND");
    const executor = createAiEvalScenarioFixtureExecutor({
        scenarioLibrary: detail.cases.map((runCase) => runCase.scenario),
    });

    for (const runCase of detail.cases) {
        if (runCase.lifecycleState === "completed") continue;
        await executeRunCase(repository, executor, runCase);
    }
    const finalized = await repository.finalizeRun(claimed.runId);
    return {
        status: finalized?.lifecycleState === "completed" ? "completed" as const : "partial" as const,
        runId: claimed.runId,
        completedCaseCount: finalized?.completedCaseCount ?? 0,
        failedCaseCount: finalized?.failedCaseCount ?? 0,
    };
}

async function executeClaimedLiveRun(
    input: {
        repository: Pick<
            AiEvalScenarioRepository,
            | "loadClaimedRun"
            | "markCaseRunning"
            | "completeLayer"
            | "failLayer"
            | "finalizeCase"
            | "finalizeLiveRun"
            | "claimLiveOperation"
            | "completeLiveOperation"
            | "failLiveOperation"
            | "renewLiveRunClaim"
            | "failLiveRunConfiguration"
        >;
        workerId: string;
        env: Record<string, string | undefined>;
        concurrency: number;
    },
    claimed: AiEvalScenarioRunSummary | null,
) {
    if (!claimed) return { status: "idle" as const };
    if (claimed.executionMode !== "credentialed_live") {
        throw new Error("AI_EVAL_LIVE_WORKER_CLAIMED_UNSUPPORTED_MODE");
    }
    const detail = await input.repository.loadClaimedRun(claimed);
    if (!detail) throw new Error("CLAIMED_LIVE_SCENARIO_RUN_NOT_FOUND");
    let executor: ReturnType<typeof createAiEvalScenarioLiveExecutor>;
    try {
        executor = createAiEvalScenarioLiveExecutor({
            repository: input.repository,
            run: detail,
            workerId: input.workerId,
            env: input.env,
        });
    } catch (error) {
        await input.repository.failLiveRunConfiguration({
            runId: detail.runId,
            workerId: input.workerId,
            errorCode: safeErrorCode(error),
        });
        return { status: "failed" as const, runId: detail.runId, completedCaseCount: 0, failedCaseCount: 0 };
    }
    let claimHealthy = true;
    const heartbeat = setInterval(() => {
        void input.repository.renewLiveRunClaim(detail.runId, input.workerId)
            .then((renewed) => { claimHealthy = claimHealthy && renewed; })
            .catch(() => { claimHealthy = false; });
    }, 60_000);
    heartbeat.unref?.();
    try {
        const pendingCases = detail.cases.filter((runCase) => runCase.lifecycleState !== "completed");
        await runWithConcurrency(pendingCases, input.concurrency, async (runCase) => {
            if (!claimHealthy) throw new Error("AI_EVAL_LIVE_RUN_CLAIM_LOST");
            await executeRunCase(input.repository, executor, runCase);
        });
        if (!claimHealthy) throw new Error("AI_EVAL_LIVE_RUN_CLAIM_LOST");
        const finalized = await input.repository.finalizeLiveRun(detail.runId);
        return {
            status: finalized?.lifecycleState === "completed"
                ? "completed" as const
                : finalized?.lifecycleState === "failed"
                    ? "failed" as const
                    : "partial" as const,
            runId: detail.runId,
            completedCaseCount: finalized?.completedCaseCount ?? 0,
            failedCaseCount: finalized?.failedCaseCount ?? 0,
        };
    } finally {
        clearInterval(heartbeat);
    }
}

async function runWithConcurrency<T>(
    items: readonly T[],
    concurrency: number,
    operation: (item: T) => Promise<void>,
) {
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, concurrency), Math.max(1, items.length));
    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            await operation(items[index]!);
        }
    }));
}

async function executeRunCase(
    repository: Pick<
        AiEvalScenarioRepository,
        "markCaseRunning" | "completeLayer" | "failLayer" | "finalizeCase"
    >,
    executor: ReturnType<typeof createAiEvalScenarioFixtureExecutor>,
    runCase: AiEvalScenarioRunDetail["cases"][number],
) {
    await repository.markCaseRunning(runCase.runCaseId);
    let execution: Awaited<ReturnType<typeof executor.execute>>;
    try {
        execution = await executor.execute(runCase.scenario);
    } catch (error) {
        const code = safeErrorCode(error);
        for (const layer of runCase.layers.filter((item) => item.lifecycleState !== "completed")) {
            await repository.failLayer(layer.runLayerId, code);
        }
        await repository.finalizeCase(runCase.runCaseId);
        return;
    }

    for (const persistedLayer of runCase.layers) {
        if (persistedLayer.lifecycleState === "completed") continue;
        const produced = execution.layers.find((layer) => layer.outputLayer === persistedLayer.outputLayer);
        if (!produced) {
            await repository.failLayer(persistedLayer.runLayerId, "FIXTURE_LAYER_NOT_PRODUCED");
            continue;
        }
        await repository.completeLayer({
            runLayerId: persistedLayer.runLayerId,
            assertionResult: produced.assertionResult,
            assertionReasons: produced.assertionReasons,
            output: produced.output,
            diagnostics: produced.diagnostics,
        });
    }
    await repository.finalizeCase(runCase.runCaseId);
}

function safeErrorCode(error: unknown) {
    const message = error instanceof Error ? error.message : "SCENARIO_FIXTURE_EXECUTION_FAILED";
    const candidate = message.split(":", 1)[0]?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_") ?? "";
    return /^[A-Z][A-Z0-9_]{0,79}$/.test(candidate) ? candidate : "SCENARIO_FIXTURE_EXECUTION_FAILED";
}
