import { getOptionalServerEnv } from "@/lib/server/config/server-env";
import type {
    CounterMetric,
    DurableCounterRollup,
    DurableTimingRollup,
    MetricsSnapshot,
    TimingMetric
} from "@/lib/server/metrics/types";

export type MetricsBackendName = "memory" | "supabase";

export interface DurableMetricsBackend {
    writeCounter(params: {
        name: string;
        value: number;
        tags: Record<string, string>;
        tagsKey: string;
        recordedAt: string;
    }): Promise<void>;
    writeTiming(params: {
        name: string;
        durationMs: number;
        tags: Record<string, string>;
        tagsKey: string;
        recordedAt: string;
    }): Promise<void>;
    readSnapshot(options?: { sinceMs?: number }): Promise<MetricsSnapshot>;
}

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

function floorToMinute(date: Date) {
    const copy = new Date(date);
    copy.setUTCSeconds(0, 0);
    return copy;
}

function buildSnapshotFromRollups(
    counters: DurableCounterRollup[],
    timings: DurableTimingRollup[]
): MetricsSnapshot {
    const mappedCounters: CounterMetric[] = counters
        .map((metric) => ({
            name: metric.metric_name,
            tags: metric.tags ?? {},
            value: metric.value
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

    const mappedTimings: TimingMetric[] = timings
        .map((metric) => ({
            name: metric.metric_name,
            tags: metric.tags ?? {},
            count: metric.count,
            totalMs: metric.total_ms,
            minMs: metric.min_ms,
            maxMs: metric.max_ms,
            avgMs: metric.count === 0 ? 0 : Number((metric.total_ms / metric.count).toFixed(2))
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

    return {
        generatedAt: new Date().toISOString(),
        counters: mappedCounters,
        timings: mappedTimings
    };
}

export class SupabaseDurableMetricsBackend implements DurableMetricsBackend {
    async writeCounter(params: {
        name: string;
        value: number;
        tags: Record<string, string>;
        tagsKey: string;
        recordedAt: string;
    }): Promise<void> {
        const { createAdminClient } = await import("@/lib/supabase/server");
        const supabase = createAdminClient();
        const bucketStart = floorToMinute(new Date(params.recordedAt)).toISOString();

        const { error } = await supabase.rpc("record_metric_counter_rollup", {
            p_bucket_start: bucketStart,
            p_metric_name: params.name,
            p_tags: params.tags,
            p_tags_key: params.tagsKey,
            p_value: params.value
        });

        if (error) {
            throw new Error(`Failed to record counter metric: ${error.message}`);
        }
    }

    async writeTiming(params: {
        name: string;
        durationMs: number;
        tags: Record<string, string>;
        tagsKey: string;
        recordedAt: string;
    }): Promise<void> {
        const { createAdminClient } = await import("@/lib/supabase/server");
        const supabase = createAdminClient();
        const bucketStart = floorToMinute(new Date(params.recordedAt)).toISOString();

        const { error } = await supabase.rpc("record_metric_timing_rollup", {
            p_bucket_start: bucketStart,
            p_metric_name: params.name,
            p_tags: params.tags,
            p_tags_key: params.tagsKey,
            p_duration_ms: params.durationMs
        });

        if (error) {
            throw new Error(`Failed to record timing metric: ${error.message}`);
        }
    }

    async readSnapshot(options?: { sinceMs?: number }): Promise<MetricsSnapshot> {
        const { createAdminClient } = await import("@/lib/supabase/server");
        const supabase = createAdminClient();
        const since = new Date(Date.now() - (options?.sinceMs ?? DEFAULT_WINDOW_MS)).toISOString();

        const [
            { data: counterData, error: counterError },
            { data: timingData, error: timingError }
        ] = await Promise.all([
            supabase.rpc("get_metric_counter_rollups", {
                p_since: since
            }),
            supabase.rpc("get_metric_timing_rollups", {
                p_since: since
            })
        ]);

        if (counterError) {
            throw new Error(`Failed to read counter metrics: ${counterError.message}`);
        }
        if (timingError) {
            throw new Error(`Failed to read timing metrics: ${timingError.message}`);
        }

        return buildSnapshotFromRollups(
            Array.isArray(counterData) ? counterData as DurableCounterRollup[] : [],
            Array.isArray(timingData) ? timingData as DurableTimingRollup[] : []
        );
    }
}

let backendInstance: DurableMetricsBackend | null | undefined;

export function getMetricsBackendName(): MetricsBackendName {
    const configured = getOptionalServerEnv("METRICS_BACKEND")?.toLowerCase();
    if (configured === "supabase") {
        return "supabase";
    }
    return "memory";
}

export function getDurableMetricsBackend(): DurableMetricsBackend | null {
    const backendName = getMetricsBackendName();
    if (backendName === "memory") {
        return null;
    }

    if (!backendInstance) {
        backendInstance = new SupabaseDurableMetricsBackend();
    }

    return backendInstance;
}

export function resetDurableMetricsBackendForTests() {
    backendInstance = undefined;
}

export { buildSnapshotFromRollups };

