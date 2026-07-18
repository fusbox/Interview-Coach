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
    };

    const exchange = {
        sessionExpiresAt: "2026-07-15T17:00:00.000Z",
        launchTokenExpiresAt: "2026-07-08T17:02:00.000Z",
        launchTokenId: "launch-123",
        launchTokenFingerprint: "a".repeat(64),
    };

    it("refreshes canonical profile and identity facts before creating a session for a returning identity", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(async () => ({
                candidateProfileId: "profile-123",
                platformCandidateId: "12345",
            })),
            createProfileFromLaunch: vi.fn(),
            refreshProfileFromLaunch: vi.fn(async () => ({
                candidateProfileId: "profile-123",
                platformCandidateId: "12345",
            })),
            upsertIdentity: vi.fn(async () => undefined),
            hasPrepContexts: vi.fn(async () => true),
            createSession: vi.fn(async () => ({
                ok: true as const,
                sessionId: "session-123",
            })),
        };

        const result = await resolveCandidateLaunchSession({
            handoff,
            launchContext,
            launchedAt: "2026-07-08T17:00:00.000Z",
            ...exchange,
            repository,
        });

        expect(result).toEqual({
            ok: true,
            session: {
                candidateProfileId: "profile-123",
                sessionId: "session-123",
                entryRoute: "/candidate/setup",
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
        expect(repository.refreshProfileFromLaunch).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId: "profile-123",
            authSubject: "rangamworks:rw-user-67890",
            email: "candidate@example.com",
        }));
        expect(repository.upsertIdentity).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId: "profile-123",
            lastSeenAt: "2026-07-08T17:00:00.000Z",
        }));
        expect(repository.createSession).toHaveBeenCalledWith({
            candidateProfileId: "profile-123",
            provider: "rangamworks_launch",
            issuer: "rangamworks",
            subject: "rw-user-67890",
            launchTokenId: "launch-123",
            launchTokenFingerprint: "a".repeat(64),
            launchTokenExpiresAt: "2026-07-08T17:02:00.000Z",
            expiresAt: "2026-07-15T17:00:00.000Z",
            launchContext: {
                candidateId: "12345",
                jobCollectionId: "555",
                sourceSurface: "RW_JOB_SEARCH",
                hostDomain: "rangamworks.com",
            },
            trustedSetupContext: {
                sourcePlatform: "rangamworks",
                jobCollectionId: "555",
                requirementId: "777",
                targetRole: "Warehouse Associate",
                jobDescription: "Pick, pack, and prepare shipments safely.",
                jobDescriptionHash: "7524282fd4de6c39071cff432be5743da531f3e7c76902e1fefc1748442645ef",
            },
        });
        expect(repository.hasPrepContexts).not.toHaveBeenCalled();
    });

    it("creates a profile and upserts the launch identity when no mapping exists yet", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(async () => null),
            createProfileFromLaunch: vi.fn(async () => ({
                candidateProfileId: "profile-new",
                platformCandidateId: "12345",
            })),
            refreshProfileFromLaunch: vi.fn(),
            upsertIdentity: vi.fn(async () => undefined),
            hasPrepContexts: vi.fn(async () => false),
            createSession: vi.fn(async () => ({
                ok: true as const,
                sessionId: "session-new",
            })),
        };

        const result = await resolveCandidateLaunchSession({
            handoff,
            launchContext,
            launchedAt: "2026-07-08T17:00:00.000Z",
            ...exchange,
            repository,
        });

        expect(result).toEqual({
            ok: true,
            session: {
                candidateProfileId: "profile-new",
                sessionId: "session-new",
                entryRoute: "/candidate/setup",
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
                platformCandidateId: "12345",
            })),
            refreshProfileFromLaunch: vi.fn(),
            upsertIdentity: vi.fn(async () => undefined),
            hasPrepContexts: vi.fn(async () => false),
            createSession: vi.fn(async () => ({
                ok: true as const,
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
            ...exchange,
            repository,
        });

        expect(repository.createProfileFromLaunch).toHaveBeenCalledWith(expect.objectContaining({
            email: "context@example.com",
            displayName: "Context Candidate",
        }));
    });

    it("prefers canonical host-database profile attributes over duplicated token attributes", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(async () => null),
            createProfileFromLaunch: vi.fn(async () => ({
                candidateProfileId: "profile-context",
                platformCandidateId: "12345",
            })),
            refreshProfileFromLaunch: vi.fn(),
            upsertIdentity: vi.fn(async () => undefined),
            hasPrepContexts: vi.fn(async () => false),
            createSession: vi.fn(async () => ({ ok: true as const, sessionId: "session-context" })),
        };

        await resolveCandidateLaunchSession({
            handoff,
            launchContext: {
                ...launchContext,
                candidate: {
                    ...launchContext.candidate,
                    email: "canonical@example.com",
                    displayName: "Canonical Candidate",
                },
            },
            launchedAt: "2026-07-08T17:00:00.000Z",
            ...exchange,
            repository,
        });

        expect(repository.createProfileFromLaunch).toHaveBeenCalledWith(expect.objectContaining({
            email: "canonical@example.com",
            displayName: "Canonical Candidate",
        }));
        expect(repository.upsertIdentity).toHaveBeenCalledWith(expect.objectContaining({
            email: "canonical@example.com",
        }));
    });

    it.each([
        { hasPrepContexts: false, entryRoute: "/candidate/setup" as const },
        { hasPrepContexts: true, entryRoute: "/candidate/dashboard" as const },
    ])("routes identity-only launch from candidate-owned prep history", async ({ hasPrepContexts, entryRoute }) => {
        const repository = {
            findProfileByIdentity: vi.fn(async () => ({
                candidateProfileId: "profile-123",
                platformCandidateId: "12345",
            })),
            createProfileFromLaunch: vi.fn(),
            refreshProfileFromLaunch: vi.fn(async () => ({
                candidateProfileId: "profile-123",
                platformCandidateId: "12345",
            })),
            upsertIdentity: vi.fn(async () => undefined),
            hasPrepContexts: vi.fn(async () => hasPrepContexts),
            createSession: vi.fn(async () => ({ ok: true as const, sessionId: "session-identity" })),
        };

        const result = await resolveCandidateLaunchSession({
            handoff: {
                ...handoff,
                launchContextHint: {
                    ...handoff.launchContextHint,
                    jobCollectionId: null,
                },
            },
            launchContext: {
                ...launchContext,
                job: null,
            },
            launchedAt: "2026-07-08T17:00:00.000Z",
            ...exchange,
            repository,
        });

        expect(result).toEqual({
            ok: true,
            session: {
                candidateProfileId: "profile-123",
                sessionId: "session-identity",
                entryRoute,
            },
        });
        expect(repository.createSession).toHaveBeenCalledWith(expect.objectContaining({
            trustedSetupContext: null,
        }));
    });

    it("fails closed when token and launch context candidate ids disagree", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(),
            createProfileFromLaunch: vi.fn(),
            refreshProfileFromLaunch: vi.fn(),
            upsertIdentity: vi.fn(),
            hasPrepContexts: vi.fn(),
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
            ...exchange,
            repository,
        });

        expect(result).toEqual({
            ok: false,
            reason: "identity_context_mismatch",
        });
        expect(repository.findProfileByIdentity).not.toHaveBeenCalled();
    });

    it("fails closed when an existing signed subject is already mapped to another platform candidate", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(async () => ({
                candidateProfileId: "profile-123",
                platformCandidateId: "99999",
            })),
            createProfileFromLaunch: vi.fn(),
            refreshProfileFromLaunch: vi.fn(),
            upsertIdentity: vi.fn(),
            hasPrepContexts: vi.fn(),
            createSession: vi.fn(),
        };

        const result = await resolveCandidateLaunchSession({
            handoff,
            launchContext,
            launchedAt: "2026-07-08T17:00:00.000Z",
            ...exchange,
            repository,
        });

        expect(result).toEqual({
            ok: false,
            reason: "identity_context_mismatch",
        });
        expect(repository.createProfileFromLaunch).not.toHaveBeenCalled();
        expect(repository.upsertIdentity).not.toHaveBeenCalled();
        expect(repository.createSession).not.toHaveBeenCalled();
    });

    it("fails closed when the identity mapping and canonical auth subject resolve to different profiles", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(async () => ({
                candidateProfileId: "profile-mapped",
                platformCandidateId: "12345",
            })),
            createProfileFromLaunch: vi.fn(),
            refreshProfileFromLaunch: vi.fn(async () => null),
            upsertIdentity: vi.fn(),
            hasPrepContexts: vi.fn(),
            createSession: vi.fn(),
        };

        const result = await resolveCandidateLaunchSession({
            handoff,
            launchContext,
            launchedAt: "2026-07-08T17:00:00.000Z",
            ...exchange,
            repository,
        });

        expect(result).toEqual({
            ok: false,
            reason: "identity_context_mismatch",
        });
        expect(repository.upsertIdentity).not.toHaveBeenCalled();
        expect(repository.createSession).not.toHaveBeenCalled();
    });

    it("fails closed when a profile cannot be resolved or created", async () => {
        const repository = {
            findProfileByIdentity: vi.fn(async () => null),
            createProfileFromLaunch: vi.fn(async () => null),
            refreshProfileFromLaunch: vi.fn(),
            upsertIdentity: vi.fn(),
            hasPrepContexts: vi.fn(),
            createSession: vi.fn(),
        };

        const result = await resolveCandidateLaunchSession({
            handoff,
            launchContext,
            launchedAt: "2026-07-08T17:00:00.000Z",
            ...exchange,
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
                platformCandidateId: "12345",
            })),
            createProfileFromLaunch: vi.fn(),
            refreshProfileFromLaunch: vi.fn(async () => ({
                candidateProfileId: "profile-123",
                platformCandidateId: "12345",
            })),
            upsertIdentity: vi.fn(async () => undefined),
            hasPrepContexts: vi.fn(async () => true),
            createSession: vi.fn(async () => ({
                ok: false as const,
                reason: "session_not_created" as const,
            })),
        };

        const result = await resolveCandidateLaunchSession({
            handoff,
            launchContext,
            launchedAt: "2026-07-08T17:00:00.000Z",
            ...exchange,
            repository,
        });

        expect(result).toEqual({
            ok: false,
            reason: "session_not_created",
        });
    });
});
