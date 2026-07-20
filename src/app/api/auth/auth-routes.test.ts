import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createLoginRouteHandler } from "./login/route-implementation";
import { createLogoutRouteHandler } from "./logout/route-implementation";

const authenticatedUser = {
    id: "user-1",
    email: "recruiter@example.com",
    status: "active" as const,
    roles: ["recruiter" as const],
};

describe("app auth routes", () => {
    it("sets the HttpOnly app cookie after a successful login", async () => {
        const authenticate = vi.fn().mockResolvedValue({
            ok: true,
            user: authenticatedUser,
            sessionToken: "secret-session",
            expiresAt: "2026-07-19T20:00:00.000Z",
        });
        const response = await createLoginRouteHandler({ authenticate })(new NextRequest(
            "http://localhost:3000/api/auth/login",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-forwarded-for": "127.0.0.1, 10.0.0.1",
                    "user-agent": "route-test",
                },
                body: JSON.stringify({ email: "Recruiter@Example.com", password: "password" }),
            },
        ));

        expect(response.status).toBe(200);
        expect(response.headers.get("set-cookie")).toContain("ic_app_session=secret-session");
        expect(response.headers.get("set-cookie")).toContain("HttpOnly");
        expect(authenticate).toHaveBeenCalledWith(
            "Recruiter@Example.com",
            "password",
            { userAgent: "route-test", ipAddress: "127.0.0.1" },
        );
    });

    it("rejects malformed and failed login requests without setting a cookie", async () => {
        const authenticate = vi.fn();
        const handler = createLoginRouteHandler({ authenticate });
        const malformed = await handler(new NextRequest("http://localhost/api/auth/login", {
            method: "POST",
            body: "not-json",
        }));
        expect(malformed.status).toBe(400);
        expect(authenticate).not.toHaveBeenCalled();

        authenticate.mockResolvedValue({ ok: false, status: 401, error: "Invalid email or password." });
        const denied = await handler(new NextRequest("http://localhost/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "user@example.com", password: "bad" }),
        }));
        expect(denied.status).toBe(401);
        expect(denied.headers.get("set-cookie")).toBeNull();
    });

    it("returns a safe availability response when the auth store fails", async () => {
        const response = await createLoginRouteHandler({
            authenticate: vi.fn().mockRejectedValue(new Error("database unavailable")),
        })(new NextRequest("http://localhost/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "user@example.com", password: "password" }),
        }));
        expect(response.status).toBe(503);
        await expect(response.json()).resolves.not.toEqual(expect.objectContaining({
            message: expect.stringContaining("database"),
        }));
    });

    it("revokes the persisted session before clearing its cookie", async () => {
        const revoke = vi.fn().mockResolvedValue(undefined);
        const response = await createLogoutRouteHandler({ revoke })(new NextRequest(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: { cookie: "ic_app_session=secret-session" },
            },
        ));
        expect(response.status).toBe(200);
        expect(revoke).toHaveBeenCalledWith("secret-session", {
            userAgent: null,
            ipAddress: null,
        });
        expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    });

    it("keeps the cookie when durable revocation fails", async () => {
        const response = await createLogoutRouteHandler({
            revoke: vi.fn().mockRejectedValue(new Error("database unavailable")),
        })(new NextRequest("http://localhost/api/auth/logout", {
            method: "POST",
            headers: { cookie: "ic_app_session=secret-session" },
        }));
        expect(response.status).toBe(503);
        expect(response.headers.get("set-cookie")).toBeNull();
    });
});
