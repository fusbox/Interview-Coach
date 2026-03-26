import { getDurableMetricsBackend } from "@/lib/server/metrics/backend";
import type {
    CounterMetric,
    MetricTags,
    MetricTagValue,
    MetricsSnapshot,
    TimingMetric
} from "@/lib/server/metrics/types";

type MetricsState = {
    counters: Map<string, CounterMetric>;
    timings: Map<string, Omit<TimingMetric, "avgMs">>;
};

type OperationsDashboard = {
    generatedAt: string;
    invites: {
        createSuccesses: number;
        createFailures: number;
        sendSuccesses: number;
        sendFailures: number;
    };
    sessions: {
        starts: number;
        repeatStarts: number;
        completions: number;
    };
    ai: {
        requests: number;
        errors: number;
        operations: Array<{
            operation: string;
            requests: number;
            errors: number;
            avgLatencyMs: number;
            maxLatencyMs: number;
        }>;
    };
    security: {
        authDenials: number;
        rateLimitDenials: number;
    };
};

declare global {
    // eslint-disable-next-line no-var
    var __interviewCoachMetrics__: MetricsState | undefined;
}

function getMetricsState(): MetricsState {
    if (!globalThis.__interviewCoachMetrics__) {
        globalThis.__interviewCoachMetrics__ = {
            counters: new Map(),
            timings: new Map()
        };
    }

    return globalThis.__interviewCoachMetrics__;
}

function normalizeTags(tags: MetricTags = {}): Record<string, string> {
    return Object.fromEntries(
        Object.entries(tags)
            .filter(([, value]) => value !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, value]) => [key, String(value)])
    );
}

function metricKey(name: string, tags: Record<string, string>) {
    return `${name}::${JSON.stringify(tags)}`;
}

function writeDurableCounter(name: string, value: number, tags: Record<string, string>) {
    const backend = getDurableMetricsBackend();
    if (!backend) {
        return;
    }

    const recordedAt = new Date().toISOString();
    void backend.writeCounter({
        name,
        value,
        tags,
        tagsKey: metricKey(name, tags),
        recordedAt
    }).catch(() => undefined);
}

function writeDurableTiming(name: string, durationMs: number, tags: Record<string, string>) {
    const backend = getDurableMetricsBackend();
    if (!backend) {
        return;
    }

    const recordedAt = new Date().toISOString();
    void backend.writeTiming({
        name,
        durationMs,
        tags,
        tagsKey: metricKey(name, tags),
        recordedAt
    }).catch(() => undefined);
}

export function incrementMetric(name: string, tags: MetricTags = {}, value = 1) {
    const state = getMetricsState();
    const normalizedTags = normalizeTags(tags);
    const key = metricKey(name, normalizedTags);
    const existing = state.counters.get(key);

    if (existing) {
        existing.value += value;
    } else {
        state.counters.set(key, {
            name,
            tags: normalizedTags,
            value
        });
    }

    writeDurableCounter(name, value, normalizedTags);
}

export function observeMetric(name: string, durationMs: number, tags: MetricTags = {}) {
    const state = getMetricsState();
    const normalizedTags = normalizeTags(tags);
    const key = metricKey(name, normalizedTags);
    const existing = state.timings.get(key);

    if (existing) {
        existing.count += 1;
        existing.totalMs += durationMs;
        existing.minMs = Math.min(existing.minMs, durationMs);
        existing.maxMs = Math.max(existing.maxMs, durationMs);
    } else {
        state.timings.set(key, {
            name,
            tags: normalizedTags,
            count: 1,
            totalMs: durationMs,
            minMs: durationMs,
            maxMs: durationMs
        });
    }

    writeDurableTiming(name, durationMs, normalizedTags);
}

export function startMetricTimer(name: string, tags: MetricTags = {}) {
    const startedAt = Date.now();
    return (extraTags: MetricTags = {}) => {
        observeMetric(name, Date.now() - startedAt, { ...tags, ...extraTags });
    };
}

export function recordAuthDenial(tags: MetricTags = {}) {
    incrementMetric("auth_denials_total", tags);
}

