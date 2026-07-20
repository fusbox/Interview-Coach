import { describe, expect, it, vi } from "vitest";

import { handleInvitedPracticeLinkExchange } from "./route-implementation";

describe("invited practice link exchange route", () => {
    it("removes invitation bearer material through a clean no-store redirect", async () => {
        const onDiagnostic = vi.fn();
        const response = await handleInvitedPracticeLinkExchange({
            rawInvitationToken: "i".repeat(43),
            secureCookie: true,
            exchange: vi.fn().mockResolvedValue({
                rawBrowserSessionToken: "s".repeat(43),
                expiresAt: "2026-07-27T00:00:00.000Z",
            }),
            requestId: "request-1",
            onDiagnostic,
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/candidate/invited");
        expect(response.headers.get("Location")).not.toContain("i".repeat(43));
        expect(response.headers.get("Cache-Control")).toContain("no-store");
        expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
        expect(response.headers.get("Set-Cookie")).toContain("ic_invited_access=");
        expect(response.headers.get("Set-Cookie")).toContain("Secure");
        expect(onDiagnostic).toHaveBeenCalledWith({ requestId: "request-1", outcome: "accepted" });
        expect(JSON.stringify(onDiagnostic.mock.calls)).not.toContain("i".repeat(43));
        expect(JSON.stringify(onDiagnostic.mock.calls)).not.toContain("s".repeat(43));
    });

    it("uses one generic clean destination for malformed, expired, or revoked links", async () => {
        const response = await handleInvitedPracticeLinkExchange({
            rawInvitationToken: "bad",
            secureCookie: true,
            exchange: vi.fn().mockResolvedValue(null),
            requestId: "request-2",
        });
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/candidate/invited/unavailable");
        expect(response.headers.get("Set-Cookie")).toContain("ic_invited_access=");
        expect(response.headers.get("Set-Cookie")).toContain("Expires=Thu, 01 Jan 1970");
    });

    it("fails to the same clean surface when persistence is unavailable", async () => {
        const response = await handleInvitedPracticeLinkExchange({
            rawInvitationToken: "i".repeat(43),
            secureCookie: false,
            exchange: vi.fn().mockRejectedValue(new Error("database unavailable")),
            requestId: "request-3",
        });
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/candidate/invited/unavailable");
        expect(await response.text()).toBe("");
    });
});
