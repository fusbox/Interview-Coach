import { NextRequest, NextResponse } from "next/server";
import { isQualityEvaluator } from "@/lib/auth/rbac";
import {
    AI_GENERATION_STATUSES,
    AI_GENERATION_SURFACES,
    type AiGenerationStatus,
    type AiGenerationSurface,
} from "@/lib/server/ai-quality/types";
import {
    SupabaseAiGenerationReadRepository,
    type AiGenerationListFilters,
} from "@/lib/server/ai-quality/ai-generation-read-repository";
import {
    buildAiGenerationExportFilename,
    buildAiGenerationExportPayload,
    formatAiGenerationsCsv,
    type AiGenerationExportFormat,
} from "@/lib/server/ai-quality/ai-generation-export";
import { getCachedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function parseSurface(value: string | null): AiGenerationSurface | undefined {
    return AI_GENERATION_SURFACES.find((surface) => surface === value);
}

function parseStatus(value: string | null): AiGenerationStatus | undefined {
    return AI_GENERATION_STATUSES.find((status) => status === value);
}

function parseFormat(value: string | null): AiGenerationExportFormat | null {
    if (!value || value === "json") return "json";
    if (value === "csv") return "csv";
    return null;
}

function parseLimit(value: string | null) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 100;
    return Math.min(Math.max(Math.trunc(parsed), 1), 1000);
}

function parseSearch(value: string | null) {
    const trimmed = value?.trim();
    return trimmed || undefined;
}

export async function GET(request: NextRequest) {
    const user = await getCachedUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isQualityEvaluator(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const surfaceParam = request.nextUrl.searchParams.get("surface");
    const statusParam = request.nextUrl.searchParams.get("status");
    const format = parseFormat(request.nextUrl.searchParams.get("format"));

    if (surfaceParam && !parseSurface(surfaceParam)) {
        return NextResponse.json({ error: "Invalid surface filter" }, { status: 400 });
    }

    if (statusParam && !parseStatus(statusParam)) {
        return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    if (!format) {
        return NextResponse.json({ error: "Invalid export format" }, { status: 400 });
    }

    const filters: AiGenerationListFilters = {
        surface: parseSurface(surfaceParam),
        status: parseStatus(statusParam),
        search: parseSearch(request.nextUrl.searchParams.get("search")),
        limit: parseLimit(request.nextUrl.searchParams.get("limit")),
        maxLimit: 1000,
    };
    const exportedAt = new Date().toISOString();
    const repo = new SupabaseAiGenerationReadRepository();
    const records = await repo.listRecent(filters);
    const filename = buildAiGenerationExportFilename({
        format,
        surface: filters.surface,
        status: filters.status,
        exportedAt,
    });

    if (format === "csv") {
        return new Response(formatAiGenerationsCsv(records), {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        });
    }

    return NextResponse.json(
        buildAiGenerationExportPayload({ records, filters, exportedAt }),
        {
            headers: {
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        }
    );
}
