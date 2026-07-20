import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateWithPassword } from "@/features/recruiter-auth-v2/app-auth";
import { getAppSessionCookieOptions } from "@/features/recruiter-auth-v2/app-session";

const LoginRequestSchema = z.object({
    email: z.string().email().max(320),
    password: z.string().min(1).max(1024),
}).strict();

type Authenticator = typeof authenticateWithPassword;

export function createLoginRouteHandler(dependencies: {
    authenticate?: Authenticator;
} = {}) {
    const authenticate = dependencies.authenticate ?? authenticateWithPassword;

    return async function loginRoute(request: NextRequest) {
        let payload: unknown;
        try {
            payload = await request.json();
        } catch {
            return invalidRequest();
        }

        const parsed = LoginRequestSchema.safeParse(payload);
        if (!parsed.success) return invalidRequest();

        try {
            const result = await authenticate(parsed.data.email, parsed.data.password, {
                userAgent: request.headers.get("user-agent"),
                ipAddress: readRequestIp(request),
            });
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
                    roles: result.user.roles,
                },
                expiresAt: result.expiresAt,
            });
            response.cookies.set(cookieOptions.name, result.sessionToken, cookieOptions);
            return response;
        } catch {
            return NextResponse.json({
                code: "AUTHENTICATION_UNAVAILABLE",
                message: "Sign in is temporarily unavailable. Please try again.",
            }, { status: 503 });
        }
    };
}

function invalidRequest() {
    return NextResponse.json({
        code: "INVALID_REQUEST",
        message: "Enter a valid email and password.",
    }, { status: 400 });
}

function readRequestIp(request: NextRequest): string | null {
    const candidates = [
        request.headers.get("x-real-ip"),
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    ];
    return candidates.find((value): value is string => Boolean(value && isIP(value))) ?? null;
}
