import { createHash } from "crypto";
import { describe, expect, it, vi } from "vitest";

import {
    CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT,
    CANDIDATE_HOST_LAUNCH_MAX_SESSION_TTL_SECONDS,
    createCandidateHostLaunchSession,
    type CandidateHostLaunchTokenPayload,
} from "./host-launch-contract";

describe("candidate host launch contract", () => {
    const validPayload: CandidateHostLaunchTokenPayload = {
        issuer: "talentarbor",
        subject: "ta-user-123",
        email: " candidate@example.com ",
        displayName: " Candidate Example ",
        workspace: "talentarbor",
        product: "interview-coach",
        expiresAt: "2026-07-08T18:00:00.000Z",
        issuedAt: "2026-07-08T17:55:00.000Z",
        hostCandidateId: "cand-123",
        hostUserId: "user-123",
    };

    it("verifies a host token and creates a candidate handoff session", async () => {
        const verifyLaunchToken = vi.fn(async () => validPayload);
        const resolveCandidateProfile = vi.fn(async () => ({
            ok: true as const,
            candidateProfileId: "profile-123",
            sessionId: "session-123",
        }));

        const result = await createCandidateHostLaunchSession({
            token: "signed.jwt",
            now: new Date("2026-07-08T17:56:00.000Z"),
            requestedRedirect: "/candidate/setup",
            verifyLaunchToken,
            resolveCandidateProfile,
        });

        expect(result).toEqual({
            ok: true,
            redirectTo: "/candidate/setup",
            session: {
                candidateProfileId: "profile-123",
                sessionId: "session-123",
                expiresAt: "2026-07-15T17:56:00.000Z",
            },
        });
        expect(verifyLaunchToken).toHaveBeenCalledWith("signed.jwt");
        expect(resolveCandidateProfile).toHaveBeenCalledWith({
            provider: "talentarbor_launch",
            issuer: "talentarbor",
            subject: "ta-user-123",
            email: "candidate@example.com",
            displayName: "Candidate Example",
            workspace: "talentarbor",
            externalIds: {
                hostCandidateId: "cand-123",
                hostUserId: "user-123",
                rangamWorksId: null,
                talentArborId: null,
            },
            launchContextHint: {
                candidateId: "cand-123",
                jobCollectionId: null,
                requirementId: null,
                talentChannelId: null,
                clientId: null,
                hostDomain: null,
                sourceSurface: "UNKNOWN",
            },
        }, {
            launchTokenExpiresAt: "2026-07-08T18:00:00.000Z",
            issuedAt: "2026-07-08T17:55:00.000Z",
            tokenId: null,
            tokenFingerprint: createHash("sha256").update("signed.jwt").digest("hex"),
            sessionExpiresAt: "2026-07-15T17:56:00.000Z",
        });
    });

    it("strips an optional Bearer prefix before verification and fingerprinting", async () => {
        const verifyLaunchToken = vi.fn(async () => validPayload);
        const resolveCandidateProfile = vi.fn(async () => ({
            ok: true as const,
            candidateProfileId: "profile-123",
            sessionId: "session-123",
        }));

        const result = await createCandidateHostLaunchSession({
            token: "Bearer signed.jwt",
            now: new Date("2026-07-08T17:56:00.000Z"),
            verifyLaunchToken,
            resolveCandidateProfile,
        });

        expect(result.ok).toBe(true);
        expect(verifyLaunchToken).toHaveBeenCalledWith("signed.jwt");
        expect(resolveCandidateProfile).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                tokenFingerprint: createHash("sha256").update("signed.jwt").digest("hex"),
            }),
        );
    });

    it("rejects missing tokens before profile resolution", async () => {
        const resolveCandidateProfile = vi.fn();

        await expect(createCandidateHostLaunchSession({
            token: "",
            now: new Date("2026-07-08T17:56:00.000Z"),
            verifyLaunchToken: vi.fn(),
            resolveCandidateProfile,
        })).resolves.toEqual({
            ok: false,
            reason: "missing_token",
            redirectTo: CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT,
        });
        expect(resolveCandidateProfile).not.toHaveBeenCalled();
    });

    it("rejects invalid product claims", async () => {
        await expect(createCandidateHostLaunchSession({
            token: "signed.jwt",
            now: new Date("2026-07-08T17:56:00.000Z"),
            verifyLaunchToken: vi.fn(async () => ({
                ...validPayload,
                product: "resume_builder",
            })),
            resolveCandidateProfile: vi.fn(),
        })).resolves.toEqual({
            ok: false,
            reason: "invalid_product",
            redirectTo: CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT,
        });
    });

    it("rejects expired launch tokens", async () => {
        await expect(createCandidateHostLaunchSession({
            token: "signed.jwt",
            now: new Date("2026-07-08T18:00:01.000Z"),
            verifyLaunchToken: vi.fn(async () => validPayload),
            resolveCandidateProfile: vi.fn(),
        })).resolves.toEqual({
            ok: false,
            reason: "expired_token",
            redirectTo: CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT,
        });
    });

    it("does not allow external redirects after token verification", async () => {
        const result = await createCandidateHostLaunchSession({
            token: "signed.jwt",
            now: new Date("2026-07-08T17:56:00.000Z"),
            requestedRedirect: "https://evil.example/path",
            verifyLaunchToken: vi.fn(async () => validPayload),
            resolveCandidateProfile: vi.fn(async () => ({
                ok: true as const,
                candidateProfileId: "profile-123",
                sessionId: "session-123",
            })),
        });

        expect(result).toMatchObject({
            ok: true,
            redirectTo: CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT,
        });
    });

    it("prefers the server-resolved entry route over an unsigned browser next parameter", async () => {
        const result = await createCandidateHostLaunchSession({
            token: "signed.jwt",
            now: new Date("2026-07-08T17:56:00.000Z"),
            requestedRedirect: "/candidate/dashboard",
            verifyLaunchToken: vi.fn(async () => validPayload),
            resolveCandidateProfile: vi.fn(async () => ({
                ok: true as const,
                candidateProfileId: "profile-123",
                sessionId: "session-123",
                entryRoute: "/candidate/setup",
            })),
        });

        expect(result).toMatchObject({
            ok: true,
            redirectTo: "/candidate/setup",
        });
    });

    it("fails closed when the verifier cannot validate the signature", async () => {
        await expect(createCandidateHostLaunchSession({
            token: "signed.jwt",
            now: new Date("2026-07-08T17:56:00.000Z"),
            verifyLaunchToken: vi.fn(async () => null),
            resolveCandidateProfile: vi.fn(),
        })).resolves.toEqual({
            ok: false,
            reason: "invalid_signature",
            redirectTo: CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT,
        });
    });

    it("surfaces a replayed one-time token without creating a cookieable session", async () => {
        await expect(createCandidateHostLaunchSession({
            token: "signed.jwt",
            now: new Date("2026-07-08T17:56:00.000Z"),
            verifyLaunchToken: vi.fn(async () => validPayload),
            resolveCandidateProfile: vi.fn(async () => ({
                ok: false as const,
                reason: "replayed_token" as const,
            })),
        })).resolves.toEqual({
            ok: false,
            reason: "replayed_token",
            redirectTo: CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT,
        });
    });

    it("fails closed when the app-session TTL policy is invalid", async () => {
        const resolveCandidateProfile = vi.fn();

        await expect(createCandidateHostLaunchSession({
            token: "signed.jwt",
            now: new Date("2026-07-08T17:56:00.000Z"),
            verifyLaunchToken: vi.fn(async () => validPayload),
            resolveCandidateProfile,
            sessionTtlSeconds: 0,
        })).resolves.toEqual({
            ok: false,
            reason: "invalid_session_policy",
            redirectTo: CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT,
        });
        expect(resolveCandidateProfile).not.toHaveBeenCalled();
    });

    it("does not let callers create app sessions beyond the seven-day maximum", async () => {
        const resolveCandidateProfile = vi.fn();

        await expect(createCandidateHostLaunchSession({
            token: "signed.jwt",
            now: new Date("2026-07-08T17:56:00.000Z"),
            verifyLaunchToken: vi.fn(async () => validPayload),
            resolveCandidateProfile,
            sessionTtlSeconds: CANDIDATE_HOST_LAUNCH_MAX_SESSION_TTL_SECONDS + 1,
        })).resolves.toEqual({
            ok: false,
            reason: "invalid_session_policy",
            redirectTo: CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT,
        });
        expect(resolveCandidateProfile).not.toHaveBeenCalled();
    });
});
