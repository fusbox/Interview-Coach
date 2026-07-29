import { NextResponse } from "next/server";

import { revokeAppSession } from "@/features/app-auth-v2/app-auth";
import { isTrustedSameOriginMutationRequest } from "@/lib/server/trusted-mutation-request";
import { clearCandidateAppSessionCookie } from "@/features/candidate-auth-v2/candidate-app-session";
import { readCandidateAccountRequestMetadata } from "@/features/candidate-auth-v2/candidate-account-request";
import { CANDIDATE_APP_SESSION_COOKIE } from "@/features/candidate-auth-v2/candidate-route-access";

type Revoke = typeof revokeAppSession;

export function createCandidateLogoutRouteHandler(dependencies: {
    revoke?: Revoke;
} = {}) {
    const revoke = dependencies.revoke ?? revokeAppSession;
    return async function candidateLogoutRoute(request: Request) {
        if (!isTrustedSameOriginMutationRequest(request)) {
            return NextResponse.json({ message: "Sign out is unavailable from this request." }, { status: 403 });
        }
        const token = readCookie(request.headers.get("cookie"), CANDIDATE_APP_SESSION_COOKIE);
        try {
            await revoke(token, readCandidateAccountRequestMetadata(request));
            const response = NextResponse.json({ status: "signed_out" });
            clearCandidateAppSessionCookie(response);
            return response;
        } catch {
            return NextResponse.json({
                code: "LOGOUT_UNAVAILABLE",
                message: "Sign out is temporarily unavailable. Try again.",
            }, { status: 503 });
        }
    };
}

function readCookie(header: string | null, name: string) {
    for (const part of header?.split(";") ?? []) {
        const [rawName, ...rawValue] = part.trim().split("=");
        if (rawName === name) {
            try {
                return decodeURIComponent(rawValue.join("="));
            } catch {
                return undefined;
            }
        }
    }
    return undefined;
}
