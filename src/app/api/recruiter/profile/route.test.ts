import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import type { RecruiterAccess } from "@/features/recruiter-auth-v2/current-recruiter-access";
import { handleRecruiterProfileUpdate } from "./route-implementation";

describe("recruiter profile API", () => {
    it("updates only the authenticated account and returns no-store settings", async () => {
        const update = vi.fn().mockResolvedValue({ outcome: "updated", settings: savedSettings() });
        const response = await handleRecruiterProfileUpdate({
            request: request({ senderDisplayName: "  Fu Chen  ", revision: REVISION }),
            access: authorizedAccess(),
            update,
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        await expect(response.json()).resolves.toMatchObject({ status: "settings_saved", outcome: "updated" });
        expect(update).toHaveBeenCalledWith({
            userId: "user-1",
            senderDisplayName: "Fu Chen",
            revision: REVISION,
        });
    });

    it("accepts a browser-facing origin when Next receives the request on its internal bind address", async () => {
        const update = vi.fn().mockResolvedValue({ outcome: "unchanged", settings: savedSettings() });
        const response = await handleRecruiterProfileUpdate({
            request: request({ senderDisplayName: "Fu Chen", revision: REVISION }, {
                url: "http://0.0.0.0:3001/api/recruiter/profile",
                host: "localhost:3001",
                origin: "http://localhost:3001",
            }),
            access: authorizedAccess(),
            update,
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ outcome: "unchanged" });
    });

    it("rejects foreign origins before calling the repository", async () => {
        const update = vi.fn();
        const response = await handleRecruiterProfileUpdate({
            request: request({ senderDisplayName: "Fu Chen", revision: REVISION }, {
                origin: "https://foreign.example",
            }),
            access: authorizedAccess(),
            update,
        });

        expect(response.status).toBe(403);
        expect(update).not.toHaveBeenCalled();
    });

    it.each<[RecruiterAccess, number]>([
        [{ kind: "missing" } as const, 401],
        [{ kind: "forbidden", user: { ...authorizedAccess().user, roles: ["qa"] } }, 403],
    ])("rejects missing or forbidden recruiter access", async (access, status) => {
        const update = vi.fn();
        const response = await handleRecruiterProfileUpdate({
            request: request({ senderDisplayName: "Fu Chen", revision: REVISION }),
            access,
            update,
        });
        expect(response.status).toBe(status);
        expect(update).not.toHaveBeenCalled();
    });

    it("rejects malformed, expanded, non-JSON, and oversized input", async () => {
        const update = vi.fn();
        const malformed = await handleRecruiterProfileUpdate({
            request: request({ senderDisplayName: "Fu Chen", revision: REVISION, userId: "foreign" }),
            access: authorizedAccess(),
            update,
        });
        const nonJson = await handleRecruiterProfileUpdate({
            request: request("plain", { contentType: "text/plain" }),
            access: authorizedAccess(),
            update,
        });
        const oversized = await handleRecruiterProfileUpdate({
            request: request({ senderDisplayName: "x".repeat(5_000), revision: REVISION }),
            access: authorizedAccess(),
            update,
        });

        expect(malformed.status).toBe(400);
        expect(nonJson.status).toBe(415);
        expect(oversized.status).toBe(413);
        expect(update).not.toHaveBeenCalled();
    });

    it("reports stale-tab conflicts and a role-removal race without exposing settings", async () => {
        const conflict = await handleRecruiterProfileUpdate({
            request: request({ senderDisplayName: "Fu Chen", revision: REVISION }),
            access: authorizedAccess(),
            update: vi.fn().mockResolvedValue({ outcome: "conflict" }),
        });
        const removed = await handleRecruiterProfileUpdate({
            request: request({ senderDisplayName: "Fu Chen", revision: REVISION }),
            access: authorizedAccess(),
            update: vi.fn().mockResolvedValue({ outcome: "not_found" }),
        });

        expect(conflict.status).toBe(409);
        await expect(conflict.json()).resolves.toMatchObject({ code: "SETTINGS_CHANGED" });
        expect(removed.status).toBe(403);
        await expect(removed.json()).resolves.not.toHaveProperty("settings");
    });

    it("returns a retryable service error without losing the submitted browser value", async () => {
        const response = await handleRecruiterProfileUpdate({
            request: request({ senderDisplayName: "Fu Chen", revision: REVISION }),
            access: authorizedAccess(),
            update: vi.fn().mockRejectedValue(new Error("database unavailable")),
        });
        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({ code: "SETTINGS_SAVE_UNAVAILABLE" });
    });
});

const REVISION = "2026-07-20T12:00:00.000000Z";

function authorizedAccess() {
    return {
        kind: "authorized" as const,
        user: {
            id: "user-1",
            email: "dev@example.invalid",
            displayName: "Dev Recruiter",
            status: "active" as const,
            roles: ["recruiter" as const],
        },
    };
}

function savedSettings() {
    return { senderDisplayName: "Fu Chen", email: "dev@example.invalid", revision: REVISION };
}

function request(body: unknown, options: {
    url?: string;
    host?: string;
    origin?: string;
    contentType?: string;
} = {}) {
    const url = options.url ?? "http://localhost:3000/api/recruiter/profile";
    const origin = options.origin ?? "http://localhost:3000";
    const contentType = options.contentType ?? "application/json";
    return new NextRequest(url, {
        method: "PUT",
        headers: {
            "content-type": contentType,
            host: options.host ?? new URL(url).host,
            origin,
            "sec-fetch-site": "same-origin",
        },
        body: contentType === "application/json" ? JSON.stringify(body) : String(body),
    });
}
