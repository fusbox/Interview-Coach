import { describe, expect, it } from "vitest";

import {
    createCandidatePracticeIntentRepository,
    toCandidatePracticeIntentRecord,
} from "./candidate-practice-intent-repository";
import type { CandidatePracticeIntentRecord } from "./candidate-follow-up-practice-intent";

describe("candidate practice intent repository", () => {
    it("creates a durable candidate-owned follow-up practice intent with one or many items", async () => {
        const queries: Array<{ sql: string; values: unknown[] }> = [];
        const repository = createCandidatePracticeIntentRepository({
            async query(sql, values) {
                queries.push({ sql, values });
                return {
                    rows: [{
                        candidate_practice_intent_id: "intent-1",
                    }],
                };
            },
        });

        await expect(repository.createPracticeIntent({
            candidateProfileId: "candidate-1",
            source: "practice_builder",
            roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            targetInterviewId: "material handler i",
            targetRole: "Material Handler I",
            setupContext: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials safely.",
                interviewStage: "first_interview",
                questionCount: 3,
                resumeIncluded: false,
            },
            items: [createIntentItem("slot-1"), createIntentItem("slot-2")],
        })).resolves.toEqual({
            candidatePracticeIntentId: "intent-1",
        });

        expect(queries).toHaveLength(1);
        expect(normalizeSql(queries[0].sql)).toContain("insert into public.candidate_practice_intents");
        expect(queries[0].values.slice(0, 8)).toEqual([
            "candidate-1",
            "practice_builder",
            "ready",
            null,
            null,
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            "material handler i",
            "Material Handler I",
        ]);
        expect(queries[0].values[8]).toEqual(JSON.stringify({
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely.",
            interviewStage: "first_interview",
            questionCount: 3,
            resumeIncluded: false,
        }));
        expect(queries[0].values[9]).toEqual(expect.any(String));
        expect(JSON.parse(queries[0].values[9] as string)).toMatchObject([
            {
                source: {
                    questionKey: "slot-1",
                },
            },
            {
                source: {
                    questionKey: "slot-2",
                },
            },
        ]);
    });

    it("delegates direct creation to the atomic candidate-owned request boundary", async () => {
        const queries: Array<{ sql: string; values: unknown[] }> = [];
        const repository = createCandidatePracticeIntentRepository({
            async query(sql, values) {
                queries.push({ sql, values });
                return {
                    rows: [{
                        creation_outcome: "replayed",
                        candidate_practice_intent_id: "intent-1",
                        intent_lifecycle_state: "consumed",
                        consumed_candidate_practice_session_id: "session-2",
                    }],
                };
            },
        });

        await expect(repository.createDirectPracticeIntent({
            candidateProfileId: "candidate-1",
            source: "coach_update_detail",
            roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            targetInterviewId: "material handler i",
            targetRole: "Material Handler I",
            setupContext: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials safely.",
                interviewStage: "first_interview",
                questionCount: 1,
                resumeIncluded: false,
            },
            items: [createIntentItem("slot-1")],
            idempotencyKeyHash: "a".repeat(64),
            requestFingerprint: "b".repeat(64),
        })).resolves.toEqual({
            outcome: "replayed",
            candidatePracticeIntentId: "intent-1",
            lifecycleState: "consumed",
            consumedCandidatePracticeSessionId: "session-2",
        });

        expect(normalizeSql(queries[0].sql)).toContain(
            "from public.create_candidate_direct_practice_intent(",
        );
        expect(queries[0].values.slice(0, 5)).toEqual([
            "candidate-1",
            "a".repeat(64),
            "b".repeat(64),
            "coach_update_detail",
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ]);
    });

    it("finds a candidate-owned practice intent by id and candidate", async () => {
        const repository = createCandidatePracticeIntentRepository({
            async query(sql, values) {
                expect(normalizeSql(sql)).toContain("from public.candidate_practice_intents");
                expect(values).toEqual(["intent-1", "candidate-1"]);
                return {
                    rows: [createIntentRow()],
                };
            },
        });

        await expect(repository.findPracticeIntent({
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
        })).resolves.toMatchObject({
            status: "candidate_practice_intent_record",
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            lifecycleState: "ready",
            launchVersion: 1,
            expiresAt: "2026-07-13T12:00:00.000Z",
            roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            itemCount: 2,
            items: [
                {
                    source: {
                        questionKey: "slot-1",
                    },
                },
                {
                    source: {
                        questionKey: "slot-2",
                    },
                },
            ],
        });
    });

    it("normalizes a consumed intent only with complete launch lineage", () => {
        expect(toCandidatePracticeIntentRecord({
            ...createIntentRow(),
            lifecycle_state: "consumed",
            launch_version: 2,
            consumed_candidate_practice_session_id: "session-2",
            consumed_at: "2026-07-12T12:05:00.000Z",
        })).toMatchObject({
            lifecycleState: "consumed",
            launchVersion: 2,
            consumedCandidatePracticeSessionId: "session-2",
            consumedAt: "2026-07-12T12:05:00.000Z",
        });

        expect(toCandidatePracticeIntentRecord({
            ...createIntentRow(),
            lifecycle_state: "consumed",
            launch_version: 2,
            consumed_candidate_practice_session_id: "session-2",
            consumed_at: null,
        })).toBeNull();
    });

    it("normalizes malformed rows closed instead of leaking partial practice intents", () => {
        expect(toCandidatePracticeIntentRecord(undefined)).toBeNull();
        expect(toCandidatePracticeIntentRecord({
            candidate_practice_intent_id: "intent-1",
            candidate_profile_id: "candidate-1",
            source: "practice_builder",
            lifecycle_state: "ready",
            target_interview_id: "material handler i",
            target_role: "Material Handler I",
            setup_context_json: {},
            items_json: [],
            created_at: "2026-07-12T12:00:00.000Z",
            updated_at: "2026-07-12T12:00:00.000Z",
        })).toBeNull();
        expect(toCandidatePracticeIntentRecord({
            ...createIntentRow(),
            expires_at: "not-a-date",
        })).toBeNull();
    });

    it("normalizes complete next-round draft lineage and rejects partial lineage", () => {
        expect(toCandidatePracticeIntentRecord({
            ...createIntentRow(),
            source_next_round_draft_id: "draft-1",
            source_next_round_draft_version: "3",
        })).toMatchObject({
            sourceNextRoundDraftId: "draft-1",
            sourceNextRoundDraftVersion: 3,
        });

        expect(toCandidatePracticeIntentRecord({
            ...createIntentRow(),
            source_next_round_draft_id: "draft-1",
            source_next_round_draft_version: null,
        })).toBeNull();
    });
});

