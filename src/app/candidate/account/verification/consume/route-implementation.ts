import { NextResponse } from "next/server";

import { isTrustedSameOriginMutationRequest } from "@/lib/server/trusted-mutation-request";
import { candidateVerificationConsumeRequestSchema } from "@/features/candidate-auth-v2/candidate-account-contract";
import { readJsonBody } from "@/features/candidate-auth-v2/candidate-account-request";
import { consumeCandidateEmailVerification } from "@/features/candidate-auth-v2/candidate-account-service";
import type { CandidateAccountRateLimiter } from "@/features/candidate-auth-v2/candidate-account-rate-limit";
import { enforceCandidateAccountRateLimit } from "@/features/candidate-auth-v2/candidate-account-route-rate-limit";

type Consume = typeof consumeCandidateEmailVerification;

export function createCandidateVerificationConsumeRouteHandler(dependencies: {
    consume?: Consume;
    rateLimit?: CandidateAccountRateLimiter;
} = {}) {
    const consume = dependencies.consume ?? consumeCandidateEmailVerification;
    return async function candidateVerificationConsumeRoute(request: Request) {
        if (!isTrustedSameOriginMutationRequest(request)) return accessDenied();
        const rateLimited = await enforceCandidateAccountRateLimit(
            request,
            "verification_consume",
            dependencies.rateLimit,
        );
        if (rateLimited) return rateLimited;
        const parsed = candidateVerificationConsumeRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) return invalidToken();

        try {
            const result = await consume(parsed.data.token);
            if (result.outcome === "expired") {
                return NextResponse.json({
                    code: "VERIFICATION_EXPIRED",
                    message: "This verification link has expired. Request a new email.",
                }, { status: 410 });
            }
            if (result.outcome === "invalid") return invalidToken();
            return NextResponse.json({
                status: "email_verified",
                outcome: result.outcome,
                message: result.outcome === "already_verified"
                    ? "Your email is already verified."
                    : "Your email is verified.",
            });
        } catch {
            return NextResponse.json({
                code: "VERIFICATION_UNAVAILABLE",
                message: "Email verification is temporarily unavailable. Try again shortly.",
            }, { status: 503 });
        }
    };
}

function invalidToken() {
    return NextResponse.json({
        code: "VERIFICATION_INVALID",
        message: "This verification link is invalid or has already been replaced.",
    }, { status: 400 });
}

function accessDenied() {
    return NextResponse.json({
        code: "VERIFICATION_ACCESS_DENIED",
        message: "Email verification is unavailable from this request.",
    }, { status: 403 });
}
