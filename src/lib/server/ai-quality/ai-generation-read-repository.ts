import type { Pool, QueryResultRow } from "pg";
import { createAdminClient } from "@/lib/supabase/server";
import { getOptionalServerEnv } from "@/lib/server/config/server-env";
import { getPostgresPool } from "@/lib/server/db/postgres";
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

type AiGenerationReadRepositoryBackend = "supabase" | "postgres";

export interface AiGenerationReadRepository {
    listRecent(filters?: AiGenerationListFilters): Promise<AiGenerationListItem[]>;
    listPage(filters?: AiGenerationPageFilters): Promise<AiGenerationPage>;
    getSummary(filters?: AiGenerationListFilters): Promise<AiGenerationSummary>;
    findById(generationId: string): Promise<AiGenerationListItem | null>;
}

export function getAiGenerationReadRepositoryBackend(): AiGenerationReadRepositoryBackend {
    const configured = getOptionalServerEnv("AI_GENERATION_REPOSITORY_BACKEND")?.toLowerCase();
    if (!configured) {
        return "supabase";
    }

    if (configured === "supabase" || configured === "postgres") {
        return configured;
    }

    throw new Error(`Unsupported AI_GENERATION_REPOSITORY_BACKEND value "${configured}". Expected "supabase" or "postgres".`);
}

export function createAiGenerationReadRepository(): AiGenerationReadRepository {
    const backend = getAiGenerationReadRepositoryBackend();

    if (backend === "postgres") {
        return new PostgresAiGenerationReadRepository();
    }

    return new SupabaseAiGenerationReadRepository();
}

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

type AiGenerationRow = QueryResultRow & {
    generation_id: string;
    app_name: string;
    surface: AiGenerationSurface;
    status: AiGenerationStatus;
    input_snapshot: unknown;
    context_artifacts: unknown;
    prompt_snapshot: unknown | null;
    prompt_version: string;
    model_provider: string;
    model_name: string;
    model_params: unknown;
    raw_output: unknown | null;
    parsed_output: unknown | null;
    latency_ms: number | string;
    token_usage: unknown | null;
    cost_estimate: number | string | null;
    trace_id: string | null;
    correlation_id: string | null;
    source_refs: unknown;
    created_by: string | null;
    session_id: string | null;
    invite_batch_id: string | null;
    candidate_id: string | null;
    error_json: unknown | null;
    privacy_flags: string[] | null;
    redaction_status: AiGenerationRedactionStatus;
    retention_class: AiGenerationRetentionClass;
    retention_until: string | Date | null;
    created_at: string | Date;
};

export class PostgresAiGenerationReadRepository implements AiGenerationReadRepository {
    constructor(private readonly pool: Pool = getPostgresPool()) {}

    async listRecent(filters: AiGenerationListFilters = {}): Promise<AiGenerationListItem[]> {
        const maxLimit = Math.max(filters.maxLimit ?? 250, 1);
        const limit = Math.min(Math.max(filters.limit ?? 100, 1), maxLimit);
        const where = buildPostgresFilter(filters);
        const result = await this.pool.query<AiGenerationRow>(
            `
                select ${AI_GENERATION_SELECT}
                from public.ai_generations
                ${where.sql}
                order by created_at desc
                limit $${where.values.length + 1}
            `,
            [...where.values, limit]
        );

        return result.rows.map(mapPostgresRow);
    }

    async listPage(filters: AiGenerationPageFilters = {}): Promise<AiGenerationPage> {
        const pageSize = Math.min(Math.max(filters.pageSize ?? filters.limit ?? 25, 1), 100);
        const page = Math.max(filters.page ?? 1, 1);
        const offset = (page - 1) * pageSize;
        const where = buildPostgresFilter(filters);
        const [recordsResult, countResult] = await Promise.all([
            this.pool.query<AiGenerationRow>(
                `
                    select ${AI_GENERATION_SELECT}
                    from public.ai_generations
                    ${where.sql}
                    order by created_at desc
                    limit $${where.values.length + 1}
                    offset $${where.values.length + 2}
                `,
                [...where.values, pageSize, offset]
            ),
            this.pool.query<{ total: string | number }>(
                `
                    select count(*)::bigint as total
                    from public.ai_generations
                    ${where.sql}
                `,
                where.values
            )
        ]);
        const total = Number(countResult.rows[0]?.total ?? 0);

        return {
            records: recordsResult.rows.map(mapPostgresRow),
            total,
            page,
            pageSize,
            totalPages: Math.max(Math.ceil(total / pageSize), 1),
        };
    }

