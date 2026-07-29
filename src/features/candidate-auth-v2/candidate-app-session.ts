import type { NextResponse } from "next/server";

import { getAppSessionTtlSeconds } from "@/features/app-auth-v2/app-session";
import { CANDIDATE_APP_SESSION_COOKIE } from "./candidate-route-access";

type SessionEnv = Readonly<Record<string, string | undefined>>;

export function setCandidateAppSessionCookie(
    response: NextResponse,
    sessionToken: string,
    env: SessionEnv = process.env,
) {
    response.cookies.set(CANDIDATE_APP_SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        path: "/",
        maxAge: getAppSessionTtlSeconds(env),
    });
}

export function clearCandidateAppSessionCookie(
    response: NextResponse,
    env: SessionEnv = process.env,
) {
    response.cookies.set(CANDIDATE_APP_SESSION_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
    });
}
