import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("invite repository factory", () => {
    it("defaults to the Supabase backend during migration", async () => {
        delete process.env.INVITE_REPOSITORY_BACKEND;
        const { getInviteRepositoryBackend } = await import("./invite-repository");

        expect(getInviteRepositoryBackend()).toBe("supabase");
    });

    it("accepts the Postgres backend flag", async () => {
        process.env.INVITE_REPOSITORY_BACKEND = "postgres";
        const { getInviteRepositoryBackend } = await import("./invite-repository");

        expect(getInviteRepositoryBackend()).toBe("postgres");
    });

    it("rejects unknown backend values", async () => {
        process.env.INVITE_REPOSITORY_BACKEND = "sqlite";
        const { getInviteRepositoryBackend } = await import("./invite-repository");

        expect(() => getInviteRepositoryBackend()).toThrow(
            "[InviteRepository] INVITE_REPOSITORY_BACKEND must be either 'supabase' or 'postgres'."
        );
    });
});
