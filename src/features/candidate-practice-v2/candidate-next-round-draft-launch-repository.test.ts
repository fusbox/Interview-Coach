import { describe, expect, it, vi } from "vitest";

import type {
    CandidatePracticeIntentItem,
    CandidatePracticeIntentRecord,
} from "./candidate-follow-up-practice-intent";
import type { CandidatePracticeIntentQueryClient } from "./candidate-practice-intent-repository";
import { createCandidateNextRoundDraftLaunchRepository } from "./candidate-next-round-draft-launch-repository";

type Query = CandidatePracticeIntentQueryClient["query"];

describe("candidate next-round draft launch repository", () => {
    it("recovers an existing candidate-owned intent for one draft version", async () => {
        const query = vi.fn<Query>(async () => ({ rows: [createIntentRow()] }));
        const repository = createCandidateNextRoundDraftLaunchRepository({ query });

        await expect(repository.findIntentForDraftVersion({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            sourceDraftVersion: 4,
        })).resolves.toMatchObject({
            candidatePracticeIntentId: "intent-1",
            sourceNextRoundDraftId: "draft-1",
            sourceNextRoundDraftVersion: 4,
        });

        const sql = normalizeSql(query.mock.calls[0][0]);
        expect(sql).toContain("where source_next_round_draft_id = $1");
        expect(sql).toContain("and candidate_profile_id = $2");
        expect(sql).toContain("and role_profile_id = $3");
        expect(query.mock.calls[0][1]).toEqual(["draft-1", "candidate-1", "role-1", 4]);
    });

    it("delegates the all-or-nothing snapshot to the database function", async () => {
        const query = vi.fn<Query>(async () => ({
            rows: [{
                launch_outcome: "created",
                candidate_practice_intent_id: "intent-2",
                current_version: "5",
            }],
        }));
        const repository = createCandidateNextRoundDraftLaunchRepository({ query });

        await expect(repository.snapshotDraftToIntent({
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            expectedVersion: 4,
            targetInterviewId: "quality inspector",
            targetRole: "Quality Inspector",
            setupContext: createIntentRow().setup_context_json,
            items: createIntentRow().items_json,
        })).resolves.toEqual({
            outcome: "created",
            candidatePracticeIntentId: "intent-2",
            currentVersion: 5,
        });

        const sql = normalizeSql(query.mock.calls[0][0]);
        expect(sql).toContain("from public.snapshot_candidate_next_round_draft_to_intent");
        expect(query.mock.calls[0][1]).toHaveLength(8);
    });

    it("returns typed replay and conflict outcomes", async () => {
        const query = vi.fn<Query>()
            .mockResolvedValueOnce({
                rows: [{ launch_outcome: "replayed", candidate_practice_intent_id: "intent-1" }],
            })
            .mockResolvedValueOnce({
                rows: [{ launch_outcome: "version_conflict", current_version: "7" }],
            });
        const repository = createCandidateNextRoundDraftLaunchRepository({ query });
        const input = {
            candidateNextRoundDraftId: "draft-1",
            candidateProfileId: "candidate-1",
            roleProfileId: "role-1",
            expectedVersion: 4,
            targetInterviewId: "quality inspector",
            targetRole: "Quality Inspector",
            setupContext: createIntentRow().setup_context_json,
            items: createIntentRow().items_json,
        };

        await expect(repository.snapshotDraftToIntent(input)).resolves.toEqual({
            outcome: "replayed",
            candidatePracticeIntentId: "intent-1",
        });
        await expect(repository.snapshotDraftToIntent(input)).resolves.toEqual({
            outcome: "version_conflict",
            currentVersion: 7,
        });
    });
});

function createIntentRow() {
    const setupContext: CandidatePracticeIntentRecord["setupContext"] = {
        targetRole: "Quality Inspector",
        jobDescription: "Inspect finished goods.",
        interviewStage: "screening",
        questionCount: 2,
        resumeIncluded: false,
    };
    const items: CandidatePracticeIntentItem[] = [{
        kind: "practice_from_feedback",
        source: {
            kind: "coach_update_detail",
            candidatePracticeSessionId: "session-1",
            questionKey: "slot-1",
            targetInterviewId: "quality inspector",
            targetRole: "Quality Inspector",
            questionNumber: 1,
            category: "Screening",
            questionText: "Why this role?",
            evidenceStatus: "practiced_with_coaching",
        },
        display: {
            label: "Practice from coach feedback",
            body: "Practice question 1.",
        },
        assembly: {
            source: "next_round_draft",
            candidateNextRoundDraftItemId: "item-1",
            provenance: "coach_update",
            displayPosition: 0,
        },
    }];

    return {
        candidate_practice_intent_id: "intent-1",
        candidate_profile_id: "candidate-1",
        source: "practice_builder",
        lifecycle_state: "ready",
        consumed_candidate_practice_session_id: null,
        source_next_round_draft_id: "draft-1",
        source_next_round_draft_version: "4",
        role_profile_id: "role-1",
        target_interview_id: "quality inspector",
        target_role: "Quality Inspector",
        setup_context_json: setupContext,
        items_json: items,
        created_at: "2026-07-15T12:00:00.000Z",
        updated_at: "2026-07-15T12:00:00.000Z",
    };
}

function normalizeSql(value: unknown) {
    return String(value).replace(/\s+/g, " ").trim().toLowerCase();
}
