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
            findOwnedJobContext: vi.fn(),
        };
        const lookup = createTalentArborLaunchContextLookup({ reader });

        const result = await lookup({
            candidateId: "123456",
            jobCollectionId: null,
            hostDomain: "talentarbor.com",
            sourceSurface: "TA_DASHBOARD",
        });

        expect(reader.findCandidateById).toHaveBeenCalledWith(123456);
        expect(reader.findOwnedJobContext).not.toHaveBeenCalled();
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
        });
        expect(JSON.stringify(result)).not.toContain("must-not-escape-reader-row");
    });

    it("requires an owned bridge row and canonical catalog context for a job-aware launch", async () => {
        const reader = {
            findCandidateById: vi.fn(),
            findOwnedJobContext: vi.fn(async () => [{
                candidateId: 123456,
                userId: 101,
                companyId: 2,
                email: "candidate@example.com",
                displayName: "Candidate Example",
                jobCollectionId: 5551234,
                jobTitle: "CDL Truck Driver",
                jobDescription: "Drive safely and complete delivery documentation.",
                client: "Example Client",
                location: "New Jersey",
                isActive: false,
                isExpired: true,
                expirationDate: new Date("2026-06-01T00:00:00.000Z"),
            }]),
        };
        const lookup = createTalentArborLaunchContextLookup({ reader });

        const result = await lookup({
            candidateId: "123456",
            jobCollectionId: "5551234",
            hostDomain: "talentarbor.com",
            sourceSurface: "TA_JOB_DETAIL",
        });

        expect(reader.findCandidateById).not.toHaveBeenCalled();
        expect(reader.findOwnedJobContext).toHaveBeenCalledWith(123456, 5551234);
        expect(result).toMatchObject({
            candidateId: 123456,
            jobCollectionId: 5551234,
            jobTitle: "CDL Truck Driver",
            jobDescriptionSource: "JobCollection",
            isActive: false,
            isExpired: true,
        });
    });

    it("rejects invalid SQL identifiers before opening a database connection", async () => {
        const reader = {
            findCandidateById: vi.fn(),
            findOwnedJobContext: vi.fn(),
        };
        const diagnostics = vi.fn();
        const lookup = createTalentArborLaunchContextLookup({ reader, onDiagnostic: diagnostics });

        await expect(lookup({
            candidateId: "123456 OR 1=1",
            jobCollectionId: null,
            hostDomain: null,
            sourceSurface: "TA_DASHBOARD",
        })).resolves.toBeNull();
        await expect(lookup({
            candidateId: "123456",
            jobCollectionId: "0",
            hostDomain: null,
            sourceSurface: "TA_JOB_DETAIL",
        })).resolves.toBeNull();

        expect(reader.findCandidateById).not.toHaveBeenCalled();
        expect(reader.findOwnedJobContext).not.toHaveBeenCalled();
        expect(diagnostics).toHaveBeenNthCalledWith(1, {
            operation: "validation",
            reason: "invalid_candidate_id",
        });
        expect(diagnostics).toHaveBeenNthCalledWith(2, {
            operation: "validation",
            reason: "invalid_job_collection_id",
        });
    });

    it("does not degrade an unowned job-aware launch to identity-only context", async () => {
        const reader = {
            findCandidateById: vi.fn(async () => [{ candidateId: 123456 }]),
            findOwnedJobContext: vi.fn(async () => []),
        };
        const diagnostics = vi.fn();
        const lookup = createTalentArborLaunchContextLookup({ reader, onDiagnostic: diagnostics });

        await expect(lookup({
            candidateId: "123456",
            jobCollectionId: "5551234",
            hostDomain: null,
            sourceSurface: "TA_JOB_DETAIL",
        })).resolves.toBeNull();

        expect(reader.findCandidateById).not.toHaveBeenCalled();
        expect(diagnostics).toHaveBeenCalledWith({
            operation: "owned_job_context",
            reason: "job_not_owned_or_catalog_missing",
        });
    });

    it("fails closed on ambiguous, mismatched, or failed database results without exposing errors", async () => {
        const diagnostics = vi.fn();
        const ambiguousLookup = createTalentArborLaunchContextLookup({
            reader: {
                findCandidateById: vi.fn(async () => [{ candidateId: 123456 }, { candidateId: 123456 }]),
                findOwnedJobContext: vi.fn(),
            },
            onDiagnostic: diagnostics,
        });
        const mismatchedLookup = createTalentArborLaunchContextLookup({
            reader: {
                findCandidateById: vi.fn(async () => [{ candidateId: 999999 }]),
                findOwnedJobContext: vi.fn(),
            },
            onDiagnostic: diagnostics,
        });
        const failedLookup = createTalentArborLaunchContextLookup({
            reader: {
                findCandidateById: vi.fn(async () => {
                    throw new Error("password=secret; select * from CandidateMaster");
                }),
                findOwnedJobContext: vi.fn(),
            },
            onDiagnostic: diagnostics,
        });
        const input = {
            candidateId: "123456",
            jobCollectionId: null,
            hostDomain: null,
            sourceSurface: "TA_DASHBOARD",
        };

        await expect(ambiguousLookup(input)).resolves.toBeNull();
        await expect(mismatchedLookup(input)).resolves.toBeNull();
        await expect(failedLookup(input)).resolves.toBeNull();

        expect(diagnostics).toHaveBeenCalledWith({
            operation: "candidate_identity",
            reason: "ambiguous_result",
        });
        expect(diagnostics).toHaveBeenCalledWith({
            operation: "candidate_identity",
            reason: "invalid_result",
        });
        expect(diagnostics).toHaveBeenCalledWith({
            operation: "candidate_identity",
            reason: "query_failed",
        });
        expect(JSON.stringify(diagnostics.mock.calls)).not.toContain("password=secret");
    });
});
