import { Pool } from "pg";

import { loadEnvConfig } from "@next/env";

import { createAiEvalScenarioRepository } from "../src/features/ai-eval-v2/ai-eval-scenario-repository";
import {
    runAiEvalScenarioLiveJobById,
    runNextAiEvalScenarioFixtureJob,
    runNextAiEvalScenarioLiveJob,
} from "../src/features/ai-eval-v2/ai-eval-scenario-worker";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

loadEnvConfig(process.cwd());

async function main() {
    const once = process.argv.includes("--once");
    const live = process.argv.includes("--live");
    const confirmed = process.argv.includes("--confirm-live");
    const runId = readArgument("--run-id");
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
    if (live && !configuredDatabaseUrl) {
        throw new Error("Live scenario execution requires an explicit DATABASE_URL; the smoke database fallback is disabled.");
    }
    const pool = new Pool({
        connectionString: configuredDatabaseUrl || getSmokeDatabaseUrl(),
        max: 1,
        application_name: "interview-coach-ai-eval-scenario-worker",
    });
    const repository = createAiEvalScenarioRepository({
        query: (sql, values) => pool.query(sql, values),
    });
    const workerId = `${live ? "local-live" : "local-contract"}-worker:${process.pid}`;

    try {
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
        await pool.end();
    }
}

function readArgument(name: string) {
    const prefix = `${name}=`;
    return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim() || null;
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : "AI-eval scenario worker failed.");
    process.exitCode = 1;
});
