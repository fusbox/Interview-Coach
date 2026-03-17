import { beforeEach, describe, expect, it } from "vitest";
import {
    buildOperationsDashboard,
    getMetricsSnapshot,
    incrementMetric,
    observeMetric,
    resetMetrics
} from "./metrics";

describe("server metrics", () => {
    beforeEach(() => {
        resetMetrics();
    });

    it("aggregates counters and timing observations", () => {
        incrementMetric("invite_send_total", { outcome: "success" });
        incrementMetric("invite_send_total", { outcome: "success" });
        incrementMetric("invite_send_total", { outcome: "error" });
        observeMetric("ai_request_duration_ms", 120, { operation: "analysis", outcome: "success" });
        observeMetric("ai_request_duration_ms", 80, { operation: "analysis", outcome: "success" });

        const snapshot = getMetricsSnapshot();

        expect(snapshot.counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "invite_send_total",
                tags: { outcome: "success" },
                value: 2
            }),
            expect.objectContaining({
                name: "invite_send_total",
                tags: { outcome: "error" },
                value: 1
            })
        ]));

        expect(snapshot.timings).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "ai_request_duration_ms",
                tags: { operation: "analysis", outcome: "success" },
                count: 2,
                avgMs: 100,
                minMs: 80,
                maxMs: 120
            })
        ]));
    });

    it("builds an operations dashboard from the snapshot", () => {
        incrementMetric("recruiter_invite_create_total", { outcome: "success" });
        incrementMetric("invite_send_total", { outcome: "success" });
        incrementMetric("session_start_total", { outcome: "success", mode: "new" });
        incrementMetric("session_start_total", { outcome: "success", mode: "clone" });
        incrementMetric("session_completion_total", { outcome: "success" });
        incrementMetric("auth_denials_total", { actorType: "candidate" });
        incrementMetric("rate_limit_denials_total", { scope: "analysis" });
        incrementMetric("ai_requests_total", { operation: "analysis", outcome: "success" });
        incrementMetric("ai_requests_total", { operation: "analysis", outcome: "error" });
        observeMetric("ai_request_duration_ms", 90, { operation: "analysis", outcome: "success" });

        const dashboard = buildOperationsDashboard(getMetricsSnapshot());

        expect(dashboard.invites).toMatchObject({
            createSuccesses: 1,
            sendSuccesses: 1
        });
        expect(dashboard.sessions).toMatchObject({
            starts: 2,
            repeatStarts: 1,
            completions: 1
        });
        expect(dashboard.security).toMatchObject({
            authDenials: 1,
            rateLimitDenials: 1
        });
        expect(dashboard.ai).toMatchObject({
            requests: 1,
            errors: 1
        });
        expect(dashboard.ai.operations).toEqual([
            expect.objectContaining({
                operation: "analysis",
                requests: 1,
                errors: 1,
                avgLatencyMs: 90
            })
        ]);
    });
});
