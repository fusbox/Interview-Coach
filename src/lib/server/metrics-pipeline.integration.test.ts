import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    getAuthenticatedRouteUserMock,
    durableState,
    resetDurableState,
} = vi.hoisted(() => {
    type CounterRow = {
        metric_name: string;
        tags_key: string;
        tags: Record<string, string>;
        value: number;
    };

    type TimingRow = {
        metric_name: string;
        tags_key: string;
        tags: Record<string, string>;
        count: number;
        total_ms: number;
        min_ms: number;
        max_ms: number;
    };

    const durableState = {
        counters: new Map<string, CounterRow>(),
        timings: new Map<string, TimingRow>(),
    };

    return {
        getAuthenticatedRouteUserMock: vi.fn(),
        durableState,
        resetDurableState: () => {
            durableState.counters.clear();
            durableState.timings.clear();
        },
    };
});

vi.mock("@/lib/server/auth/current-user", () => ({
    getAuthenticatedRouteUser: getAuthenticatedRouteUserMock,
}));

vi.mock("@/lib/server/metrics/backend", async () => {
    const actual = await vi.importActual<typeof import("@/lib/server/metrics/backend")>("@/lib/server/metrics/backend");

    const percentage = (numerator: number, denominator: number) => (
        denominator <= 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2))
    );

    const counterValue = (name: string, filters: Record<string, string> = {}) => (
        Array.from(durableState.counters.values())
            .filter((metric) => metric.metric_name === name)
            .filter((metric) => Object.entries(filters).every(([key, value]) => metric.tags[key] === value))
            .reduce((total, metric) => total + metric.value, 0)
    );

    class FakeDurableMetricsBackend {
        async writeCounter(params: {
            name: string;
            value: number;
            tags: Record<string, string>;
            tagsKey: string;
            recordedAt: string;
        }) {
            const existing = durableState.counters.get(params.tagsKey);
            if (existing) {
                existing.value += params.value;
                return;
            }

            durableState.counters.set(params.tagsKey, {
                metric_name: params.name,
                tags_key: params.tagsKey,
                tags: params.tags,
                value: params.value,
            });
        }

        async writeTiming(params: {
            name: string;
            durationMs: number;
            tags: Record<string, string>;
            tagsKey: string;
            recordedAt: string;
        }) {
            const existing = durableState.timings.get(params.tagsKey);
            if (existing) {
                existing.count += 1;
                existing.total_ms += params.durationMs;
                existing.min_ms = Math.min(existing.min_ms, params.durationMs);
                existing.max_ms = Math.max(existing.max_ms, params.durationMs);
                return;
            }

            durableState.timings.set(params.tagsKey, {
                metric_name: params.name,
                tags_key: params.tagsKey,
                tags: params.tags,
                count: 1,
                total_ms: params.durationMs,
                min_ms: params.durationMs,
                max_ms: params.durationMs,
            });
        }

        async readSnapshot() {
            return actual.buildSnapshotFromRollups(
                Array.from(durableState.counters.values()),
                Array.from(durableState.timings.values()),
            );
        }

        async readSloSummary(options?: { sinceMs?: number }) {
            const since = new Date(Date.now() - (options?.sinceMs ?? 24 * 60 * 60 * 1000)).toISOString();

            const sessionStartSuccessCount = counterValue("session_start_total", { outcome: "success" });
            const sessionStartFailureCount = counterValue("session_start_total", { outcome: "error" })
                + counterValue("session_start_total", { outcome: "rate_limited" });
            const sessionStartTotalCount = sessionStartSuccessCount + sessionStartFailureCount;

            const submitSuccessCount = counterValue("session_submit_total", { outcome: "success" });
            const replaySuccessCount = counterValue("session_submit_total", { outcome: "replay_success" });
            const submitErrorCount = counterValue("session_submit_total", { outcome: "error" });
            const requestInProgressCount = counterValue("session_submit_total", { outcome: "request_in_progress" });
            const idempotencyMismatchCount = counterValue("session_submit_total", { outcome: "idempotency_mismatch" });
            const invalidRequestCount = counterValue("session_submit_total", { outcome: "invalid_request" });
            const submitSliNumerator = submitSuccessCount + replaySuccessCount;
            const submitSliDenominator = submitSliNumerator + submitErrorCount + requestInProgressCount;

            const operations = new Set([
                ...Array.from(durableState.counters.values())
                    .filter((metric) => metric.metric_name === "ai_requests_total")
                    .map((metric) => metric.tags.operation || "unknown"),
                ...Array.from(durableState.timings.values())
                    .filter((metric) => metric.metric_name === "ai_request_duration_ms")
                    .map((metric) => metric.tags.operation || "unknown"),
            ]);

            const aiReliabilityRows = Array.from(operations)
                .sort((left, right) => left.localeCompare(right))
                .map((operation) => {
                    const successCount = counterValue("ai_requests_total", { operation, outcome: "success" });
                    const errorCount = counterValue("ai_requests_total", { operation, outcome: "error" });
                    const malformedResponseCount = counterValue("ai_requests_total", { operation, outcome: "malformed_response" });
                    const mockFallbackCount = counterValue("ai_requests_total", { operation, outcome: "mock_fallback" });
                    const totalCount = successCount + errorCount + malformedResponseCount + mockFallbackCount;

                    return {
                        operation,
                        success_count: successCount,
                        error_count: errorCount,
                        malformed_response_count: malformedResponseCount,
                        mock_fallback_count: mockFallbackCount,
                        total_count: totalCount,
                        success_rate: percentage(successCount, totalCount),
                    };
                });

            const aiLatencyRows = Array.from(durableState.timings.values())
                .filter((metric) => metric.metric_name === "ai_request_duration_ms")
                .map((metric) => ({
                    operation: metric.tags.operation || "unknown",
                    count: metric.count,
                    total_ms: metric.total_ms,
                    min_ms: metric.min_ms,
                    max_ms: metric.max_ms,
                    avg_ms: metric.count === 0 ? 0 : Number((metric.total_ms / metric.count).toFixed(2)),
                }))
                .sort((left, right) => left.operation.localeCompare(right.operation));

            return actual.buildSloSummaryFromRows(
                since,
                {
                    success_count: sessionStartSuccessCount,
                    failure_count: sessionStartFailureCount,
                    total_count: sessionStartTotalCount,
                    success_rate: percentage(sessionStartSuccessCount, sessionStartTotalCount),
                },
                {
                    success_count: submitSuccessCount,
                    replay_success_count: replaySuccessCount,
                    error_count: submitErrorCount,
                    request_in_progress_count: requestInProgressCount,
                    idempotency_mismatch_count: idempotencyMismatchCount,
                    invalid_request_count: invalidRequestCount,
                    sli_numerator: submitSliNumerator,
                    sli_denominator: submitSliDenominator,
                    success_rate: percentage(submitSliNumerator, submitSliDenominator),
                },
                aiReliabilityRows,
                aiLatencyRows,
            );
        }
    }

    const backend = new FakeDurableMetricsBackend();

    return {
        ...actual,
        getMetricsBackendName: () => "postgres" as const,
        getDurableMetricsBackend: () => backend,
        resetDurableMetricsBackendForTests: resetDurableState,
    };
});

