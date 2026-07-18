import { describe, expect, it, vi } from "vitest";

import { createCandidateLaunchSessionRepository } from "./candidate-launch-session-repository";
import type { CandidateLaunchIdentityKey } from "./candidate-launch-session-resolver";

describe("candidate launch session repository", () => {
    const identity: CandidateLaunchIdentityKey = {
        provider: "talentarbor_launch",
        issuer: "talentarbor",
        subject: "candidate:12345",
        hostCandidateId: "12345",
        hostUserId: "67890",
        platformCandidateId: "12345",
        workspace: "talentarbor",
    };

    it("finds an existing candidate profile by the host launch identity key", async () => {
        const query = vi.fn(async () => ({
            rows: [{
                candidate_profile_id: "profile-123",
                platform_candidate_id: "12345",
            }],
        }));
        const repository = createCandidateLaunchSessionRepository({ query });

        await expect(repository.findProfileByIdentity(identity)).resolves.toEqual({
            candidateProfileId: "profile-123",
            platformCandidateId: "12345",
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("from public.candidate_identities"), [
            "talentarbor_launch",
            "talentarbor",
            "candidate:12345",
        ]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining("p.status = 'active'"), expect.any(Array));
    });

    it("creates or refreshes a candidate profile from launch attributes", async () => {
        const query = vi.fn(async () => ({
            rows: [{ candidate_profile_id: "profile-created" }],
        }));
        const repository = createCandidateLaunchSessionRepository({ query });

        await expect(repository.createProfileFromLaunch({
            authSubject: "talentarbor:candidate:12345",
            workspace: "talentarbor",
            email: "candidate@example.com",
            displayName: "Candidate Example",
            platformCandidateId: "12345",
            platformUserId: "67890",
            companyId: "2",
        })).resolves.toEqual({
            candidateProfileId: "profile-created",
            platformCandidateId: "12345",
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("insert into public.candidate_profiles"), [
            "talentarbor:candidate:12345",
            "candidate@example.com",
            "Candidate Example",
            "talentarbor",
        ]);
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("where candidate_profiles.status = 'active'"),
            expect.any(Array),
        );
    });

    it("upserts launch identity mapping with platform ids and last seen timestamp", async () => {
        const query = vi.fn(async () => ({ rows: [] }));
        const repository = createCandidateLaunchSessionRepository({ query });

        await repository.upsertIdentity({
            candidateProfileId: "profile-123",
            identity,
            email: "candidate@example.com",
            lastSeenAt: "2026-07-08T17:00:00.000Z",
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("insert into public.candidate_identities"), [
            "profile-123",
            "talentarbor_launch",
            "talentarbor",
            "candidate:12345",
            "candidate@example.com",
            "12345",
            "67890",
            "12345",
            "talentarbor",
            "2026-07-08T17:00:00.000Z",
        ]);
    });

    it("refreshes only the expected active profile and auth subject", async () => {
        const query = vi.fn(async () => ({
            rows: [{ candidate_profile_id: "profile-123" }],
        }));
        const repository = createCandidateLaunchSessionRepository({ query });

        await expect(repository.refreshProfileFromLaunch({
            candidateProfileId: "profile-123",
            authSubject: "talentarbor:candidate:12345",
            workspace: "talentarbor",
            email: "current@example.com",
            displayName: "Current Candidate",
            platformCandidateId: "12345",
        })).resolves.toEqual({
            candidateProfileId: "profile-123",
            platformCandidateId: "12345",
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("and auth_subject = $2"), [
            "profile-123",
            "talentarbor:candidate:12345",
            "current@example.com",
            "Current Candidate",
            "talentarbor",
        ]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining("and status = 'active'"), expect.any(Array));
    });

    it("detects whether identity-only launch should resume an existing prep context", async () => {
        const query = vi.fn(async () => ({ rows: [{ has_prep_contexts: true }] }));
        const repository = createCandidateLaunchSessionRepository({ query });

        await expect(repository.hasPrepContexts("profile-123")).resolves.toBe(true);
        expect(query).toHaveBeenCalledWith(expect.stringContaining("status in ('active', 'paused')"), [
            "profile-123",
        ]);
    });

    it("creates a launch session with a compact context snapshot", async () => {
        const query = vi.fn(async () => ({
            rows: [{ candidate_launch_session_id: "session-123" }],
        }));
        const repository = createCandidateLaunchSessionRepository({ query });

        await expect(repository.createSession({
            candidateProfileId: "profile-123",
            provider: "talentarbor_launch",
            issuer: "talentarbor",
            subject: "candidate:12345",
            launchTokenId: "launch-123",
            launchTokenFingerprint: "a".repeat(64),
            launchTokenExpiresAt: "2026-07-08T17:02:00.000Z",
            expiresAt: "2026-07-15T17:00:00.000Z",
            launchContext: {
                candidateId: "12345",
                jobCollectionId: "555",
                sourceSurface: "TA_JOB_SEARCH",
                hostDomain: "talentarbor.com",
            },
            trustedSetupContext: {
                sourcePlatform: "talentarbor",
                jobCollectionId: "555",
                requirementId: "777",
                targetRole: "Warehouse Associate",
                jobDescription: "Pick, pack, and prepare shipments safely.",
                jobDescriptionHash: "7524282fd4de6c39071cff432be5743da531f3e7c76902e1fefc1748442645ef",
            },
        })).resolves.toEqual({
            ok: true,
            sessionId: "session-123",
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("insert into public.candidate_launch_sessions"), [
            "profile-123",
            "talentarbor_launch",
            "talentarbor",
            "candidate:12345",
            "launch-123",
            "a".repeat(64),
            "2026-07-08T17:02:00.000Z",
            "12345",
            "555",
            "TA_JOB_SEARCH",
            "talentarbor.com",
            {
                candidateId: "12345",
                jobCollectionId: "555",
                sourceSurface: "TA_JOB_SEARCH",
                hostDomain: "talentarbor.com",
            },
            "2026-07-15T17:00:00.000Z",
            "talentarbor",
            "555",
            "777",
            "Warehouse Associate",
            "Pick, pack, and prepare shipments safely.",
            "7524282fd4de6c39071cff432be5743da531f3e7c76902e1fefc1748442645ef",
        ]);
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("insert into public.candidate_launch_setup_contexts"),
            expect.any(Array),
        );
    });

    it("reports a replay when the token fingerprint or issuer-scoped token id conflicts", async () => {
        const repository = createCandidateLaunchSessionRepository({
            query: vi.fn(async () => ({ rows: [] })),
        });

        await expect(repository.createSession({
            candidateProfileId: "profile-123",
            provider: "talentarbor_launch",
            issuer: "talentarbor",
            subject: "candidate:12345",
            launchTokenId: "launch-123",
            launchTokenFingerprint: "a".repeat(64),
            launchTokenExpiresAt: "2026-07-08T17:02:00.000Z",
            expiresAt: "2026-07-15T17:00:00.000Z",
            launchContext: {
                candidateId: "12345",
                jobCollectionId: null,
                sourceSurface: "TA_DASHBOARD",
                hostDomain: null,
            },
            trustedSetupContext: null,
        })).resolves.toEqual({
            ok: false,
            reason: "replayed_token",
        });
    });
});
