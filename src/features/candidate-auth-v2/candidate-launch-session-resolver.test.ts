import { describe, expect, it, vi } from "vitest";

import type { CandidateHostLaunchHandoff } from "./host-launch-contract";
import type { CandidateLaunchContext } from "./candidate-launch-context";
import { resolveCandidateLaunchSession } from "./candidate-launch-session-resolver";

describe("candidate launch session resolver", () => {
    const handoff: CandidateHostLaunchHandoff = {
        provider: "rangamworks_launch",
        issuer: "rangamworks",
        subject: "rw-user-67890",
        email: "candidate@example.com",
        displayName: "Candidate Example",
        workspace: "rangamworks",
        externalIds: {
            hostCandidateId: "12345",
            hostUserId: "67890",
            talentArborId: null,
            rangamWorksId: "12345",
        },
        launchContextHint: {
            candidateId: "12345",
            jobCollectionId: "555",
            hostDomain: "rangamworks.com",
            sourceSurface: "RW_JOB_SEARCH",
        },
    };

    const launchContext: CandidateLaunchContext = {
        candidate: {
            candidateId: "12345",
            userId: "67890",
            companyId: "2",
            email: null,
            displayName: null,
        },
        source: {
            hostDomain: "rangamworks.com",
            sourceSurface: "RW_JOB_SEARCH",
            talentChannelId: null,
        },
        job: {
            jobCollectionId: "555",
            requirementId: "777",
            requirementCode: "REQ-777",
            title: "Warehouse Associate",
            description: "Pick, pack, and prepare shipments safely.",
            descriptionSource: "JobCollection",
            client: "Example Client",
            location: "New Jersey",
            isActive: true,
            isExpired: false,
            expirationDate: "2026-08-01T00:00:00.000Z",
        },
        resume: {
            hasParsedResume: true,
            sourceType: "ResumeParserJSONMaster",
            createdDate: "2026-07-01T00:00:00.000Z",
            contentAvailable: true,
        },
        consent: {
            hasAIConsent: true,
            consentDate: "2026-06-01T00:00:00.000Z",
        },
    };

    it("creates a session for an existing provider identity without creating a duplicate profile", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(async () => ({
                candidateProfileId: "profile-123",
            })),
            createProfileFromLaunch: vi.fn(),
            upsertIdentity: vi.fn(),
            createSession: vi.fn(async () => ({
                sessionId: "session-123",
            })),
        };

        const result = await resolveCandidateLaunchSession({
            handoff,
            launchContext,
            launchedAt: "2026-07-08T17:00:00.000Z",
            expiresAt: "2026-07-15T17:00:00.000Z",
            repository,
        });

        expect(result).toEqual({
            ok: true,
            session: {
                candidateProfileId: "profile-123",
                sessionId: "session-123",
            },
        });
        expect(repository.findProfileByIdentity).toHaveBeenCalledWith({
            provider: "rangamworks_launch",
            issuer: "rangamworks",
            subject: "rw-user-67890",
            hostCandidateId: "12345",
            hostUserId: "67890",
            platformCandidateId: "12345",
            workspace: "rangamworks",
        });
        expect(repository.createProfileFromLaunch).not.toHaveBeenCalled();
        expect(repository.createSession).toHaveBeenCalledWith({
            candidateProfileId: "profile-123",
            provider: "rangamworks_launch",
            issuer: "rangamworks",
            subject: "rw-user-67890",
            expiresAt: "2026-07-15T17:00:00.000Z",
            launchContext: {
                candidateId: "12345",
                jobCollectionId: "555",
                sourceSurface: "RW_JOB_SEARCH",
                hostDomain: "rangamworks.com",
            },
        });
    });

    it("creates a profile and upserts the launch identity when no mapping exists yet", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(async () => null),
            createProfileFromLaunch: vi.fn(async () => ({
                candidateProfileId: "profile-new",
            })),
            upsertIdentity: vi.fn(async () => undefined),
            createSession: vi.fn(async () => ({
                sessionId: "session-new",
            })),
        };

        const result = await resolveCandidateLaunchSession({
            handoff,
            launchContext,
            launchedAt: "2026-07-08T17:00:00.000Z",
            expiresAt: "2026-07-15T17:00:00.000Z",
            repository,
        });

        expect(result).toEqual({
            ok: true,
            session: {
                candidateProfileId: "profile-new",
                sessionId: "session-new",
            },
        });
        expect(repository.createProfileFromLaunch).toHaveBeenCalledWith({
            authSubject: "rangamworks:rw-user-67890",
            workspace: "rangamworks",
            email: "candidate@example.com",
            displayName: "Candidate Example",
            platformCandidateId: "12345",
            platformUserId: "67890",
            companyId: "2",
        });
        expect(repository.upsertIdentity).toHaveBeenCalledWith({
            candidateProfileId: "profile-new",
            identity: {
                provider: "rangamworks_launch",
                issuer: "rangamworks",
                subject: "rw-user-67890",
                hostCandidateId: "12345",
                hostUserId: "67890",
                platformCandidateId: "12345",
                workspace: "rangamworks",
            },
            email: "candidate@example.com",
            lastSeenAt: "2026-07-08T17:00:00.000Z",
        });
    });

    it("uses launch context candidate email and display name when the token omits friendly profile details", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(async () => null),
            createProfileFromLaunch: vi.fn(async () => ({
                candidateProfileId: "profile-context",
            })),
            upsertIdentity: vi.fn(async () => undefined),
            createSession: vi.fn(async () => ({
                sessionId: "session-context",
            })),
        };

        await resolveCandidateLaunchSession({
            handoff: {
                ...handoff,
                email: "",
                displayName: null,
            },
            launchContext: {
                ...launchContext,
                candidate: {
                    ...launchContext.candidate,
                    email: "context@example.com",
                    displayName: "Context Candidate",
                },
            },
            launchedAt: "2026-07-08T17:00:00.000Z",
            expiresAt: "2026-07-15T17:00:00.000Z",
            repository,
        });

        expect(repository.createProfileFromLaunch).toHaveBeenCalledWith(expect.objectContaining({
            email: "context@example.com",
            displayName: "Context Candidate",
        }));
    });

    it("fails closed when token and launch context candidate ids disagree", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(),
            createProfileFromLaunch: vi.fn(),
            upsertIdentity: vi.fn(),
            createSession: vi.fn(),
        };

        const result = await resolveCandidateLaunchSession({
            handoff,
            launchContext: {
                ...launchContext,
                candidate: {
                    ...launchContext.candidate,
                    candidateId: "99999",
                },
            },
            launchedAt: "2026-07-08T17:00:00.000Z",
            expiresAt: "2026-07-15T17:00:00.000Z",
            repository,
        });

        expect(result).toEqual({
            ok: false,
            reason: "identity_context_mismatch",
        });
        expect(repository.findProfileByIdentity).not.toHaveBeenCalled();
    });

    it("fails closed when a profile cannot be resolved or created", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(async () => null),
            createProfileFromLaunch: vi.fn(async () => null),
            upsertIdentity: vi.fn(),
            createSession: vi.fn(),
        };

        const result = await resolveCandidateLaunchSession({
            handoff,
            launchContext,
            launchedAt: "2026-07-08T17:00:00.000Z",
            expiresAt: "2026-07-15T17:00:00.000Z",
            repository,
        });

        expect(result).toEqual({
            ok: false,
            reason: "profile_not_resolved",
        });
        expect(repository.createSession).not.toHaveBeenCalled();
    });

    it("fails closed when the app session cannot be created", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(async () => ({
                candidateProfileId: "profile-123",
            })),
            createProfileFromLaunch: vi.fn(),
            upsertIdentity: vi.fn(),
            createSession: vi.fn(async () => null),
        };

        const result = await resolveCandidateLaunchSession({
            handoff,
            launchContext,
            launchedAt: "2026-07-08T17:00:00.000Z",
            expiresAt: "2026-07-15T17:00:00.000Z",
            repository,
        });

        expect(result).toEqual({
            ok: false,
            reason: "session_not_created",
        });
    });
});
