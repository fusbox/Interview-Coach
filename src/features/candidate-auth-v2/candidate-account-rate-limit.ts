import { createHash } from "node:crypto";

import type { AppAuthQueryClient } from "@/features/app-auth-v2/app-auth-postgres-runtime";
import { createAppAuthQueryClientFromEnv } from "@/features/app-auth-v2/app-auth-postgres-runtime";

import { readCandidateAccountRequestMetadata } from "./candidate-account-request";

export type CandidateAccountRateLimitAction =
    | "login"
    | "register"
    | "verification_resend"
    | "verification_consume"
    | "password_reset_request"
    | "password_reset_consume";

export type CandidateAccountRateLimitResult =
    | { allowed: true }
    | { allowed: false; retryAfterSeconds: number };

type RatePolicy = {
    maxRequests: number;
    windowMs: number;
};

const POLICIES: Record<CandidateAccountRateLimitAction, RatePolicy> = {
    login: { maxRequests: 50, windowMs: 15 * 60 * 1000 },
    register: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
    verification_resend: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
    verification_consume: { maxRequests: 30, windowMs: 15 * 60 * 1000 },
    password_reset_request: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
    password_reset_consume: { maxRequests: 20, windowMs: 15 * 60 * 1000 },
};

export type CandidateAccountRateLimiter = (
    request: Request,
    action: CandidateAccountRateLimitAction,
) => Promise<CandidateAccountRateLimitResult>;

export function createCandidateAccountRateLimiter(
    client: AppAuthQueryClient = createAppAuthQueryClientFromEnv(),
    now: () => Date = () => new Date(),
): CandidateAccountRateLimiter {
    return async (request, action) => {
        const metadata = readCandidateAccountRequestMetadata(request);
        const policy = POLICIES[action];
        const nowMs = now().getTime();
        const result = await client.query(`
            select *
            from public.consume_rate_limit_bucket($1, $2, $3, $4)
        `, [
            createBucketKey(action, metadata.ipAddress),
            policy.maxRequests,
            policy.windowMs,
            nowMs,
        ]);
        const row = result.rows[0];
        if (row?.allowed === true) return { allowed: true };

        const resetAtMs = Number(row?.reset_at_ms);
        const retryAfterSeconds = Number.isFinite(resetAtMs)
            ? Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000))
            : Math.ceil(policy.windowMs / 1000);
        await recordRateLimitSafely(client, {
            action,
            retryAfterSeconds,
            ...metadata,
        });
        return { allowed: false, retryAfterSeconds };
    };
}

export function createCandidateAccountRateLimitBucketKey(
    action: CandidateAccountRateLimitAction,
    ipAddress: string | null,
) {
    return createBucketKey(action, ipAddress);
}

async function recordRateLimitSafely(
    client: AppAuthQueryClient,
    input: {
        action: CandidateAccountRateLimitAction;
        retryAfterSeconds: number;
        ipAddress: string | null;
        userAgent: string | null;
    },
) {
    try {
        await client.query(`
            insert into public.auth_audit_events (
              event_type,
              outcome,
              ip_address,
              user_agent,
              metadata
            )
            values (
              'candidate_account_rate_limit',
              'failed',
              nullif($1, '')::inet,
              $2,
              $3::jsonb
            )
        `, [
            input.ipAddress,
            input.userAgent,
            JSON.stringify({
                action: input.action,
                reason: "rate_limited",
                retryAfterSeconds: input.retryAfterSeconds,
            }),
        ]);
    } catch {
        // The authentication mutation remains denied when audit telemetry is degraded.
    }
}

function createBucketKey(
    action: CandidateAccountRateLimitAction,
    ipAddress: string | null,
) {
    const sourceDigest = createHash("sha256")
        .update(ipAddress ?? "unattributed")
        .digest("hex");
    return `candidate-account:${action}:${sourceDigest}`;
}
