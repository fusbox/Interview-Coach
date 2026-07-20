import { describe, expect, it, vi } from "vitest";

import type { CandidatePracticeIntentQueryClient } from "./candidate-practice-intent-repository";
import { createCandidateNextRoundDraftRepository } from "./candidate-next-round-draft-repository";

type Query = CandidatePracticeIntentQueryClient["query"];

describe("candidate next-round draft repository", () => {
    it("finds or creates one draft only through candidate-owned active prep context", async () => {
        const query = vi.fn<Query>(async () => ({ rows: [createDraftRow()] }));
        const repository = createCandidateNextRoundDraftRepository({ query });

        await expect(repository.findOrCreateDraft({
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
        })).resolves.toMatchObject({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            version: 2,
        });

        expect(normalizeSql(query.mock.calls[0][0])).toContain(
            "status in ('active', 'paused')",
        );
        expect(query.mock.calls[0][1]).toEqual(["candidate-1", "role-1"]);
    });

    it("adds a source question only at the expected version after evidence revalidation", async () => {
        const query = vi.fn<Query>(async () => ({
            rows: [{
                mutation_outcome: "updated",
                version: "3",
                candidate_next_round_draft_item_id: "item-1",
            }],
        }));
        const repository = createCandidateNextRoundDraftRepository({ query });

        await expect(repository.addItem({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            expectedVersion: 2,
            sourceCandidatePracticeSessionId: "session-1",
            sourceQuestionKey: "slot-1",
            practiceKind: "practice_from_feedback",
            provenance: "coach_update",
        })).resolves.toEqual({
            outcome: "updated",
            version: 3,
            candidateNextRoundDraftItemId: "item-1",
        });

        const sql = normalizeSql(query.mock.calls[0][0]);
        expect(sql).toContain("for update");
        expect(sql).toContain("draft.version = $4");
        expect(sql).toContain("source_session.answer_submissions_json ? $6");
        expect(sql).toContain("source_session.answer_analysis_snapshots_json ? $6");
        expect(sql).toContain("profile.rigor_baseline_question_wording_snapshot_json");
        expect(sql).toContain("not (source_session.setup_snapshot_json ? 'followuppractice')");
        expect(query.mock.calls[0][1]).toEqual([
            "draft-1",
            "candidate-1",
            "role-1",
            2,
            "session-1",
            "slot-1",
            "practice_from_feedback",
            "coach_update",
        ]);
    });

    it("returns typed optimistic conflicts without inventing a mutation", async () => {
        const repository = createCandidateNextRoundDraftRepository({
            query: vi.fn(async () => ({
                rows: [{ mutation_outcome: "version_conflict", version: "5" }],
            })),
        });

        await expect(repository.removeItem({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            expectedVersion: 4,
            candidateNextRoundDraftItemId: "item-1",
        })).resolves.toEqual({ outcome: "version_conflict", version: 5 });
    });

    it("rejects malformed reorder requests before issuing SQL", async () => {
        const query = vi.fn<Query>();
        const repository = createCandidateNextRoundDraftRepository({ query });

        await expect(repository.reorderItems({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            expectedVersion: 2,
            orderedItemIds: ["item-1", "item-1"],
            expectedItemCount: 2,
        })).resolves.toEqual({ outcome: "invalid_order" });
        expect(query).not.toHaveBeenCalled();
    });

    it("clears only the exact owned version and increments the draft once", async () => {
        const query = vi.fn<Query>(async () => ({
            rows: [{ mutation_outcome: "updated", version: 4 }],
        }));
        const repository = createCandidateNextRoundDraftRepository({ query });

        await expect(repository.clearDraft({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            expectedVersion: 3,
        })).resolves.toEqual({ outcome: "updated", version: 4 });
        expect(normalizeSql(query.mock.calls[0][0])).toContain("set version = draft.version + 1");
    });
});

function createDraftRow() {
    return {
        candidate_next_round_draft_id: "draft-1",
        candidate_profile_id: "candidate-1",
        role_profile_id: "role-1",
        version: "2",
        items_json: [],
        created_at: "2026-07-15T12:00:00.000Z",
        updated_at: "2026-07-15T12:01:00.000Z",
    };
}

function normalizeSql(value: unknown) {
    return String(value).replace(/\s+/g, " ").trim().toLowerCase();
}
