import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock("@/lib/supabase/server", () => ({
    createAdminClient: () => ({
        from: fromMock,
    }),
}));

describe("SupabaseAiGenerationRepository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        insertMock.mockResolvedValue({ error: null });
    });

    it("inserts AI generation records into ai_generations", async () => {
        const { SupabaseAiGenerationRepository } = await import("./ai-generation-repository");
        const repository = new SupabaseAiGenerationRepository();

        const generationId = await repository.create({
            appName: "recruiter_app",
            surface: "question_generation",
            status: "success",
            inputSnapshot: { role: "Warehouse Associate" },
            contextArtifacts: [{ type: "resume_excerpt", redactionStatus: "raw" }],
            promptSnapshot: { prompt: "Generate questions for Warehouse Associate." },
            promptVersion: "question-generation-v1",
            modelProvider: "gemini",
            modelName: "gemini-2.5-flash",
            modelParams: { responseMimeType: "application/json" },
            rawOutput: "{\"technical\":[]}",
            parsedOutput: { technical: [] },
            latencyMs: 1200,
            tokenUsage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
            costEstimate: 0.01,
            traceId: "trace-1",
            correlationId: "corr-1",
            sourceRefs: [{ type: "invite_batch", id: "batch-1" }],
            createdBy: "11111111-1111-1111-1111-111111111111",
            sessionId: "22222222-2222-2222-2222-222222222222",
            inviteBatchId: "33333333-3333-3333-3333-333333333333",
            candidateId: "candidate-1",
            privacyFlags: ["contains_resume"],
            redactionStatus: "raw",
            retentionClass: "eval_raw_restricted",
            retentionUntil: "2026-05-29T00:00:00.000Z",
        });

        expect(generationId).toMatch(/[0-9a-f-]{36}/);
        expect(fromMock).toHaveBeenCalledWith("ai_generations");
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            generation_id: generationId,
            app_name: "recruiter_app",
            surface: "question_generation",
            status: "success",
            input_snapshot: { role: "Warehouse Associate" },
            context_artifacts: [{ type: "resume_excerpt", redactionStatus: "raw" }],
            prompt_snapshot: { prompt: "Generate questions for Warehouse Associate." },
            prompt_version: "question-generation-v1",
            model_provider: "gemini",
            model_name: "gemini-2.5-flash",
            model_params: { responseMimeType: "application/json" },
            raw_output: "{\"technical\":[]}",
            parsed_output: { technical: [] },
            latency_ms: 1200,
            token_usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
            cost_estimate: 0.01,
            trace_id: "trace-1",
            correlation_id: "corr-1",
            source_refs: [{ type: "invite_batch", id: "batch-1" }],
            created_by: "11111111-1111-1111-1111-111111111111",
            session_id: "22222222-2222-2222-2222-222222222222",
            invite_batch_id: "33333333-3333-3333-3333-333333333333",
            candidate_id: "candidate-1",
            privacy_flags: ["contains_resume"],
            redaction_status: "raw",
            retention_class: "eval_raw_restricted",
            retention_until: "2026-05-29T00:00:00.000Z",
        }));
    });

    it("throws a useful error when the insert fails", async () => {
        insertMock.mockResolvedValue({ error: { message: "permission denied" } });
        const { SupabaseAiGenerationRepository } = await import("./ai-generation-repository");
        const repository = new SupabaseAiGenerationRepository();

        await expect(repository.create({
            appName: "recruiter_app",
            surface: "question_generation",
            status: "failed",
            inputSnapshot: {},
            promptVersion: "question-generation-v1",
            modelProvider: "gemini",
            modelName: "gemini-2.5-flash",
            latencyMs: 10,
            redactionStatus: "not_applicable",
        })).rejects.toThrow("Supabase AI Generation Create Error: permission denied");
    });
});

describe("PostgresAiGenerationRepository", () => {
    it("inserts AI generation records into ai_generations with serialized JSON fields", async () => {
        const queryMock = vi.fn().mockResolvedValue({ rowCount: 1 });
        const { PostgresAiGenerationRepository } = await import("./ai-generation-repository");
        const repository = new PostgresAiGenerationRepository({ query: queryMock } as never);

        const generationId = await repository.create({
            generationId: "44444444-4444-4444-8444-444444444444",
            appName: "recruiter_app",
            surface: "answer_feedback",
            status: "success",
            inputSnapshot: { question: "Tell me about a time." },
            contextArtifacts: [{ type: "resume_excerpt", redactionStatus: "redacted" }],
            promptSnapshot: { prompt: "Assess the answer." },
            promptVersion: "answer-feedback-v1",
            modelProvider: "Google",
            modelName: "gemini-2.5-flash",
            modelParams: { responseMimeType: "application/json" },
            rawOutput: { text: "raw output" },
            parsedOutput: { ack: "Good start." },
            latencyMs: 1200,
            tokenUsage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
            costEstimate: 0.01,
            traceId: "trace-1",
            correlationId: "corr-1",
            sourceRefs: [{ type: "answer", id: "answer-1" }],
            candidateId: "candidate-1",
            privacyFlags: ["contains_resume"],
            redactionStatus: "redacted",
            retentionClass: "eval_redacted",
            retentionUntil: "2026-05-29T00:00:00.000Z",
        });

        expect(generationId).toBe("44444444-4444-4444-8444-444444444444");
        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining("insert into public.ai_generations"),
            expect.arrayContaining([
                "44444444-4444-4444-8444-444444444444",
                "recruiter_app",
                "answer_feedback",
                "success",
                JSON.stringify({ question: "Tell me about a time." }),
                JSON.stringify([{ type: "resume_excerpt", redactionStatus: "redacted" }]),
                JSON.stringify({ prompt: "Assess the answer." }),
                "answer-feedback-v1",
                "Google",
                "gemini-2.5-flash",
                JSON.stringify({ responseMimeType: "application/json" }),
                JSON.stringify({ text: "raw output" }),
                JSON.stringify({ ack: "Good start." }),
                1200,
                JSON.stringify({ input_tokens: 10, output_tokens: 20, total_tokens: 30 }),
                0.01,
                "trace-1",
                "corr-1",
                JSON.stringify([{ type: "answer", id: "answer-1" }]),
                "candidate-1",
                ["contains_resume"],
                "redacted",
                "eval_redacted",
                "2026-05-29T00:00:00.000Z",
            ])
        );
    });

    it("throws a useful error when the Postgres insert fails", async () => {
        const queryMock = vi.fn().mockRejectedValue(new Error("permission denied"));
        const { PostgresAiGenerationRepository } = await import("./ai-generation-repository");
        const repository = new PostgresAiGenerationRepository({ query: queryMock } as never);

        await expect(repository.create({
            appName: "recruiter_app",
            surface: "question_generation",
            status: "failed",
            inputSnapshot: {},
            promptVersion: "question-generation-v1",
            modelProvider: "Google",
            modelName: "gemini-2.5-flash",
            latencyMs: 10,
            redactionStatus: "not_applicable",
        })).rejects.toThrow("Postgres AI Generation Create Error: permission denied");
    });
});
