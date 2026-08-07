import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
    resolve(process.cwd(), "db/migrations/053_candidate_canonical_pacing_and_question_updates.sql"),
    "utf8",
);

describe("migration 053 canonical pacing and question updates", () => {
    it("admits baseline V2 without rewriting baseline V1", () => {
        expect(sql).toContain("candidate_practice_plan_baseline_v1");
        expect(sql).toContain("candidate_practice_plan_baseline_v2");
        expect(sql).toContain("stageRecommendedQuestionCount");
        expect(sql).toContain("paceSize");
    });

    it("scopes Coach Update claims to immutable question evidence", () => {
        expect(sql).toContain("source_question_key");
        expect(sql).toContain("source_answer_attempt_id");
        expect(sql).toContain("source_accepted_evaluation_run_id");
        expect(sql).toContain("uq_candidate_answer_attempt_coach_update_source");
        expect(sql).toContain("uq_candidate_answer_evaluation_run_attempt_source");
        expect(sql).toContain("source_candidate_practice_session_id,\n      candidate_profile_id,\n      source_question_key");
        expect(sql).toContain("uq_candidate_coach_update_question_generation_attempt");
    });
});
