import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createAdminClient: () => ({
        rpc: rpcMock
    })
}));

const originalEnv = { ...process.env };

describe("consumeRateLimit", () => {
    beforeEach(() => {
        process.env = { ...originalEnv, NODE_ENV: "test" };
        vi.resetModules();
        rpcMock.mockReset();
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
