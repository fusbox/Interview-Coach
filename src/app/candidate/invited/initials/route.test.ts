import { describe, expect, it, vi } from "vitest";

import { handleInvitedPracticeInitialsRequest } from "./route-implementation";

describe("invited practice initials route", () => {
    it("persists through the invite cookie and does not expose mismatch state", async () => {
        const confirm = vi.fn().mockResolvedValue({ initialsConfirmed: true, matchState: "mismatch" });
        const response = await handleInvitedPracticeInitialsRequest({
            request: request({ initials: "XX" }),
            rawBrowserSessionToken: "s".repeat(43),
            confirm,
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ initialsConfirmed: true });
        expect(confirm).toHaveBeenCalledWith({
            rawBrowserSessionToken: "s".repeat(43),
            initials: "XX",
        });
        expect(response.headers.get("Cache-Control")).toContain("no-store");
    });

    it("returns the candidate first name only after a server-confirmed match", async () => {
        const response = await handleInvitedPracticeInitialsRequest({
            request: request({ initials: "IC" }),
            rawBrowserSessionToken: "s".repeat(43),
            confirm: vi.fn().mockResolvedValue({
                initialsConfirmed: true,
                matchState: "match",
                candidateFirstName: "Irma",
            }),
        });
        expect(await response.json()).toEqual({ initialsConfirmed: true, candidateFirstName: "Irma" });
    });

    it("accepts the browser origin when Next exposes an internal bind address", async () => {
        const confirm = vi.fn().mockResolvedValue({ initialsConfirmed: true, matchState: "match" });
        const response = await handleInvitedPracticeInitialsRequest({
            request: request(
                { initials: "IC" },
                "http://localhost:3001",
                "http://0.0.0.0:3001/candidate/invited/initials",
                { Host: "localhost:3001" },
            ),
            rawBrowserSessionToken: "s".repeat(43),
            confirm,
        });

        expect(response.status).toBe(200);
        expect(confirm).toHaveBeenCalledOnce();
    });

    it("accepts a trusted forwarded public origin without weakening foreign-origin denial", async () => {
        const confirm = vi.fn().mockResolvedValue({ initialsConfirmed: true, matchState: "match" });
        const response = await handleInvitedPracticeInitialsRequest({
            request: request(
                { initials: "IC" },
                "https://coach.example.com",
                "http://0.0.0.0:3001/candidate/invited/initials",
                { "X-Forwarded-Host": "coach.example.com", "X-Forwarded-Proto": "https" },
            ),
            rawBrowserSessionToken: "s".repeat(43),
            confirm,
        });

        expect(response.status).toBe(200);
        expect(confirm).toHaveBeenCalledOnce();
    });

    it("fails closed for missing access, cross-origin requests, extras, and oversized bodies", async () => {
        const noAccess = await handleInvitedPracticeInitialsRequest({
            request: request({ initials: "IC" }),
            rawBrowserSessionToken: undefined,
            confirm: vi.fn().mockResolvedValue(null),
        });
        expect(noAccess.status).toBe(401);

        const crossOrigin = await handleInvitedPracticeInitialsRequest({
            request: request({ initials: "IC" }, "https://other.example.com"),
            rawBrowserSessionToken: "s".repeat(43),
            confirm: vi.fn(),
        });
        expect(crossOrigin.status).toBe(403);

        const extras = await handleInvitedPracticeInitialsRequest({
            request: request({ initials: "IC", expected: "IC" }),
            rawBrowserSessionToken: "s".repeat(43),
            confirm: vi.fn(),
        });
        expect(extras.status).toBe(400);

        const oversized = await handleInvitedPracticeInitialsRequest({
            request: request({ initials: "I".repeat(2_000) }),
            rawBrowserSessionToken: "s".repeat(43),
            confirm: vi.fn(),
        });
        expect(oversized.status).toBe(413);
    });
});

function request(
    body: unknown,
    origin = "https://coach.example.com",
    url = "https://coach.example.com/candidate/invited/initials",
    additionalHeaders: Record<string, string> = {},
) {
    return new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin, ...additionalHeaders },
        body: JSON.stringify(body),
    });
}
