import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAuthStore, PasswordCredentialRecord } from "./app-auth-store";
import { authenticateWithPassword, getUserBySessionToken, revokeAppSession } from "./app-auth";
import { hashPassword } from "./password";
import { hashAppSessionToken } from "./app-session";

const user = {
    id: "20000000-0000-4000-8000-000000000001",
    email: "recruiter-dev@talentarbor.local",
    displayName: "Dev Recruiter",
    status: "active" as const,
    roles: ["recruiter" as const],
};

describe("recruiter app auth", () => {
    let credential: PasswordCredentialRecord;
    let store: AppAuthStore;

    beforeEach(async () => {
        credential = {
            user,
            passwordHash: await hashPassword("local-only-recruiter"),
            failedLoginCount: 0,
            lockedUntil: null,
        };
        store = {
            findPasswordCredentialByEmail: vi.fn().mockResolvedValue(credential),
            findUserBySessionTokenHash: vi.fn().mockResolvedValue(user),
            createSession: vi.fn().mockResolvedValue(undefined),
            revokeSession: vi.fn().mockResolvedValue(user.id),
            recordPasswordFailure: vi.fn().mockResolvedValue(undefined),
            clearPasswordFailures: vi.fn().mockResolvedValue(undefined),
            recordAuditEvent: vi.fn().mockResolvedValue(undefined),
        };
    });

    it("creates a hashed, expiring session and clears prior failures", async () => {
        const result = await authenticateWithPassword(
            user.email,
            "local-only-recruiter",
            { userAgent: "test-agent", ipAddress: "127.0.0.1" },
            {
                store,
                now: () => new Date("2026-07-19T12:00:00.000Z"),
                sessionToken: () => "session-secret",
            },
        );

        expect(result).toMatchObject({ ok: true, sessionToken: "session-secret" });
        expect(store.createSession).toHaveBeenCalledWith({
            userId: user.id,
            sessionTokenHash: hashAppSessionToken("session-secret"),
            expiresAt: "2026-07-19T20:00:00.000Z",
            userAgent: "test-agent",
            ipAddress: "127.0.0.1",
        });
        expect(store.clearPasswordFailures).toHaveBeenCalledWith(user.id);
        expect(store.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: "login",
            outcome: "success",
        }));
    });

    it("returns one public failure for unknown, bad, locked, and disabled identities", async () => {
        const expected = { ok: false, status: 401, error: "Invalid email or password." };

        vi.mocked(store.findPasswordCredentialByEmail).mockResolvedValueOnce(null);
        await expect(authenticateWithPassword("missing@example.com", "bad", {}, { store }))
            .resolves.toEqual(expected);

        await expect(authenticateWithPassword(user.email, "bad", {}, { store }))
            .resolves.toEqual(expected);
        expect(store.recordPasswordFailure).toHaveBeenCalledWith(user.id);

        vi.mocked(store.findPasswordCredentialByEmail).mockResolvedValueOnce({
            ...credential,
            lockedUntil: "2026-07-20T00:00:00.000Z",
        });
        await expect(authenticateWithPassword(user.email, "local-only-recruiter", {}, {
            store,
            now: () => new Date("2026-07-19T12:00:00.000Z"),
        })).resolves.toEqual(expected);

        vi.mocked(store.findPasswordCredentialByEmail).mockResolvedValueOnce({
            ...credential,
            user: { ...user, status: "disabled" },
        });
        await expect(authenticateWithPassword(user.email, "local-only-recruiter", {}, { store }))
            .resolves.toEqual(expected);
    });

    it("resolves and revokes only hashed session tokens", async () => {
        await expect(getUserBySessionToken("session-secret", { store })).resolves.toEqual(user);
        expect(store.findUserBySessionTokenHash).toHaveBeenCalledWith(hashAppSessionToken("session-secret"));

        await revokeAppSession("session-secret", {}, { store });
        expect(store.revokeSession).toHaveBeenCalledWith(hashAppSessionToken("session-secret"));
        expect(store.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            userId: user.id,
            eventType: "logout",
            outcome: "success",
        }));
    });
});
