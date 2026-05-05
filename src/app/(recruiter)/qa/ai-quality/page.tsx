import Link from "next/link";
import { AlertCircle, ChevronLeft, ChevronRight, Download, Filter, Layers, RotateCcw, Search } from "lucide-react";
import { AlertPanel } from "@/components/patterns/AlertPanel";
import { PageHeaderBlock } from "@/components/patterns/PageHeaderBlock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import {
    AI_GENERATION_STATUSES,
    AI_GENERATION_SURFACES,
    type AiGenerationStatus,
    type AiGenerationSurface,
} from "@/lib/server/ai-quality/types";
import {
    SupabaseAiGenerationReadRepository,
    type AiGenerationSummary,
    type AiGenerationListItem,
} from "@/lib/server/ai-quality/ai-generation-read-repository";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
    searchParams?: Promise<SearchParams>;
};

type GroupBy = "none" | "session" | "correlation" | "surface";

const statusStyles: Record<AiGenerationStatus, string> = {
    success: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/30",
    partial: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30",
    failed: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30",
};

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function parseSurface(value: string | undefined): AiGenerationSurface | undefined {
    return AI_GENERATION_SURFACES.find((surface) => surface === value);
}

function parseStatus(value: string | undefined): AiGenerationStatus | undefined {
    return AI_GENERATION_STATUSES.find((status) => status === value);
}

function parseLimit(value: string | undefined) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 100;
    return Math.min(Math.max(Math.trunc(parsed), 1), 250);
}

function parsePage(value: string | undefined) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(Math.trunc(parsed), 1);
}

function parsePageSize(value: string | undefined) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 25;
    return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function parseGroupBy(value: string | undefined): GroupBy {
    if (value === "session" || value === "correlation" || value === "surface") return value;
    return "none";
}

function parseSearch(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed || undefined;
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
    }).format(new Date(value));
}

function formatSurface(value: string) {
    return value
        .split("_")
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" ");
}

function formatJson(value: unknown) {
    if (value === null || value === undefined) return "null";
    return JSON.stringify(value, null, 2);
}

function buildGenerationHref(params: {
    generationId: string;
    surface?: AiGenerationSurface;
    status?: AiGenerationStatus;
    search?: string;
    page: number;
    pageSize: number;
    groupBy: GroupBy;
}) {
    const search = new URLSearchParams();
    search.set("generation_id", params.generationId);
    search.set("page", String(params.page));
    search.set("page_size", String(params.pageSize));

    if (params.surface) search.set("surface", params.surface);
    if (params.status) search.set("status", params.status);
    if (params.search) search.set("search", params.search);
    if (params.groupBy !== "none") search.set("group_by", params.groupBy);

    return `/qa/ai-quality?${search.toString()}`;
}

function buildExportHref(params: {
    format: "csv" | "json";
    surface?: AiGenerationSurface;
    status?: AiGenerationStatus;
    search?: string;
    limit: number;
}) {
    const search = new URLSearchParams();
    search.set("format", params.format);
    search.set("limit", String(params.limit));

    if (params.surface) search.set("surface", params.surface);
    if (params.status) search.set("status", params.status);
    if (params.search) search.set("search", params.search);

    return `/qa/ai-quality/export?${search.toString()}`;
}

function buildPageHref(params: {
    page: number;
    pageSize: number;
    surface?: AiGenerationSurface;
    status?: AiGenerationStatus;
    search?: string;
    groupBy: GroupBy;
}) {
    const search = new URLSearchParams();
    search.set("page", String(params.page));
    search.set("page_size", String(params.pageSize));

    if (params.surface) search.set("surface", params.surface);
    if (params.status) search.set("status", params.status);
    if (params.search) search.set("search", params.search);
    if (params.groupBy !== "none") search.set("group_by", params.groupBy);

    return `/qa/ai-quality?${search.toString()}`;
}

function StatusBadge({ status }: { status: AiGenerationStatus }) {
    return (
        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold capitalize", statusStyles[status])}>
            {status}
        </span>
    );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
    return (
        <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">{title}</h3>
            <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-surface-subtle p-3 text-xs leading-relaxed text-text-primary">
                {formatJson(value)}
            </pre>
        </section>
    );
}