    async getSummary(filters: AiGenerationListFilters = {}): Promise<AiGenerationSummary> {
        const where = buildPostgresFilter(filters);
        const result = await this.pool.query<{
            total_count: string | number;
            success_count: string | number;
            partial_count: string | number;
            failed_count: string | number;
            average_latency_ms: string | number | null;
        }>(
            `
                select
                    count(*)::bigint as total_count,
                    count(*) filter (where status = 'success')::bigint as success_count,
                    count(*) filter (where status = 'partial')::bigint as partial_count,
                    count(*) filter (where status = 'failed')::bigint as failed_count,
                    avg(latency_ms)::numeric as average_latency_ms
                from public.ai_generations
                ${where.sql}
            `,
            where.values
        );
        const summary = result.rows[0];

        return {
            total: Number(summary?.total_count ?? 0),
            success: Number(summary?.success_count ?? 0),
            partial: Number(summary?.partial_count ?? 0),
            failed: Number(summary?.failed_count ?? 0),
            averageLatencyMs: Math.round(Number(summary?.average_latency_ms ?? 0)),
        };
    }

    async findById(generationId: string): Promise<AiGenerationListItem | null> {
        const result = await this.pool.query<AiGenerationRow>(
            `
                select ${AI_GENERATION_SELECT}
                from public.ai_generations
                where generation_id = $1
            `,
            [generationId]
        );

        return result.rows[0] ? mapPostgresRow(result.rows[0]) : null;
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

function buildPostgresFilter(filters: AiGenerationListFilters): { sql: string; values: unknown[] } {
    const clauses: string[] = [];
    const values: unknown[] = [];

    if (filters.surface) {
        values.push(filters.surface);
        clauses.push(`surface = $${values.length}`);
    }

    if (filters.status) {
        values.push(filters.status);
        clauses.push(`status = $${values.length}`);
    }

    const normalizedSearch = normalizeSearch(filters.search);
    if (normalizedSearch) {
        values.push(`%${normalizedSearch}%`);
        const placeholder = `$${values.length}`;
        clauses.push(`(
            generation_id::text ilike ${placeholder}
            or app_name ilike ${placeholder}
            or surface ilike ${placeholder}
            or status ilike ${placeholder}
            or prompt_version ilike ${placeholder}
            or model_provider ilike ${placeholder}
            or model_name ilike ${placeholder}
            or coalesce(trace_id, '') ilike ${placeholder}
            or coalesce(correlation_id, '') ilike ${placeholder}
            or coalesce(created_by::text, '') ilike ${placeholder}
            or coalesce(session_id::text, '') ilike ${placeholder}
            or coalesce(invite_batch_id::text, '') ilike ${placeholder}
            or coalesce(candidate_id, '') ilike ${placeholder}
            or redaction_status ilike ${placeholder}
            or retention_class ilike ${placeholder}
        )`);
    }

    return {
        sql: clauses.length > 0 ? `where ${clauses.join(" and ")}` : "",
        values,
    };
}

function normalizeSearch(search?: string): string | undefined {
    const normalized = search?.trim();
    if (!normalized) return undefined;

    const safeSearch = normalized
        .replace(/[%_]/g, "")
        .replace(/[(),]/g, " ")
        .trim();

    return safeSearch || undefined;
}

function asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function toIsoString(value: string | Date | null): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return new Date(value).toISOString();
}

function mapPostgresRow(row: AiGenerationRow): AiGenerationListItem {
    return {
        generation_id: row.generation_id,
        app_name: row.app_name,
        surface: row.surface,
        status: row.status,
        input_snapshot: row.input_snapshot,
        context_artifacts: asArray(row.context_artifacts),
        prompt_snapshot: row.prompt_snapshot,
        prompt_version: row.prompt_version,
        model_provider: row.model_provider,
        model_name: row.model_name,
        model_params: asObject(row.model_params),
        raw_output: row.raw_output,
        parsed_output: row.parsed_output,
        latency_ms: Number(row.latency_ms),
        token_usage: row.token_usage ? asObject(row.token_usage) : null,
        cost_estimate: row.cost_estimate,
        trace_id: row.trace_id,
        correlation_id: row.correlation_id,
        source_refs: asArray(row.source_refs),
        created_by: row.created_by,
        session_id: row.session_id,
        invite_batch_id: row.invite_batch_id,
        candidate_id: row.candidate_id,
        error_json: row.error_json,
        privacy_flags: row.privacy_flags ?? [],
        redaction_status: row.redaction_status,
        retention_class: row.retention_class,
        retention_until: toIsoString(row.retention_until),
        created_at: toIsoString(row.created_at) ?? new Date(0).toISOString(),
    };
}
