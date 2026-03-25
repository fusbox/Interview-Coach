import type { RateLimitBackend, RateLimitConsumeParams, RateLimitDecision } from "@/lib/server/rate-limit/types";

type Bucket = {
    count: number;
    resetAt: number;
};

type SupabaseRateLimitRow = {
    allowed: boolean;
    remaining: number;
    reset_at_ms: number;
};

export class MemoryRateLimitBackend implements RateLimitBackend {
    private readonly buckets = new Map<string, Bucket>();

    async consume(params: RateLimitConsumeParams): Promise<RateLimitDecision> {
        const now = params.now ?? Date.now();
        const existing = this.buckets.get(params.key);

        if (!existing || existing.resetAt <= now) {
            const resetAt = now + params.windowMs;
            this.buckets.set(params.key, { count: 1, resetAt });
            return { allowed: true, remaining: Math.max(0, params.maxRequests - 1), resetAt };
        }

        if (existing.count >= params.maxRequests) {
            return { allowed: false, remaining: 0, resetAt: existing.resetAt };
        }

        existing.count += 1;
        this.buckets.set(params.key, existing);

        return {
            allowed: true,
            remaining: Math.max(0, params.maxRequests - existing.count),
            resetAt: existing.resetAt
        };
    }

    clear(): void {
        this.buckets.clear();
    }
}

export class SupabaseRateLimitBackend implements RateLimitBackend {
    async consume(params: RateLimitConsumeParams): Promise<RateLimitDecision> {
        const { createAdminClient } = await import("@/lib/supabase/server");
        const supabase = createAdminClient();
        const { data, error } = await supabase.rpc("consume_rate_limit_bucket", {
            p_bucket_key: params.key,
            p_max_requests: params.maxRequests,
            p_window_ms: params.windowMs,
            p_now_ms: params.now ?? Date.now()
        });

        if (error) {
            throw new Error(`Failed to consume rate limit bucket: ${error.message}`);
        }

        const row = Array.isArray(data) ? data[0] : data as SupabaseRateLimitRow | null;
        if (!row || typeof row.allowed !== "boolean" || typeof row.remaining !== "number" || typeof row.reset_at_ms !== "number") {
            throw new Error("Failed to consume rate limit bucket: invalid backend response");
        }

        return {
            allowed: row.allowed,
            remaining: row.remaining,
            resetAt: row.reset_at_ms
        };
    }
}
