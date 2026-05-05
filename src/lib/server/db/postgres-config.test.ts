import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
});

describe("Postgres runtime config", () => {
    it("prefers DATABASE_URL when present", async () => {
        const { getPostgresRuntimeConfig } = await import("./postgres-config");

        const config = getPostgresRuntimeConfig({
            DATABASE_URL: "postgresql://app:secret@example.com:5432/interviewcoach",
            POSTGRES_HOST: "ignored",
            POSTGRES_USER: "ignored",
            POSTGRES_PASSWORD: "ignored",
            POSTGRES_DB: "ignored"
        });

        expect(config.source).toBe("database_url");
        expect(config.pool.connectionString).toBe("postgresql://app:secret@example.com:5432/interviewcoach");
        expect(config.pool.max).toBe(10);
        expect(config.pool.connectionTimeoutMillis).toBe(5000);
    });

    it("uses individual POSTGRES values when DATABASE_URL is absent", async () => {
        const { getPostgresRuntimeConfig } = await import("./postgres-config");

        const config = getPostgresRuntimeConfig({
            POSTGRES_HOST: "db.internal",
            POSTGRES_PORT: "6543",
            POSTGRES_USER: "app_user",
            POSTGRES_PASSWORD: "secret",
            POSTGRES_DB: "interviewcoach"
        });

        expect(config.source).toBe("individual_env");
        expect(config.pool.host).toBe("db.internal");
        expect(config.pool.port).toBe(6543);
        expect(config.pool.user).toBe("app_user");
        expect(config.pool.password).toBe("secret");
        expect(config.pool.database).toBe("interviewcoach");
    });

    it("throws when individual POSTGRES values are incomplete", async () => {
        const { getPostgresRuntimeConfig } = await import("./postgres-config");

        expect(() => getPostgresRuntimeConfig({
            POSTGRES_HOST: "db.internal",
            POSTGRES_USER: "app_user",
            POSTGRES_DB: "interviewcoach"
        })).toThrow("[PostgresConfig] Missing required environment variable POSTGRES_PASSWORD for Postgres connection.");
    });

    it("validates numeric pool settings", async () => {
        const { getPostgresRuntimeConfig } = await import("./postgres-config");

        expect(() => getPostgresRuntimeConfig({
            DATABASE_URL: "postgresql://app:secret@example.com/interviewcoach",
            POSTGRES_POOL_MAX: "0"
        })).toThrow("[PostgresConfig] POSTGRES_POOL_MAX must be a positive integer.");
    });

    it("honors SSL disable mode", async () => {
        const { getPostgresRuntimeConfig } = await import("./postgres-config");

        const config = getPostgresRuntimeConfig({
            DATABASE_URL: "postgresql://app:secret@example.com/interviewcoach?sslmode=disable"
        });

        expect(config.pool.ssl).toBe(false);
    });

    it("supports explicit SSL verification behavior", async () => {
        const { getPostgresRuntimeConfig } = await import("./postgres-config");

        const config = getPostgresRuntimeConfig({
            DATABASE_URL: "postgresql://app:secret@example.com/interviewcoach",
            POSTGRES_SSL_MODE: "require",
            POSTGRES_SSL_REJECT_UNAUTHORIZED: "true"
        });

        expect(config.pool.ssl).toEqual({ rejectUnauthorized: true });
    });
});
