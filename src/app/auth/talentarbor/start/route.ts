import { NextResponse, type NextRequest } from "next/server";

import {
    candidateLoginNextCookieName,
    resolveCandidateLoginNext,
    talentArborCandidateLoginUrl,
} from "@/lib/server/candidate-login-intent";

export function GET(request: NextRequest) {
    const next = resolveCandidateLoginNext(request.nextUrl.searchParams.get("next"));
    const response = NextResponse.redirect(talentArborCandidateLoginUrl, 302);

    response.cookies.set(candidateLoginNextCookieName, next, {
        httpOnly: true,
        maxAge: 10 * 60,
        path: "/",
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
    });

    return response;
}
