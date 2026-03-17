type MetricTagValue = string | number | boolean | undefined;
export type MetricTags = Record<string, MetricTagValue>;

type CounterMetric = {
    name: string;
    tags: Record<string, string>;
    value: number;
};

type TimingMetric = {
    name: string;
    tags: Record<string, string>;
    count: number;
    totalMs: number;
    minMs: number;
    maxMs: number;
    avgMs: number;
};

type MetricsState = {
    counters: Map<string, CounterMetric>;
    timings: Map<string, Omit<TimingMetric, "avgMs">>;
};

export type MetricsSnapshot = {
    generatedAt: string;
    counters: CounterMetric[];
    timings: TimingMetric[];
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

export function incrementMetric(name: string, tags: MetricTags = {}, value = 1) {
    const state = getMetricsState();
    const normalizedTags = normalizeTags(tags);
    const key = metricKey(name, normalizedTags);
    const existing = state.counters.get(key);

    if (existing) {
        existing.value += value;
        return;
    }

    state.counters.set(key, {
        name,
        tags: normalizedTags,
        value
    });
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
        return;
    }

    state.timings.set(key, {
        name,
        tags: normalizedTags,
        count: 1,
        totalMs: durationMs,
        minMs: durationMs,
        maxMs: durationMs
    });
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
            }),
            avgLatencyMs: metric.avgMs,
            maxLatencyMs: metric.maxMs
        }))
        .sort((left, right) => left.operation.localeCompare(right.operation));

    return {
        generatedAt: snapshot.generatedAt,
        invites: {
            createSuccesses: counterValue(snapshot, "recruiter_invite_create_total", { outcome: "success" }),
            createFailures: counterValue(snapshot, "recruiter_invite_create_total", { outcome: "error" }),
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
            errors: counterValue(snapshot, "ai_requests_total", { outcome: "error" }),
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
