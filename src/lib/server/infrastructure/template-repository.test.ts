import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("template repository backend selection", () => {
    it("defaults to Postgres", async () => {
        delete process.env.TEMPLATE_REPOSITORY_BACKEND;
        const { getTemplateRepositoryBackend } = await import("./template-repository");

        expect(getTemplateRepositoryBackend()).toBe("postgres");
    });

    it("accepts the Postgres backend flag", async () => {
        process.env.TEMPLATE_REPOSITORY_BACKEND = "postgres";
        const { getTemplateRepositoryBackend } = await import("./template-repository");

        expect(getTemplateRepositoryBackend()).toBe("postgres");
    });

    it("rejects unknown backend values", async () => {
        process.env.TEMPLATE_REPOSITORY_BACKEND = "file";
        const { getTemplateRepositoryBackend } = await import("./template-repository");

        expect(() => getTemplateRepositoryBackend()).toThrow(
            'Unsupported TEMPLATE_REPOSITORY_BACKEND value "file". Expected "postgres".'
        );
    });

    it("requires a user id for Postgres-backed repositories", async () => {
        process.env.TEMPLATE_REPOSITORY_BACKEND = "postgres";
        const { createTemplateRepository } = await import("./template-repository");

        await expect(createTemplateRepository()).rejects.toThrow(
            "[TemplateRepository] userId is required."
        );
    });
});
