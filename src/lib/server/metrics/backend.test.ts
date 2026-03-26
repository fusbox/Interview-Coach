import { afterEach, describe, expect, it, vi } from "vitest";
import {
    buildSnapshotFromRollups,
    getDurableMetricsBackend,
    getMetricsBackendName,
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
});
