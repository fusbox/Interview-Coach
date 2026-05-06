import { randomBytes } from "crypto";
import { hashToken } from "@/lib/server/crypto";
import {
    getAppSessionCookieName,
    getAppSessionCookieOptions,
    getAppSessionTtlSeconds,
    type AppSessionCookieOptions,
} from "./app-session-cookie";

export { getAppSessionCookieName, getAppSessionCookieOptions, getAppSessionTtlSeconds };
export type { AppSessionCookieOptions };

export function generateAppSessionToken(): string {
    return randomBytes(32).toString("base64url");
}

export function hashAppSessionToken(token: string): string {
    return hashToken(token);
}

export function getAppSessionExpiresAt(now: Date = new Date()): Date {
    return new Date(now.getTime() + getAppSessionTtlSeconds() * 1000);
}
