import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "db", "migrations", "011_candidate_coach_update_artifacts_schema.sql");

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate Coach Update artifact schema migration", () => {
    it("binds artifacts to candidate-owned prep context and completed source session", () => {
        const sql = migrationSql();
        expect(sql).toContain("foreign key (candidate_profile_id, role_profile_id)");
        expect(sql).toContain("foreign key (source_candidate_practice_session_id, candidate_profile_id, role_profile_id)");
        expect(sql).toContain("source_candidate_practice_session_id uuid not null");
    });

    it("stores source lineage, version metadata, and candidate-safe content lifecycle", () => {
        const sql = migrationSql();
        expect(sql).toContain("source_completion_fingerprint text not null");
        expect(sql).toContain("source_answer_attempt_ids_json jsonb not null");
        expect(sql).toContain("accepted_evaluation_run_ids_json jsonb not null");
        expect(sql).toContain("synthesis_input_fingerprint text not null");
        expect(sql).toContain("candidate_safe_content_json jsonb");
        expect(sql).toContain("lifecycle_state in ('requested', 'completed', 'failed', 'rejected')");
    });

    it("permits only one requested-to-terminal transition and freezes source metadata", () => {
        const sql = migrationSql();
        expect(sql).toContain("old.lifecycle_state <> 'requested'");
        expect(sql).toContain("new.lifecycle_state not in ('completed', 'failed', 'rejected')");
        expect(sql).toContain("candidate coach update artifact source and version metadata are immutable");
    });
});
