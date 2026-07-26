import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import { aiEvalScenarioBaselineCases } from "../src/features/ai-eval-v2/ai-eval-scenario-baseline";
import { createAiEvalScenarioRepository } from "../src/features/ai-eval-v2/ai-eval-scenario-repository";
import {
    executeAiEvalScenarioRetention,
    readAiEvalScenarioRetentionDatabaseClock,
} from "../src/features/ai-eval-v2/ai-eval-scenario-retention";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 1,
        application_name: "interview-coach-ai-eval-retention-smoke",
    });
    const client = await pool.connect();
    const operatorUserId = randomUUID();

    try {
        await client.query("begin");
        await client.query(`
            insert into public.app_users (user_id, email, display_name, status)
            values ($1, $2, 'Retention smoke operator', 'active')
        `, [operatorUserId, `retention-smoke-${operatorUserId}@example.invalid`]);
        await client.query(`
            insert into public.ai_eval_operator_grants (user_id, granted_by_user_id, reason)
            values ($1, $1, 'Rollback-only worker retention smoke')
        `, [operatorUserId]);

        const repository = createAiEvalScenarioRepository({
            query: (sql, values) => client.query(sql, values),
        });
        const baseline = await repository.synchronizeBaseline(operatorUserId);
        assert(baseline.scenarioCount === aiEvalScenarioBaselineCases.length, "Baseline synchronization drifted.");
        const versions = await repository.listScenarioVersions(operatorUserId);
        const scenarioVersionId = versions[0]?.scenarioVersionId;
        assert(scenarioVersionId, "Retention smoke requires a staged scenario version.");

        const expiredRunIds = [
            await createRunGraph(client, {
                operatorUserId,
                scenarioVersionId,
                requestedAt: "2026-05-01T00:00:00.000Z",
                retentionExpiresAt: "2026-06-01T00:00:00.000Z",
                includeLiveOperation: true,
                terminalState: "completed",
            }),
            await createRunGraph(client, {
                operatorUserId,
                scenarioVersionId,
                requestedAt: "2026-05-02T00:00:00.000Z",
                retentionExpiresAt: "2026-06-02T00:00:00.000Z",
                includeLiveOperation: false,
                terminalState: "failed",
            }),
            await createRunGraph(client, {
                operatorUserId,
                scenarioVersionId,
                requestedAt: "2026-05-03T00:00:00.000Z",
                retentionExpiresAt: "2026-06-03T00:00:00.000Z",
                includeLiveOperation: false,
                terminalState: "completed",
            }),
        ];
        const activeRunId = await createActiveExpiredRun(client, {
            operatorUserId,
            scenarioVersionId,
        });
        const nonExpiredRunId = await createRunGraph(client, {
            operatorUserId,
            scenarioVersionId,
            requestedAt: "2026-07-23T00:00:00.000Z",
            retentionExpiresAt: "2099-01-01T00:00:00.000Z",
            includeLiveOperation: false,
            terminalState: "completed",
        });
        const cutoffAt = await readAiEvalScenarioRetentionDatabaseClock(client);

        const dryRunRequestKey = randomUUID();
        const dryRun = await executeAiEvalScenarioRetention(client, {
            requestKey: dryRunRequestKey,
            cutoffAt,
            batchLimit: 2,
            workerId: "retention-smoke",
            apply: false,
        });
        assert(dryRun.operationMode === "dry_run", "Retention did not default to dry-run semantics.");
        assert(dryRun.eligibleRunCount === 3, "Dry-run did not identify all expired terminal runs.");
        assert(dryRun.selectedRunCount === 2, "Dry-run did not honor the batch limit.");
        assert(dryRun.deletedRunCount === 0, "Dry-run deleted run artifacts.");
        assert(dryRun.selectedCaseCount === 2 && dryRun.selectedLayerCount === 2, "Dry-run child counts drifted.");
        assert(dryRun.selectedLiveOperationCount === 1, "Dry-run live-operation count drifted.");
        assert(dryRun.remainingExpiredRunCount === 3, "Dry-run changed the remaining expired count.");

        const replay = await executeAiEvalScenarioRetention(client, {
            requestKey: dryRunRequestKey,
            cutoffAt,
            batchLimit: 2,
            workerId: "retention-smoke",
            apply: false,
        });
        assert(replay.operationId === dryRun.operationId, "Exact retention replay did not converge.");

        await client.query("savepoint changed_retention_request");
        let idempotencyConflict = false;
        try {
            await executeAiEvalScenarioRetention(client, {
                requestKey: dryRunRequestKey,
                cutoffAt,
                batchLimit: 2,
                workerId: "retention-smoke",
                apply: true,
            });
        } catch {
            idempotencyConflict = true;
            await client.query("rollback to savepoint changed_retention_request");
        }
        assert(idempotencyConflict, "Changed retention request-key reuse did not fail closed.");

        await client.query("savepoint direct_delete_check");
        let directDeleteBlocked = false;
        try {
            await client.query(`
                delete from public.ai_eval_scenario_runs
                where ai_eval_scenario_run_id = $1
            `, [expiredRunIds[0]]);
        } catch {
            directDeleteBlocked = true;
            await client.query("rollback to savepoint direct_delete_check");
        }
        assert(directDeleteBlocked, "Direct AI-eval run deletion bypassed the cleanup function.");

        const applied = await executeAiEvalScenarioRetention(client, {
            requestKey: randomUUID(),
            cutoffAt,
            batchLimit: 2,
            workerId: "retention-smoke",
            apply: true,
        });
        assert(applied.operationMode === "apply", "Retention apply mode drifted.");
        assert(applied.deletedRunCount === 2, "Retention apply did not delete exactly one bounded batch.");
        assert(applied.deletedCaseCount === 2 && applied.deletedLayerCount === 2, "Cascade delete counts drifted.");
        assert(applied.deletedLiveOperationCount === 1, "Live-operation cascade count drifted.");
        assert(applied.remainingExpiredRunCount === 1, "Retention apply did not report the remaining batch.");

        const preserved = await client.query(`
            select ai_eval_scenario_run_id
            from public.ai_eval_scenario_runs
            where ai_eval_scenario_run_id = any($1::uuid[])
        `, [[expiredRunIds[2], activeRunId, nonExpiredRunId]]);
        assert(preserved.rows.length === 3, "Retention removed an active, non-expired, or unselected run.");
        const deleted = await client.query(`
            select count(*)::integer as count
            from public.ai_eval_scenario_runs
            where ai_eval_scenario_run_id = any($1::uuid[])
        `, [expiredRunIds.slice(0, 2)]);
        assert(Number(deleted.rows[0]?.count) === 0, "Selected expired runs survived retention apply.");

        const receipt = await client.query(`
            select operation_mode, deleted_run_count, remaining_expired_run_count
            from public.ai_eval_scenario_retention_operations
            where ai_eval_scenario_retention_operation_id = $1
        `, [applied.operationId]);
        assert(
            receipt.rows[0]?.operation_mode === "apply"
            && Number(receipt.rows[0]?.deleted_run_count) === 2,
            "Durable retention receipt was not recorded.",
        );

        console.log(JSON.stringify({
            dryRun: {
                eligibleRunCount: dryRun.eligibleRunCount,
                selectedRunCount: dryRun.selectedRunCount,
                deletedRunCount: dryRun.deletedRunCount,
            },
            apply: {
                deletedRunCount: applied.deletedRunCount,
                deletedCaseCount: applied.deletedCaseCount,
                deletedLayerCount: applied.deletedLayerCount,
                deletedLiveOperationCount: applied.deletedLiveOperationCount,
                remainingExpiredRunCount: applied.remainingExpiredRunCount,
            },
            idempotencyReplay: true,
            changedInputConflict: true,
            directDeleteBlocked: true,
            activeRunPreserved: true,
            nonExpiredRunPreserved: true,
            receiptMetadataOnly: true,
        }, null, 2));
    } finally {
        await client.query("rollback").catch(() => undefined);
        client.release();
        await pool.end();
    }
}

