import { describe, expect, it } from 'vitest';
import { clearRateLimitBuckets, consumeRateLimit } from './rate-limit';

describe('consumeRateLimit', () => {
    it('allows requests within limit and blocks after max', () => {
        clearRateLimitBuckets();
        const key = 'k1';
        const now = 1000;

        expect(consumeRateLimit(key, 2, 10000, now).allowed).toBe(true);
        expect(consumeRateLimit(key, 2, 10000, now + 1).allowed).toBe(true);
        expect(consumeRateLimit(key, 2, 10000, now + 2).allowed).toBe(false);
    });

    it('resets after window', () => {
        clearRateLimitBuckets();
        const key = 'k2';
        const now = 1000;

        expect(consumeRateLimit(key, 1, 10, now).allowed).toBe(true);
        expect(consumeRateLimit(key, 1, 10, now + 1).allowed).toBe(false);
        expect(consumeRateLimit(key, 1, 10, now + 11).allowed).toBe(true);
    });
});
