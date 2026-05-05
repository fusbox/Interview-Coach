import { createAdminClient } from "@/lib/supabase/server";
import type {
    AiGenerationRedactionStatus,
    AiGenerationRetentionClass,
    AiGenerationStatus,
    AiGenerationSurface,
} from "./types";

const AI_GENERATION_SELECT = `
    generation_id,
    app_name,
    surface,
    status,
    input_snapshot,
    context_artifacts,
    prompt_snapshot,
    prompt_version,
    model_provider,
    model_name,
    model_params,
    raw_output,
    parsed_output,
    latency_ms,
    token_usage,
    cost_estimate,
    trace_id,
    correlation_id,
    source_refs,
    created_by,
    session_id,
    invite_batch_id,
    candidate_id,
    error_json,
    privacy_flags,
    redaction_status,
    retention_class,
    retention_until,
    created_at
`;

export type AiGenerationListFilters = {
    surface?: AiGenerationSurface;
    status?: AiGenerationStatus;
    search?: string;
    limit?: number;
    maxLimit?: number;
};

export type AiGenerationPageFilters = AiGenerationListFilters & {
    page?: number;
    pageSize?: number;
};

export type AiGenerationPage = {
    records: AiGenerationListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export type AiGenerationSummary = {
    total: number;
    success: number;
    partial: number;
    failed: number;
    averageLatencyMs: number;
};

export type AiGenerationListItem = {
    generation_id: string;
    app_name: string;
    surface: AiGenerationSurface;
    status: AiGenerationStatus;
    input_snapshot: unknown;
    context_artifacts: unknown[];
    prompt_snapshot: unknown | null;
    prompt_version: string;
    model_provider: string;
    model_name: string;
    model_params: Record<string, unknown>;
    raw_output: unknown | null;
    parsed_output: unknown | null;
    latency_ms: number;
    token_usage: Record<string, unknown> | null;
    cost_estimate: number | string | null;
    trace_id: string | null;
    correlation_id: string | null;
    source_refs: unknown[];
    created_by: string | null;
    session_id: string | null;
    invite_batch_id: string | null;
    candidate_id: string | null;
    error_json: unknown | null;
    privacy_flags: string[];
    redaction_status: AiGenerationRedactionStatus;
    retention_class: AiGenerationRetentionClass;
    retention_until: string | null;
    created_at: string;
};

export class SupabaseAiGenerationReadRepository {
    async listRecent(filters: AiGenerationListFilters = {}): Promise<AiGenerationListItem[]> {
        const supabase = createAdminClient();
        const maxLimit = Math.max(filters.maxLimit ?? 250, 1);
        const limit = Math.min(Math.max(filters.limit ?? 100, 1), maxLimit);

        let query = supabase
            .from("ai_generations")
            .select(AI_GENERATION_SELECT);

        query = applyFilters(query, filters);

        const { data, error } = await query
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Supabase AI Generation Read Error: ${error.message}`);
        }

        return (data ?? []) as AiGenerationListItem[];
    }

    async listPage(filters: AiGenerationPageFilters = {}): Promise<AiGenerationPage> {
        const supabase = createAdminClient();
        const pageSize = Math.min(Math.max(filters.pageSize ?? filters.limit ?? 25, 1), 100);
        const page = Math.max(filters.page ?? 1, 1);
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from("ai_generations")
            .select(AI_GENERATION_SELECT, { count: "exact" });

        query = applyFilters(query, filters);

        const { data, error, count } = await query
            .order("created_at", { ascending: false })
            .range(from, to);

        if (error) {
            throw new Error(`Supabase AI Generation Read Error: ${error.message}`);
        }

        const total = count ?? 0;

        return {
            records: (data ?? []) as AiGenerationListItem[],
            total,
            page,
            pageSize,
            totalPages: Math.max(Math.ceil(total / pageSize), 1),
        };
    }

    async getSummary(filters: AiGenerationListFilters = {}): Promise<AiGenerationSummary> {
        const supabase = createAdminClient();
        const { data, error } = await supabase.rpc("get_ai_generation_summary", {
            p_surface: filters.surface ?? null,
            p_status: filters.status ?? null,
            p_search: filters.search ?? null,
        });

        if (!error) {
            const summary = Array.isArray(data) ? data[0] : data;
            return {
                total: Number(summary?.total_count ?? 0),
                success: Number(summary?.success_count ?? 0),
                partial: Number(summary?.partial_count ?? 0),
                failed: Number(summary?.failed_count ?? 0),
                averageLatencyMs: Math.round(Number(summary?.average_latency_ms ?? 0)),
            };
        }

        if (isMissingSummaryFunctionError(error)) {
            return this.getSummaryFallback(filters);
        }

        throw new Error(`Supabase AI Generation Summary Error: ${error.message}`);
    }

    async findById(generationId: string): Promise<AiGenerationListItem | null> {
        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from("ai_generations")
            .select(AI_GENERATION_SELECT)
            .eq("generation_id", generationId)
            .maybeSingle();

        if (error) {
            throw new Error(`Supabase AI Generation Read Error: ${error.message}`);
        }

        return data as AiGenerationListItem | null;
    }

    private async getSummaryFallback(filters: AiGenerationListFilters): Promise<AiGenerationSummary> {
        const [total, success, partial, failed, averageLatencyMs] = await Promise.all([
            this.countRecords(filters),
            filters.status && filters.status !== "success" ? Promise.resolve(0) : this.countRecords({ ...filters, status: "success" }),
            filters.status && filters.status !== "partial" ? Promise.resolve(0) : this.countRecords({ ...filters, status: "partial" }),
            filters.status && filters.status !== "failed" ? Promise.resolve(0) : this.countRecords({ ...filters, status: "failed" }),
            this.averageLatencyFallback(filters),
        ]);

        return {
            total,
            success,
            partial,
            failed,
            averageLatencyMs,
        };
    }

    private async countRecords(filters: AiGenerationListFilters): Promise<number> {
        const supabase = createAdminClient();
        let query = supabase
            .from("ai_generations")
            .select("generation_id", { count: "exact", head: true });

        query = applyFilters(query, filters);

        const { error, count } = await query.limit(0);

        if (error) {
            throw new Error(`Supabase AI Generation Summary Error: ${error.message}`);
        }

        return count ?? 0;
    }

    private async averageLatencyFallback(filters: AiGenerationListFilters): Promise<number> {
        const supabase = createAdminClient();
        let query = supabase
            .from("ai_generations")
            .select("latency_ms");

        query = applyFilters(query, filters);

        const { data, error } = await query.limit(1000);

        if (error) {
            throw new Error(`Supabase AI Generation Summary Error: ${error.message}`);
        }

        const values = (data ?? [])
            .map((row: { latency_ms?: unknown }) => Number(row.latency_ms))
            .filter((value) => Number.isFinite(value));

        if (values.length === 0) return 0;

        return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    }
}

type FilterableQuery<T> = {
    eq(column: string, value: string): T;
    or(filters: string): T;
};

function applyFilters<T extends FilterableQuery<T>>(query: T, filters: AiGenerationListFilters): T {
    let filteredQuery = query;

    if (filters.surface) {
        filteredQuery = filteredQuery.eq("surface", filters.surface);
    }

    if (filters.status) {
        filteredQuery = filteredQuery.eq("status", filters.status);
    }

    const searchClauses = buildSearchClauses(filters.search);
    if (searchClauses.length > 0) {
        filteredQuery = filteredQuery.or(searchClauses.join(","));
    }

    return filteredQuery;
}

function buildSearchClauses(search?: string): string[] {
    const normalized = search?.trim();
    if (!normalized) return [];

    const safeSearch = normalized
        .replace(/[%_]/g, "")
        .replace(/[(),]/g, " ")
        .trim();

    if (!safeSearch) return [];

    const pattern = `%${safeSearch}%`;
    const clauses = [
        `app_name.ilike.${pattern}`,
        `surface.ilike.${pattern}`,
        `status.ilike.${pattern}`,
        `prompt_version.ilike.${pattern}`,
        `model_provider.ilike.${pattern}`,
        `model_name.ilike.${pattern}`,
        `trace_id.ilike.${pattern}`,
        `correlation_id.ilike.${pattern}`,
        `candidate_id.ilike.${pattern}`,
        `redaction_status.ilike.${pattern}`,
        `retention_class.ilike.${pattern}`,
    ];

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeSearch)) {
        clauses.push(
            `generation_id.eq.${safeSearch}`,
            `created_by.eq.${safeSearch}`,
            `session_id.eq.${safeSearch}`,
            `invite_batch_id.eq.${safeSearch}`,
        );
    }

    return clauses;
}

function isMissingSummaryFunctionError(error: { code?: string; message?: string }) {
    return error.code === "PGRST202"
        || error.code === "42883"
        || Boolean(error.message?.includes("get_ai_generation_summary"));
}
