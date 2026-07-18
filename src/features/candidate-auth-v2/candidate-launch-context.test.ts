import { describe, expect, it, vi } from "vitest";

import {
    normalizeCandidateLaunchContextRow,
    resolveCandidateLaunchContext,
    type CandidateLaunchContextRow,
} from "./candidate-launch-context";

describe("candidate launch context contract", () => {
    const baseRow: CandidateLaunchContextRow = {
        candidateId: 12345,
        userId: 67890,
        companyId: 2,
        email: null,
        displayName: null,
        hostDomain: "rangamworks.com",
        sourceSurface: "RW_JOB_SEARCH",
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
    };

    it("normalizes approved candidate and job launch context", () => {
        const result = normalizeCandidateLaunchContextRow(baseRow);

        expect(result).toEqual({
            ok: true,
            context: {
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
            },
        });
    });

    it("fails closed when the purpose-built resolver cannot find job context", () => {
        expect(normalizeCandidateLaunchContextRow(null)).toEqual({
            ok: false,
            reason: "missing_launch_context",
        });
    });

    it("surfaces inactive or expired jobs as normalized context flags instead of dropping the row", () => {
        const result = normalizeCandidateLaunchContextRow({
            ...baseRow,
            isActive: false,
            isExpired: true,
        });

        expect(result).toMatchObject({
            ok: true,
            context: {
                job: {
                    isActive: false,
                    isExpired: true,
                },
            },
        });
    });

    it("allows partial requirement mapping because RequirementID is not guaranteed from every listing", () => {
        const result = normalizeCandidateLaunchContextRow({
            ...baseRow,
            requirementId: null,
            requirementCode: null,
            talentChannelId: 3,
        });

        expect(result).toMatchObject({
            ok: true,
            context: {
                source: {
                    talentChannelId: "3",
                },
                job: {
                    requirementId: null,
                    requirementCode: null,
                },
            },
        });
    });

    it("allows identity-only launch context while rejecting incomplete job context", () => {
        expect(normalizeCandidateLaunchContextRow({ ...baseRow, candidateId: null })).toEqual({
            ok: false,
            reason: "missing_candidate_id",
        });
        expect(normalizeCandidateLaunchContextRow({ ...baseRow, jobCollectionId: null })).toMatchObject({
            ok: true,
            context: {
                candidate: { candidateId: "12345" },
                job: null,
            },
        });
        expect(normalizeCandidateLaunchContextRow({ ...baseRow, jobTitle: " " })).toEqual({
            ok: false,
            reason: "missing_job_title",
        });
        expect(normalizeCandidateLaunchContextRow({ ...baseRow, jobDescription: "" })).toEqual({
            ok: false,
            reason: "missing_job_description",
        });
    });

    it("resolves context through an injected future TA/RW launch-context lookup", async () => {
        const lookupLaunchContext = vi.fn(async () => baseRow);

        const result = await resolveCandidateLaunchContext({
            input: {
                candidateId: "12345",
                jobCollectionId: "555",
                hostDomain: "rangamworks.com",
                sourceSurface: "RW_JOB_SEARCH",
            },
            lookupLaunchContext,
        });

        expect(result).toMatchObject({
            ok: true,
            context: {
                candidate: {
                    candidateId: "12345",
                },
                job: {
                    jobCollectionId: "555",
                },
            },
        });
        expect(lookupLaunchContext).toHaveBeenCalledWith({
            candidateId: "12345",
            jobCollectionId: "555",
            hostDomain: "rangamworks.com",
            sourceSurface: "RW_JOB_SEARCH",
        });
    });
});
