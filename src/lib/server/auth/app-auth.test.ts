import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppAuthStore } from "./app-auth-store";
import { hashPassword } from "./password";

describe("app auth foundation", () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    it("hashes and verifies passwords using a non-plain stored format", async () => {
        const storedHash = await hashPassword("Correct Horse Battery Staple");

        expect(storedHash).toMatch(/^scrypt\$/);
        expect(storedHash).not.toContain("Correct Horse");
        await expect(import("./password").then(({ verifyPassword }) => verifyPassword("Correct Horse Battery Staple", storedHash))).resolves.toBe(true);
        await expect(import("./password").then(({ verifyPassword }) => verifyPassword("wrong", storedHash))).resolves.toBe(false);
    });

    it("creates a hashed app session after password authentication succeeds", async () => {
        const passwordHash = await hashPassword("valid-password");
        const store = fakeStore({
            findPasswordCredentialByEmail: vi.fn().mockResolvedValue({
                user: {
                    id: "11111111-1111-4111-8111-111111111111",
                    email: "recruiter@example.com",
                    status: "active",
                    roles: ["recruiter"],
                },
                passwordHash,
                failedLoginCount: 0,
                lockedUntil: null,
            }),
        });
        const { authenticateWithPassword } = await import("./app-auth");

        const result = await authenticateWithPassword(
            "Recruiter@Example.com",
            "valid-password",
            { userAgent: "vitest", ipAddress: "127.0.0.1" },
            { store }
        );

        expect(result).toMatchObject({
            ok: true,
            user: { email: "recruiter@example.com" },
        });
        expect(result.ok && result.sessionToken).toEqual(expect.any(String));
        expect(store.createSession).toHaveBeenCalledWith(expect.objectContaining({
            userId: "11111111-1111-4111-8111-111111111111",
            userAgent: "vitest",
            ipAddress: "127.0.0.1",
        }));
        const sessionTokenHash = vi.mocked(store.createSession).mock.calls[0][0].sessionTokenHash;
        expect(sessionTokenHash).not.toBe(result.ok ? result.sessionToken : "");
        expect(store.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            outcome: "success",
            eventType: "login",
        }));
    });

    it("rejects unknown users and bad passwords without creating sessions", async () => {
        const store = fakeStore({
            findPasswordCredentialByEmail: vi.fn().mockResolvedValue(null),
        });
        const { authenticateWithPassword } = await import("./app-auth");

        await expect(authenticateWithPassword("missing@example.com", "password", {}, { store })).resolves.toEqual({
            ok: false,
            status: 401,
            error: "Invalid email or password.",
        });
        expect(store.createSession).not.toHaveBeenCalled();
        expect(store.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            outcome: "failed",
            metadata: { reason: "unknown_user" },
        }));
    });

    it("loads and revokes app users by hashed session token", async () => {
        const store = fakeStore({
            findUserBySessionTokenHash: vi.fn().mockResolvedValue({
                id: "11111111-1111-4111-8111-111111111111",
                email: "recruiter@example.com",
                roles: ["recruiter"],
            }),
        });
        const { getUserBySessionToken, revokeAppSession } = await import("./app-auth");

        await expect(getUserBySessionToken("raw-session-token", { store })).resolves.toMatchObject({
            email: "recruiter@example.com",
        });
        expect(store.findUserBySessionTokenHash).toHaveBeenCalledWith(expect.not.stringContaining("raw-session-token"));

        await revokeAppSession("raw-session-token", { store });
        expect(store.revokeSession).toHaveBeenCalledWith(expect.not.stringContaining("raw-session-token"));
    });
});

function fakeStore(overrides: Partial<AppAuthStore> = {}): AppAuthStore {
    return {
        findPasswordCredentialByEmail: vi.fn(),
        findUserBySessionTokenHash: vi.fn(),
        createSession: vi.fn(),
        revokeSession: vi.fn(),
        recordAuditEvent: vi.fn(),
        ...overrides,
    };
}

