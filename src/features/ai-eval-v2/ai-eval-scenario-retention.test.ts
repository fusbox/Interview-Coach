import { describe, expect, it, vi } from "vitest";

import {
    createAiEvalScenarioRetentionRequestFingerprint,
    executeAiEvalScenarioRetention,
    readAiEvalScenarioRetentionDatabaseClock,
} from "./ai-eval-scenario-retention";

describe("AI-eval scenario retention operation", () => {
    it("fingerprints normalized cleanup inputs without the idempotency key", () => {
        const first = createAiEvalScenarioRetentionRequestFingerprint({
            cutoffAt: "2026-07-24T12:00:00.000Z",
            batchLimit: 100,
            workerId: " retention-worker ",
            apply: false,
        });
        const second = createAiEvalScenarioRetentionRequestFingerprint({
            cutoffAt: "2026-07-24T07:00:00-05:00",
            batchLimit: 100,
            workerId: "retention-worker",
            apply: false,
        });
        expect(first).toMatch(/^[a-f0-9]{64}$/);
        expect(second).toBe(first);
        expect(createAiEvalScenarioRetentionRequestFingerprint({
            cutoffAt: "2026-07-24T12:00:00.000Z",
            batchLimit: 100,
            workerId: "replacement-retention-worker",
            apply: false,
        })).toBe(first);
        expect(createAiEvalScenarioRetentionRequestFingerprint({
            cutoffAt: "2026-07-24T12:00:00.000Z",
            batchLimit: 100,
            workerId: "retention-worker",
            apply: true,
        })).not.toBe(first);
    });

    it("uses the database clock and maps a metadata-only cleanup receipt", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ database_clock: "2026-07-24T12:00:00.123456Z" }] })
            .mockResolvedValueOnce({
                rows: [{
                    ai_eval_scenario_retention_operation_id: "11111111-1111-4111-8111-111111111111",
                    request_key: "22222222-2222-4222-8222-222222222222",
                    request_fingerprint: "a".repeat(64),
                    operation_mode: "dry_run",
                    cutoff_at: "2026-07-24T12:00:00.123456Z",
                    batch_limit: 100,
                    worker_id: "retention-worker",
                    eligible_run_count: 7,
                    selected_run_count: 5,
                    selected_case_count: 8,
                    selected_layer_count: 24,
                    selected_live_operation_count: 3,
                    deleted_run_count: 0,
                    deleted_case_count: 0,
                    deleted_layer_count: 0,
                    deleted_live_operation_count: 0,
                    remaining_expired_run_count: 7,
                    completed_at: "2026-07-24T12:00:01.000000Z",
                }],
            });
        const client = { query };
        const cutoffAt = await readAiEvalScenarioRetentionDatabaseClock(client);
        const result = await executeAiEvalScenarioRetention(client, {
            requestKey: "22222222-2222-4222-8222-222222222222",
            cutoffAt,
            batchLimit: 100,
            workerId: "retention-worker",
            apply: false,
        });

        expect(result).toMatchObject({
            operationMode: "dry_run",
            eligibleRunCount: 7,
            selectedRunCount: 5,
            selectedLayerCount: 24,
            deletedRunCount: 0,
        });
        expect(query.mock.calls[1]?.[1]).toEqual([
            "22222222-2222-4222-8222-222222222222",
            expect.stringMatching(/^[a-f0-9]{64}$/),
            "retention-worker",
            "2026-07-24T12:00:00.123Z",
            100,
            false,
        ]);
    });

    it("rejects unsafe request controls before querying the database", async () => {
        const client = { query: vi.fn() };
        await expect(executeAiEvalScenarioRetention(client, {
            requestKey: "not-a-uuid",
            cutoffAt: "2026-07-24T12:00:00.000Z",
            batchLimit: 100,
            workerId: "retention-worker",
            apply: false,
        })).rejects.toThrow("AI_EVAL_RETENTION_REQUEST_KEY_INVALID");
        await expect(executeAiEvalScenarioRetention(client, {
            requestKey: "22222222-2222-4222-8222-222222222222",
            cutoffAt: "2026-07-24T12:00:00.000Z",
            batchLimit: 501,
            workerId: "retention-worker",
            apply: false,
        })).rejects.toThrow("AI_EVAL_RETENTION_BATCH_LIMIT_INVALID");
        expect(client.query).not.toHaveBeenCalled();
    });
});
