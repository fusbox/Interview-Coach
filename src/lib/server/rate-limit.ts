export type RateLimitDecision = {
    allowed: boolean;
    remaining: number;
    resetAt: number;
};

type Bucket = {
    count: number;
    resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function consumeRateLimit(key: string, maxRequests: number, windowMs: number, now: number = Date.now()): RateLimitDecision {
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
        const resetAt = now + windowMs;
        buckets.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: Math.max(0, maxRequests - 1), resetAt };
    }

    if (existing.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }

    existing.count += 1;
    buckets.set(key, existing);

    return {
        allowed: true,
        remaining: Math.max(0, maxRequests - existing.count),
        resetAt: existing.resetAt
    };
}

export function clearRateLimitBuckets() {
    buckets.clear();
}
