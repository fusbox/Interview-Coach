import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();
const rangeMock = vi.fn();
const maybeSingleMock = vi.fn();
const rpcMock = vi.fn();

const queryMock = {
    eq: vi.fn(() => queryMock),
    or: vi.fn(() => queryMock),
    order: vi.fn(() => ({ limit: limitMock, range: rangeMock })),
    limit: limitMock,
    maybeSingle: maybeSingleMock,
};

const selectMock = vi.fn(() => queryMock);
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("@/lib/supabase/server", () => ({
    createAdminClient: () => ({
        from: fromMock,
        rpc: rpcMock,
    }),
}));

describe("SupabaseAiGenerationReadRepository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        limitMock.mockResolvedValue({ data: [], error: null });
        rangeMock.mockResolvedValue({ data: [], error: null, count: 0 });
        maybeSingleMock.mockResolvedValue({ data: null, error: null });
        rpcMock.mockResolvedValue({
            data: [{
                total_count: 0,
                success_count: 0,
                partial_count: 0,
                failed_count: 0,
                average_latency_ms: 0,
            }],
            error: null,
        });
    });

    it("lists recent generations with surface, status, and capped limit filters", async () => {
        const { SupabaseAiGenerationReadRepository } = await import("./ai-generation-read-repository");
        const repository = new SupabaseAiGenerationReadRepository();

        await repository.listRecent({
            surface: "hint",
            status: "failed",
            limit: 500,
        });

        expect(fromMock).toHaveBeenCalledWith("ai_generations");
        expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("generation_id"));
        expect(queryMock.eq).toHaveBeenCalledWith("surface", "hint");
        expect(queryMock.eq).toHaveBeenCalledWith("status", "failed");
        expect(queryMock.order).toHaveBeenCalledWith("created_at", { ascending: false });
        expect(limitMock).toHaveBeenCalledWith(250);
    });

    it("searches across text fields", async () => {
        const { SupabaseAiGenerationReadRepository } = await import("./ai-generation-read-repository");
        const repository = new SupabaseAiGenerationReadRepository();

        await repository.listRecent({ search: "gemini" });

        expect(queryMock.or).toHaveBeenCalledWith(expect.stringContaining("model_name.ilike.%gemini%"));
    });

    it("allows callers to raise the max limit for export workflows", async () => {
        const { SupabaseAiGenerationReadRepository } = await import("./ai-generation-read-repository");
        const repository = new SupabaseAiGenerationReadRepository();

        await repository.listRecent({
            limit: 500,
            maxLimit: 1000,
        });

        expect(limitMock).toHaveBeenCalledWith(500);
    });

    it("lists a counted page with range pagination", async () => {
        rangeMock.mockResolvedValue({ data: [], error: null, count: 42 });
        const { SupabaseAiGenerationReadRepository } = await import("./ai-generation-read-repository");
        const repository = new SupabaseAiGenerationReadRepository();

        const page = await repository.listPage({ page: 2, pageSize: 10 });

        expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("generation_id"), { count: "exact" });
        expect(queryMock.order).toHaveBeenCalledWith("created_at", { ascending: false });
        expect(rangeMock).toHaveBeenCalledWith(10, 19);
        expect(page).toMatchObject({
            total: 42,
            page: 2,
            pageSize: 10,
            totalPages: 5,
        });
    });

    it("loads one generation by id", async () => {
        const row = {
            generation_id: "generation-1",
            surface: "question_generation",
            status: "success",
        };
        maybeSingleMock.mockResolvedValue({ data: row, error: null });
        const { SupabaseAiGenerationReadRepository } = await import("./ai-generation-read-repository");
        const repository = new SupabaseAiGenerationReadRepository();

        await expect(repository.findById("generation-1")).resolves.toBe(row);
        expect(queryMock.eq).toHaveBeenCalledWith("generation_id", "generation-1");
        expect(maybeSingleMock).toHaveBeenCalled();
    });

    it("loads aggregate summary through the database summary function", async () => {
        rpcMock.mockResolvedValue({
            data: [{
                total_count: 53,
                success_count: 53,
                partial_count: 0,
                failed_count: 0,
                average_latency_ms: 1234.6,
            }],
            error: null,
        });
        const { SupabaseAiGenerationReadRepository } = await import("./ai-generation-read-repository");
        const repository = new SupabaseAiGenerationReadRepository();

        await expect(repository.getSummary({
            surface: "answer_feedback",
            status: "success",
            search: "gemini",
        })).resolves.toEqual({
            total: 53,
            success: 53,
            partial: 0,
            failed: 0,
            averageLatencyMs: 1235,
        });

        expect(rpcMock).toHaveBeenCalledWith("get_ai_generation_summary", {
            p_surface: "answer_feedback",
            p_status: "success",
            p_search: "gemini",
        });
    });

    it("falls back when the database summary function is not installed yet", async () => {
        rpcMock.mockResolvedValue({
            data: null,
            error: { code: "PGRST202", message: "function missing" },
        });
        limitMock
            .mockResolvedValueOnce({ data: null, error: null, count: 3 })
            .mockResolvedValueOnce({ data: null, error: null, count: 2 })
            .mockResolvedValueOnce({ data: null, error: null, count: 1 })
            .mockResolvedValueOnce({ data: null, error: null, count: 0 })
            .mockResolvedValueOnce({
                data: [{ latency_ms: 100 }, { latency_ms: 200 }, { latency_ms: 300 }],
                error: null,
            });
        const { SupabaseAiGenerationReadRepository } = await import("./ai-generation-read-repository");
        const repository = new SupabaseAiGenerationReadRepository();

        await expect(repository.getSummary()).resolves.toEqual({
            total: 3,
            success: 2,
            partial: 1,
            failed: 0,
            averageLatencyMs: 200,
        });
    });

    it("throws a useful error when Supabase rejects a read", async () => {
        limitMock.mockResolvedValue({ data: null, error: { message: "permission denied" } });
        const { SupabaseAiGenerationReadRepository } = await import("./ai-generation-read-repository");
        const repository = new SupabaseAiGenerationReadRepository();

        await expect(repository.listRecent()).rejects.toThrow("Supabase AI Generation Read Error: permission denied");
    });
});
