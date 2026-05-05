import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("session repository backend selection", () => {
    it("defaults to Supabase during migration", async () => {
        delete process.env.SESSION_REPOSITORY_BACKEND;
        const { getSessionRepositoryBackend } = await import("./session-repository");

        expect(getSessionRepositoryBackend()).toBe("supabase");
    });

    it("accepts the Postgres backend flag", async () => {
        process.env.SESSION_REPOSITORY_BACKEND = "postgres";
        const { getSessionRepositoryBackend } = await import("./session-repository");

        expect(getSessionRepositoryBackend()).toBe("postgres");
    });

    it("rejects unknown backend values", async () => {
        process.env.SESSION_REPOSITORY_BACKEND = "file";
        const { getSessionRepositoryBackend } = await import("./session-repository");

        expect(() => getSessionRepositoryBackend()).toThrow(
            'Unsupported SESSION_REPOSITORY_BACKEND value "file". Expected "supabase" or "postgres".'
        );
    });
});
