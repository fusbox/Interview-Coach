import { NextResponse } from "next/server";

import { isTrustedSameOriginMutationRequest } from "@/lib/server/trusted-mutation-request";
import { candidateRegistrationRequestSchema } from "@/features/candidate-auth-v2/candidate-account-contract";
import { resolveCandidateAccountOrigin } from "@/features/candidate-auth-v2/candidate-account-origin";
import { readCandidateAccountRequestMetadata, readJsonBody } from "@/features/candidate-auth-v2/candidate-account-request";
import { registerCandidateAccount } from "@/features/candidate-auth-v2/candidate-account-service";
import type { CandidateAccountRateLimiter } from "@/features/candidate-auth-v2/candidate-account-rate-limit";
import { enforceCandidateAccountRateLimit } from "@/features/candidate-auth-v2/candidate-account-route-rate-limit";

type Register = typeof registerCandidateAccount;

export function createCandidateRegisterRouteHandler(dependencies: {
    register?: Register;
    resolveOrigin?: typeof resolveCandidateAccountOrigin;
    rateLimit?: CandidateAccountRateLimiter;
} = {}) {
    const register = dependencies.register ?? registerCandidateAccount;
    const resolveOrigin = dependencies.resolveOrigin ?? resolveCandidateAccountOrigin;

    return async function candidateRegisterRoute(request: Request) {
        if (!isTrustedSameOriginMutationRequest(request)) return accessDenied();
        const rateLimited = await enforceCandidateAccountRateLimit(request, "register", dependencies.rateLimit);
        if (rateLimited) return rateLimited;
        const parsed = candidateRegistrationRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
            return NextResponse.json({
                code: "INVALID_REGISTRATION",
                message: "Review the highlighted account details and try again.",
            }, { status: 400 });
        }

        try {
            const result = await register(
                parsed.data,
                readCandidateAccountRequestMetadata(request),
                resolveOrigin(request.url),
            );
            return NextResponse.json({
                status: "verification_pending",
                message: "If this address can be registered, a verification email is on its way.",
                ...(result.outcome === "accepted" && result.developmentVerificationUrl
                    ? { developmentVerificationUrl: result.developmentVerificationUrl }
                    : {}),
            }, { status: 202 });
        } catch {
            return NextResponse.json({
                code: "REGISTRATION_UNAVAILABLE",
                message: "Account creation is temporarily unavailable. Try again shortly.",
            }, { status: 503 });
        }
    };
}

function accessDenied() {
    return NextResponse.json({
        code: "REGISTRATION_ACCESS_DENIED",
        message: "Account creation is unavailable from this request.",
    }, { status: 403 });
}
