import { NextRequest, NextResponse } from "next/server";
import { getAppSessionCookieName } from "./app-session-cookie";
import { resolveRecruiterReturnTarget } from "./recruiter-return-target";

export const RECRUITER_RETURN_TARGET_HEADER = "x-interview-coach-recruiter-return-target";

export function protectRecruiterRoute(request: NextRequest): NextResponse {
    if (request.cookies.get(getAppSessionCookieName())?.value) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set(
            RECRUITER_RETURN_TARGET_HEADER,
            resolveRecruiterReturnTarget(`${request.nextUrl.pathname}${request.nextUrl.search}`),
        );
        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
        "next",
        resolveRecruiterReturnTarget(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    );
    return NextResponse.redirect(loginUrl);
}
