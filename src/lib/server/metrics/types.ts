export type MetricTagValue = string | number | boolean | undefined;
export type MetricTags = Record<string, MetricTagValue>;

export type CounterMetric = {
    name: string;
    tags: Record<string, string>;
    value: number;
};

export type TimingMetric = {
    name: string;
    tags: Record<string, string>;
    count: number;
    totalMs: number;
    minMs: number;
    maxMs: number;
    avgMs: number;
};

export type MetricsSnapshot = {
    generatedAt: string;
    counters: CounterMetric[];
    timings: TimingMetric[];
};

export type DurableCounterRollup = {
    metric_name: string;
    tags_key: string;
    tags: Record<string, string> | null;
    value: number;
};

export type DurableTimingRollup = {
    metric_name: string;
    tags_key: string;
    tags: Record<string, string> | null;
    count: number;
    total_ms: number;
    min_ms: number;
    max_ms: number;
};

export type SloSessionStartRow = {
    success_count: number;
    failure_count: number;
    total_count: number;
    success_rate: number;
};

export type SloSessionProgressRow = {
    success_count: number;
    replay_success_count: number;
    error_count: number;
    request_in_progress_count: number;
    idempotency_mismatch_count: number;
    invalid_request_count: number;
    sli_numerator: number;
    sli_denominator: number;
    success_rate: number;
};

export type SloAiReliabilityRow = {
    operation: string;
    success_count: number;
    error_count: number;
    malformed_response_count: number;
    mock_fallback_count: number;
    total_count: number;
    success_rate: number;
};

export type SloAiLatencyRow = {
    operation: string;
    count: number;
    total_ms: number;
    min_ms: number;
    max_ms: number;
    avg_ms: number;
};

export type OperationalSloSummary = {
    generatedAt: string;
    since: string;
    sessionStart: {
        successCount: number;
        failureCount: number;
        totalCount: number;
        successRate: number;
    };
    sessionProgress: {
        successCount: number;
        replaySuccessCount: number;
        errorCount: number;
        requestInProgressCount: number;
        idempotencyMismatchCount: number;
        invalidRequestCount: number;
        sliNumerator: number;
        sliDenominator: number;
        successRate: number;
    };
    aiReliability: {
        overall: {
            successCount: number;
            errorCount: number;
            malformedResponseCount: number;
            mockFallbackCount: number;
            totalCount: number;
            successRate: number;
        };
        operations: Array<{
            operation: string;
            successCount: number;
            errorCount: number;
            malformedResponseCount: number;
            mockFallbackCount: number;
            totalCount: number;
            successRate: number;
        }>;
    };
    aiLatency: {
        operations: Array<{
            operation: string;
            count: number;
            totalMs: number;
            minMs: number;
            maxMs: number;
            avgMs: number;
        }>;
    };
};
