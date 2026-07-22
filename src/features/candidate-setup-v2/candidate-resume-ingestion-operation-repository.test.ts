import { describe, expect, it, vi } from "vitest";

import {
    classifyCandidateResumeInputSize,
    classifyCandidateResumeLatency,
    classifyCandidateResumePageCount,
    createCandidateResumeIngestionDiagnostic,
    createCandidateResumeIngestionOperationRepository,
    emitCandidateResumeIngestionDiagnostic,
} from "./candidate-resume-ingestion-operation-repository";

describe("candidate resume ingestion operation repository", () => {
    it("claims with source policy and maps metadata-only database state", async () => {
        const query = vi.fn(async () => ({ rows: [{
            claim_outcome: "acquired",
            claim_generation: 2,
            candidate_resume_artifact_id: null,
            claim_expires_at: new Date("2026-07-22T12:01:00.000Z"),
        }] }));
        const repository = createCandidateResumeIngestionOperationRepository({ query });

        await expect(repository.claimOperation({
            operationId: "30000000-0000-4000-8000-000000000001",
            candidateProfileId: "10000000-0000-4000-8000-000000000001",
            setupOwnerKey: "candidate:primary",
            source: "photo_capture",
            now: new Date("2026-07-22T12:00:00.000Z"),
        })).resolves.toEqual({
            outcome: "acquired",
            claimGeneration: 2,
            artifactId: null,
            claimExpiresAt: "2026-07-22T12:01:00.000Z",
        });
        expect(query).toHaveBeenCalledWith(expect.stringContaining("claim_candidate_resume_ingestion_operation"), [
            "30000000-0000-4000-8000-000000000001",
            "10000000-0000-4000-8000-000000000001",
            "candidate:primary",
            "photo_capture",
            "2026-07-22T12:00:00.000Z",
            "2026-07-22T12:01:00.000Z",
            2,
            6,
            600,
            3,
        ]);
    });

    it("classifies only bounded operational metadata", () => {
        expect([
            classifyCandidateResumeInputSize(0),
            classifyCandidateResumeInputSize(17 * 1024),
            classifyCandidateResumeInputSize(6 * 1024 * 1024),
        ]).toEqual(["tiny", "small", "maximum"]);
        expect(classifyCandidateResumeLatency(45_000)).toBe("over_45s");
        expect(classifyCandidateResumePageCount(4)).toBe("multiple");

        const diagnostic = createCandidateResumeIngestionDiagnostic({
            source: "document_upload",
            outcome: "failed",
            reason: "extraction_failed",
            statusCode: 422,
            claimGeneration: 1,
            durationMs: 5200,
            inputSizeClass: "medium",
            pageCount: 0,
        });
        expect(diagnostic).toEqual({
            event: "candidate_resume_ingestion",
            source: "document_upload",
            outcome: "failed",
            reason: "extraction_failed",
            statusCode: 422,
            claimGeneration: 1,
            durationMs: 5200,
            latencyClass: "under_15s",
            inputSizeClass: "medium",
            pageCountClass: "none",
        });
        expect(JSON.stringify(diagnostic)).not.toMatch(/candidateProfileId|artifactId|filename|normalizedText|fingerprint|inputBytes/i);
    });

    it("does not let a diagnostic sink failure alter request handling", () => {
        expect(() => emitCandidateResumeIngestionDiagnostic(createCandidateResumeIngestionDiagnostic({
            source: "pasted_text",
            outcome: "accepted",
            reason: "completed",
            statusCode: 201,
            claimGeneration: 1,
            durationMs: 10,
            inputSizeClass: "tiny",
            pageCount: 0,
        }), () => {
            throw new Error("sink unavailable");
        })).not.toThrow();
    });
});
