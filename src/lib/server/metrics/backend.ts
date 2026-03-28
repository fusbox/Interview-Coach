import { getOptionalServerEnv, isProductionServer } from "@/lib/server/config/server-env";
import type {
    CounterMetric,
    DurableCounterRollup,
    DurableTimingRollup,
    MetricsSnapshot,
    OperationalSloSummary,
    SloAiLatencyRow,
    SloAiReliabilityRow,
    SloSessionProgressRow,
    SloSessionStartRow,
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
    readSloSummary(options?: { sinceMs?: number }): Promise<OperationalSloSummary>;
}

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function toFiniteNumber(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
}

function toStringMap(value: unknown): Record<string, string> {
    const record = asRecord(value);
    if (!record) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(record)
            .filter(([, entryValue]) => entryValue !== null && entryValue !== undefined)
            .map(([key, entryValue]) => [key, String(entryValue)])
    );
}

function normalizeCounterRollup(row: unknown): DurableCounterRollup {
    const record = asRecord(row);

    return {
        metric_name: typeof record?.metric_name === "string" ? record.metric_name : "",
        tags_key: typeof record?.tags_key === "string" ? record.tags_key : "",
        tags: toStringMap(record?.tags),
        value: toFiniteNumber(record?.value)
    };
}

function normalizeTimingRollup(row: unknown): DurableTimingRollup {
    const record = asRecord(row);

    return {
        metric_name: typeof record?.metric_name === "string" ? record.metric_name : "",
        tags_key: typeof record?.tags_key === "string" ? record.tags_key : "",
        tags: toStringMap(record?.tags),
        count: toFiniteNumber(record?.count),
        total_ms: toFiniteNumber(record?.total_ms),
        min_ms: toFiniteNumber(record?.min_ms),
        max_ms: toFiniteNumber(record?.max_ms)
    };
}

function normalizeSessionStartRow(row: unknown): SloSessionStartRow | null {
    const record = asRecord(row);
    if (!record) {
        return null;
    }

    return {
        success_count: toFiniteNumber(record.success_count),
        failure_count: toFiniteNumber(record.failure_count),
        total_count: toFiniteNumber(record.total_count),
        success_rate: toFiniteNumber(record.success_rate)
    };
}

function normalizeSessionProgressRow(row: unknown): SloSessionProgressRow | null {
    const record = asRecord(row);
    if (!record) {
        return null;
    }

    return {
        success_count: toFiniteNumber(record.success_count),
        replay_success_count: toFiniteNumber(record.replay_success_count),
        error_count: toFiniteNumber(record.error_count),
        request_in_progress_count: toFiniteNumber(record.request_in_progress_count),
        idempotency_mismatch_count: toFiniteNumber(record.idempotency_mismatch_count),
        invalid_request_count: toFiniteNumber(record.invalid_request_count),
        sli_numerator: toFiniteNumber(record.sli_numerator),
        sli_denominator: toFiniteNumber(record.sli_denominator),
        success_rate: toFiniteNumber(record.success_rate)
    };
}

function normalizeAiReliabilityRow(row: unknown): SloAiReliabilityRow | null {
    const record = asRecord(row);
    if (!record || typeof record.operation !== "string") {
        return null;
    }

    return {
        operation: record.operation,
        success_count: toFiniteNumber(record.success_count),
        error_count: toFiniteNumber(record.error_count),
        malformed_response_count: toFiniteNumber(record.malformed_response_count),
        mock_fallback_count: toFiniteNumber(record.mock_fallback_count),
        total_count: toFiniteNumber(record.total_count),
        success_rate: toFiniteNumber(record.success_rate)
    };
}

function normalizeAiLatencyRow(row: unknown): SloAiLatencyRow | null {
    const record = asRecord(row);
    if (!record || typeof record.operation !== "string") {
        return null;
    }

    return {
        operation: record.operation,
        count: toFiniteNumber(record.count),
        total_ms: toFiniteNumber(record.total_ms),
        min_ms: toFiniteNumber(record.min_ms),
        max_ms: toFiniteNumber(record.max_ms),
        avg_ms: toFiniteNumber(record.avg_ms)
    };
}

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

function percentage(numerator: number, denominator: number) {
    if (denominator <= 0) {
        return 0;
    }
    return Number(((numerator / denominator) * 100).toFixed(2));
}

