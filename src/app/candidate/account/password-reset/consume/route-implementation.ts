import { NextResponse } from "next/server";

import { candidatePasswordResetConsumeRequestSchema } from "@/features/candidate-auth-v2/candidate-account-contract";
import { readCandidateAccountRequestMetadata, readJsonBody } from "@/features/candidate-auth-v2/candidate-account-request";
import type { CandidateAccountRateLimiter } from "@/features/candidate-auth-v2/candidate-account-rate-limit";
import { enforceCandidateAccountRateLimit } from "@/features/candidate-auth-v2/candidate-account-route-rate-limit";
import { consumeCandidatePasswordReset } from "@/features/candidate-auth-v2/candidate-password-recovery-service";
import { isTrustedSameOriginMutationRequest } from "@/lib/server/trusted-mutation-request";

type ConsumeReset = typeof consumeCandidatePasswordReset;

export function createCandidatePasswordResetConsumeRouteHandler(dependencies: {
    consumeReset?: ConsumeReset;
    rateLimit?: CandidateAccountRateLimiter;
} = {}) {
    const consumeReset = dependencies.consumeReset ?? consumeCandidatePasswordReset;

    return async function candidatePasswordResetConsumeRoute(request: Request) {
        if (!isTrustedSameOriginMutationRequest(request)) return accessDenied();
        const rateLimited = await enforceCandidateAccountRateLimit(
            request,
            "password_reset_consume",
            dependencies.rateLimit,
        );
        if (rateLimited) return rateLimited;

        const parsed = candidatePasswordResetConsumeRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) return invalidReset();

        try {
            const result = await consumeReset(
                parsed.data,
                readCandidateAccountRequestMetadata(request),
            );
            if (result.outcome === "expired") {
                return NextResponse.json({
                    code: "PASSWORD_RESET_EXPIRED",
                    message: "This password reset link has expired. Request a new one.",
                }, { status: 410 });
            }
            if (result.outcome === "invalid") return invalidReset();

            return NextResponse.json({
                status: "password_reset",
                message: "Your password has been reset. Sign in again on each device.",
                revokedSessionCount: result.revokedSessionCount,
            });
        } catch {
            return NextResponse.json({
                code: "PASSWORD_RESET_UNAVAILABLE",
                message: "Password reset is temporarily unavailable. Try again shortly.",
            }, { status: 503 });
        }
    };
}

function invalidReset() {
    return NextResponse.json({
        code: "PASSWORD_RESET_INVALID",
        message: "This password reset link is invalid or has already been used.",
    }, { status: 400 });
}

function accessDenied() {
    return NextResponse.json({
        code: "PASSWORD_RESET_ACCESS_DENIED",
        message: "Password reset is unavailable from this request.",
    }, { status: 403 });
}
