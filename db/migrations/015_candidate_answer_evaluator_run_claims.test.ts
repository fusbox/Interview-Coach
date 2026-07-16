import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function migrationSql() {
    const migrationPath = path.join(
        process.cwd(),
        "db",
        "migrations",
        "015_candidate_answer_evaluator_run_claims.sql",
    );
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate answer evaluator-run claims migration", () => {
    it("adds immutable sequential generations and explicit claim leases", () => {
        const sql = migrationSql();

        expect(sql).toContain("add column if not exists generation_attempt integer");
        expect(sql).toContain("partition by candidate_answer_attempt_id, purpose");
        expect(sql).toContain("add column if not exists claim_expires_at timestamptz");
        expect(sql).toContain("requested_at + interval '60 seconds'");
        expect(sql).toContain("check (generation_attempt > 0)");
        expect(sql).toContain("check (claim_expires_at = requested_at + interval '60 seconds')");
        expect(sql).toContain("drop trigger if exists trg_candidate_answer_evaluation_runs_updated_at");
        expect(sql).toContain("create trigger trg_candidate_answer_evaluation_runs_updated_at");
        expect(sql).toContain("new.generation_attempt");
        expect(sql).toContain("new.claim_expires_at");
    });

    it("replaces one-key-only idempotency with candidate-coaching claim fences", () => {
        const sql = migrationSql();

        expect(sql).toContain("drop constraint if exists uq_candidate_answer_evaluation_run_idempotency");
        expect(sql).toContain("create unique index if not exists uq_candidate_answer_evaluation_run_generation");
        expect(sql).toContain("create unique index if not exists uq_candidate_answer_evaluation_run_requested_coaching");
        expect(sql).toContain("where purpose = 'candidate_coaching' and lifecycle_state = 'requested'");
        expect(sql).toContain("create unique index if not exists uq_candidate_answer_evaluation_run_completed_coaching");
        expect(sql).toContain("where purpose = 'candidate_coaching' and lifecycle_state = 'completed'");
    });
});
