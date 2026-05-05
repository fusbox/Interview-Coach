import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateWithPassword } from "@/lib/server/auth/app-auth";
import { getAppSessionCookieOptions } from "@/lib/server/auth/app-session";

const LoginRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

function requestIp(request: NextRequest): string | null {
    const forwarded = request.headers.get("x-forwarded-for");
    return forwarded?.split(",")[0]?.trim() || null;
}

export async function POST(request: NextRequest) {
    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({
            code: "INVALID_REQUEST",
            message: "Invalid login request.",
        }, { status: 400 });
    }

    const parsed = LoginRequestSchema.safeParse(payload);
    if (!parsed.success) {
        return NextResponse.json({
            code: "INVALID_REQUEST",
            message: "Invalid login request.",
        }, { status: 400 });
    }

    const result = await authenticateWithPassword(
        parsed.data.email,
        parsed.data.password,
        {
            userAgent: request.headers.get("user-agent"),
            ipAddress: requestIp(request),
        }
    );

    if (!result.ok) {
        return NextResponse.json({
            code: "AUTHENTICATION_FAILED",
            message: result.error,
        }, { status: result.status });
    }

    const cookieOptions = getAppSessionCookieOptions();
    const response = NextResponse.json({
        success: true,
        user: {
            id: result.user.id,
            email: result.user.email,
            roles: result.user.roles ?? [],
        },
        expiresAt: result.expiresAt,
    });
    response.cookies.set(cookieOptions.name, result.sessionToken, cookieOptions);

    return response;
}