function createIntentItem(questionKey: string): CandidatePracticeIntentRecord["items"][number] {
    const questionNumber = questionKey === "slot-1" ? 1 : 2;

    return {
        kind: "practice_from_feedback",
        source: {
            kind: "coach_update_detail",
            candidatePracticeSessionId: "session-1",
            questionKey,
            targetInterviewId: "material handler i",
            targetRole: "Material Handler I",
            questionNumber,
            category: questionNumber === 1 ? "Screening" : "Behavioral",
            questionText: questionNumber === 1
                ? "What interests you about this Material Handler role?"
                : "Tell me about a time you handled an inventory issue.",
            evidenceStatus: "practiced_with_coaching",
        },
        display: {
            label: "Practice from coach feedback",
            body: `I found the source coach read for Material Handler I, question ${questionNumber}.`,
        },
    };
}

function createIntentRow() {
    return {
        candidate_practice_intent_id: "intent-1",
        candidate_profile_id: "candidate-1",
        source: "practice_builder",
        lifecycle_state: "ready",
        launch_version: 1,
        consumed_candidate_practice_session_id: null,
        consumed_at: null,
        role_profile_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        target_interview_id: "material handler i",
        target_role: "Material Handler I",
        setup_context_json: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely.",
            interviewStage: "first_interview",
            questionCount: 3,
            resumeIncluded: false,
        },
        items_json: [createIntentItem("slot-1"), createIntentItem("slot-2")],
        created_at: "2026-07-12T12:00:00.000Z",
        updated_at: "2026-07-12T12:01:00.000Z",
        expires_at: "2026-07-13T12:00:00.000Z",
    };
}

function normalizeSql(sql: string) {
    return sql.replace(/\s+/g, " ").trim().toLowerCase();
}
