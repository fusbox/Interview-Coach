import { describe, expect, it, vi } from "vitest";

import {
    createCandidateAccountRateLimitBucketKey,
    createCandidateAccountRateLimiter,
} from "./candidate-account-rate-limit";

describe("candidate account rate limit", () => {
    it("uses a purpose-scoped digest rather than a raw request source", () => {
        const key = createCandidateAccountRateLimitBucketKey("login", "192.0.2.10");
        expect(key).toMatch(/^candidate-account:login:[0-9a-f]{64}$/);
        expect(key).not.toContain("192.0.2.10");
    });

    it("returns a bounded retry delay and records metadata-only denial facts", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({
                rows: [{
                    allowed: false,
                    remaining: 0,
                    reset_at_ms: Date.parse("2026-07-28T12:00:45.000Z"),
                }],
            })
            .mockResolvedValueOnce({ rows: [] });
        const rateLimit = createCandidateAccountRateLimiter(
            { query },
            () => new Date("2026-07-28T12:00:00.000Z"),
        );
        const request = new Request("https://example.com/candidate/account/login", {
            headers: {
                "x-real-ip": "192.0.2.10",
                "user-agent": "test-agent",
            },
        });

        await expect(rateLimit(request, "login")).resolves.toEqual({
            allowed: false,
            retryAfterSeconds: 45,
        });
        const bucketKey = query.mock.calls[0][1][0];
        const auditMetadata = JSON.parse(query.mock.calls[1][1][2]);
        expect(bucketKey).not.toContain("192.0.2.10");
        expect(auditMetadata).toEqual({
            action: "login",
            reason: "rate_limited",
            retryAfterSeconds: 45,
        });
    });
});
