import type { AiGenerationListFilters, AiGenerationListItem } from "./ai-generation-read-repository";

const CSV_COLUMNS: Array<keyof AiGenerationListItem> = [
    "generation_id",
    "app_name",
    "surface",
    "status",
    "input_snapshot",
    "context_artifacts",
    "prompt_snapshot",
    "prompt_version",
    "model_provider",
    "model_name",
    "model_params",
    "raw_output",
    "parsed_output",
    "latency_ms",
    "token_usage",
    "cost_estimate",
    "trace_id",
    "correlation_id",
    "source_refs",
    "created_by",
    "session_id",
    "invite_batch_id",
    "candidate_id",
    "error_json",
    "privacy_flags",
    "redaction_status",
    "retention_class",
    "retention_until",
    "created_at",
];

export type AiGenerationExportFormat = "csv" | "json";

export type AiGenerationExportPayload = {
    exported_at: string;
    filters: {
        surface?: string;
        status?: string;
        search?: string;
        limit: number;
    };
    count: number;
    records: AiGenerationListItem[];
};

function stringifyCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
}

function escapeCsvCell(value: unknown): string {
    const stringValue = stringifyCell(value);
    const safeValue = /^[=+\-@]/.test(stringValue)
        ? `'${stringValue}`
        : stringValue;

    return `"${safeValue.replace(/"/g, '""')}"`;
}

export function buildAiGenerationExportPayload(params: {
    records: AiGenerationListItem[];
    filters: AiGenerationListFilters;
    exportedAt?: string;
}): AiGenerationExportPayload {
    return {
        exported_at: params.exportedAt ?? new Date().toISOString(),
        filters: {
            surface: params.filters.surface,
            status: params.filters.status,
            search: params.filters.search,
            limit: params.filters.limit ?? 100,
        },
        count: params.records.length,
        records: params.records,
    };
}

export function formatAiGenerationsCsv(records: AiGenerationListItem[]): string {
    const header = CSV_COLUMNS.map(escapeCsvCell).join(",");
    const rows = records.map((record) => (
        CSV_COLUMNS.map((column) => escapeCsvCell(record[column])).join(",")
    ));

    return [header, ...rows].join("\r\n");
}

export function buildAiGenerationExportFilename(params: {
    format: AiGenerationExportFormat;
    surface?: string;
    status?: string;
    exportedAt?: string;
}) {
    const timestamp = (params.exportedAt ?? new Date().toISOString())
        .replace(/[:.]/g, "-");
    const parts = [
        "ai-generations",
        params.surface ?? "all-surfaces",
        params.status ?? "all-statuses",
        timestamp,
    ];

    return `${parts.join("_")}.${params.format}`;
}
