import { beforeEach, describe, expect, it, vi } from "vitest";

describe("PostgresAiGenerationReadRepository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const row = {
        generation_id: "44444444-4444-4444-8444-444444444444",
        app_name: "recruiter_app",
        surface: "answer_feedback",
        status: "success",
        input_snapshot: { question: "Tell me about a time." },
        context_artifacts: [{ type: "resume_excerpt" }],
        prompt_snapshot: { prompt: "Assess the answer." },
        prompt_version: "answer-feedback-v1",
        model_provider: "Google",
        model_name: "gemini-2.5-flash",
        model_params: { responseMimeType: "application/json" },
        raw_output: { text: "raw output" },
        parsed_output: { ack: "Good start." },
        latency_ms: 1200,
        token_usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
        cost_estimate: "0.01",
        trace_id: "trace-1",
        correlation_id: "corr-1",
        source_refs: [{ type: "answer", id: "answer-1" }],
        created_by: null,
        session_id: null,
        invite_batch_id: null,
        candidate_id: "candidate-1",
        error_json: null,
        privacy_flags: ["contains_resume"],
        redaction_status: "redacted",
        retention_class: "eval_redacted",
        retention_until: null,
        created_at: new Date("2026-05-05T12:00:00.000Z"),
    };

    it("lists recent generations with filters and maps Postgres rows", async () => {
        const queryMock = vi.fn().mockResolvedValue({ rows: [row] });
        const { PostgresAiGenerationReadRepository } = await import("./ai-generation-read-repository");
        const repository = new PostgresAiGenerationReadRepository({ query: queryMock } as never);

        const records = await repository.listRecent({
            surface: "answer_feedback",
            status: "success",
            search: "gemini",
            limit: 10,
        });

        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining("from public.ai_generations"),
            ["answer_feedback", "success", "%gemini%", 10]
        );
        expect(records[0]).toMatchObject({
            generation_id: row.generation_id,
            latency_ms: 1200,
            created_at: "2026-05-05T12:00:00.000Z",
        });
    });

    it("returns counted pages from the full filtered result set", async () => {
        const queryMock = vi.fn()
            .mockResolvedValueOnce({ rows: [row] })
            .mockResolvedValueOnce({ rows: [{ total: "53" }] });
        const { PostgresAiGenerationReadRepository } = await import("./ai-generation-read-repository");
        const repository = new PostgresAiGenerationReadRepository({ query: queryMock } as never);

        const page = await repository.listPage({ page: 3, pageSize: 25 });

        expect(page).toMatchObject({
            total: 53,
            page: 3,
            pageSize: 25,
            totalPages: 3,
        });
        expect(queryMock).toHaveBeenNthCalledWith(1, expect.stringContaining("offset $2"), [25, 50]);
        expect(queryMock).toHaveBeenNthCalledWith(2, expect.stringContaining("count(*)::bigint"), []);
    });

    it("calculates aggregate summary in Postgres", async () => {
        const queryMock = vi.fn().mockResolvedValue({
            rows: [{
                total_count: "53",
                success_count: "52",
                partial_count: "1",
                failed_count: "0",
                average_latency_ms: "1234.6",
            }],
        });
        const { PostgresAiGenerationReadRepository } = await import("./ai-generation-read-repository");
        const repository = new PostgresAiGenerationReadRepository({ query: queryMock } as never);

        await expect(repository.getSummary({ surface: "answer_feedback" })).resolves.toEqual({
            total: 53,
            success: 52,
            partial: 1,
            failed: 0,
            averageLatencyMs: 1235,
        });
    });
});
