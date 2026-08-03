import { describe, expect, it, vi } from "vitest";

import {
    applyCandidateTrustedSetupContext,
    createCandidateSetupDraftOwnerKey,
    createCandidateSetupEntryRepository,
    createCandidateTrustedSetupContext,
} from "./candidate-setup-entry-context";

describe("candidate setup entry context", () => {
    it("isolates job-aware browser drafts from generic and other-job setup", () => {
        const trusted = {
            sourcePlatform: "talentarbor" as const,
            jobCollectionId: "555",
            requirementId: null,
            targetRole: "Warehouse Associate",
            jobDescription: "Pick, pack, and prepare shipments safely.",
            jobDescriptionHash: "7524282fd4de6c39071cff432be5743da531f3e7c76902e1fefc1748442645ef",
        };

        expect(createCandidateSetupDraftOwnerKey("profile-123", null)).toBe("candidate:profile-123");
        expect(createCandidateSetupDraftOwnerKey("profile-123", trusted)).toBe(
            "candidate:profile-123:host:talentarbor:555",
        );
        expect(createCandidateSetupDraftOwnerKey("profile-123", {
            ...trusted,
            jobCollectionId: "556",
        })).not.toBe(createCandidateSetupDraftOwnerKey("profile-123", trusted));
    });

    it("creates an immutable setup seed only for a bounded canonical host job", () => {
        expect(createCandidateTrustedSetupContext({
            workspace: "talentarbor",
            launchContext: {
                candidate: {
                    candidateId: "123456",
                    userId: null,
                    companyId: null,
                    email: "candidate@example.com",
                    displayName: "Candidate",
                },
                source: {
                    hostDomain: "talentarbor.com",
                    sourceSurface: "TA_JOB_SEARCH",
                    talentChannelId: null,
                },
                job: {
                    jobCollectionId: "555",
                    requirementId: "777",
                    requirementCode: "REQ-777",
                    title: "Warehouse Associate",
                    description: "Pick, pack, and prepare shipments safely.",
                    descriptionSource: "JobCollection",
                    client: null,
                    location: null,
                    isActive: true,
                    isExpired: false,
                    expirationDate: null,
                },
                resumePlainText: null,
            },
        })).toMatchObject({
            sourcePlatform: "talentarbor",
            jobCollectionId: "555",
            requirementId: "777",
            targetRole: "Warehouse Associate",
            jobDescriptionHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        });
    });

    it("restores an unconsumed trusted job context through the active launch session", async () => {
        const query = vi.fn(async () => ({
            rows: [{
                candidate_profile_id: "profile-123",
                launch_job_collection_id: "555",
                setup_context_consumed_at: null,
                source_platform: "talentarbor",
                job_collection_id: "555",
                requirement_id: "777",
                target_role: "Warehouse Associate",
                job_description_snapshot: "Pick, pack, and prepare shipments safely.",
                job_description_hash: "7524282fd4de6c39071cff432be5743da531f3e7c76902e1fefc1748442645ef",
            }],
        }));
        const repository = createCandidateSetupEntryRepository({ query });

        await expect(repository.resolveLaunchEntry("launch-123")).resolves.toMatchObject({
            candidateProfileId: "profile-123",
            candidateLaunchSessionId: "launch-123",
            trustedSetupContext: {
                jobCollectionId: "555",
                targetRole: "Warehouse Associate",
            },
        });
        expect(query).toHaveBeenCalledWith(expect.stringContaining("setup.expires_at > now()"), ["launch-123"]);
    });

    it("keeps a consumed job-aware launch authenticated but removes its one-time prefill", async () => {
        const repository = createCandidateSetupEntryRepository({
            query: vi.fn(async () => ({
                rows: [{
                    candidate_profile_id: "profile-123",
                    launch_job_collection_id: "555",
                    setup_context_consumed_at: new Date("2026-07-17T12:00:00.000Z"),
                }],
            })),
        });

        await expect(repository.resolveLaunchEntry("launch-123")).resolves.toEqual({
            candidateProfileId: "profile-123",
            candidateLaunchSessionId: "launch-123",
            trustedSetupContext: null,
        });
    });

    it("fails closed instead of downgrading a malformed unconsumed job launch to manual input", async () => {
        const repository = createCandidateSetupEntryRepository({
            query: vi.fn(async () => ({
                rows: [{
                    candidate_profile_id: "profile-123",
                    launch_job_collection_id: "555",
                    setup_context_consumed_at: null,
                }],
            })),
        });

        await expect(repository.resolveLaunchEntry("launch-123")).resolves.toBeNull();
    });

    it("rejects browser mutation and reuses the canonical server values", () => {
        const trusted = {
            sourcePlatform: "talentarbor" as const,
            jobCollectionId: "555",
            requirementId: null,
            targetRole: "Warehouse Associate",
            jobDescription: "Pick, pack, and prepare shipments safely.",
            jobDescriptionHash: "7524282fd4de6c39071cff432be5743da531f3e7c76902e1fefc1748442645ef",
        };
        const setup = {
            targetRole: "Warehouse Associate",
            jobDescription: "Pick, pack, and prepare shipments safely.",
            resumeText: null,
            interviewStage: "screening" as const,
            questionCount: 5,
            resumeCaptureMode: "none" as const,
        };

        expect(applyCandidateTrustedSetupContext(setup, trusted)).toEqual(setup);
        expect(applyCandidateTrustedSetupContext({
            ...setup,
            jobDescription: "Attacker-supplied replacement.",
        }, trusted)).toBeNull();
    });

    it("consumes trusted staging only when the selected existing path has the same host job identity", async () => {
        const query = vi.fn(async () => ({
            rows: [{ role_profile_id: "role-profile-123" }],
        }));
        const repository = createCandidateSetupEntryRepository({ query });

        await expect(repository.consumeWithExistingPrepContext({
            candidateProfileId: "profile-123",
            candidateLaunchSessionId: "launch-123",
            roleProfileId: "role-profile-123",
        })).resolves.toBe(true);
        expect(query).toHaveBeenCalledWith(
            expect.stringMatching(/profile\.source_job_collection_id = setup\.job_collection_id[\s\S]*candidate_practice_sessions practice/),
            ["profile-123", "launch-123", "role-profile-123"],
        );
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("set setup_context_consumed_at = now()"),
            expect.any(Array),
        );
    });
});
