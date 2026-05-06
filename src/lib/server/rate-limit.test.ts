import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postgresQueryMock = vi.fn();

vi.mock("@/lib/server/db/postgres", () => ({
    getPostgresPool: () => ({
        query: postgresQueryMock
    })
}));

const originalEnv = { ...process.env };

describe("consumeRateLimit", () => {
    beforeEach(() => {
        process.env = { ...originalEnv, NODE_ENV: "test" };
        vi.resetModules();
        postgresQueryMock.mockReset();
    });

    afterEach(async () => {
        process.env = { ...originalEnv };
        const { clearRateLimitBuckets } = await import("./rate-limit");
        await clearRateLimitBuckets();
    });

    it("allows requests within limit and blocks after max with the memory backend", async () => {
        const { clearRateLimitBuckets, consumeRateLimit } = await import("./rate-limit");
        await clearRateLimitBuckets();
        const key = "k1";
        const now = 1000;

        expect((await consumeRateLimit(key, 2, 10000, now)).allowed).toBe(true);
        expect((await consumeRateLimit(key, 2, 10000, now + 1)).allowed).toBe(true);
        expect((await consumeRateLimit(key, 2, 10000, now + 2)).allowed).toBe(false);
    });

    it("resets after window with the memory backend", async () => {
        const { clearRateLimitBuckets, consumeRateLimit } = await import("./rate-limit");
        await clearRateLimitBuckets();
        const key = "k2";
        const now = 1000;

        expect((await consumeRateLimit(key, 1, 10, now)).allowed).toBe(true);
        expect((await consumeRateLimit(key, 1, 10, now + 1)).allowed).toBe(false);
        expect((await consumeRateLimit(key, 1, 10, now + 11)).allowed).toBe(true);
    });

    it("uses the postgres backend when configured", async () => {
        process.env = { ...process.env, RATE_LIMIT_BACKEND: "postgres" };
        postgresQueryMock.mockResolvedValue({
            rows: [{ allowed: true, remaining: 2, reset_at_ms: "7000" }]
        });

        const { consumeRateLimit } = await import("./rate-limit");
        const decision = await consumeRateLimit("bucket-pg", 3, 1000, 6000);

        expect(postgresQueryMock).toHaveBeenCalledWith(
            expect.stringContaining("public.consume_rate_limit_bucket($1, $2, $3, $4)"),
            ["bucket-pg", 3, 1000, 6000]
        );
        expect(decision).toEqual({ allowed: true, remaining: 2, resetAt: 7000 });
    });

    it("enforces limits across isolated module instances with the shared postgres backend", async () => {
        process.env = { ...process.env, RATE_LIMIT_BACKEND: "postgres" };
        const sharedBuckets = new Map<string, { count: number; resetAt: number }>();

        postgresQueryMock.mockImplementation(async (_query, params: [string, number, number, number]) => {
            const [bucketKey, maxRequests, windowMs, nowMs] = params;
            const existing = sharedBuckets.get(bucketKey);

            if (!existing || existing.resetAt <= nowMs) {
                const resetAt = nowMs + windowMs;
                sharedBuckets.set(bucketKey, { count: 1, resetAt });
                return { rows: [{ allowed: true, remaining: maxRequests - 1, reset_at_ms: resetAt }] };
            }

            if (existing.count >= maxRequests) {
                return { rows: [{ allowed: false, remaining: 0, reset_at_ms: existing.resetAt }] };
            }

            existing.count += 1;
            sharedBuckets.set(bucketKey, existing);
            return { rows: [{ allowed: true, remaining: maxRequests - existing.count, reset_at_ms: existing.resetAt }] };
        });

        const firstModule = await import("./rate-limit");
        const firstDecision = await firstModule.consumeRateLimit("shared-bucket", 2, 1000, 1000);
        const secondDecision = await firstModule.consumeRateLimit("shared-bucket", 2, 1000, 1001);

        vi.resetModules();

        const secondModule = await import("./rate-limit");
        const thirdDecision = await secondModule.consumeRateLimit("shared-bucket", 2, 1000, 1002);

        expect(firstDecision).toEqual({ allowed: true, remaining: 1, resetAt: 2000 });
        expect(secondDecision).toEqual({ allowed: true, remaining: 0, resetAt: 2000 });
        expect(thirdDecision).toEqual({ allowed: false, remaining: 0, resetAt: 2000 });
        expect(postgresQueryMock).toHaveBeenCalledTimes(3);
    });

    it("defaults to the postgres backend in production", async () => {
        process.env = { ...process.env, NODE_ENV: "production" };
        delete process.env.RATE_LIMIT_BACKEND;
        postgresQueryMock.mockResolvedValue({
            rows: [{ allowed: false, remaining: 0, reset_at_ms: "9000" }]
        });

        const { consumeRateLimit } = await import("./rate-limit");
        const decision = await consumeRateLimit("bucket-2", 1, 1000, 3000);

        expect(decision).toEqual({ allowed: false, remaining: 0, resetAt: 9000 });
    });

    it("rejects the memory backend in production", async () => {
        process.env = { ...process.env, NODE_ENV: "production", RATE_LIMIT_BACKEND: "memory" };

        const { consumeRateLimit } = await import("./rate-limit");

        await expect(consumeRateLimit("bucket-3", 1, 1000, 3000)).rejects.toThrow(
            "RATE_LIMIT_BACKEND=memory is not allowed in production."
        );
    });
});
