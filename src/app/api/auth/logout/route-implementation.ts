import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { revokeAppSession } from "@/features/recruiter-auth-v2/app-auth";
import {
    getAppSessionCookieName,
    getAppSessionCookieOptions,
} from "@/features/recruiter-auth-v2/app-session";

type SessionRevoker = typeof revokeAppSession;

export function createLogoutRouteHandler(dependencies: {
    revoke?: SessionRevoker;
} = {}) {
    const revoke = dependencies.revoke ?? revokeAppSession;

    return async function logoutRoute(request: NextRequest) {
        const cookieName = getAppSessionCookieName();
        const sessionToken = request.cookies.get(cookieName)?.value;

        try {
            await revoke(sessionToken, {
                userAgent: request.headers.get("user-agent"),
                ipAddress: readRequestIp(request),
            });
        } catch {
            return NextResponse.json({
                code: "LOGOUT_UNAVAILABLE",
                message: "Sign out is temporarily unavailable. Please try again.",
            }, { status: 503 });
        }

        const cookieOptions = getAppSessionCookieOptions();
        const response = NextResponse.json({ success: true });
        response.cookies.set(cookieName, "", { ...cookieOptions, maxAge: 0 });
        return response;
    };
}

function readRequestIp(request: NextRequest): string | null {
    const candidates = [
        request.headers.get("x-real-ip"),
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    ];
    return candidates.find((value): value is string => Boolean(value && isIP(value))) ?? null;
}
