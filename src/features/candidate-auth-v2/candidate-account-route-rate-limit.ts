import { NextResponse } from "next/server";

import {
    createCandidateAccountRateLimiter,
    type CandidateAccountRateLimitAction,
    type CandidateAccountRateLimiter,
    type CandidateAccountRateLimitResult,
} from "./candidate-account-rate-limit";

export async function enforceCandidateAccountRateLimit(
    request: Request,
    action: CandidateAccountRateLimitAction,
    rateLimit: CandidateAccountRateLimiter = createCandidateAccountRateLimiter(),
): Promise<NextResponse | null> {
    let result: CandidateAccountRateLimitResult;
    try {
        result = await rateLimit(request, action);
    } catch {
        return NextResponse.json({
            code: "AUTHENTICATION_CONTROL_UNAVAILABLE",
            message: "This account action is temporarily unavailable. Try again shortly.",
        }, { status: 503 });
    }
    if (result.allowed) return null;

    return NextResponse.json({
        code: "RATE_LIMITED",
        message: "Too many attempts. Wait a moment and try again.",
    }, {
        status: 429,
        headers: {
            "retry-after": String(result.retryAfterSeconds),
        },
    });
}
