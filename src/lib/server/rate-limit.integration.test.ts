import { randomUUID } from "crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_RATE_LIMIT_TEST_DATABASE_URL;
const runIntegration = databaseUrl ? describe : describe.skip;

runIntegration("Postgres rate-limit integration", () => {
    let pool: Pool;
    let keyPrefix: string;

    beforeAll(() => {
        if (!databaseUrl) {
            return;
        }

        process.env.RATE_LIMIT_BACKEND = "postgres";
        process.env.DATABASE_URL = databaseUrl;
        keyPrefix = `rate-limit-smoke:${randomUUID()}`;
        pool = new Pool({ connectionString: databaseUrl });
    });

    afterAll(async () => {
        if (!pool) {
            return;
        }

        await pool.query("delete from public.rate_limit_buckets where bucket_key like $1", [`${keyPrefix}%`]);
        await pool.end();
        const { closePostgresPoolForTests } = await import("./db/postgres");
        await closePostgresPoolForTests();
    });

    it("allows requests within the window, blocks over-limit requests, and resets after expiry", async () => {
        const { consumeRateLimit } = await import("./rate-limit");
        const key = `${keyPrefix}:window`;
        const now = 1_710_000_000_000;

        await expect(consumeRateLimit(key, 2, 1_000, now)).resolves.toEqual({
            allowed: true,
            remaining: 1,
            resetAt: now + 1_000
        });
        await expect(consumeRateLimit(key, 2, 1_000, now + 1)).resolves.toEqual({
            allowed: true,
            remaining: 0,
            resetAt: now + 1_000
        });
        await expect(consumeRateLimit(key, 2, 1_000, now + 2)).resolves.toEqual({
            allowed: false,
            remaining: 0,
            resetAt: now + 1_000
        });
        await expect(consumeRateLimit(key, 2, 1_000, now + 1_001)).resolves.toEqual({
            allowed: true,
            remaining: 1,
            resetAt: now + 2_001
        });
    });

    it("enforces the limit atomically across concurrent requests", async () => {
        const { consumeRateLimit } = await import("./rate-limit");
        const key = `${keyPrefix}:concurrent`;
        const decisions = await Promise.all(
            Array.from({ length: 5 }, () => consumeRateLimit(key, 3, 1_000, 1_710_000_010_000))
        );

        expect(decisions.filter((decision) => decision.allowed)).toHaveLength(3);
        expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(2);
        expect(decisions.every((decision) => decision.resetAt === 1_710_000_011_000)).toBe(true);
    });
});
