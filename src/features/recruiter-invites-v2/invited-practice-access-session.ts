import { createHash, randomBytes, randomUUID } from "node:crypto";

export const INVITED_PRACTICE_ACCESS_COOKIE = "ic_invited_access";
export const INVITED_PRACTICE_CLEAN_ENTRY_PATH = "/candidate/invited";
export const INVITED_PRACTICE_UNAVAILABLE_PATH = "/candidate/invited/unavailable";
export const DEFAULT_INVITED_PRACTICE_ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60;

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MIN_ACCESS_TTL_SECONDS = 5 * 60;
const MAX_ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60;

export type InvitedPracticeBrowserSessionMaterial = {
    browserSessionId: string;
    rawSessionToken: string;
    sessionTokenHash: string;
};

export function isInvitedPracticeBearer(value: string | null | undefined): value is string {
    return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function hashInvitedPracticeBrowserSessionToken(rawToken: string) {
    return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function createInvitedPracticeBrowserSessionMaterial(): InvitedPracticeBrowserSessionMaterial {
    const rawSessionToken = randomBytes(TOKEN_BYTES).toString("base64url");
    return {
        browserSessionId: randomUUID(),
        rawSessionToken,
        sessionTokenHash: hashInvitedPracticeBrowserSessionToken(rawSessionToken),
    };
}

export function resolveInvitedPracticeAccessTtlSeconds(value: string | undefined) {
    if (!value?.trim()) return DEFAULT_INVITED_PRACTICE_ACCESS_TTL_SECONDS;
    const seconds = Number(value);
    if (!Number.isInteger(seconds) || seconds < MIN_ACCESS_TTL_SECONDS || seconds > MAX_ACCESS_TTL_SECONDS) {
        throw new Error("INVITED_PRACTICE_ACCESS_TTL_SECONDS is invalid.");
    }
    return seconds;
}

export function serializeInvitedPracticeAccessCookie(input: {
    rawSessionToken: string;
    expiresAt: string;
    secure: boolean;
}) {
    const parts = [
        `${INVITED_PRACTICE_ACCESS_COOKIE}=${encodeURIComponent(input.rawSessionToken)}`,
        "Path=/candidate/invited",
        "HttpOnly",
        "SameSite=Lax",
        `Expires=${new Date(input.expiresAt).toUTCString()}`,
    ];
    if (input.secure) parts.splice(4, 0, "Secure");
    return parts.join("; ");
}

export function clearInvitedPracticeAccessCookie(secure: boolean) {
    return serializeInvitedPracticeAccessCookie({
        rawSessionToken: "",
        expiresAt: new Date(0).toISOString(),
        secure,
    });
}
