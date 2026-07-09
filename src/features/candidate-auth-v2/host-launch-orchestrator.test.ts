import { describe, expect, it, vi } from "vitest";

import type { CandidateLaunchContextRow } from "./candidate-launch-context";
import type { CandidateHostLaunchTokenPayload } from "./host-launch-contract";
import { createCandidateHostLaunchOrchestration } from "./host-launch-orchestrator";

describe("candidate host launch orchestration boundary", () => {
    const payload: CandidateHostLaunchTokenPayload = {
        issuer: "talentarbor",
        subject: "candidate:12345",
        email: "candidate@example.com",
        displayName: "Candidate Example",
        workspace: "talentarbor",
        product: "interview-coach",
        expiresAt: "2026-07-15T17:00:00.000Z",
        issuedAt: "2026-07-08T16:55:00.000Z",
        hostCandidateId: "12345",
        hostUserId: "67890",
        talentArborId: "12345",
        rangamWorksId: null,
        jobCollectionId: "555",
        hostDomain: "talentarbor.com",
        sourceSurface: "TA_JOB_SEARCH",
    };

    const launchContextRow: CandidateLaunchContextRow = {
        candidateId: 12345,
        userId: 67890,
        companyId: 2,
        email: "context@example.com",
        displayName: "Context Candidate",
        hostDomain: "talentarbor.com",
        sourceSurface: "TA_JOB_SEARCH",
        talentChannelId: null,
        jobCollectionId: 555,
        requirementId: 777,
        requirementCode: "REQ-777",
        jobTitle: "Warehouse Associate",
        jobDescription: "Pick, pack, and prepare shipments safely.",
        jobDescriptionSource: "JobCollection",
        client: "Example Client",
        location: "New Jersey",
        isActive: true,
        isExpired: false,
        expirationDate: "2026-08-01T00:00:00.000Z",
        hasParsedResume: true,
        resumeSourceType: "ResumeParserJSONMaster",
        resumeCreatedDate: "2026-07-01T00:00:00.000Z",
        resumeContentAvailable: true,
        hasAIConsent: true,
        aiConsentDate: "2026-06-01T00:00:00.000Z",
    };

    it("orchestrates verified token, launch context, profile resolution, and session creation", async () => {
        const verifyLaunchToken = vi.fn(async () => payload);
        const lookupLaunchContext = vi.fn(async () => launchContextRow);
        const sessionRepository = {
            findProfileByIdentity: vi.fn(async () => ({ candidateProfileId: "profile-123" })),
            createProfileFromLaunch: vi.fn(),
            upsertIdentity: vi.fn(),
            createSession: vi.fn(async () => ({ sessionId: "session-123" })),
        };

        const result = await createCandidateHostLaunchOrchestration({
            token: "signed.jwt",
            now: new Date("2026-07-08T17:00:00.000Z"),
            requestedRedirect: "/candidate/setup",
            verifyLaunchToken,
            lookupLaunchContext,
            sessionRepository,
        });

        expect(result).toEqual({
            ok: true,
            redirectTo: "/candidate/setup",
            session: {
                candidateProfileId: "profile-123",
                sessionId: "session-123",
                expiresAt: "2026-07-15T17:00:00.000Z",
            },
        });
        expect(verifyLaunchToken).toHaveBeenCalledWith("signed.jwt");
        expect(lookupLaunchContext).toHaveBeenCalledWith({
            candidateId: "12345",
            jobCollectionId: "555",
            hostDomain: "talentarbor.com",
            sourceSurface: "TA_JOB_SEARCH",
        });
        expect(sessionRepository.createSession).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId: "profile-123",
            expiresAt: "2026-07-15T17:00:00.000Z",
            launchContext: {
                candidateId: "12345",
                jobCollectionId: "555",
                sourceSurface: "TA_JOB_SEARCH",
                hostDomain: "talentarbor.com",
            },
        }));
    });

    it("fails closed before lookup when the verified token cannot identify the target job", async () => {
        const lookupLaunchContext = vi.fn();
        const sessionRepository = {
            findProfileByIdentity: vi.fn(),
            createProfileFromLaunch: vi.fn(),
            upsertIdentity: vi.fn(),
            createSession: vi.fn(),
        };

        const result = await createCandidateHostLaunchOrchestration({
            token: "signed.jwt",
            now: new Date("2026-07-08T17:00:00.000Z"),
            requestedRedirect: "/candidate/setup",
            verifyLaunchToken: vi.fn(async () => ({
                ...payload,
                jobCollectionId: null,
            })),
            lookupLaunchContext,
            sessionRepository,
        });

        expect(result).toEqual({
            ok: false,
            reason: "invalid_identity",
            redirectTo: "/candidate/dashboard",
        });
        expect(lookupLaunchContext).not.toHaveBeenCalled();
        expect(sessionRepository.createSession).not.toHaveBeenCalled();
    });

    it("fails closed when the launch context resolver cannot normalize the platform row", async () => {
        const sessionRepository = {
            findProfileByIdentity: vi.fn(),
            createProfileFromLaunch: vi.fn(),
            upsertIdentity: vi.fn(),
            createSession: vi.fn(),
        };

        const result = await createCandidateHostLaunchOrchestration({
            token: "signed.jwt",
            now: new Date("2026-07-08T17:00:00.000Z"),
            requestedRedirect: "/candidate/setup",
            verifyLaunchToken: vi.fn(async () => payload),
            lookupLaunchContext: vi.fn(async () => null),
            sessionRepository,
        });

        expect(result).toEqual({
            ok: false,
            reason: "invalid_identity",
            redirectTo: "/candidate/dashboard",
        });
        expect(sessionRepository.createSession).not.toHaveBeenCalled();
    });

    it("fails closed when the profile/session resolver rejects the normalized context", async () => {
        const result = await createCandidateHostLaunchOrchestration({
            token: "signed.jwt",
            now: new Date("2026-07-08T17:00:00.000Z"),
            requestedRedirect: "/candidate/setup",
            verifyLaunchToken: vi.fn(async () => payload),
            lookupLaunchContext: vi.fn(async () => ({
                ...launchContextRow,
                candidateId: 99999,
            })),
            sessionRepository: {
                findProfileByIdentity: vi.fn(async () => ({ candidateProfileId: "profile-123" })),
                createProfileFromLaunch: vi.fn(),
                upsertIdentity: vi.fn(),
                createSession: vi.fn(async () => ({ sessionId: "session-123" })),
            },
        });

        expect(result).toEqual({
            ok: false,
            reason: "invalid_identity",
            redirectTo: "/candidate/dashboard",
        });
    });
});