async function createRunGraph(client: PoolClient, input: {
    operatorUserId: string;
    scenarioVersionId: string;
    requestedAt: string;
    retentionExpiresAt: string;
    includeLiveOperation: boolean;
    terminalState: "completed" | "failed";
}) {
    const runId = randomUUID();
    const caseId = randomUUID();
    await client.query(`
        insert into public.ai_eval_scenario_runs (
          ai_eval_scenario_run_id,
          requested_by_operator_user_id,
          creation_request_key,
          request_fingerprint,
          execution_mode,
          profile_id,
          configuration_fingerprint,
          lifecycle_state,
          case_count,
          requested_at,
          retention_expires_at
        ) values ($1, $2, $3, $4, 'contract_fixture', 'retention_smoke_v1', $5, 'queued', 1, $6, $7)
    `, [runId, input.operatorUserId, randomUUID(), "a".repeat(64), "b".repeat(64), input.requestedAt, input.retentionExpiresAt]);
    await client.query(`
        update public.ai_eval_scenario_runs
        set lifecycle_state = 'running',
            claim_worker_id = 'retention-smoke-fixture',
            claim_generation = 1,
            claim_expires_at = clock_timestamp() + interval '5 minutes',
            started_at = requested_at + interval '1 second'
        where ai_eval_scenario_run_id = $1
    `, [runId]);
    await client.query(`
        insert into public.ai_eval_scenario_run_cases (
          ai_eval_scenario_run_case_id,
          ai_eval_scenario_run_id,
          ai_eval_scenario_version_id,
          ordinal
        ) values ($1, $2, $3, 1)
    `, [caseId, runId, input.scenarioVersionId]);
    await client.query(`
        insert into public.ai_eval_scenario_run_layers (
          ai_eval_scenario_run_case_id,
          output_layer,
          candidate_visible
        ) values ($1, 'session_coaching', true)
    `, [caseId]);
    await client.query(`
        update public.ai_eval_scenario_run_cases
        set lifecycle_state = $2,
            assertion_result = case when $2 = 'completed' then 'pass' else null end,
            error_code = case when $2 = 'failed' then 'RETENTION_SMOKE_FAILURE' else null end,
            started_at = clock_timestamp() - interval '2 seconds',
            completed_at = clock_timestamp() - interval '1 second'
        where ai_eval_scenario_run_case_id = $1
    `, [caseId, input.terminalState]);
    await client.query(`
        update public.ai_eval_scenario_run_layers
        set lifecycle_state = $2,
            assertion_result = case when $2 = 'completed' then 'pass' else null end,
            output_json = case when $2 = 'completed' then '{"fixture":"retention-smoke"}'::jsonb else null end,
            error_code = case when $2 = 'failed' then 'RETENTION_SMOKE_FAILURE' else null end,
            started_at = clock_timestamp() - interval '2 seconds',
            completed_at = clock_timestamp() - interval '1 second'
        where ai_eval_scenario_run_case_id = $1
    `, [caseId, input.terminalState]);

    if (input.includeLiveOperation) {
        const operationId = randomUUID();
        await client.query(`
            insert into public.ai_eval_scenario_live_operations (
              ai_eval_scenario_live_operation_id,
              ai_eval_scenario_run_id,
              operation_key,
              operation_kind,
              input_fingerprint,
              profile_id,
              configuration_fingerprint
            ) values ($1, $2, $3, 'answer_evaluation', $4, 'retention_smoke_v1', $5)
        `, [operationId, runId, `retention-smoke:${operationId}`, "c".repeat(64), "d".repeat(64)]);
    }

    await client.query(`
        update public.ai_eval_scenario_runs
        set lifecycle_state = $2,
            completed_case_count = case when $2 = 'completed' then 1 else 0 end,
            failed_case_count = case when $2 = 'failed' then 1 else 0 end,
            assertion_result = case when $2 = 'completed' then 'pass' else 'fail' end,
            error_code = case when $2 = 'failed' then 'RETENTION_SMOKE_FAILURE' else null end,
            claim_worker_id = null,
            claim_expires_at = null,
            completed_at = clock_timestamp()
        where ai_eval_scenario_run_id = $1
    `, [runId, input.terminalState]);
    return runId;
}

