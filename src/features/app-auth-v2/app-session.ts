import { createHash, randomBytes } from "node:crypto";
import { getAppSessionTtlSeconds } from "./app-session-cookie";

type SessionEnv = Readonly<Record<string, string | undefined>>;

export {
    getAppSessionCookieName,
    getAppSessionCookieOptions,
    getAppSessionTtlSeconds,
} from "./app-session-cookie";
export type { AppSessionCookieOptions } from "./app-session-cookie";

export function generateAppSessionToken(): string {
    return randomBytes(32).toString("base64url");
}

export function hashAppSessionToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export function getAppSessionExpiresAt(
    now: Date = new Date(),
    env: SessionEnv = process.env,
): Date {
    return new Date(now.getTime() + getAppSessionTtlSeconds(env) * 1000);
}
