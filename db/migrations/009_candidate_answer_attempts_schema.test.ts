import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "db", "migrations", "009_candidate_answer_attempts_schema.sql");

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate answer attempts schema migration", () => {
    it("creates immutable candidate-owned answer attempts with retry lineage", () => {
        const sql = migrationSql();

        expect(sql).toContain("create table if not exists public.candidate_answer_attempts");
        expect(sql).toContain("foreign key (candidate_practice_session_id, candidate_profile_id) references public.candidate_practice_sessions(candidate_practice_session_id, candidate_profile_id) on delete cascade");
        expect(sql).toContain("attempt_number integer not null");
        expect(sql).toContain("constraint fk_candidate_answer_attempt_supersedes foreign key (supersedes_candidate_answer_attempt_id) references public.candidate_answer_attempts(candidate_answer_attempt_id)");
        expect(sql).toContain("constraint chk_candidate_answer_attempt_lineage check");
        expect(sql).toContain("create or replace function public.validate_candidate_answer_attempt_lineage()");
        expect(sql).toContain("prior.attempt_number = new.attempt_number - 1");
        expect(sql).toContain("create or replace function public.prevent_candidate_answer_attempt_update()");
        expect(sql).toContain("constraint uq_candidate_answer_attempt_number unique (candidate_practice_session_id, question_slot_id, attempt_number)");
        expect(sql).toContain("constraint uq_candidate_answer_attempt_idempotency unique (candidate_practice_session_id, question_slot_id, idempotency_key)");
    });

    it("stores evaluator runs separately from candidate answer attempts", () => {
        const sql = migrationSql();

        expect(sql).toContain("create table if not exists public.candidate_answer_evaluation_runs");
        expect(sql).toContain("candidate_answer_attempt_id uuid not null references public.candidate_answer_attempts(candidate_answer_attempt_id) on delete cascade");
        expect(sql).toContain("constraint chk_candidate_answer_evaluation_run_purpose check (purpose in ('candidate_coaching', 'qa_comparison'))");
        expect(sql).toContain("constraint chk_candidate_answer_evaluation_run_state check (lifecycle_state in ('requested', 'completed', 'failed', 'rejected'))");
        expect(sql).toContain("create or replace function public.validate_candidate_answer_evaluation_run_transition()");
        expect(sql).toContain("new.lifecycle_state not in ('completed', 'failed', 'rejected')");
        expect(sql).toContain("constraint uq_candidate_answer_evaluation_run_idempotency unique (candidate_answer_attempt_id, idempotency_key)");
    });

    it("backfills valid latest-result V2 submissions as attempt one", () => {
        const sql = migrationSql();

        expect(sql).toContain("cross join lateral jsonb_each(coalesce(session.answer_submissions_json, '{}'::jsonb)) submission");
        expect(sql).toContain("'migration-backfill:' || submission.key");
        expect(sql).toContain("~* '^[0-9]{4}-[0-9]{2}-[0-9]{2}t'");
        expect(sql).toContain("on conflict (candidate_practice_session_id, question_slot_id, attempt_number) do nothing");
    });
});
