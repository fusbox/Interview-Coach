import { getOptionalServerEnv } from "@/lib/server/config/server-env";

const DEFAULT_COOKIE_NAME = "ic_app_session";
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 8;

export type AppSessionCookieOptions = {
    name: string;
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: "/";
    maxAge: number;
};

export function getAppSessionCookieName(): string {
    return getOptionalServerEnv("AUTH_COOKIE_NAME") ?? DEFAULT_COOKIE_NAME;
}

export function getAppSessionTtlSeconds(): number {
    const configured = getOptionalServerEnv("APP_SESSION_TTL_SECONDS");
    if (!configured) {
        return DEFAULT_SESSION_TTL_SECONDS;
    }

    const value = Number(configured);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Unsupported APP_SESSION_TTL_SECONDS value "${configured}". Expected a positive integer.`);
    }

    return value;
}

export function getAppSessionCookieOptions(): AppSessionCookieOptions {
    return {
        name: getAppSessionCookieName(),
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: getAppSessionTtlSeconds(),
    };
}
