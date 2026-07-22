import { describe, expect, it, vi } from "vitest";

import {
    CandidateResumeArtifactRepositoryError,
    createCandidateResumeTextArtifactRepository,
} from "./candidate-resume-text-artifact-repository";

const candidateProfileId = "10000000-0000-4000-8000-000000000001";
const artifactId = "20000000-0000-4000-8000-000000000001";
const setupOwnerKey = `candidate:${candidateProfileId}`;

describe("candidate resume text artifact repository", () => {
    it("creates a candidate-owned document review artifact without passing raw source text to persistence", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ display_name: "Dev Candidate", email: "dev@example.com" }] })
            .mockResolvedValueOnce({ rows: [artifactRow({
                source: "document_upload",
                candidate_label: "resume.pdf",
                source_fingerprint: "c".repeat(64),
            })] });
        const repository = createCandidateResumeTextArtifactRepository({ query });

        const artifact = await repository.createOrRecoverReviewArtifact({
            candidateProfileId,
            source: "document_upload",
            text: "Dev Candidate\ndev@example.com\nInventory lead with shipping experience.",
            candidateLabel: "C:\\private\\resume.pdf",
            sourceFingerprint: "c".repeat(64),
            now: new Date("2026-07-21T12:00:00.000Z"),
        });

        expect(artifact).toMatchObject({
            artifactId,
            candidateProfileId,
            reviewState: "awaiting_review",
            originalRetained: false,
            source: "document_upload",
            candidateLabel: "resume.pdf",
        });
        const persistenceCall = query.mock.calls[1];
        expect(persistenceCall[0]).toContain("candidate_resume_processed_artifacts");
        expect(persistenceCall[1][1]).toBe("document_upload");
        expect(persistenceCall[1][4]).toBe("c".repeat(64));
        expect(persistenceCall[1]).not.toContain("dev@example.com");
        expect(persistenceCall[1]).not.toContain("Dev Candidate");
        expect(persistenceCall[1]).toContain("[Name removed]\n[Email removed]\nInventory lead with shipping experience.");
    });

    it("requires another review when candidate edits reintroduce direct PII", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{
                ...artifactRow(),
                display_name: "Dev Candidate",
                email: "dev@example.com",
            }] })
            .mockResolvedValueOnce({ rows: [{
                ...artifactRow(),
                review_revision: 2,
                normalized_text: "Inventory lead with shipping experience. [Email removed]",
                normalized_text_fingerprint: "c".repeat(64),
                pii_redaction_counts_json: { email: 1 },
            }] });
        const repository = createCandidateResumeTextArtifactRepository({ query });

        const result = await repository.acceptReview({
            candidateProfileId,
            setupOwnerKey,
            artifactId,
            expectedVersion: 1,
            expectedRevision: 1,
            reviewedText: "Inventory lead with shipping experience. dev@example.com",
            now: new Date("2026-07-21T12:05:00.000Z"),
        });

        expect(result.outcome).toBe("review_required");
        expect(result.artifact).toMatchObject({ revision: 2, reviewState: "awaiting_review" });
        expect(query.mock.calls[1][1]).toContain("awaiting_review");
    });

    it("accepts reviewed text behind the expected revision fence", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{
                ...artifactRow(),
                display_name: "Dev Candidate",
                email: "dev@example.com",
            }] })
            .mockResolvedValueOnce({ rows: [{
                ...artifactRow(),
                review_revision: 2,
                review_state: "accepted",
                accepted_at: new Date("2026-07-21T12:05:00.000Z"),
            }] });
        const repository = createCandidateResumeTextArtifactRepository({ query });

        const result = await repository.acceptReview({
            candidateProfileId,
            setupOwnerKey,
            artifactId,
            expectedVersion: 1,
            expectedRevision: 1,
            reviewedText: "Inventory lead with shipping experience.",
            now: new Date("2026-07-21T12:05:00.000Z"),
        });

        expect(result.outcome).toBe("accepted");
        expect(result.artifact).toMatchObject({ revision: 2, reviewState: "accepted" });
    });

    it("fails stale or unowned review operations without mutating", async () => {
        const staleQuery = vi.fn().mockResolvedValueOnce({ rows: [{
            ...artifactRow(),
            review_revision: 2,
            display_name: "Dev Candidate",
            email: "dev@example.com",
        }] });
        await expect(createCandidateResumeTextArtifactRepository({ query: staleQuery }).acceptReview({
            candidateProfileId,
            setupOwnerKey,
            artifactId,
            expectedVersion: 1,
            expectedRevision: 1,
            reviewedText: "Inventory lead with shipping experience.",
            now: new Date("2026-07-21T12:05:00.000Z"),
        })).rejects.toEqual(expect.objectContaining({ code: "STALE_REVISION" }));
        expect(staleQuery).toHaveBeenCalledTimes(1);

        const unownedQuery = vi.fn().mockResolvedValueOnce({ rows: [] });
        await expect(createCandidateResumeTextArtifactRepository({ query: unownedQuery }).acceptReview({
            candidateProfileId,
            setupOwnerKey,
            artifactId,
            expectedVersion: 1,
            expectedRevision: 1,
            reviewedText: "Inventory lead with shipping experience.",
            now: new Date("2026-07-21T12:05:00.000Z"),
        })).rejects.toBeInstanceOf(CandidateResumeArtifactRepositoryError);
    });

    it("requires a new artifact when the recorded scrub policy is no longer current", async () => {
        const query = vi.fn().mockResolvedValueOnce({ rows: [{
            ...artifactRow(),
            pii_policy_version: "candidate_resume_direct_pii_v1",
            display_name: "Dev Candidate",
            email: "dev@example.com",
        }] });

        await expect(createCandidateResumeTextArtifactRepository({ query }).acceptReview({
            candidateProfileId,
            setupOwnerKey,
            artifactId,
            expectedVersion: 1,
            expectedRevision: 1,
            reviewedText: "Inventory lead with shipping experience.",
            now: new Date("2026-07-21T12:05:00.000Z"),
        })).rejects.toEqual(expect.objectContaining({ code: "STALE_POLICY" }));
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("resolves only the exact accepted candidate-owned version and revision", async () => {
        const query = vi.fn().mockResolvedValueOnce({ rows: [{
            ...artifactRow(),
            review_revision: 2,
            review_state: "accepted",
            accepted_at: new Date("2026-07-21T12:05:00.000Z"),
        }] });
        const result = await createCandidateResumeTextArtifactRepository({ query }).resolveAcceptedArtifact({
            candidateProfileId,
            artifactId,
            version: 1,
            revision: 2,
        });

        expect(result).toMatchObject({ artifactId, version: 1, revision: 2, reviewState: "accepted" });
        expect(query).toHaveBeenCalledWith(expect.stringContaining("review_state = 'accepted'"), [
            artifactId,
            candidateProfileId,
            1,
            2,
            "candidate_resume_text_processing_v1",
            "candidate_resume_direct_pii_v5",
        ]);
    });
});

function artifactRow(overrides: Record<string, unknown> = {}) {
    return {
        candidate_resume_artifact_id: artifactId,
        candidate_profile_id: candidateProfileId,
        role_profile_id: null,
        version: 1,
        review_revision: 1,
        source: "pasted_text",
        candidate_label: "Pasted resume",
        normalized_text: "Inventory lead with shipping experience.",
        source_fingerprint: "a".repeat(64),
        normalized_text_fingerprint: "b".repeat(64),
        processing_policy_version: "candidate_resume_text_processing_v1",
        pii_policy_version: "candidate_resume_direct_pii_v5",
        pii_redaction_counts_json: {},
        review_state: "awaiting_review",
        original_retained: false,
        created_at: new Date("2026-07-21T12:00:00.000Z"),
        accepted_at: null,
        ...overrides,
    };
}
