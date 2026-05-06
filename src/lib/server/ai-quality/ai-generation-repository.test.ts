import { beforeEach, describe, expect, it, vi } from "vitest";

describe("PostgresAiGenerationRepository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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
