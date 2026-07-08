import { describe, expect, it, vi } from "vitest";

import {
    CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT,
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
        product: "interview_coach",
        expiresAt: "2026-07-08T18:00:00.000Z",
        issuedAt: "2026-07-08T17:55:00.000Z",
        hostCandidateId: "cand-123",
        hostUserId: "user-123",
    };

    it("verifies a host token and creates a candidate handoff session", async () => {
        const verifyLaunchToken = vi.fn(async () => validPayload);
        const resolveCandidateProfile = vi.fn(async () => ({
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
                expiresAt: "2026-07-08T18:00:00.000Z",
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
        });
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
                candidateProfileId: "profile-123",
                sessionId: "session-123",
            })),
        });

        expect(result).toMatchObject({
            ok: true,
            redirectTo: CANDIDATE_HOST_LAUNCH_DEFAULT_REDIRECT,
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
});
