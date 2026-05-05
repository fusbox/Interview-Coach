import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const revokeAppSessionMock = vi.fn();

vi.mock("@/lib/server/auth/app-auth", () => ({
    revokeAppSession: revokeAppSessionMock,
}));

describe("POST /api/auth/logout", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
    });

    it("revokes the current app session and clears the cookie", async () => {
        const { POST } = await import("./route");
        const response = await POST(new NextRequest("http://localhost/api/auth/logout", {
            method: "POST",
            headers: {
                cookie: "ic_app_session=raw-session-token",
            },
        }));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true });
        expect(revokeAppSessionMock).toHaveBeenCalledWith("raw-session-token");
        expect(response.headers.get("set-cookie")).toContain("ic_app_session=");
        expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    });
});