import { buildOperationsAlerts } from "@/lib/server/alerts";
import {
    buildOperationsDashboard,
    getOperationalMetricsSnapshot,
    getOperationalSloSummary,
    incrementMetric,
    observeMetric,
    resetMetrics,
} from "@/lib/server/metrics";
import { GET } from "@/app/api/recruiter/ops/metrics/route";

describe("metrics pipeline integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMetrics();
        resetDurableState();
        getAuthenticatedRouteUserMock.mockResolvedValue({ id: "recruiter-1", email: "recruiter@example.com" });
    });

    it("writes operational events into the durable backend and surfaces them through snapshot, slo, dashboard, alerts, and the ops route", async () => {
        incrementMetric("invite_send_total", { outcome: "success" }, 2);
        incrementMetric("recruiter_invite_create_total", { outcome: "success" });
        incrementMetric("session_start_total", { outcome: "success", mode: "new" });
        incrementMetric("session_submit_total", { outcome: "success", analysisIncluded: false }, 2);
        incrementMetric("session_completion_total", { outcome: "success" });
        incrementMetric("ai_requests_total", { operation: "analysis", outcome: "success" }, 2);
        incrementMetric("ai_requests_total", { operation: "analysis", outcome: "error" });
        observeMetric("ai_request_duration_ms", 9200, { operation: "analysis", outcome: "success" });

        await Promise.resolve();
        await Promise.resolve();

        const snapshot = await getOperationalMetricsSnapshot();
        const sloSummary = await getOperationalSloSummary();
        const dashboard = buildOperationsDashboard(snapshot);
        const alerts = buildOperationsAlerts(snapshot);

        expect(snapshot.counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "invite_send_total",
                tags: { outcome: "success" },
                value: 2,
            }),
            expect.objectContaining({
                name: "ai_requests_total",
                tags: { operation: "analysis", outcome: "error" },
                value: 1,
            }),
        ]));
        expect(snapshot.timings).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "ai_request_duration_ms",
                tags: { operation: "analysis", outcome: "success" },
                count: 1,
                avgMs: 9200,
            }),
        ]));

        expect(sloSummary.sessionStart).toMatchObject({
            successCount: 1,
            failureCount: 0,
            totalCount: 1,
            successRate: 100,
        });
        expect(sloSummary.sessionProgress).toMatchObject({
            successCount: 2,
            replaySuccessCount: 0,
            errorCount: 0,
            sliNumerator: 2,
            sliDenominator: 2,
            successRate: 100,
        });
        expect(sloSummary.aiReliability.overall).toMatchObject({
            successCount: 2,
            errorCount: 1,
            totalCount: 3,
            successRate: 66.67,
        });

        expect(dashboard.invites).toMatchObject({
            createSuccesses: 1,
            sendSuccesses: 2,
        });
        expect(dashboard.sessions).toMatchObject({
            starts: 1,
            completions: 1,
        });
        expect(dashboard.ai).toMatchObject({
            requests: 2,
            errors: 1,
        });
        expect(alerts).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: "ai_latency_spike",
                triggered: true,
            }),
        ]));

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.dashboard).toMatchObject({
            invites: {
                createSuccesses: 1,
                sendSuccesses: 2,
            },
            sessions: {
                starts: 1,
                completions: 1,
            },
        });
        expect(body.sloSummary.aiReliability.overall).toMatchObject({
            successCount: 2,
            errorCount: 1,
            totalCount: 3,
        });
        expect(body.alerts).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: "ai_latency_spike",
                triggered: true,
            }),
        ]));
    });
});
