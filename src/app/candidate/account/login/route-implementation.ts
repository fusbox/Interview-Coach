import { NextResponse } from "next/server";

import { authenticateWithPassword } from "@/features/app-auth-v2/app-auth";
import { isTrustedSameOriginMutationRequest } from "@/lib/server/trusted-mutation-request";
import { candidateLoginRequestSchema } from "@/features/candidate-auth-v2/candidate-account-contract";
import { setCandidateAppSessionCookie } from "@/features/candidate-auth-v2/candidate-app-session";
import { readCandidateAccountRequestMetadata, readJsonBody } from "@/features/candidate-auth-v2/candidate-account-request";
import type { CandidateAccountRateLimiter } from "@/features/candidate-auth-v2/candidate-account-rate-limit";
import { enforceCandidateAccountRateLimit } from "@/features/candidate-auth-v2/candidate-account-route-rate-limit";

type Authenticate = typeof authenticateWithPassword;

export function createCandidateLoginRouteHandler(dependencies: {
    authenticate?: Authenticate;
    rateLimit?: CandidateAccountRateLimiter;
} = {}) {
    const authenticate = dependencies.authenticate ?? authenticateWithPassword;
    return async function candidateLoginRoute(request: Request) {
        if (!isTrustedSameOriginMutationRequest(request)) return accessDenied();
        const rateLimited = await enforceCandidateAccountRateLimit(request, "login", dependencies.rateLimit);
        if (rateLimited) return rateLimited;
        const parsed = candidateLoginRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) return invalidLogin();

        try {
            const result = await authenticate(
                parsed.data.email,
                parsed.data.password,
                readCandidateAccountRequestMetadata(request),
                {},
                {
                    requiredRole: "candidate",
                    requireVerifiedEmail: true,
                    requireCandidateProfile: true,
                },
            );
            if (!result.ok) return invalidLogin();

            const response = NextResponse.json({
                status: "authenticated",
                expiresAt: result.expiresAt,
            });
            setCandidateAppSessionCookie(response, result.sessionToken);
            return response;
        } catch {
            return NextResponse.json({
                code: "AUTHENTICATION_UNAVAILABLE",
                message: "Sign in is temporarily unavailable. Try again shortly.",
            }, { status: 503 });
        }
    };
}

function invalidLogin() {
    return NextResponse.json({
        code: "AUTHENTICATION_FAILED",
        message: "Invalid email or password.",
    }, { status: 401 });
}

function accessDenied() {
    return NextResponse.json({
        code: "AUTHENTICATION_ACCESS_DENIED",
        message: "Sign in is unavailable from this request.",
    }, { status: 403 });
}
