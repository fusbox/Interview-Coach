import { describe, expect, it } from "vitest";

import {
    createInvitedPracticeBrowserSessionMaterial,
    hashInvitedPracticeBrowserSessionToken,
    INVITED_PRACTICE_ACCESS_COOKIE,
    isInvitedPracticeBearer,
    resolveInvitedPracticeAccessTtlSeconds,
    serializeInvitedPracticeAccessCookie,
} from "./invited-practice-access-session";

describe("invited practice access sessions", () => {
    it("creates a high-entropy bearer while exposing only its hash for persistence", () => {
        const material = createInvitedPracticeBrowserSessionMaterial();
        expect(material.rawSessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(material.sessionTokenHash).toBe(hashInvitedPracticeBrowserSessionToken(material.rawSessionToken));
        expect(material.sessionTokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("accepts only the fixed invitation and browser bearer shape", () => {
        expect(isInvitedPracticeBearer("a".repeat(43))).toBe(true);
        expect(isInvitedPracticeBearer("a".repeat(42))).toBe(false);
        expect(isInvitedPracticeBearer("/".repeat(43))).toBe(false);
    });

    it("uses a bounded seven-day default", () => {
        expect(resolveInvitedPracticeAccessTtlSeconds(undefined)).toBe(604_800);
        expect(() => resolveInvitedPracticeAccessTtlSeconds("60")).toThrow();
        expect(() => resolveInvitedPracticeAccessTtlSeconds("604801")).toThrow();
    });

    it("uses an invite-only HttpOnly cookie distinct from candidate and employee cookies", () => {
        const cookie = serializeInvitedPracticeAccessCookie({
            rawSessionToken: "a".repeat(43),
            expiresAt: "2026-07-27T00:00:00.000Z",
            secure: true,
        });
        expect(INVITED_PRACTICE_ACCESS_COOKIE).not.toBe("ic_candidate_launch_session");
        expect(INVITED_PRACTICE_ACCESS_COOKIE).not.toBe("ic_app_session");
        expect(cookie).toContain("Path=/candidate/invited");
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain("SameSite=Lax");
        expect(cookie).toContain("Secure");
    });
});
