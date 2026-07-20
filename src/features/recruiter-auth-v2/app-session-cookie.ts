const DEFAULT_COOKIE_NAME = "ic_app_session";
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 8;
const RESERVED_IDENTITY_COOKIE_NAMES = new Set([
    "ic_candidate_launch_session",
    "ic_invited_access",
]);
type SessionEnv = Readonly<Record<string, string | undefined>>;

export type AppSessionCookieOptions = {
    name: string;
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: "/";
    maxAge: number;
};

export function getAppSessionCookieName(env: SessionEnv = process.env): string {
    const name = readOptionalEnv(env, "AUTH_COOKIE_NAME") ?? DEFAULT_COOKIE_NAME;
    if (RESERVED_IDENTITY_COOKIE_NAMES.has(name)) {
        throw new Error(`AUTH_COOKIE_NAME cannot use reserved identity cookie name "${name}".`);
    }
    return name;
}

export function getAppSessionTtlSeconds(env: SessionEnv = process.env): number {
    const configured = readOptionalEnv(env, "APP_SESSION_TTL_SECONDS");
    if (!configured) return DEFAULT_SESSION_TTL_SECONDS;

    const value = Number(configured);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Unsupported APP_SESSION_TTL_SECONDS value "${configured}". Expected a positive integer.`);
    }
    return value;
}

export function getAppSessionCookieOptions(
    env: SessionEnv = process.env,
): AppSessionCookieOptions {
    return {
        name: getAppSessionCookieName(env),
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        path: "/",
        maxAge: getAppSessionTtlSeconds(env),
    };
}

function readOptionalEnv(env: SessionEnv, name: string): string | undefined {
    const value = env[name]?.trim();
    return value || undefined;
}
