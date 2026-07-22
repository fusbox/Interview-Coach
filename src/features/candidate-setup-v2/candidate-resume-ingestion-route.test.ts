import { describe, expect, it, vi } from "vitest";

import type { CandidateResumeTextArtifact } from "./candidate-resume-text-artifact-repository";
import {
    completeCandidateResumeIngestion,
    failCandidateResumeIngestion,
    type CandidateResumeIngestionContext,
    type CandidateResumeIngestionRouteDependencies,
} from "./candidate-resume-ingestion-route";

const candidateProfileId = "10000000-0000-4000-8000-000000000001";
const operationId = "30000000-0000-4000-8000-000000000001";
const setupOwnerKey = `candidate:${candidateProfileId}:setup`;

describe("candidate resume ingestion route lifecycle", () => {
    it("does not let a stale generation abandon a newer selection claim", async () => {
        const abandonSelectionOperation = vi.fn(async () => true);
        await failCandidateResumeIngestion({
            context: ingestionContext(),
            dependencies: dependencies({
                abandonSelectionOperation,
                failOperation: vi.fn(async () => "stale_claim" as const),
            }),
            terminalReason: "provider_unavailable",
            statusCode: 503,
            inputBytes: 1024,
            pageCount: 1,
        });

        expect(abandonSelectionOperation).not.toHaveBeenCalled();
    });

    it("abandons the pending selection only after the current generation is terminalized", async () => {
        const abandonSelectionOperation = vi.fn(async () => true);
        await failCandidateResumeIngestion({
            context: ingestionContext(),
            dependencies: dependencies({ abandonSelectionOperation }),
            terminalReason: "empty_extraction",
            statusCode: 422,
            inputBytes: 1024,
            pageCount: 1,
        });

        expect(abandonSelectionOperation).toHaveBeenCalledOnce();
        expect(abandonSelectionOperation).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId,
            setupOwnerKey,
            operationId,
        }));
    });

    it("does not clear selection state when late completion is lease-fenced", async () => {
        const abandonSelectionOperation = vi.fn(async () => true);
        const response = await completeCandidateResumeIngestion({
            context: ingestionContext(),
            dependencies: dependencies({
                abandonSelectionOperation,
                completeOperationAndPublish: vi.fn(async () => "stale_claim" as const),
            }),
            artifact: artifact(),
            inputBytes: 1024,
            pageCount: 1,
        });

        expect(response?.status).toBe(409);
        expect(abandonSelectionOperation).not.toHaveBeenCalled();
    });
});

function ingestionContext(): CandidateResumeIngestionContext {
    return {
        operationId,
        identity: { candidateProfileId, setupOwnerKey },
        source: "photo_capture",
        claimGeneration: 1,
        startedAtMs: Date.parse("2026-07-22T12:00:00.000Z"),
    };
}

function dependencies(overrides: {
    abandonSelectionOperation?: CandidateResumeIngestionRouteDependencies["selectionRepository"]["abandonSelectionOperation"];
    failOperation?: CandidateResumeIngestionRouteDependencies["operationRepository"]["failOperation"];
    completeOperationAndPublish?: CandidateResumeIngestionRouteDependencies["operationRepository"]["completeOperationAndPublish"];
} = {}): CandidateResumeIngestionRouteDependencies {
    return {
        now: new Date("2026-07-22T12:00:01.000Z"),
        operationRepository: {
            claimOperation: vi.fn(async () => ({
                outcome: "acquired" as const,
                claimGeneration: 1,
                artifactId: null,
                claimExpiresAt: "2026-07-22T12:01:00.000Z",
            })),
            completeOperationAndPublish: overrides.completeOperationAndPublish
                ?? vi.fn(async () => "completed" as const),
            failOperation: overrides.failOperation ?? vi.fn(async () => "failed" as const),
        },
        artifactRepository: {
            recoverSelectedArtifact: vi.fn(async () => artifact()),
        },
        selectionRepository: {
            beginSelectionOperation: vi.fn(async () => ({ revision: 1 })),
            abandonSelectionOperation: overrides.abandonSelectionOperation ?? vi.fn(async () => true),
        },
    };
}

function artifact(): CandidateResumeTextArtifact {
    return {
        artifactId: "40000000-0000-4000-8000-000000000001",
        candidateProfileId,
        roleProfileId: null,
        version: 1,
        revision: 1,
        source: "photo_capture",
        candidateLabel: "Resume photos",
        normalizedText: "Inventory lead.",
        sourceFingerprint: "a".repeat(64),
        normalizedTextFingerprint: "b".repeat(64),
        processingPolicyVersion: "candidate_resume_text_processing_v1",
        piiPolicyVersion: "candidate_resume_direct_pii_v1",
        piiRedactionCounts: {
            known_name: 0,
            personal_detail: 0,
            email: 0,
            phone: 0,
            address: 0,
            date_of_birth: 0,
            government_identifier: 0,
            personal_url_or_handle: 0,
        },
        reviewState: "awaiting_review",
        createdAt: "2026-07-22T12:00:00.000Z",
        acceptedAt: null,
        originalRetained: false,
    };
}
