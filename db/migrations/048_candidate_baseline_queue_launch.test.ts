import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sql = fs.readFileSync(
    path.join(process.cwd(), "db/migrations/048_candidate_baseline_queue_launch.sql"),
    "utf8",
);

describe("candidate baseline queue launch migration", () => {
    it("keeps feedback launch tied to persisted source-round evidence", () => {
        expect(sql).toContain("item.practice_kind = 'practice_from_feedback'");
        expect(sql).toContain("source_session.question_wording_snapshot_json -> 'questions'");
        expect(sql).toContain("source_session.answer_submissions_json ? item.source_question_key");
        expect(sql).toContain("source_session.answer_analysis_snapshots_json ? item.source_question_key");
    });

    it("allows missing-evidence launch from the candidate-owned immutable baseline", () => {
        expect(sql).toContain("join public.candidate_role_preparation_profiles role_profile");
        expect(sql).toContain("item.practice_kind = 'practice_missing_evidence'");
        expect(sql).toContain("role_profile.rigor_baseline_question_wording_snapshot_json -> 'questions'");
        expect(sql).toContain("baseline_question ->> 'slotId' = item.source_question_key");
    });
});
