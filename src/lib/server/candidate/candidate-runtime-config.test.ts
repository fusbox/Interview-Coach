import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("candidate runtime config", () => {
    it("defaults candidate data access to Postgres and production auth to external", async () => {
        process.env = { NODE_ENV: "production" };

        const { getCandidateRuntimeConfig } = await import("./candidate-runtime-config");

        expect(getCandidateRuntimeConfig()).toEqual({
            authMode: "external",
            dataBackend: "postgres",
        });
    });

    it("allows password and mock auth outside production", async () => {
        process.env = {
            NODE_ENV: "development",
            CANDIDATE_AUTH_MODE: "password",
            CANDIDATE_DATA_BACKEND: "postgres",
        };

        const { getCandidateRuntimeConfig } = await import("./candidate-runtime-config");

        expect(getCandidateRuntimeConfig()).toEqual({
            authMode: "password",
            dataBackend: "postgres",
        });

        process.env.CANDIDATE_AUTH_MODE = "mock";
        expect(getCandidateRuntimeConfig().authMode).toBe("mock");
    });

    it("rejects Supabase or unknown candidate data backends", async () => {
        process.env.CANDIDATE_DATA_BACKEND = "supabase";

        const { getCandidateRuntimeConfig } = await import("./candidate-runtime-config");

        expect(() => getCandidateRuntimeConfig()).toThrow(
            'Unsupported CANDIDATE_DATA_BACKEND value "supabase". Expected "postgres".'
        );
    });

    it("rejects unsupported candidate auth modes", async () => {
        process.env.CANDIDATE_AUTH_MODE = "magic";

        const { getCandidateRuntimeConfig } = await import("./candidate-runtime-config");

        expect(() => getCandidateRuntimeConfig()).toThrow(
            'Unsupported CANDIDATE_AUTH_MODE value "magic". Expected "external", "password", or "mock".'
        );
    });

    it("rejects local-only auth modes in production", async () => {
        process.env = {
            NODE_ENV: "production",
            CANDIDATE_AUTH_MODE: "mock",
        };

        const { getCandidateRuntimeConfig } = await import("./candidate-runtime-config");

        expect(() => getCandidateRuntimeConfig()).toThrow("CANDIDATE_AUTH_MODE=mock is not allowed in production.");

        process.env.CANDIDATE_AUTH_MODE = "password";
        expect(() => getCandidateRuntimeConfig()).toThrow("CANDIDATE_AUTH_MODE=password is not allowed in production.");
    });
});