function buildSloSummaryFromRows(
    since: string,
    sessionStart: SloSessionStartRow | null,
    sessionProgress: SloSessionProgressRow | null,
    aiReliabilityRows: SloAiReliabilityRow[],
    aiLatencyRows: SloAiLatencyRow[]
): OperationalSloSummary {
    const overallAi = aiReliabilityRows.reduce((total, row) => ({
        successCount: total.successCount + row.success_count,
        errorCount: total.errorCount + row.error_count,
        malformedResponseCount: total.malformedResponseCount + row.malformed_response_count,
        mockFallbackCount: total.mockFallbackCount + row.mock_fallback_count,
        totalCount: total.totalCount + row.total_count
    }), {
        successCount: 0,
        errorCount: 0,
        malformedResponseCount: 0,
        mockFallbackCount: 0,
        totalCount: 0
    });

    return {
        generatedAt: new Date().toISOString(),
        since,
        sessionStart: {
            successCount: sessionStart?.success_count ?? 0,
            failureCount: sessionStart?.failure_count ?? 0,
            totalCount: sessionStart?.total_count ?? 0,
            successRate: sessionStart?.success_rate ?? 0
        },
        sessionProgress: {
            successCount: sessionProgress?.success_count ?? 0,
            replaySuccessCount: sessionProgress?.replay_success_count ?? 0,
            errorCount: sessionProgress?.error_count ?? 0,
            requestInProgressCount: sessionProgress?.request_in_progress_count ?? 0,
            idempotencyMismatchCount: sessionProgress?.idempotency_mismatch_count ?? 0,
            invalidRequestCount: sessionProgress?.invalid_request_count ?? 0,
            sliNumerator: sessionProgress?.sli_numerator ?? 0,
            sliDenominator: sessionProgress?.sli_denominator ?? 0,
            successRate: sessionProgress?.success_rate ?? 0
        },
        aiReliability: {
            overall: {
                ...overallAi,
                successRate: percentage(overallAi.successCount, overallAi.totalCount)
            },
            operations: aiReliabilityRows.map((row) => ({
                operation: row.operation,
                successCount: row.success_count,
                errorCount: row.error_count,
                malformedResponseCount: row.malformed_response_count,
                mockFallbackCount: row.mock_fallback_count,
                totalCount: row.total_count,
                successRate: row.success_rate
            }))
        },
        aiLatency: {
            operations: aiLatencyRows.map((row) => ({
                operation: row.operation,
                count: row.count,
                totalMs: row.total_ms,
                minMs: row.min_ms,
                maxMs: row.max_ms,
                avgMs: row.avg_ms
            }))
        }
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
            Array.isArray(counterData) ? counterData.map(normalizeCounterRollup) : [],
            Array.isArray(timingData) ? timingData.map(normalizeTimingRollup) : []
        );
    }

    async readSloSummary(options?: { sinceMs?: number }): Promise<OperationalSloSummary> {
        const { createAdminClient } = await import("@/lib/supabase/server");
        const supabase = createAdminClient();
        const since = new Date(Date.now() - (options?.sinceMs ?? DEFAULT_WINDOW_MS)).toISOString();

        const [
            { data: sessionStartData, error: sessionStartError },
            { data: sessionProgressData, error: sessionProgressError },
            { data: aiReliabilityData, error: aiReliabilityError },
            { data: aiLatencyData, error: aiLatencyError }
        ] = await Promise.all([
            supabase.rpc("get_slo_session_start", { p_since: since }),
            supabase.rpc("get_slo_session_progress", { p_since: since }),
            supabase.rpc("get_slo_ai_reliability", { p_since: since }),
            supabase.rpc("get_slo_ai_latency", { p_since: since })
        ]);

        if (sessionStartError) {
            throw new Error(`Failed to read session start SLO summary: ${sessionStartError.message}`);
        }
        if (sessionProgressError) {
            throw new Error(`Failed to read session progress SLO summary: ${sessionProgressError.message}`);
        }
        if (aiReliabilityError) {
            throw new Error(`Failed to read AI reliability SLO summary: ${aiReliabilityError.message}`);
        }
        if (aiLatencyError) {
            throw new Error(`Failed to read AI latency SLO summary: ${aiLatencyError.message}`);
        }

        return buildSloSummaryFromRows(
            since,
            Array.isArray(sessionStartData) ? normalizeSessionStartRow(sessionStartData[0]) : null,
            Array.isArray(sessionProgressData) ? normalizeSessionProgressRow(sessionProgressData[0]) : null,
            Array.isArray(aiReliabilityData)
                ? aiReliabilityData.map(normalizeAiReliabilityRow).filter((row): row is SloAiReliabilityRow => row !== null)
                : [],
            Array.isArray(aiLatencyData)
                ? aiLatencyData.map(normalizeAiLatencyRow).filter((row): row is SloAiLatencyRow => row !== null)
                : []
        );
    }
}

let backendInstance: DurableMetricsBackend | null | undefined;

export function getMetricsBackendName(): MetricsBackendName {
    const configured = getOptionalServerEnv("METRICS_BACKEND")?.toLowerCase();
    if (configured && configured !== "memory" && configured !== "supabase") {
        throw new Error(`Unsupported METRICS_BACKEND value "${configured}". Expected "memory" or "supabase".`);
    }

    if (configured === "supabase") {
        return "supabase";
    }

    if (isProductionServer()) {
        if (!configured) {
            throw new Error("[ServerEnv] Missing required environment variable METRICS_BACKEND for durable metrics backend.");
        }

        throw new Error('METRICS_BACKEND must be set to "supabase" in production.');
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

export {
    buildSnapshotFromRollups,
    buildSloSummaryFromRows,
    normalizeAiLatencyRow,
    normalizeAiReliabilityRow,
    normalizeCounterRollup,
    normalizeSessionProgressRow,
    normalizeSessionStartRow,
    normalizeTimingRollup
};
