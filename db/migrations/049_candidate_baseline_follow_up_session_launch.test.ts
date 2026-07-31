import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sql = fs.readFileSync(
    path.join(process.cwd(), "db/migrations/049_candidate_baseline_follow_up_session_launch.sql"),
    "utf8",
);

describe("candidate baseline follow-up session launch migration", () => {
    it("keeps ordinary and feedback-driven questions tied to persisted source wording", () => {
        expect(sql).toContain("source_session.question_wording_snapshot_json -> 'questions'");
        expect(sql).toContain("source_question ->> 'questionText' = source.item #>> '{source,questionText}'");
    });

    it("permits only missing-evidence items to resolve exact wording through the owned baseline", () => {
        expect(sql).toContain("source.item ->> 'kind' = 'practice_missing_evidence'");
        expect(sql).toContain("role_profile.candidate_profile_id = p_candidate_profile_id");
        expect(sql).toContain("role_profile.rigor_baseline_question_wording_snapshot_json -> 'questions'");
        expect(sql).toContain("baseline_question ->> 'questionText'");
        expect(sql).toContain("not source_session.answer_submissions_json");
    });
});