function MetadataRow({ label, value }: { label: string; value: unknown }) {
    const displayValue = value === null || value === undefined || value === "" ? "—" : String(value);

    return (
        <div className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</dt>
            <dd className="mt-1 truncate text-sm font-medium text-text-primary" title={displayValue}>
                {displayValue}
            </dd>
        </div>
    );
}

function groupRows(rows: AiGenerationListItem[], groupBy: GroupBy) {
    if (groupBy === "none") return [];

    const groups = new Map<string, {
        label: string;
        count: number;
        success: number;
        failed: number;
        partial: number;
    }>();

    for (const row of rows) {
        const rawLabel = groupBy === "session"
            ? row.session_id
            : groupBy === "correlation"
                ? row.correlation_id
                : row.surface;
        const label = rawLabel || `(no ${groupBy})`;
        const group = groups.get(label) ?? {
            label: groupBy === "surface" ? formatSurface(label) : label,
            count: 0,
            success: 0,
            failed: 0,
            partial: 0,
        };

        group.count += 1;
        group[row.status] += 1;
        groups.set(label, group);
    }

    return Array.from(groups.values())
        .sort((left, right) => right.count - left.count)
        .slice(0, 12);
}

export default async function AiQualityPage({ searchParams }: PageProps) {
    const params = await searchParams ?? {};
    const surface = parseSurface(firstParam(params.surface));
    const status = parseStatus(firstParam(params.status));
    const search = parseSearch(firstParam(params.search));
    const generationId = firstParam(params.generation_id);
    const page = parsePage(firstParam(params.page));
    const pageSize = parsePageSize(firstParam(params.page_size));
    const groupBy = parseGroupBy(firstParam(params.group_by));
    const exportLimit = parseLimit(firstParam(params.limit)) || pageSize;
    const repo = new SupabaseAiGenerationReadRepository();

    let rows: AiGenerationListItem[] = [];
    let selectedGeneration: AiGenerationListItem | null = null;
    let error: string | null = null;
    let total = 0;
    let totalPages = 1;
    let summary: AiGenerationSummary = {
        total: 0,
        success: 0,
        partial: 0,
        failed: 0,
        averageLatencyMs: 0,
    };

    try {
        const [result, summaryResult] = await Promise.all([
            repo.listPage({ surface, status, search, page, pageSize }),
            repo.getSummary({ surface, status, search }),
        ]);
        rows = result.records;
        total = result.total;
        totalPages = result.totalPages;
        summary = summaryResult;
        selectedGeneration = generationId
            ? rows.find((row) => row.generation_id === generationId) ?? await repo.findById(generationId)
            : rows[0] ?? null;
    } catch (err) {
        console.error("Failed to load AI generations", err);
        error = "Failed to load AI generation records. Check Supabase connectivity and service-role configuration.";
    }

    const groups = groupRows(rows, groupBy);
    const previousPage = Math.max(page - 1, 1);
    const nextPage = Math.min(page + 1, totalPages);
    const exportRowLimit = Math.max(exportLimit, pageSize);
    const filterFormKey = [
        search ?? "",
        surface ?? "",
        status ?? "",
        pageSize,
        groupBy,
    ].join(":");

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-12">
            <PageHeaderBlock
                title="AI Quality"
                description="Recent source-level generation records for evaluation and debugging."
            />

            {error && (
                <AlertPanel tone="critical" size="sm" icon={<AlertCircle className="h-5 w-5 shrink-0" />}>
                    <span className="font-medium">{error}</span>
                </AlertPanel>
            )}

            <form key={filterFormKey} className="flex flex-col gap-3 rounded-xl border border-border bg-surface-base p-4 shadow-flat md:flex-row md:items-end">
                <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Search</span>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                            <input
                                name="search"
                                defaultValue={search ?? ""}
                                placeholder="Model, prompt, ID"
                                className="h-10 w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                            />
                        </div>
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Surface</span>
                        <select
                            name="surface"
                            defaultValue={surface ?? ""}
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                        >
                            <option value="">All surfaces</option>
                            {AI_GENERATION_SURFACES.map((option) => (
                                <option key={option} value={option}>
                                    {formatSurface(option)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Status</span>
                        <select
                            name="status"
                            defaultValue={status ?? ""}
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                        >
                            <option value="">All statuses</option>
                            {AI_GENERATION_STATUSES.map((option) => (
                                <option key={option} value={option}>
                                    {option[0].toUpperCase() + option.slice(1)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Page Size</span>
                        <select
                            name="page_size"
                            defaultValue={String(pageSize)}
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                        >
                            {[25, 50, 100].map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Group</span>
                        <select
                            name="group_by"
                            defaultValue={groupBy}
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                        >
                            <option value="none">No grouping</option>
                            <option value="session">Session</option>
                            <option value="correlation">Correlation</option>
                            <option value="surface">Surface</option>
                        </select>
                    </label>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="submit" density="default" shape="app" label="strong" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Apply
                    </Button>
                    <Button asChild type="button" emphasis="secondary" density="default" shape="app" label="strong" className="gap-2">
                        <Link href="/qa/ai-quality">
                            <RotateCcw className="h-4 w-4" />
                            Reset
                        </Link>
                    </Button>
                    <Button asChild type="button" emphasis="secondary" density="default" shape="app" label="strong" className="gap-2">
                        <Link href={buildExportHref({ format: "json", surface, status, search, limit: exportRowLimit })}>
                            <Download className="h-4 w-4" />
                            JSON
                        </Link>
                    </Button>
                    <Button asChild type="button" emphasis="secondary" density="default" shape="app" label="strong" className="gap-2">
                        <Link href={buildExportHref({ format: "csv", surface, status, search, limit: exportRowLimit })}>
                            <Download className="h-4 w-4" />
                            CSV
                        </Link>
                    </Button>
                </div>
            </form>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Visible Records</p>
                        <p className="mt-2 text-2xl font-black text-text-primary">{summary.total}</p>
                        <p className="mt-1 text-xs font-medium text-text-muted">Page {page} of {totalPages}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Success</p>
                        <p className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-300">{summary.success}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Partial / Failed</p>
                        <p className="mt-2 text-2xl font-black text-amber-800 dark:text-amber-300">{summary.partial + summary.failed}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Avg Latency</p>
                        <p className="mt-2 text-2xl font-black text-text-primary">{summary.averageLatencyMs}ms</p>
                    </CardContent>
                </Card>
            </div>

            {groups.length > 0 && (
                <Card>
                    <CardHeader className="border-b border-border pb-4">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                            <Layers className="h-4 w-4 text-text-muted" />
                            Grouped By {groupBy === "correlation" ? "Correlation" : groupBy[0].toUpperCase() + groupBy.slice(1)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                        {groups.map((group) => (
                            <div key={group.label} className="rounded-lg border border-border bg-surface-subtle p-3">
                                <div className="truncate text-sm font-semibold text-text-primary" title={group.label}>
                                    {group.label}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-text-muted">
                                    <span>{group.count} records</span>
                                    <span>{group.success} success</span>
                                    <span>{group.partial} partial</span>
                                    <span>{group.failed} failed</span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
                <Card>
                    <CardHeader className="border-b border-border pb-4">
                        <CardTitle className="text-base font-semibold">Recent Generations</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="uppercase text-[11px] font-bold tracking-wider text-muted-foreground">Created</TableHead>
                                    <TableHead className="uppercase text-[11px] font-bold tracking-wider text-muted-foreground">Surface</TableHead>
                                    <TableHead className="uppercase text-[11px] font-bold tracking-wider text-muted-foreground">Status</TableHead>
                                    <TableHead className="uppercase text-[11px] font-bold tracking-wider text-muted-foreground">Model</TableHead>
                                    <TableHead className="uppercase text-[11px] font-bold tracking-wider text-muted-foreground text-right">Latency</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => {
                                    const selected = selectedGeneration?.generation_id === row.generation_id;

                                    return (
                                        <TableRow key={row.generation_id} className={cn(selected && "bg-primary/5 hover:bg-primary/5")}>
                                            <TableCell className="whitespace-nowrap text-sm font-medium">
                                                <Link
                                                    href={buildGenerationHref({ generationId: row.generation_id, surface, status, search, page, pageSize, groupBy })}
                                                    className="inline-flex items-center gap-2 text-text-primary hover:text-primary"
                                                >
                                                    <Search className="h-4 w-4 text-text-muted" />
                                                    {formatDate(row.created_at)}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-semibold text-text-primary">{formatSurface(row.surface)}</div>
                                                <div className="mt-1 max-w-[12rem] truncate text-xs text-text-muted" title={row.generation_id}>
                                                    {row.generation_id}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={row.status} />
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm font-semibold text-text-primary">{row.model_name}</div>
                                                <div className="text-xs text-text-muted">{row.model_provider}</div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-text-primary">
                                                {row.latency_ms}ms
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {!rows.length && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="p-12 text-center text-sm text-text-muted">
                                            No AI generation records match the current filters.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-medium text-text-muted">
                                Showing {rows.length} of {total} matching records
                            </p>
                            <div className="flex items-center gap-2">
                                <Button asChild type="button" emphasis="secondary" density="compact" shape="app" label="strong" disabled={page <= 1}>
                                    <Link
                                        href={buildPageHref({ page: previousPage, pageSize, surface, status, search, groupBy })}
                                        aria-disabled={page <= 1}
                                        className={cn(page <= 1 && "pointer-events-none opacity-50")}
                                    >
                                        <ChevronLeft className="mr-1 h-4 w-4" />
                                        Previous
                                    </Link>
                                </Button>
                                <span className="min-w-20 text-center text-sm font-semibold text-text-primary">
                                    {page} / {totalPages}
                                </span>
                                <Button asChild type="button" emphasis="secondary" density="compact" shape="app" label="strong" disabled={page >= totalPages}>
                                    <Link
                                        href={buildPageHref({ page: nextPage, pageSize, surface, status, search, groupBy })}
                                        aria-disabled={page >= totalPages}
                                        className={cn(page >= totalPages && "pointer-events-none opacity-50")}
                                    >
                                        Next
                                        <ChevronRight className="ml-1 h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="border-b border-border pb-4">
                        <CardTitle className="text-base font-semibold">Generation Detail</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 p-5">
                        {selectedGeneration ? (
                            <>
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusBadge status={selectedGeneration.status} />
                                    <span className="rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs font-bold text-text-muted">
                                        {formatSurface(selectedGeneration.surface)}
                                    </span>
                                    <span className="rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs font-bold text-text-muted">
                                        {selectedGeneration.redaction_status}
                                    </span>
                                </div>

                                <dl className="grid grid-cols-1 gap-4 border-b border-border pb-5 sm:grid-cols-2">
                                    <MetadataRow label="Generation ID" value={selectedGeneration.generation_id} />
                                    <MetadataRow label="Created" value={formatDate(selectedGeneration.created_at)} />
                                    <MetadataRow label="Prompt Version" value={selectedGeneration.prompt_version} />
                                    <MetadataRow label="Retention" value={selectedGeneration.retention_class} />
                                    <MetadataRow label="Trace ID" value={selectedGeneration.trace_id} />
                                    <MetadataRow label="Correlation ID" value={selectedGeneration.correlation_id} />
                                    <MetadataRow label="Created By" value={selectedGeneration.created_by} />
                                    <MetadataRow label="Session ID" value={selectedGeneration.session_id} />
                                    <MetadataRow label="Invite Batch ID" value={selectedGeneration.invite_batch_id} />
                                    <MetadataRow label="Candidate ID" value={selectedGeneration.candidate_id} />
                                </dl>

                                <JsonBlock title="Input Snapshot" value={selectedGeneration.input_snapshot} />
                                <JsonBlock title="Context Artifacts" value={selectedGeneration.context_artifacts} />
                                <JsonBlock title="Prompt Snapshot" value={selectedGeneration.prompt_snapshot} />
                                <JsonBlock title="Parsed Output" value={selectedGeneration.parsed_output} />
                                <JsonBlock title="Raw Output" value={selectedGeneration.raw_output} />
                                <JsonBlock title="Source References" value={selectedGeneration.source_refs} />
                                <JsonBlock title="Model Parameters" value={selectedGeneration.model_params} />
                                <JsonBlock title="Token Usage" value={selectedGeneration.token_usage} />
                                <JsonBlock title="Privacy Flags" value={selectedGeneration.privacy_flags} />
                                <JsonBlock title="Error" value={selectedGeneration.error_json} />
                            </>
                        ) : (
                            <p className="text-sm text-text-muted">Select a generation to inspect its captured inputs, outputs, and trace fields.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
