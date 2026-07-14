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
        expect(queries[0].values.slice(0, 5)).toEqual([
            "candidate-1",
            "practice_builder",
            "ready",
            "material handler i",
            "Material Handler I",
        ]);
        expect(queries[0].values[5]).toEqual(JSON.stringify({
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely.",
            interviewStage: "first_interview",
            questionCount: 3,
            resumeIncluded: false,
        }));
        expect(queries[0].values[6]).toEqual(expect.any(String));
        expect(JSON.parse(queries[0].values[6] as string)).toMatchObject([
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

    it("marks a ready practice intent consumed with the created follow-up session id", async () => {
        const repository = createCandidatePracticeIntentRepository({
            async query(sql, values) {
                expect(normalizeSql(sql)).toContain("update public.candidate_practice_intents");
                expect(values).toEqual(["intent-1", "candidate-1", "session-2"]);
                return {
                    rows: [{
                        candidate_practice_intent_id: "intent-1",
                        lifecycle_state: "consumed",
                        consumed_candidate_practice_session_id: "session-2",
                    }],
                };
            },
        });

        await expect(repository.markPracticeIntentConsumed({
            candidatePracticeIntentId: "intent-1",
            candidateProfileId: "candidate-1",
            consumedCandidatePracticeSessionId: "session-2",
        })).resolves.toEqual({
            candidatePracticeIntentId: "intent-1",
            lifecycleState: "consumed",
            consumedCandidatePracticeSessionId: "session-2",
        });
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
        consumed_candidate_practice_session_id: null,
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
    };
}

function normalizeSql(sql: string) {
    return sql.replace(/\s+/g, " ").trim().toLowerCase();
}
