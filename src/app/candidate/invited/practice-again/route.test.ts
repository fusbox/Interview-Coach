import { describe, expect, it, vi } from "vitest";

import { handleInvitedPracticeAgainRequest } from "./route-implementation";

describe("invited practice-again route", () => {
    it("sets a fresh clean cookie for a created or replayed child attempt", async () => {
        const repeat = vi.fn().mockResolvedValue({
            outcome: "created",
            sessionId: "session-2",
            rawBrowserSessionToken: "n".repeat(43),
            expiresAt: "2026-07-27T00:00:00.000Z",
        });
        const response = await handleInvitedPracticeAgainRequest({
            request: request({ sessionId: "session-1" }),
            secureCookie: false,
            repeat,
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            status: "invited_practice_attempt_ready",
            nextRoute: "/candidate/invited",
        });
        expect(response.headers.get("set-cookie")).toContain("ic_invited_access=");
        expect(response.headers.get("set-cookie")).toContain("Path=/candidate/invited");
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(repeat).toHaveBeenCalledWith("session-1");
    });

    it("accepts the browser origin when Next exposes an internal bind address", async () => {
        const repeat = vi.fn().mockResolvedValue({
            outcome: "replayed",
            sessionId: "session-2",
            rawBrowserSessionToken: "n".repeat(43),
            expiresAt: "2026-07-27T00:00:00.000Z",
        });
        const response = await handleInvitedPracticeAgainRequest({
            request: request(
                { sessionId: "session-1" },
                { Origin: "http://localhost:3001", Host: "localhost:3001" },
                "http://0.0.0.0:3001/candidate/invited/practice-again",
            ),
            secureCookie: false,
            repeat,
        });

        expect(response.status).toBe(200);
        expect(repeat).toHaveBeenCalledWith("session-1");
    });

    it("fails closed for cross-origin, missing access, and stale parents", async () => {
        const crossOrigin = await handleInvitedPracticeAgainRequest({
            request: request({ sessionId: "session-1" }, {
                origin: "https://attacker.example",
                "sec-fetch-site": "cross-site",
            }),
            secureCookie: false,
            repeat: vi.fn(),
        });
        expect(crossOrigin.status).toBe(403);

        const missing = await handleInvitedPracticeAgainRequest({
            request: request({ sessionId: "session-1" }),
            secureCookie: false,
            repeat: vi.fn().mockResolvedValue(null),
        });
        expect(missing.status).toBe(401);

        const stale = await handleInvitedPracticeAgainRequest({
            request: request({ sessionId: "session-1" }),
            secureCookie: false,
            repeat: vi.fn().mockResolvedValue({ outcome: "stale_parent" }),
        });
        expect(stale.status).toBe(409);
        expect(stale.headers.get("set-cookie")).toBeNull();
    });
});

function request(
    body: unknown,
    headers: Record<string, string> = {},
    url = "http://localhost:3000/candidate/invited/practice-again",
) {
    return new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", ...headers },
        body: JSON.stringify(body),
    });
}