export function recordRateLimitDenial(tags: MetricTags = {}) {
    incrementMetric("rate_limit_denials_total", tags);
}

export function getMetricsSnapshot(): MetricsSnapshot {
    const state = getMetricsState();

    return {
        generatedAt: new Date().toISOString(),
        counters: Array.from(state.counters.values()).sort((left, right) => left.name.localeCompare(right.name)),
        timings: Array.from(state.timings.values())
            .map((timing) => ({
                ...timing,
                avgMs: timing.count === 0 ? 0 : Number((timing.totalMs / timing.count).toFixed(2))
            }))
            .sort((left, right) => left.name.localeCompare(right.name))
    };
}

export async function getOperationalMetricsSnapshot() {
    const backend = getDurableMetricsBackend();
    if (!backend) {
        return getMetricsSnapshot();
    }

    try {
        return await backend.readSnapshot();
    } catch {
        return getMetricsSnapshot();
    }
}

function counterValue(snapshot: MetricsSnapshot, name: string, filters: Record<string, string> = {}) {
    return snapshot.counters
        .filter((metric) => metric.name === name)
        .filter((metric) => Object.entries(filters).every(([key, value]) => metric.tags[key] === value))
        .reduce((total, metric) => total + metric.value, 0);
}

export function buildOperationsDashboard(snapshot: MetricsSnapshot): OperationsDashboard {
    const aiOperations = snapshot.timings
        .filter((metric) => metric.name === "ai_request_duration_ms")
        .map((metric) => ({
            operation: metric.tags.operation || "unknown",
            requests: counterValue(snapshot, "ai_requests_total", {
                operation: metric.tags.operation || "unknown",
                outcome: "success"
            }) + counterValue(snapshot, "ai_requests_total", {
                operation: metric.tags.operation || "unknown",
                outcome: "mock_fallback"
            }),
            errors: counterValue(snapshot, "ai_requests_total", {
                operation: metric.tags.operation || "unknown",
                outcome: "error"
            }) + counterValue(snapshot, "ai_requests_total", {
                operation: metric.tags.operation || "unknown",
                outcome: "malformed_response"
            }),
            avgLatencyMs: metric.avgMs,
            maxLatencyMs: metric.maxMs
        }))
        .sort((left, right) => left.operation.localeCompare(right.operation));

    return {
        generatedAt: snapshot.generatedAt,
        invites: {
            createSuccesses: counterValue(snapshot, "recruiter_invite_create_total", { outcome: "success" }),
            createFailures: counterValue(snapshot, "recruiter_invite_create_total", { outcome: "error" })
                + counterValue(snapshot, "recruiter_invite_create_total", { outcome: "partial_failure" }),
            sendSuccesses: counterValue(snapshot, "invite_send_total", { outcome: "success" }),
            sendFailures: counterValue(snapshot, "invite_send_total", { outcome: "error" })
        },
        sessions: {
            starts: counterValue(snapshot, "session_start_total", { outcome: "success" }),
            repeatStarts: counterValue(snapshot, "session_start_total", { outcome: "success", mode: "clone" }),
            completions: counterValue(snapshot, "session_completion_total", { outcome: "success" })
        },
        ai: {
            requests: counterValue(snapshot, "ai_requests_total", { outcome: "success" })
                + counterValue(snapshot, "ai_requests_total", { outcome: "mock_fallback" }),
            errors: counterValue(snapshot, "ai_requests_total", { outcome: "error" })
                + counterValue(snapshot, "ai_requests_total", { outcome: "malformed_response" }),
            operations: aiOperations
        },
        security: {
            authDenials: counterValue(snapshot, "auth_denials_total"),
            rateLimitDenials: counterValue(snapshot, "rate_limit_denials_total")
        }
    };
}

export function resetMetrics() {
    globalThis.__interviewCoachMetrics__ = {
        counters: new Map(),
        timings: new Map()
    };
}

export type {
    CounterMetric,
    MetricTags,
    MetricTagValue,
    MetricsSnapshot,
    TimingMetric
} from "@/lib/server/metrics/types";

