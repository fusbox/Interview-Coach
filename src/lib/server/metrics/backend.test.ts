import { afterEach, describe, expect, it, vi } from "vitest";
import {
    buildSloSummaryFromRows,
    buildSnapshotFromRollups,
    getDurableMetricsBackend,
    getMetricsBackendName,
    normalizeAiLatencyRow,
    normalizeAiReliabilityRow,
    normalizeCounterRollup,
    normalizeSessionProgressRow,
    normalizeSessionStartRow,
    normalizeTimingRollup,
    resetDurableMetricsBackendForTests,
    SupabaseDurableMetricsBackend
} from "./backend";

describe("metrics backend", () => {
    afterEach(() => {
        delete process.env.METRICS_BACKEND;
        resetDurableMetricsBackendForTests();
        vi.resetModules();
    });

    it("defaults to memory backend", () => {
        expect(getMetricsBackendName()).toBe("memory");
        expect(getDurableMetricsBackend()).toBeNull();
    });

    it("selects supabase backend when configured", () => {
        process.env.METRICS_BACKEND = "supabase";

        const backend = getDurableMetricsBackend();

        expect(getMetricsBackendName()).toBe("supabase");
        expect(backend).toBeInstanceOf(SupabaseDurableMetricsBackend);
    });

    it("fails fast in production when metrics backend is unset", () => {
        vi.stubEnv("NODE_ENV", "production");

        expect(() => getMetricsBackendName()).toThrow(
            "[ServerEnv] Missing required environment variable METRICS_BACKEND for durable metrics backend."
        );
    });

    it('fails fast in production when metrics backend is set to "memory"', () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("METRICS_BACKEND", "memory");

        expect(() => getMetricsBackendName()).toThrow('METRICS_BACKEND must be set to "supabase" in production.');
    });

    it("rejects unsupported backend values", () => {
        process.env.METRICS_BACKEND = "file";

        expect(() => getMetricsBackendName()).toThrow(
            'Unsupported METRICS_BACKEND value "file". Expected "memory" or "supabase".'
        );
    });

    it("builds a snapshot from durable rollups", () => {
        const snapshot = buildSnapshotFromRollups(
            [
                {
                    metric_name: "invite_send_total",
                    tags_key: "invite_send_total::{\"outcome\":\"success\"}",
                    tags: { outcome: "success" },
                    value: 3
                }
            ],
            [
                {
                    metric_name: "ai_request_duration_ms",
                    tags_key: "ai_request_duration_ms::{\"operation\":\"analysis\"}",
                    tags: { operation: "analysis" },
                    count: 2,
                    total_ms: 300,
                    min_ms: 100,
                    max_ms: 200
                }
            ]
        );

        expect(snapshot.counters).toEqual([
            expect.objectContaining({
                name: "invite_send_total",
                tags: { outcome: "success" },
                value: 3
            })
        ]);
        expect(snapshot.timings).toEqual([
            expect.objectContaining({
                name: "ai_request_duration_ms",
                tags: { operation: "analysis" },
                count: 2,
                avgMs: 150,
                minMs: 100,
                maxMs: 200
            })
        ]);
    });

    it("normalizes stringly typed durable rollup rows from RPC payloads", () => {
        expect(normalizeCounterRollup({
            metric_name: "invite_resend_total",
            tags_key: "invite_resend_total::{\"outcome\":\"success\"}",
            tags: { outcome: "success", attempt: 2 },
            value: "4"
        })).toEqual({
            metric_name: "invite_resend_total",
            tags_key: "invite_resend_total::{\"outcome\":\"success\"}",
            tags: { outcome: "success", attempt: "2" },
            value: 4
        });

        expect(normalizeTimingRollup({
            metric_name: "invite_resend_duration_ms",
            tags_key: "invite_resend_duration_ms::{\"outcome\":\"success\"}",
            tags: null,
            count: "2",
            total_ms: "350",
            min_ms: "100",
            max_ms: "250"
        })).toEqual({
            metric_name: "invite_resend_duration_ms",
            tags_key: "invite_resend_duration_ms::{\"outcome\":\"success\"}",
            tags: {},
            count: 2,
            total_ms: 350,
            min_ms: 100,
            max_ms: 250
        });
    });

    it("builds an SLO summary from durable rows", () => {
        const summary = buildSloSummaryFromRows(
            "2026-03-26T00:00:00.000Z",
            {
                success_count: 3,
                failure_count: 1,
                total_count: 4,
                success_rate: 75
            },
            {
                success_count: 2,
                replay_success_count: 1,
                error_count: 1,
                request_in_progress_count: 0,
                idempotency_mismatch_count: 0,
                invalid_request_count: 1,
                sli_numerator: 3,
                sli_denominator: 4,
                success_rate: 75
            },
            [
                {
                    operation: "analysis",
                    success_count: 2,
                    error_count: 1,
                    malformed_response_count: 0,
                    mock_fallback_count: 0,
                    total_count: 3,
                    success_rate: 66.67
                }
            ],
            [
                {
                    operation: "analysis",
                    count: 2,
                    total_ms: 300,
                    min_ms: 100,
                    max_ms: 200,
                    avg_ms: 150
                }
            ]
        );

        expect(summary.sessionStart.successRate).toBe(75);
        expect(summary.sessionProgress.sliDenominator).toBe(4);
        expect(summary.aiReliability.overall.totalCount).toBe(3);
        expect(summary.aiLatency.operations[0]).toMatchObject({
            operation: "analysis",
            avgMs: 150
        });
    });

    it("normalizes stringly typed SLO RPC rows from Supabase", () => {
        expect(normalizeSessionStartRow({
            success_count: "3",
            failure_count: "1",
            total_count: "4",
            success_rate: "75.00"
        })).toEqual({
            success_count: 3,
            failure_count: 1,
            total_count: 4,
            success_rate: 75
        });

        expect(normalizeSessionProgressRow({
            success_count: "2",
            replay_success_count: "1",
            error_count: "1",
            request_in_progress_count: "0",
            idempotency_mismatch_count: "0",
            invalid_request_count: "1",
            sli_numerator: "3",
            sli_denominator: "4",
            success_rate: "75.00"
        })).toEqual({
            success_count: 2,
            replay_success_count: 1,
            error_count: 1,
            request_in_progress_count: 0,
            idempotency_mismatch_count: 0,
            invalid_request_count: 1,
            sli_numerator: 3,
            sli_denominator: 4,
            success_rate: 75
        });

        expect(normalizeAiReliabilityRow({
            operation: "analysis",
            success_count: "2",
            error_count: "1",
            malformed_response_count: "0",
            mock_fallback_count: "0",
            total_count: "3",
            success_rate: "66.67"
        })).toEqual({
            operation: "analysis",
            success_count: 2,
            error_count: 1,
            malformed_response_count: 0,
            mock_fallback_count: 0,
            total_count: 3,
            success_rate: 66.67
        });

        expect(normalizeAiLatencyRow({
            operation: "analysis",
            count: "2",
            total_ms: "300",
            min_ms: "100",
            max_ms: "200",
            avg_ms: "150.00"
        })).toEqual({
            operation: "analysis",
            count: 2,
            total_ms: 300,
            min_ms: 100,
            max_ms: 200,
            avg_ms: 150
        });
    });
});
