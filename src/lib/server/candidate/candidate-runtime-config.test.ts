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

    it("allows dev, password, mock, and preview test auth outside production", async () => {
        process.env = {
            NODE_ENV: "development",
            CANDIDATE_AUTH_MODE: "dev",
            CANDIDATE_DATA_BACKEND: "postgres",
        };

        const { getCandidateRuntimeConfig } = await import("./candidate-runtime-config");

        expect(getCandidateRuntimeConfig()).toEqual({
            authMode: "dev",
            dataBackend: "postgres",
        });

        process.env.CANDIDATE_AUTH_MODE = "password";
        expect(getCandidateRuntimeConfig().authMode).toBe("password");

        process.env.CANDIDATE_AUTH_MODE = "mock";
        expect(getCandidateRuntimeConfig().authMode).toBe("mock");

        process.env.CANDIDATE_AUTH_MODE = "preview_test";
        expect(getCandidateRuntimeConfig().authMode).toBe("preview_test");
    });

    it("allows preview test auth only for explicitly enabled Vercel preview deployments", async () => {
        process.env = {
            NODE_ENV: "production",
            CANDIDATE_AUTH_MODE: "preview_test",
            VERCEL_ENV: "preview",
            ALLOW_CANDIDATE_PREVIEW_AUTH: "true",
        };

        const { getCandidateRuntimeConfig } = await import("./candidate-runtime-config");

        expect(getCandidateRuntimeConfig()).toEqual({
            authMode: "preview_test",
            dataBackend: "postgres",
        });
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
            'Unsupported CANDIDATE_AUTH_MODE value "magic". Expected "external", "dev", "password", "mock", or "preview_test".'
        );
    });

    it("rejects local-only auth modes in production", async () => {
        process.env = {
            NODE_ENV: "production",
            CANDIDATE_AUTH_MODE: "dev",
        };

        const { getCandidateRuntimeConfig } = await import("./candidate-runtime-config");

        expect(() => getCandidateRuntimeConfig()).toThrow("CANDIDATE_AUTH_MODE=dev is not allowed in production.");

        process.env.CANDIDATE_AUTH_MODE = "mock";
        expect(() => getCandidateRuntimeConfig()).toThrow("CANDIDATE_AUTH_MODE=mock is not allowed in production.");

        process.env.CANDIDATE_AUTH_MODE = "password";
        expect(() => getCandidateRuntimeConfig()).toThrow("CANDIDATE_AUTH_MODE=password is not allowed in production.");
    });

    it("fails closed for preview test auth outside explicitly enabled preview deployments", async () => {
        process.env = {
            NODE_ENV: "production",
            CANDIDATE_AUTH_MODE: "preview_test",
            VERCEL_ENV: "production",
            ALLOW_CANDIDATE_PREVIEW_AUTH: "true",
        };

        const { getCandidateRuntimeConfig } = await import("./candidate-runtime-config");

        expect(() => getCandidateRuntimeConfig()).toThrow(
            "CANDIDATE_AUTH_MODE=preview_test requires VERCEL_ENV=preview and ALLOW_CANDIDATE_PREVIEW_AUTH=true."
        );

        process.env.VERCEL_ENV = "preview";
        process.env.ALLOW_CANDIDATE_PREVIEW_AUTH = "false";
        expect(() => getCandidateRuntimeConfig()).toThrow(
            "CANDIDATE_AUTH_MODE=preview_test requires VERCEL_ENV=preview and ALLOW_CANDIDATE_PREVIEW_AUTH=true."
        );
    });
});
