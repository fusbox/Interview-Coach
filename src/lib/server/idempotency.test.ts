import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("idempotency backend selection", () => {
    it("defaults to Supabase during migration", async () => {
        delete process.env.IDEMPOTENCY_BACKEND;
        const { getIdempotencyBackend } = await import("./idempotency");

        expect(getIdempotencyBackend()).toBe("supabase");
    });

    it("accepts the Postgres backend flag", async () => {
        process.env.IDEMPOTENCY_BACKEND = "postgres";
        const { getIdempotencyBackend } = await import("./idempotency");

        expect(getIdempotencyBackend()).toBe("postgres");
    });

    it("rejects unknown backend values", async () => {
        process.env.IDEMPOTENCY_BACKEND = "memory";
        const { getIdempotencyBackend } = await import("./idempotency");

        expect(() => getIdempotencyBackend()).toThrow(
            "[Idempotency] IDEMPOTENCY_BACKEND must be either 'supabase' or 'postgres'."
        );
    });
});
