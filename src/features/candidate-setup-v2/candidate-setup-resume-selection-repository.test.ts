import { describe, expect, it, vi } from "vitest";

import {
    createCandidateSetupResumeSelectionRepository,
    readCandidateResumeSelectionOperationId,
} from "./candidate-setup-resume-selection-repository";

const candidateProfileId = "10000000-0000-4000-8000-000000000001";
const setupOwnerKey = `candidate:${candidateProfileId}`;
const operationId = "30000000-0000-4000-8000-000000000001";
const artifactId = "20000000-0000-4000-8000-000000000001";
const now = new Date("2026-07-21T20:00:00.000Z");

describe("candidate setup resume selection repository", () => {
    it("claims a new operation and fences finalization to that exact operation", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ selection_revision: 4 }] })
            .mockResolvedValueOnce({ rows: [{ selection_revision: 4 }] });
        const repository = createCandidateSetupResumeSelectionRepository({ query });

        await expect(repository.beginSelectionOperation({
            candidateProfileId,
            setupOwnerKey,
            operationId,
            now,
        })).resolves.toEqual({ revision: 4 });
        await expect(repository.finalizeSelectionOperation({
            candidateProfileId,
            setupOwnerKey,
            operationId,
            artifactId,
            now,
        })).resolves.toBe(true);

        expect(query.mock.calls[0]?.[0]).toContain("selection_revision = candidate_setup_resume_selections.selection_revision + 1");
        expect(query.mock.calls[1]?.[0]).toContain("selection.pending_operation_id = $3::uuid");
        expect(query.mock.calls[1]?.[1]).toEqual([
            candidateProfileId,
            setupOwnerKey,
            operationId,
            artifactId,
            now.toISOString(),
        ]);
    });

    it("does not let a superseded provider result become the active selection", async () => {
        const query = vi.fn().mockResolvedValueOnce({ rows: [] });
        const selected = await createCandidateSetupResumeSelectionRepository({ query })
            .finalizeSelectionOperation({
                candidateProfileId,
                setupOwnerKey,
                operationId,
                artifactId,
                now,
            });

        expect(selected).toBe(false);
        expect(query.mock.calls[0]?.[0]).toContain("selection.lifecycle_state = 'pending'");
    });

    it("recovers only the active current-policy artifact for the exact setup owner", async () => {
        const query = vi.fn().mockResolvedValueOnce({ rows: [artifactRow()] });
        const result = await createCandidateSetupResumeSelectionRepository({ query })
            .recoverActiveSelection({ candidateProfileId, setupOwnerKey });

        expect(result).toMatchObject({ artifactId, candidateProfileId, reviewState: "awaiting_review" });
        expect(query).toHaveBeenCalledWith(expect.stringContaining("selection.lifecycle_state = 'active'"), [
            candidateProfileId,
            setupOwnerKey,
            "candidate_resume_text_processing_v1",
            "candidate_resume_direct_pii_v5",
        ]);
    });

    it("resolves setup submission only through the exact accepted active selection", async () => {
        const query = vi.fn().mockResolvedValueOnce({ rows: [{
            ...artifactRow(),
            review_revision: 2,
            review_state: "accepted",
            accepted_at: now,
        }] });
        const result = await createCandidateSetupResumeSelectionRepository({ query })
            .resolveAcceptedSelection({
                candidateProfileId,
                setupOwnerKey,
                artifactId,
                version: 1,
                revision: 2,
            });

        expect(result).toMatchObject({ artifactId, revision: 2, reviewState: "accepted" });
        expect(query.mock.calls[0]?.[1]).toEqual([
            candidateProfileId,
            setupOwnerKey,
            artifactId,
            1,
            2,
            "candidate_resume_text_processing_v1",
            "candidate_resume_direct_pii_v5",
        ]);
    });

    it("clears pending or active work by advancing the owner-scoped revision", async () => {
        const query = vi.fn().mockResolvedValueOnce({ rows: [{ selection_revision: 5 }] });
        await expect(createCandidateSetupResumeSelectionRepository({ query }).clearSelection({
            candidateProfileId,
            setupOwnerKey,
            now,
        })).resolves.toEqual({ revision: 5 });

        expect(query.mock.calls[0]?.[0]).toContain("lifecycle_state = 'cleared'");
        expect(query.mock.calls[0]?.[0]).toContain("pending_operation_id = null");
    });

    it("accepts UUID operation keys only", () => {
        expect(readCandidateResumeSelectionOperationId(operationId)).toBe(operationId);
        expect(readCandidateResumeSelectionOperationId("not-an-operation")).toBeNull();
        expect(readCandidateResumeSelectionOperationId(null)).toBeNull();
    });
});

function artifactRow() {
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
        created_at: now,
        accepted_at: null,
    };
}
