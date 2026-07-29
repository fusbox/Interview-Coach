import { NextResponse } from "next/server";

import { candidatePasswordResetRequestSchema } from "@/features/candidate-auth-v2/candidate-account-contract";
import { resolveCandidateAccountOrigin } from "@/features/candidate-auth-v2/candidate-account-origin";
import { readJsonBody } from "@/features/candidate-auth-v2/candidate-account-request";
import type { CandidateAccountRateLimiter } from "@/features/candidate-auth-v2/candidate-account-rate-limit";
import { enforceCandidateAccountRateLimit } from "@/features/candidate-auth-v2/candidate-account-route-rate-limit";
import { requestCandidatePasswordReset } from "@/features/candidate-auth-v2/candidate-password-recovery-service";
import { isTrustedSameOriginMutationRequest } from "@/lib/server/trusted-mutation-request";

type RequestReset = typeof requestCandidatePasswordReset;

export function createCandidatePasswordResetRequestRouteHandler(dependencies: {
    requestReset?: RequestReset;
    resolveOrigin?: typeof resolveCandidateAccountOrigin;
    rateLimit?: CandidateAccountRateLimiter;
} = {}) {
    const requestReset = dependencies.requestReset ?? requestCandidatePasswordReset;
    const resolveOrigin = dependencies.resolveOrigin ?? resolveCandidateAccountOrigin;

    return async function candidatePasswordResetRequestRoute(request: Request) {
        if (!isTrustedSameOriginMutationRequest(request)) return accessDenied();
        const rateLimited = await enforceCandidateAccountRateLimit(
            request,
            "password_reset_request",
            dependencies.rateLimit,
        );
        if (rateLimited) return rateLimited;

        const parsed = candidatePasswordResetRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) return invalidRequest();

        try {
            const result = await requestReset(parsed.data.email, resolveOrigin(request.url));
            return NextResponse.json({
                status: "reset_pending",
                message: "If that candidate account exists, a password reset email is on its way.",
                ...(result.outcome === "accepted" && result.developmentResetUrl
                    ? { developmentResetUrl: result.developmentResetUrl }
                    : {}),
            }, { status: 202 });
        } catch {
            return NextResponse.json({
                code: "PASSWORD_RESET_UNAVAILABLE",
                message: "Password recovery is temporarily unavailable. Try again shortly.",
            }, { status: 503 });
        }
    };
}

function invalidRequest() {
    return NextResponse.json({
        code: "INVALID_REQUEST",
        message: "Enter a valid email address.",
    }, { status: 400 });
}

function accessDenied() {
    return NextResponse.json({
        code: "PASSWORD_RESET_ACCESS_DENIED",
        message: "Password recovery is unavailable from this request.",
    }, { status: 403 });
}
