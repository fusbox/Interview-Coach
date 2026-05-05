import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const postgresQueryMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createAdminClient: () => ({
        rpc: rpcMock
    })
}));

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
        rpcMock.mockReset();
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

    it("uses the supabase backend when configured", async () => {
        process.env = { ...process.env, RATE_LIMIT_BACKEND: "supabase" };
        rpcMock.mockResolvedValue({
            data: [{ allowed: true, remaining: 4, reset_at_ms: 5000 }],
            error: null
        });

        const { consumeRateLimit } = await import("./rate-limit");
        const decision = await consumeRateLimit("bucket-1", 5, 1000, 2000);

        expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit_bucket", {
            p_bucket_key: "bucket-1",
            p_max_requests: 5,
            p_window_ms: 1000,
            p_now_ms: 2000
        });
        expect(decision).toEqual({ allowed: true, remaining: 4, resetAt: 5000 });
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

    it("enforces limits across isolated module instances with the shared supabase backend", async () => {
        process.env = { ...process.env, RATE_LIMIT_BACKEND: "supabase" };
        const sharedBuckets = new Map<string, { count: number; resetAt: number }>();

        rpcMock.mockImplementation(async (_name, params: {
            p_bucket_key: string;
            p_max_requests: number;
            p_window_ms: number;
            p_now_ms: number;
        }) => {
            const existing = sharedBuckets.get(params.p_bucket_key);

            if (!existing || existing.resetAt <= params.p_now_ms) {
                const resetAt = params.p_now_ms + params.p_window_ms;
                sharedBuckets.set(params.p_bucket_key, { count: 1, resetAt });
                return {
                    data: [{ allowed: true, remaining: params.p_max_requests - 1, reset_at_ms: resetAt }],
                    error: null
                };
            }

            if (existing.count >= params.p_max_requests) {
                return {
                    data: [{ allowed: false, remaining: 0, reset_at_ms: existing.resetAt }],
                    error: null
                };
            }

            existing.count += 1;
            sharedBuckets.set(params.p_bucket_key, existing);
            return {
                data: [{
                    allowed: true,
                    remaining: params.p_max_requests - existing.count,
                    reset_at_ms: existing.resetAt
                }],
                error: null
            };
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
        expect(rpcMock).toHaveBeenCalledTimes(3);
    });

    it("defaults to the supabase backend in production", async () => {
        process.env = { ...process.env, NODE_ENV: "production" };
        delete process.env.RATE_LIMIT_BACKEND;
        rpcMock.mockResolvedValue({
            data: [{ allowed: false, remaining: 0, reset_at_ms: 9000 }],
            error: null
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
