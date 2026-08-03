import { describe, expect, it, vi } from "vitest";

import { createTalentArborLaunchContextLookup } from "./talentarbor-launch-context-adapter";

describe("TalentArbor launch-context adapter", () => {
    it("resolves identity-only launch from approved CandidateMaster fields", async () => {
        const reader = {
            findCandidateById: vi.fn(async () => [{
                candidateId: 123456,
                userId: 101,
                companyId: 2,
                email: "candidate@example.com",
                displayName: "Candidate Example",
                jobCollectionId: null,
                Password: "must-not-escape-reader-row",
                SSN: "must-not-escape-reader-row",
            }]),
            findJobCollectionById: vi.fn(),
            findRequirementById: vi.fn(),
            findCandidateResumeHtml: vi.fn(async () => []),
        };
        const lookup = createTalentArborLaunchContextLookup({ reader });

        const result = await lookup({
            candidateId: "123456",
            jobCollectionId: null,
            requirementId: null,
            talentChannelId: null,
            clientId: null,
            hostDomain: "talentarbor.com",
            sourceSurface: "TA_DASHBOARD",
        });

        expect(reader.findCandidateById).toHaveBeenCalledWith(123456);
        expect(reader.findJobCollectionById).not.toHaveBeenCalled();
        expect(result).toEqual({
            candidateId: 123456,
            userId: 101,
            companyId: 2,
            email: "candidate@example.com",
            displayName: "Candidate Example",
            hostDomain: "talentarbor.com",
            sourceSurface: "TA_DASHBOARD",
            talentChannelId: null,
            jobCollectionId: null,
            requirementId: null,
            requirementCode: null,
            jobTitle: null,
            jobDescription: null,
            jobDescriptionSource: null,
            client: null,
            location: null,
            isActive: null,
            isExpired: null,
            expirationDate: null,
            resumePlainText: null,
        });
        expect(JSON.stringify(result)).not.toContain("must-not-escape-reader-row");
    });

    it("loads JobCollection details through the TA job-seeker SP shape", async () => {
        const reader = {
            findCandidateById: vi.fn(async () => [{
                candidateId: 123456,
                userId: 101,
                companyId: 2,
                email: "candidate@example.com",
                displayName: "Candidate Example",
            }]),
            findJobCollectionById: vi.fn(async () => [{
                JobCollectionID: 5551234,
                JobTitle: "CDL Truck Driver",
                JobDescription: "Drive safely and complete delivery documentation.",
                Client: "Example Client",
                Location: "New Jersey",
                IsActive: false,
                IsExpired: true,
                ExpirationDate: new Date("2026-06-01T00:00:00.000Z"),
            }]),
            findRequirementById: vi.fn(),
            findCandidateResumeHtml: vi.fn(async () => []),
        };
        const lookup = createTalentArborLaunchContextLookup({ reader });

        const result = await lookup({
            candidateId: "123456",
            jobCollectionId: "5551234",
            requirementId: null,
            talentChannelId: "0",
            clientId: null,
            hostDomain: "talentarbor.com",
            sourceSurface: "TA_JOB_DETAIL",
        });

        expect(reader.findJobCollectionById).toHaveBeenCalledWith(123456, 5551234);
        expect(reader.findRequirementById).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            candidateId: 123456,
            jobCollectionId: 5551234,
            jobTitle: "CDL Truck Driver",
            jobDescriptionSource: "JobCollection",
            talentChannelId: 0,
            isActive: false,
            isExpired: true,
        });
    });

    it("loads RequirementMaster details when talent_channel_id is positive", async () => {
        const reader = {
            findCandidateById: vi.fn(async () => [{
                candidateId: 123456,
                userId: 101,
                companyId: 2,
                email: "candidate@example.com",
                displayName: "Candidate Example",
            }]),
            findJobCollectionById: vi.fn(),
            findRequirementById: vi.fn(async () => [{
                RequirementID: 129571,
                RequirementCode: "REQ-129571",
                JobTitleText: "Registered Nurse",
                RequirementJobDescription: "Provide patient care in an acute setting.",
                ClientName: "Example Hospital",
                Location: "Newark, NJ",
            }]),
            findCandidateResumeHtml: vi.fn(async () => [{
                CandidateID: 123456,
                HTMLResumeContent: "<p>Built care plans and mentored junior nurses.</p>",
            }]),
        };
        const lookup = createTalentArborLaunchContextLookup({ reader });

        const result = await lookup({
            candidateId: "123456",
            jobCollectionId: null,
            requirementId: "129571",
            talentChannelId: "3",
            clientId: "13",
            hostDomain: "talentarbor.com",
            sourceSurface: "TA_JOB_DETAIL",
        });

        expect(reader.findRequirementById).toHaveBeenCalledWith({
            candidateId: 123456,
            requirementId: 129571,
            clientId: 13,
            talentChannelId: 3,
        });
        expect(result).toMatchObject({
            candidateId: 123456,
            jobCollectionId: "rm:129571",
            requirementId: 129571,
            jobTitle: "Registered Nurse",
            jobDescriptionSource: "RequirementMaster",
            talentChannelId: 3,
            resumePlainText: "Built care plans and mentored junior nurses.",
        });
    });

    it("rejects invalid SQL identifiers before opening a database connection", async () => {
        const reader = {
            findCandidateById: vi.fn(),
            findJobCollectionById: vi.fn(),
            findRequirementById: vi.fn(),
        };
        const diagnostics = vi.fn();
        const lookup = createTalentArborLaunchContextLookup({ reader, onDiagnostic: diagnostics });

        await expect(lookup({
            candidateId: "12.5",
            jobCollectionId: null,
            requirementId: null,
            talentChannelId: null,
            clientId: null,
            hostDomain: null,
            sourceSurface: "TA_DASHBOARD",
        })).resolves.toBeNull();
        expect(diagnostics).toHaveBeenCalledWith({
            operation: "validation",
            reason: "invalid_candidate_id",
        });
        expect(reader.findCandidateById).not.toHaveBeenCalled();
    });

    it("requires client_id for RequirementMaster launches", async () => {
        const reader = {
            findCandidateById: vi.fn(),
            findJobCollectionById: vi.fn(),
            findRequirementById: vi.fn(),
        };
        const diagnostics = vi.fn();
        const lookup = createTalentArborLaunchContextLookup({ reader, onDiagnostic: diagnostics });

        await expect(lookup({
            candidateId: "123456",
            jobCollectionId: null,
            requirementId: "129571",
            talentChannelId: "3",
            clientId: null,
            hostDomain: null,
            sourceSurface: "TA_JOB_DETAIL",
        })).resolves.toBeNull();
        expect(diagnostics).toHaveBeenCalledWith({
            operation: "validation",
            reason: "invalid_client_id",
        });
        expect(reader.findRequirementById).not.toHaveBeenCalled();
    });
});
