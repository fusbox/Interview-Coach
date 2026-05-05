import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authenticateWithPasswordMock = vi.fn();

vi.mock("@/lib/server/auth/app-auth", () => ({
    authenticateWithPassword: authenticateWithPasswordMock,
}));

describe("POST /api/auth/login", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        authenticateWithPasswordMock.mockResolvedValue({
            ok: true,
            user: {
                id: "11111111-1111-4111-8111-111111111111",
                email: "recruiter@example.com",
                roles: ["recruiter"],
            },
            sessionToken: "raw-session-token",
            expiresAt: "2026-05-05T20:00:00.000Z",
        });
    });

    it("sets an HTTP-only app session cookie after successful login", async () => {
        const { POST } = await import("./route");
        const response = await POST(new NextRequest("http://localhost/api/auth/login", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "user-agent": "vitest",
                "x-forwarded-for": "127.0.0.1",
            },
            body: JSON.stringify({
                email: "recruiter@example.com",
                password: "valid-password",
            }),
        }));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            success: true,
            user: { email: "recruiter@example.com" },
        });
        expect(response.headers.get("set-cookie")).toContain("ic_app_session=raw-session-token");
        expect(response.headers.get("set-cookie")).toContain("HttpOnly");
        expect(authenticateWithPasswordMock).toHaveBeenCalledWith(
            "recruiter@example.com",
            "valid-password",
            expect.objectContaining({
                userAgent: "vitest",
                ipAddress: "127.0.0.1",
            })
        );
    });

    it("returns 401 without setting a cookie when credentials are rejected", async () => {
        authenticateWithPasswordMock.mockResolvedValue({
            ok: false,
            status: 401,
            error: "Invalid email or password.",
        });
        const { POST } = await import("./route");
        const response = await POST(new NextRequest("http://localhost/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
                email: "recruiter@example.com",
                password: "wrong-password",
            }),
        }));

        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({
            code: "AUTHENTICATION_FAILED",
        });
        expect(response.headers.get("set-cookie")).toBeNull();
    });
});
