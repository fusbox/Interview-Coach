import { randomUUID } from "crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_METRICS_TEST_DATABASE_URL;
const runIntegration = databaseUrl ? describe : describe.skip;

runIntegration("Postgres durable metrics integration", () => {
    let pool: Pool;
    let testRun: string;

    beforeAll(() => {
        if (!databaseUrl) {
            return;
        }

        process.env.DATABASE_URL = databaseUrl;
        process.env.METRICS_BACKEND = "postgres";
        testRun = `metrics-smoke:${randomUUID()}`;
        pool = new Pool({ connectionString: databaseUrl });
    });

    afterAll(async () => {
        if (!pool) {
            return;
        }

        await pool.query(
            "delete from public.metric_counter_rollups where tags ->> 'test_run' = $1",
            [testRun]
        );
        await pool.query(
            "delete from public.metric_timing_rollups where tags ->> 'test_run' = $1",
            [testRun]
        );
        await pool.end();

        const { closePostgresPoolForTests } = await import("../db/postgres");
        await closePostgresPoolForTests();
    });

    it("writes and reads counter/timing rollups through Postgres functions", async () => {
        const { PostgresDurableMetricsBackend } = await import("./backend");
        const backend = new PostgresDurableMetricsBackend();
        const recordedAt = new Date().toISOString();

        await backend.writeCounter({
            name: "integration_counter_total",
            value: 2,
            tags: { outcome: "success", test_run: testRun },
            tagsKey: `integration_counter_total::${testRun}`,
            recordedAt
        });
        await backend.writeCounter({
            name: "integration_counter_total",
            value: 3,
            tags: { outcome: "success", test_run: testRun },
            tagsKey: `integration_counter_total::${testRun}`,
            recordedAt
        });
        await backend.writeTiming({
            name: "integration_duration_ms",
            durationMs: 80,
            tags: { operation: "db", test_run: testRun },
            tagsKey: `integration_duration_ms::${testRun}`,
            recordedAt
        });
        await backend.writeTiming({
            name: "integration_duration_ms",
            durationMs: 120,
            tags: { operation: "db", test_run: testRun },
            tagsKey: `integration_duration_ms::${testRun}`,
            recordedAt
        });

        const snapshot = await backend.readSnapshot({ sinceMs: 120_000 });

        expect(snapshot.counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "integration_counter_total",
                tags: { outcome: "success", test_run: testRun },
                value: 5
            })
        ]));
        expect(snapshot.timings).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "integration_duration_ms",
                tags: { operation: "db", test_run: testRun },
                count: 2,
                totalMs: 200,
                minMs: 80,
                maxMs: 120,
                avgMs: 100
            })
        ]));
    });

    it("reads SLO summaries from Postgres rollups", async () => {
        const { PostgresDurableMetricsBackend } = await import("./backend");
        const backend = new PostgresDurableMetricsBackend();
        const recordedAt = new Date().toISOString();

        await backend.writeCounter({
            name: "session_start_total",
            value: 2,
            tags: { outcome: "success", mode: "new", test_run: testRun },
            tagsKey: `session_start_total::success::${testRun}`,
            recordedAt
        });
        await backend.writeCounter({
            name: "session_submit_total",
            value: 1,
            tags: { outcome: "success", analysisIncluded: "true", test_run: testRun },
            tagsKey: `session_submit_total::success::${testRun}`,
            recordedAt
        });
        await backend.writeCounter({
            name: "session_submit_total",
            value: 1,
            tags: { outcome: "error", analysisIncluded: "true", test_run: testRun },
            tagsKey: `session_submit_total::error::${testRun}`,
            recordedAt
        });
        await backend.writeCounter({
            name: "ai_requests_total",
            value: 2,
            tags: { operation: "analysis", outcome: "success", test_run: testRun },
            tagsKey: `ai_requests_total::success::${testRun}`,
            recordedAt
        });
        await backend.writeCounter({
            name: "ai_requests_total",
            value: 1,
            tags: { operation: "analysis", outcome: "error", test_run: testRun },
            tagsKey: `ai_requests_total::error::${testRun}`,
            recordedAt
        });
        await backend.writeTiming({
            name: "ai_request_duration_ms",
            durationMs: 300,
            tags: { operation: "analysis", outcome: "success", test_run: testRun },
            tagsKey: `ai_request_duration_ms::analysis::${testRun}`,
            recordedAt
        });

        const summary = await backend.readSloSummary({ sinceMs: 120_000 });

        expect(summary.sessionStart).toMatchObject({
            successCount: 2,
            failureCount: 0,
            totalCount: 2,
            successRate: 100
        });
        expect(summary.sessionProgress).toMatchObject({
            successCount: 1,
            errorCount: 1,
            sliNumerator: 1,
            sliDenominator: 2,
            successRate: 50
        });
        expect(summary.aiReliability.operations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                operation: "analysis",
                successCount: 2,
                errorCount: 1,
                totalCount: 3,
                successRate: 66.67
            })
        ]));
        expect(summary.aiLatency.operations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                operation: "analysis",
                count: 1,
                avgMs: 300
            })
        ]));
    });
});
