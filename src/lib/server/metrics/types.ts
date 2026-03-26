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

