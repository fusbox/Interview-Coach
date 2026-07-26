import { createHash } from "node:crypto";

export const AI_EVAL_SCENARIO_RETENTION_OPERATION_VERSION =
    "ai_eval_scenario_retention_operation_v1" as const;

export type AiEvalScenarioRetentionQueryClient = {
    query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export type AiEvalScenarioRetentionRequest = {
    requestKey: string;
    cutoffAt: string;
    batchLimit: number;
    workerId: string;
    apply: boolean;
};

export type AiEvalScenarioRetentionResult = {
    operationId: string;
    requestKey: string;
    requestFingerprint: string;
    operationMode: "dry_run" | "apply";
    cutoffAt: string;
    batchLimit: number;
    workerId: string;
    eligibleRunCount: number;
    selectedRunCount: number;
    selectedCaseCount: number;
    selectedLayerCount: number;
    selectedLiveOperationCount: number;
    deletedRunCount: number;
    deletedCaseCount: number;
    deletedLayerCount: number;
    deletedLiveOperationCount: number;
    remainingExpiredRunCount: number;
    completedAt: string;
};

export function createAiEvalScenarioRetentionRequestFingerprint(
    input: Omit<AiEvalScenarioRetentionRequest, "requestKey">,
) {
    const normalized = normalizeRetentionRequest({ ...input, requestKey: ZERO_UUID });
    return createHash("sha256").update(JSON.stringify({
        version: AI_EVAL_SCENARIO_RETENTION_OPERATION_VERSION,
        operationMode: normalized.apply ? "apply" : "dry_run",
        cutoffAt: normalized.cutoffAt,
        batchLimit: normalized.batchLimit,
    })).digest("hex");
}

export async function readAiEvalScenarioRetentionDatabaseClock(
    client: AiEvalScenarioRetentionQueryClient,
) {
    const result = await client.query(`
        select to_char(
          clock_timestamp() at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
        ) as database_clock
    `);
    const value = readString(result.rows[0]?.database_clock);
    if (!value || Number.isNaN(Date.parse(value))) {
        throw new Error("AI_EVAL_RETENTION_DATABASE_CLOCK_INVALID");
    }
    return new Date(value).toISOString();
}

export async function executeAiEvalScenarioRetention(
    client: AiEvalScenarioRetentionQueryClient,
    input: AiEvalScenarioRetentionRequest,
) {
    const normalized = normalizeRetentionRequest(input);
    const requestFingerprint = createAiEvalScenarioRetentionRequestFingerprint(normalized);
    const result = await client.query(`
        select
          operation.ai_eval_scenario_retention_operation_id,
          operation.request_key,
          operation.request_fingerprint,
          operation.operation_mode,
          to_char(operation.cutoff_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cutoff_at,
          operation.batch_limit,
          operation.worker_id,
          operation.eligible_run_count,
          operation.selected_run_count,
          operation.selected_case_count,
          operation.selected_layer_count,
          operation.selected_live_operation_count,
          operation.deleted_run_count,
          operation.deleted_case_count,
          operation.deleted_layer_count,
          operation.deleted_live_operation_count,
          operation.remaining_expired_run_count,
          to_char(operation.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as completed_at
        from public.cleanup_expired_ai_eval_scenario_runs($1, $2, $3, $4, $5, $6) operation
    `, [
        normalized.requestKey,
        requestFingerprint,
        normalized.workerId,
        normalized.cutoffAt,
        normalized.batchLimit,
        normalized.apply,
    ]);
    return mapRetentionResult(result.rows[0]);
}

function normalizeRetentionRequest(input: AiEvalScenarioRetentionRequest) {
    if (!UUID_PATTERN.test(input.requestKey)) {
        throw new Error("AI_EVAL_RETENTION_REQUEST_KEY_INVALID");
    }
    const cutoffTime = Date.parse(input.cutoffAt);
    if (Number.isNaN(cutoffTime)) {
        throw new Error("AI_EVAL_RETENTION_CUTOFF_INVALID");
    }
    if (!Number.isInteger(input.batchLimit) || input.batchLimit < 1 || input.batchLimit > 500) {
        throw new Error("AI_EVAL_RETENTION_BATCH_LIMIT_INVALID");
    }
    const workerId = input.workerId.trim();
    if (workerId.length < 1 || workerId.length > 200) {
        throw new Error("AI_EVAL_RETENTION_WORKER_ID_INVALID");
    }
    return {
        ...input,
        cutoffAt: new Date(cutoffTime).toISOString(),
        workerId,
    };
}

function mapRetentionResult(row: Record<string, unknown> | undefined): AiEvalScenarioRetentionResult {
    if (!row) throw new Error("AI_EVAL_RETENTION_RESULT_MISSING");
    const operationMode = row.operation_mode === "apply"
        ? "apply" as const
        : row.operation_mode === "dry_run"
            ? "dry_run" as const
            : null;
    if (!operationMode) throw new Error("AI_EVAL_RETENTION_RESULT_INVALID");
    return {
        operationId: readRequiredString(row.ai_eval_scenario_retention_operation_id),
        requestKey: readRequiredString(row.request_key),
        requestFingerprint: readRequiredString(row.request_fingerprint),
        operationMode,
        cutoffAt: readRequiredString(row.cutoff_at),
        batchLimit: readNumber(row.batch_limit),
        workerId: readRequiredString(row.worker_id),
        eligibleRunCount: readNumber(row.eligible_run_count),
        selectedRunCount: readNumber(row.selected_run_count),
        selectedCaseCount: readNumber(row.selected_case_count),
        selectedLayerCount: readNumber(row.selected_layer_count),
        selectedLiveOperationCount: readNumber(row.selected_live_operation_count),
        deletedRunCount: readNumber(row.deleted_run_count),
        deletedCaseCount: readNumber(row.deleted_case_count),
        deletedLayerCount: readNumber(row.deleted_layer_count),
        deletedLiveOperationCount: readNumber(row.deleted_live_operation_count),
        remainingExpiredRunCount: readNumber(row.remaining_expired_run_count),
        completedAt: readRequiredString(row.completed_at),
    };
}

function readString(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    return typeof value === "string" ? value : "";
}

function readRequiredString(value: unknown) {
    const result = readString(value);
    if (!result) throw new Error("AI_EVAL_RETENTION_RESULT_INVALID");
    return result;
}

function readNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    throw new Error("AI_EVAL_RETENTION_RESULT_INVALID");
}

const ZERO_UUID = "00000000-0000-4000-8000-000000000000";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
