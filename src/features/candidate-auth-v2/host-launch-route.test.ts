import { createHash } from "crypto";
import { describe, expect, it, vi } from "vitest";

import { handleCandidateHostLaunchRequest } from "./host-launch-route";
import type { CandidateHostLaunchTokenPayload } from "./host-launch-contract";

describe("candidate host launch route shell", () => {
    const payload: CandidateHostLaunchTokenPayload = {
        issuer: "talentarbor",
        subject: "host-user-123",
        email: "candidate@example.com",
        displayName: "Candidate Example",
        workspace: "talentarbor",
        product: "interview-coach",
        expiresAt: "2026-07-08T18:00:00.000Z",
        issuedAt: "2026-07-08T17:54:00.000Z",
        tokenId: "launch-123",
        hostCandidateId: "candidate-123",
    };

    it("redirects missing-token launches without creating a session cookie", async () => {
        const response = await handleCandidateHostLaunchRequest({
            requestUrl: "https://interviewcoach.talentarbor.com/candidate/launch",
            now: new Date("2026-07-08T17:55:00.000Z"),
            verifyLaunchToken: vi.fn(),
            resolveCandidateProfile: vi.fn(),
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/candidate/dashboard");
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
        expect(response.headers.get("X-Interview-Coach-Request-Id")).toMatch(/^[0-9a-f-]{36}$/i);
        expect(response.headers.get("Set-Cookie")).toBeNull();
    });

    it("normalizes token, resolves candidate handoff, sets a placeholder session cookie, and strips token from redirect", async () => {
        const verifyLaunchToken = vi.fn(async () => payload);
        const resolveCandidateProfile = vi.fn(async () => ({
            ok: true as const,
            candidateProfileId: "profile-123",
            sessionId: "session-123",
        }));

        const response = await handleCandidateHostLaunchRequest({
            requestUrl: "https://interviewcoach.talentarbor.com/candidate/launch?token=%20signed.jwt%20&next=/candidate/setup",
            now: new Date("2026-07-08T17:55:00.000Z"),
            verifyLaunchToken,
            resolveCandidateProfile,
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/candidate/setup");
        expect(response.headers.get("Location")).not.toContain("signed.jwt");
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
        expect(response.headers.get("Set-Cookie")).toContain("ic_candidate_launch_session=session-123");
        expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
        expect(response.headers.get("Set-Cookie")).toContain("SameSite=Lax");
        expect(response.headers.get("Set-Cookie")).toContain("Expires=Wed, 15 Jul 2026 17:55:00 GMT");
        expect(verifyLaunchToken).toHaveBeenCalledWith("signed.jwt");
        expect(resolveCandidateProfile).toHaveBeenCalledWith(expect.objectContaining({
            email: "candidate@example.com",
            subject: "host-user-123",
        }), {
            launchTokenExpiresAt: "2026-07-08T18:00:00.000Z",
            issuedAt: "2026-07-08T17:54:00.000Z",
            tokenId: "launch-123",
            tokenFingerprint: createHash("sha256").update("signed.jwt").digest("hex"),
            sessionExpiresAt: "2026-07-15T17:55:00.000Z",
        });
    });

    it("omits the Secure cookie attribute for local http dev launches", async () => {
        const response = await handleCandidateHostLaunchRequest({
            requestUrl: "http://0.0.0.0:3000/candidate/launch?token=signed.jwt&next=/candidate/setup",
            now: new Date("2026-07-08T17:55:00.000Z"),
            verifyLaunchToken: vi.fn(async () => payload),
            resolveCandidateProfile: vi.fn(async () => ({
                ok: true as const,
                candidateProfileId: "profile-123",
                sessionId: "session-123",
            })),
        });

        expect(response.headers.get("Set-Cookie")).toContain("SameSite=Lax");
        expect(response.headers.get("Set-Cookie")).not.toContain("Secure");
        expect(response.headers.get("Location")).toBe("/candidate/setup");
    });

    it("falls back to the default candidate route for unsafe next targets", async () => {
        const response = await handleCandidateHostLaunchRequest({
            requestUrl: "https://interviewcoach.talentarbor.com/candidate/launch?token=signed.jwt&next=https://evil.example",
            now: new Date("2026-07-08T17:55:00.000Z"),
            verifyLaunchToken: vi.fn(async () => payload),
            resolveCandidateProfile: vi.fn(async () => ({
                ok: true as const,
                candidateProfileId: "profile-123",
                sessionId: "session-123",
            })),
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/candidate/dashboard");
    });

    it("does not set a session cookie when signature verification fails", async () => {
        const onDiagnostic = vi.fn();
        const response = await handleCandidateHostLaunchRequest({
            requestUrl: "https://interviewcoach.talentarbor.com/candidate/launch?token=signed.jwt",
            now: new Date("2026-07-08T17:55:00.000Z"),
            requestId: "11111111-1111-4111-8111-111111111111",
            onDiagnostic,
            verifyLaunchToken: vi.fn(async () => null),
            resolveCandidateProfile: vi.fn(),
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/candidate/dashboard");
        expect(response.headers.get("Set-Cookie")).toBeNull();
        expect(response.headers.get("X-Interview-Coach-Request-Id")).toBe("11111111-1111-4111-8111-111111111111");
        expect(onDiagnostic).toHaveBeenCalledWith({
            requestId: "11111111-1111-4111-8111-111111111111",
            phase: "exchange",
            outcome: "rejected",
            reason: "invalid_signature",
        });
    });

    it("records only bounded accepted exchange metadata", async () => {
        const onDiagnostic = vi.fn();
        await handleCandidateHostLaunchRequest({
            requestUrl: "https://interviewcoach.talentarbor.com/candidate/launch?token=secret.jwt",
            now: new Date("2026-07-08T17:55:00.000Z"),
            requestId: "22222222-2222-4222-8222-222222222222",
            onDiagnostic,
            verifyLaunchToken: vi.fn(async () => payload),
            resolveCandidateProfile: vi.fn(async () => ({
                ok: true as const,
                candidateProfileId: "profile-123",
                sessionId: "session-123",
                entryRoute: "/candidate/setup",
            })),
        });

        expect(onDiagnostic).toHaveBeenCalledWith({
            requestId: "22222222-2222-4222-8222-222222222222",
            phase: "exchange",
            outcome: "accepted",
            entryRoute: "/candidate/setup",
        });
        expect(JSON.stringify(onDiagnostic.mock.calls)).not.toContain("secret.jwt");
        expect(JSON.stringify(onDiagnostic.mock.calls)).not.toContain("candidate@example.com");
    });

    it("does not let diagnostic delivery failure break an accepted launch", async () => {
        const response = await handleCandidateHostLaunchRequest({
            requestUrl: "https://interviewcoach.talentarbor.com/candidate/launch?token=secret.jwt",
            now: new Date("2026-07-08T17:55:00.000Z"),
            onDiagnostic() {
                throw new Error("diagnostic sink unavailable");
            },
            verifyLaunchToken: vi.fn(async () => payload),
            resolveCandidateProfile: vi.fn(async () => ({
                ok: true as const,
                candidateProfileId: "profile-123",
                sessionId: "session-123",
                entryRoute: "/candidate/setup",
            })),
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/candidate/setup");
        expect(response.headers.get("Set-Cookie")).toContain("ic_candidate_launch_session=session-123");
    });
});
