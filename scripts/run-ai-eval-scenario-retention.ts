import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";

import {
    executeAiEvalScenarioRetention,
    readAiEvalScenarioRetentionDatabaseClock,
} from "../src/features/ai-eval-v2/ai-eval-scenario-retention";

loadEnvConfig(process.cwd());

async function main() {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
        throw new Error("AI-eval retention requires an explicit DATABASE_URL; no smoke database fallback is allowed.");
    }
    const apply = process.argv.includes("--apply");
    const requestKey = readArgument("--request-key") ?? randomUUID();
    const batchLimit = readBatchLimit(readArgument("--batch-limit"));
    const workerId = readWorkerId(process.env.AI_EVAL_SCENARIO_RETENTION_WORKER_ID)
        ?? `retention:${hostname()}:${process.pid}`;
    const pool = new Pool({
        connectionString: databaseUrl,
        max: 1,
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000,
        statement_timeout: 120_000,
        query_timeout: 125_000,
        application_name: "interview-coach-ai-eval-retention",
    });

    try {
        const cutoffArgument = readArgument("--cutoff");
        const cutoffAt = cutoffArgument
            ? normalizeCutoff(cutoffArgument)
            : await readAiEvalScenarioRetentionDatabaseClock(pool);
        const result = await executeAiEvalScenarioRetention(pool, {
            requestKey,
            cutoffAt,
            batchLimit,
            workerId,
            apply,
        });
        console.log(JSON.stringify({
            event: "ai_eval_retention_completed",
            operationId: result.operationId,
            requestKey: result.requestKey,
            operationMode: result.operationMode,
            cutoffAt: result.cutoffAt,
            batchLimit: result.batchLimit,
            eligibleRunCount: result.eligibleRunCount,
            selectedRunCount: result.selectedRunCount,
            selectedCaseCount: result.selectedCaseCount,
            selectedLayerCount: result.selectedLayerCount,
            selectedLiveOperationCount: result.selectedLiveOperationCount,
            deletedRunCount: result.deletedRunCount,
            deletedCaseCount: result.deletedCaseCount,
            deletedLayerCount: result.deletedLayerCount,
            deletedLiveOperationCount: result.deletedLiveOperationCount,
            remainingExpiredRunCount: result.remainingExpiredRunCount,
            completedAt: result.completedAt,
        }, null, 2));
    } finally {
        await pool.end();
    }
}

function readArgument(name: string) {
    const direct = process.argv.find((argument) => argument.startsWith(`${name}=`));
    if (direct) return direct.slice(name.length + 1).trim() || null;
    const index = process.argv.indexOf(name);
    if (index < 0) return null;
    const value = process.argv[index + 1]?.trim();
    if (!value || value.startsWith("--")) {
        throw new Error(`${name} requires a value.`);
    }
    return value;
}

function readBatchLimit(value: string | null) {
    if (value === null) return 100;
    if (!/^\d+$/.test(value)) throw new Error("--batch-limit must be an integer from 1 to 500.");
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 500) {
        throw new Error("--batch-limit must be an integer from 1 to 500.");
    }
    return parsed;
}

function normalizeCutoff(value: string) {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) throw new Error("--cutoff must be a valid ISO-8601 timestamp.");
    return new Date(parsed).toISOString();
}

function readWorkerId(value: string | undefined) {
    const normalized = value?.trim();
    if (!normalized) return null;
    if (normalized.length > 200 || /[\r\n]/.test(normalized)) {
        throw new Error("AI_EVAL_SCENARIO_RETENTION_WORKER_ID is invalid.");
    }
    return normalized;
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
