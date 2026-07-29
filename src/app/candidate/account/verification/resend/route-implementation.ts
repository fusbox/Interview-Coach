import { NextResponse } from "next/server";

import { isTrustedSameOriginMutationRequest } from "@/lib/server/trusted-mutation-request";
import { candidateVerificationResendRequestSchema } from "@/features/candidate-auth-v2/candidate-account-contract";
import { resolveCandidateAccountOrigin } from "@/features/candidate-auth-v2/candidate-account-origin";
import { readJsonBody } from "@/features/candidate-auth-v2/candidate-account-request";
import { resendCandidateEmailVerification } from "@/features/candidate-auth-v2/candidate-account-service";
import type { CandidateAccountRateLimiter } from "@/features/candidate-auth-v2/candidate-account-rate-limit";
import { enforceCandidateAccountRateLimit } from "@/features/candidate-auth-v2/candidate-account-route-rate-limit";

type Resend = typeof resendCandidateEmailVerification;

export function createCandidateVerificationResendRouteHandler(dependencies: {
    resend?: Resend;
    resolveOrigin?: typeof resolveCandidateAccountOrigin;
    rateLimit?: CandidateAccountRateLimiter;
} = {}) {
    const resend = dependencies.resend ?? resendCandidateEmailVerification;
    const resolveOrigin = dependencies.resolveOrigin ?? resolveCandidateAccountOrigin;

    return async function candidateVerificationResendRoute(request: Request) {
        if (!isTrustedSameOriginMutationRequest(request)) return accessDenied();
        const rateLimited = await enforceCandidateAccountRateLimit(
            request,
            "verification_resend",
            dependencies.rateLimit,
        );
        if (rateLimited) return rateLimited;
        const parsed = candidateVerificationResendRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) return invalidRequest();

        try {
            const result = await resend(parsed.data.email, resolveOrigin(request.url));
            return NextResponse.json({
                status: "verification_pending",
                message: "If that account needs verification, a new email is on its way.",
                ...(result.outcome === "accepted" && result.developmentVerificationUrl
                    ? { developmentVerificationUrl: result.developmentVerificationUrl }
                    : {}),
            }, { status: 202 });
        } catch {
            return NextResponse.json({
                code: "VERIFICATION_UNAVAILABLE",
                message: "Verification email is temporarily unavailable. Try again shortly.",
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
        code: "VERIFICATION_ACCESS_DENIED",
        message: "Verification email is unavailable from this request.",
    }, { status: 403 });
}
