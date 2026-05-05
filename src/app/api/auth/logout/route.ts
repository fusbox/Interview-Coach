import { NextRequest, NextResponse } from "next/server";
import { getAppSessionCookieName, getAppSessionCookieOptions } from "@/lib/server/auth/app-session";
import { revokeAppSession } from "@/lib/server/auth/app-auth";

export async function POST(request: NextRequest) {
    const cookieName = getAppSessionCookieName();
    const sessionToken = request.cookies.get(cookieName)?.value;

    await revokeAppSession(sessionToken);

    const cookieOptions = getAppSessionCookieOptions();
    const response = NextResponse.json({ success: true });
    response.cookies.set(cookieName, "", {
        ...cookieOptions,
        maxAge: 0,
    });

    return response;
}

