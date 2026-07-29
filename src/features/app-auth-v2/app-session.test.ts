import { describe, expect, it } from "vitest";
import {
    getAppSessionCookieName,
    getAppSessionCookieOptions,
    getAppSessionExpiresAt,
    getAppSessionTtlSeconds,
    hashAppSessionToken,
} from "./app-session";

describe("shared app session", () => {
    it("keeps the employee cookie distinct from candidate and invited access cookies", () => {
        expect(getAppSessionCookieName({})).toBe("ic_app_session");
        expect(getAppSessionCookieName({})).not.toBe("ic_candidate_app_session");
        expect(getAppSessionCookieName({})).not.toBe("ic_candidate_launch_session");
        expect(getAppSessionCookieName({})).not.toBe("ic_invited_access");
        expect(() => getAppSessionCookieName({
            AUTH_COOKIE_NAME: "ic_candidate_app_session",
        })).toThrow("reserved identity cookie");
        expect(() => getAppSessionCookieName({
            AUTH_COOKIE_NAME: "ic_candidate_launch_session",
        })).toThrow("reserved identity cookie");
        expect(() => getAppSessionCookieName({
            AUTH_COOKIE_NAME: "ic_invited_access",
        })).toThrow("reserved identity cookie");
    });

    it("uses an eight-hour default and secure production cookie", () => {
        const now = new Date("2026-07-19T12:00:00.000Z");
        expect(getAppSessionTtlSeconds({})).toBe(28_800);
        expect(getAppSessionExpiresAt(now, {}).toISOString())
            .toBe("2026-07-19T20:00:00.000Z");
        expect(getAppSessionCookieOptions({ NODE_ENV: "production" })).toMatchObject({
            httpOnly: true,
            sameSite: "lax",
            secure: true,
            path: "/",
            maxAge: 28_800,
        });
    });

    it("validates configured session duration", () => {
        expect(getAppSessionTtlSeconds({ APP_SESSION_TTL_SECONDS: "600" })).toBe(600);
        expect(() => getAppSessionTtlSeconds({ APP_SESSION_TTL_SECONDS: "0" }))
            .toThrow("positive integer");
    });

    it("hashes bearer tokens before persistence", () => {
        expect(hashAppSessionToken("raw-token")).toMatch(/^[a-f0-9]{64}$/);
        expect(hashAppSessionToken("raw-token")).not.toContain("raw-token");
    });
});
