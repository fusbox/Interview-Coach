import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "db/migrations/025_recruiter_invitation_question_sets.sql"), "utf8");

describe("recruiter invitation question-set migration", () => {
    it("defines an owned hashed-action lifecycle with immutable accepted output", () => {
        expect(sql).toContain("create table if not exists public.recruiter_invitation_question_sets");
        expect(sql).toContain("unique (recruiter_id, action_key_hash)");
        expect(sql).toContain("lifecycle_state in ('preparing', 'ready', 'failed')");
        expect(sql).toContain("question_wording_snapshot_json");
        expect(sql).toContain("prevent_recruiter_invitation_question_set_mutation");
        expect(sql).toContain("source_recruiter_invitation_question_set_id");
        expect(sql).toContain("create_recruiter_invitation_aggregate_from_question_set");
        expect(sql).toContain("fk_recruiter_invitation_batch_question_set_owner");
        expect(sql).not.toContain("raw_action_key");
    });
});
