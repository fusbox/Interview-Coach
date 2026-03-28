import { beforeEach, describe, expect, it } from "vitest";
import {
    buildOperationalSloSummary,
    buildOperationsDashboard,
    getMetricsSnapshot,
    getOperationalMetricsSnapshot,
    getOperationalSloSummary,
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
            sendSuccesses: 1,
            resendSuccesses: 0,
            resendFailures: 0
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

    it("returns the local snapshot when no durable backend is configured", async () => {
        incrementMetric("invite_send_total", { outcome: "success" });

        const snapshot = await getOperationalMetricsSnapshot();

        expect(snapshot.counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "invite_send_total",
                tags: { outcome: "success" },
                value: 1
            })
        ]));
    });

    it("builds an operational SLO summary from the local snapshot", () => {
        incrementMetric("session_start_total", { outcome: "success", mode: "new" }, 3);
        incrementMetric("session_submit_total", { outcome: "success", analysisIncluded: false }, 2);
        incrementMetric("session_submit_total", { outcome: "replay_success", analysisIncluded: false });
        incrementMetric("session_submit_total", { outcome: "error", analysisIncluded: true });
        incrementMetric("ai_requests_total", { operation: "analysis", outcome: "success" }, 2);
        incrementMetric("ai_requests_total", { operation: "analysis", outcome: "malformed_response" });
        observeMetric("ai_request_duration_ms", 120, { operation: "analysis", outcome: "success" });

        const summary = buildOperationalSloSummary(getMetricsSnapshot(), "2026-03-26T00:00:00.000Z");

        expect(summary.sessionStart).toMatchObject({
            successCount: 3,
            failureCount: 0,
            totalCount: 3,
            successRate: 100
        });
        expect(summary.sessionProgress).toMatchObject({
            successCount: 2,
            replaySuccessCount: 1,
            errorCount: 1,
            sliNumerator: 3,
            sliDenominator: 4,
            successRate: 75
        });
        expect(summary.aiReliability.overall).toMatchObject({
            successCount: 2,
            malformedResponseCount: 1,
            totalCount: 3,
            successRate: 66.67
        });
        expect(summary.aiLatency.operations).toEqual([
            expect.objectContaining({
                operation: "analysis",
                count: 1,
                avgMs: 120
            })
        ]);
    });

    it("returns the local SLO summary when no durable backend is configured", async () => {
        incrementMetric("session_start_total", { outcome: "success", mode: "new" });

        const summary = await getOperationalSloSummary();

        expect(summary.sessionStart).toMatchObject({
            successCount: 1,
            failureCount: 0,
            totalCount: 1,
            successRate: 100
        });
    });
});
