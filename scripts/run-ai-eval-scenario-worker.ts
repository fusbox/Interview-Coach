import { hostname } from "node:os";

import { Pool } from "pg";

import { loadEnvConfig } from "@next/env";

import { createAiEvalScenarioRepository } from "../src/features/ai-eval-v2/ai-eval-scenario-repository";
import {
    runAiEvalScenarioLiveJobById,
    runNextAiEvalScenarioFixtureJob,
    runNextAiEvalScenarioLiveJob,
} from "../src/features/ai-eval-v2/ai-eval-scenario-worker";
import {
    createAiEvalScenarioWorkerMonitor,
    readAiEvalScenarioWorkerServicePolicy,
    runAiEvalScenarioWorkerService,
    startAiEvalScenarioWorkerHealthServer,
} from "../src/features/ai-eval-v2/ai-eval-scenario-worker-service";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

loadEnvConfig(process.cwd());

async function main() {
    const once = process.argv.includes("--once");
    const service = process.argv.includes("--service");
    const live = process.argv.includes("--live");
    const confirmed = process.argv.includes("--confirm-live");
    const runId = readArgument("--run-id");
    if (service && once) {
        throw new Error("Service mode cannot be combined with --once.");
    }
    if (service && runId) {
        throw new Error("Service mode cannot target one --run-id.");
    }
    if (live && !confirmed) {
        throw new Error("Live scenario execution requires the explicit --confirm-live argument.");
    }
    if (runId && !live) {
        throw new Error("A targeted --run-id is supported only with --live.");
    }
    if (runId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
        throw new Error("The targeted live scenario run id is not a valid UUID.");
    }
    const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
    if ((live || service) && !configuredDatabaseUrl) {
        throw new Error("Live or service scenario execution requires an explicit DATABASE_URL; the smoke database fallback is disabled.");
    }
    const servicePolicyResult = service
        ? readAiEvalScenarioWorkerServicePolicy(process.env)
        : null;
    if (servicePolicyResult && !servicePolicyResult.ready) {
        throw new Error(`AI_EVAL_WORKER_SERVICE_NOT_READY:${servicePolicyResult.reasons.join(",")}`);
    }
    const pool = new Pool({
        connectionString: configuredDatabaseUrl || getSmokeDatabaseUrl(),
        max: service ? 2 : 1,
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000,
        statement_timeout: 30_000,
        query_timeout: 35_000,
        application_name: "interview-coach-ai-eval-scenario-worker",
    });
    const repository = createAiEvalScenarioRepository({
        query: (sql, values) => pool.query(sql, values),
    });
    const workerId = readWorkerId(process.env.AI_EVAL_SCENARIO_WORKER_ID)
        ?? `${live ? "live" : "contract"}:${hostname()}:${process.pid}`;
    const abortController = new AbortController();
    const requestShutdown = () => abortController.abort();
    let healthServer: Awaited<ReturnType<typeof startAiEvalScenarioWorkerHealthServer>> | null = null;

    try {
        await pool.query("select 1 as ready");
        if (service && servicePolicyResult?.ready) {
            const executionMode = live ? "credentialed_live" as const : "contract_fixture" as const;
            const monitor = createAiEvalScenarioWorkerMonitor({
                workerId,
                executionMode,
                maxConsecutiveErrors: servicePolicyResult.policy.maxConsecutiveErrors,
            });
            if (servicePolicyResult.policy.healthPort) {
                healthServer = await startAiEvalScenarioWorkerHealthServer({
                    host: servicePolicyResult.policy.healthHost,
                    port: servicePolicyResult.policy.healthPort,
                    getSnapshot: monitor.snapshot,
                });
            }
            process.once("SIGINT", requestShutdown);
            process.once("SIGTERM", requestShutdown);
            await runAiEvalScenarioWorkerService({
                monitor,
                policy: servicePolicyResult.policy,
                signal: abortController.signal,
                executeNext: () => (
                    live
                        ? runNextAiEvalScenarioLiveJob({ repository, workerId, env: process.env })
                        : runNextAiEvalScenarioFixtureJob({ repository, workerId })
                ),
                emit: (event) => console.log(JSON.stringify(event)),
            });
            return;
        }

        do {
            const result = live
                ? runId
                    ? await runAiEvalScenarioLiveJobById({
                        repository,
                        runId,
                        workerId,
                        env: process.env,
                    })
                    : await runNextAiEvalScenarioLiveJob({ repository, workerId, env: process.env })
                : await runNextAiEvalScenarioFixtureJob({ repository, workerId });
            console.log(JSON.stringify(result));
            if (result.status === "idle" || once || runId) break;
        } while (true);
    } finally {
        process.removeListener("SIGINT", requestShutdown);
        process.removeListener("SIGTERM", requestShutdown);
        await healthServer?.close();
        await pool.end();
    }
}

function readArgument(name: string) {
    const prefix = `${name}=`;
    return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim() || null;
}

function readWorkerId(value: string | undefined) {
    const candidate = value?.trim();
    if (!candidate) return null;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{2,119}$/.test(candidate)) {
        throw new Error("AI_EVAL_SCENARIO_WORKER_ID_INVALID");
    }
    return candidate;
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : "AI-eval scenario worker failed.");
    process.exitCode = 1;
});
