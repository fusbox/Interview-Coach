import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("feedback repository backend selection", () => {
    it("defaults to Postgres", async () => {
        delete process.env.FEEDBACK_REPOSITORY_BACKEND;
        const { getFeedbackRepositoryBackend } = await import("./feedback-repository");

        expect(getFeedbackRepositoryBackend()).toBe("postgres");
    });

    it("accepts the Postgres backend flag", async () => {
        process.env.FEEDBACK_REPOSITORY_BACKEND = "postgres";
        const { getFeedbackRepositoryBackend } = await import("./feedback-repository");

        expect(getFeedbackRepositoryBackend()).toBe("postgres");
    });

    it("rejects unknown backend values", async () => {
        process.env.FEEDBACK_REPOSITORY_BACKEND = "file";
        const { getFeedbackRepositoryBackend } = await import("./feedback-repository");

        expect(() => getFeedbackRepositoryBackend()).toThrow(
            'Unsupported FEEDBACK_REPOSITORY_BACKEND value "file". Expected "postgres".'
        );
    });
});