async function createActiveExpiredRun(client: PoolClient, input: {
    operatorUserId: string;
    scenarioVersionId: string;
}) {
    const runId = randomUUID();
    await client.query(`
        insert into public.ai_eval_scenario_runs (
          ai_eval_scenario_run_id,
          requested_by_operator_user_id,
          creation_request_key,
          request_fingerprint,
          execution_mode,
          profile_id,
          configuration_fingerprint,
          lifecycle_state,
          case_count,
          requested_at,
          retention_expires_at
        ) values (
          $1, $2, $3, $4, 'contract_fixture', 'retention_smoke_v1', $5,
          'queued', 1, '2026-05-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'
        )
    `, [runId, input.operatorUserId, randomUUID(), "e".repeat(64), "f".repeat(64)]);
    await client.query(`
        update public.ai_eval_scenario_runs
        set lifecycle_state = 'running',
            claim_worker_id = 'active-retention-smoke',
            claim_generation = 1,
            claim_expires_at = clock_timestamp() + interval '5 minutes',
            started_at = requested_at + interval '1 second'
        where ai_eval_scenario_run_id = $1
    `, [runId]);
    await client.query(`
        insert into public.ai_eval_scenario_run_cases (
          ai_eval_scenario_run_id,
          ai_eval_scenario_version_id,
          ordinal
        ) values ($1, $2, 1)
    `, [runId, input.scenarioVersionId]);
    return runId;
}

function assert(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
});
