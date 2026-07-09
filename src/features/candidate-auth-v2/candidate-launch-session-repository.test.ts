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
            rows: [{ candidate_profile_id: "profile-123" }],
        }));
        const repository = createCandidateLaunchSessionRepository({ query });

        await expect(repository.findProfileByIdentity(identity)).resolves.toEqual({
            candidateProfileId: "profile-123",
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("from public.candidate_identities"), [
            "talentarbor_launch",
            "talentarbor",
            "candidate:12345",
            "12345",
        ]);
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
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("insert into public.candidate_profiles"), [
            "talentarbor:candidate:12345",
            "candidate@example.com",
            "Candidate Example",
            "talentarbor",
        ]);
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
            expiresAt: "2026-07-15T17:00:00.000Z",
            launchContext: {
                candidateId: "12345",
                jobCollectionId: "555",
                sourceSurface: "TA_JOB_SEARCH",
                hostDomain: "talentarbor.com",
            },
        })).resolves.toEqual({
            sessionId: "session-123",
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("insert into public.candidate_launch_sessions"), [
            "profile-123",
            "talentarbor_launch",
            "talentarbor",
            "candidate:12345",
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
        ]);
    });
});
