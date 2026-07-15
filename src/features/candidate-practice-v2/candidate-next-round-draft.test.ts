import { describe, expect, it } from "vitest";

import {
    createCandidateNextRoundDraftAssembly,
    normalizeCandidateNextRoundDraftRecord,
    validateCandidateNextRoundDraftOrder,
} from "./candidate-next-round-draft";

describe("candidate next-round draft", () => {
    it("normalizes a candidate-owned versioned draft with ordered items", () => {
        const draft = normalizeCandidateNextRoundDraftRecord(createDraftRow());

        expect(draft).toMatchObject({
            status: "candidate_next_round_draft",
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            version: 3,
            itemCount: 2,
            items: [
                { candidateNextRoundDraftItemId: "item-1", displayPosition: 0 },
                { candidateNextRoundDraftItemId: "item-2", displayPosition: 1 },
            ],
        });
        expect(createCandidateNextRoundDraftAssembly(draft!.items[0])).toEqual({
            source: "next_round_draft",
            candidateNextRoundDraftItemId: "item-1",
            provenance: "coach_update",
            displayPosition: 0,
        });
    });

    it("fails closed for malformed versions, duplicate sources, or duplicate positions", () => {
        expect(normalizeCandidateNextRoundDraftRecord({ ...createDraftRow(), version: 0 })).toBeNull();
        expect(normalizeCandidateNextRoundDraftRecord({
            ...createDraftRow(),
            items_json: [
                createItem("item-1", "session-1", "slot-1", 0),
                createItem("item-2", "session-1", "slot-1", 1),
            ],
        })).toBeNull();
        expect(normalizeCandidateNextRoundDraftRecord({
            ...createDraftRow(),
            items_json: [
                createItem("item-1", "session-1", "slot-1", 0),
                createItem("item-2", "session-1", "slot-2", 0),
            ],
        })).toBeNull();
    });

    it("accepts only complete, unique reorder payloads", () => {
        expect(validateCandidateNextRoundDraftOrder(["item-2", "item-1"], 2)).toEqual(["item-2", "item-1"]);
        expect(validateCandidateNextRoundDraftOrder(["item-1", "item-1"], 2)).toBeNull();
        expect(validateCandidateNextRoundDraftOrder(["item-1"], 2)).toBeNull();
        expect(validateCandidateNextRoundDraftOrder([], 0)).toBeNull();
    });
});

function createDraftRow() {
    return {
        candidate_next_round_draft_id: "draft-1",
        candidate_profile_id: "candidate-1",
        role_profile_id: "role-1",
        version: "3",
        items_json: [
            createItem("item-2", "session-1", "slot-2", 1, "coach_plan"),
            createItem("item-1", "session-1", "slot-1", 0, "coach_update"),
        ],
        created_at: new Date("2026-07-15T12:00:00.000Z"),
        updated_at: "2026-07-15T12:05:00.000Z",
    };
}

function createItem(
    itemId: string,
    sourceSessionId: string,
    sourceQuestionKey: string,
    displayPosition: number,
    provenance = "coach_update",
) {
    return {
        candidateNextRoundDraftItemId: itemId,
        sourceCandidatePracticeSessionId: sourceSessionId,
        sourceQuestionKey,
        practiceKind: sourceQuestionKey === "slot-1" ? "practice_from_feedback" : "practice_missing_evidence",
        provenance,
        displayPosition,
        createdAt: "2026-07-15T12:01:00.000Z",
        updatedAt: "2026-07-15T12:01:00.000Z",
    };
}
