import { describe, expect, it, vi } from "vitest";
import { PostgresAppAuthStore } from "./postgres-app-auth-store";

describe("shared PostgresAppAuthStore", () => {
    it("normalizes email and maps credential roles", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{
                user_id: "user-1",
                email: "recruiter@example.com",
                email_verified_at: new Date("2026-07-27T12:00:00.000Z"),
                display_name: "Recruiter",
                first_name: "Dev",
                last_name: "Recruiter",
                status: "active",
                password_hash: "scrypt$hash",
                failed_login_count: "2",
                locked_until: null,
                roles: ["candidate", "recruiter", "unsupported"],
            }],
        });
        const store = new PostgresAppAuthStore({ query });

        await expect(store.findPasswordCredentialByEmail(" Recruiter@Example.com ")).resolves.toEqual({
            user: {
            id: "user-1",
            email: "recruiter@example.com",
            emailVerifiedAt: "2026-07-27T12:00:00.000Z",
                displayName: "Recruiter",
                firstName: "Dev",
                lastName: "Recruiter",
                status: "active",
                roles: ["candidate", "recruiter"],
            },
            passwordHash: "scrypt$hash",
            failedLoginCount: 2,
            lockedUntil: null,
        });
        expect(query).toHaveBeenCalledWith(expect.stringContaining("lower(u.email) = $1"), [
            "recruiter@example.com",
        ]);
    });

    it("checks the exact app-owned candidate profile binding before candidate login", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] });
        const store = new PostgresAppAuthStore({ query });

        await expect(store.isCandidateAccountEligible("user-1")).resolves.toBe(true);
        expect(query.mock.calls[0][0]).toContain("profile.workspace = 'interview_coach'");
        expect(query.mock.calls[0][0]).toContain("app_role.role = 'candidate'");
        expect(query).toHaveBeenCalledWith(expect.any(String), ["user-1"]);
    });

    it("requires an active, unexpired, unrevoked session and rate-limits last-seen writes", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] });
        const store = new PostgresAppAuthStore({ query });
        await expect(store.findUserBySessionTokenHash("hash")).resolves.toBeNull();
        expect(query).toHaveBeenCalledWith(expect.stringContaining("s.revoked_at is null"), ["hash"]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining("interval '5 minutes'"), ["hash"]);
    });

    it("persists bearer hashes and returns the revoked session owner", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ user_id: "user-1" }] });
        const store = new PostgresAppAuthStore({ query });
        await store.createSession({
            userId: "user-1",
            sessionTokenHash: "hash",
            expiresAt: "2026-07-20T00:00:00.000Z",
        });
        await expect(store.revokeSession("hash")).resolves.toBe("user-1");
        expect(query.mock.calls[0][0]).toContain("session_token_hash");
        expect(query.mock.calls[0][1]).toEqual([
            "user-1",
            "hash",
            "2026-07-20T00:00:00.000Z",
            null,
            null,
        ]);
    });
});
