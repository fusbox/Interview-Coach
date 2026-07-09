import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "db", "migrations", "007_candidate_practice_sessions_schema.sql");

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate practice sessions schema migration", () => {
    it("creates a candidate-owned session table for setup-created practice rounds", () => {
        const sql = migrationSql();

        expect(sql).toContain("create table if not exists public.candidate_practice_sessions");
        expect(sql).toContain("candidate_practice_session_id uuid primary key default gen_random_uuid()");
        expect(sql).toContain("candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade");
        expect(sql).toContain("role_profile_id uuid references public.candidate_role_preparation_profiles(role_profile_id) on delete set null");
        expect(sql).toContain("candidate_launch_session_id uuid references public.candidate_launch_sessions(candidate_launch_session_id) on delete set null");
        expect(sql).toContain("status text not null default 'planned'");
    });

    it("stores setup, plan, wording, progress, and answer draft snapshots as typed JSON boundaries", () => {
        const sql = migrationSql();

        expect(sql).toContain("setup_snapshot_json jsonb not null");
        expect(sql).toContain("question_plan_snapshot_json jsonb not null");
        expect(sql).toContain("question_wording_snapshot_json jsonb");
        expect(sql).toContain("question_wording_status text not null default 'not_requested'");
        expect(sql).toContain("progress_state_json jsonb not null default '{\"status\":\"planned\",\"currentquestionindex\":0}'::jsonb");
        expect(sql).toContain("answer_drafts_json jsonb not null default '{}'::jsonb");
        expect(sql).toContain("alter table public.candidate_practice_sessions add column if not exists answer_drafts_json jsonb not null default '{}'::jsonb");
        expect(sql).toContain("constraint chk_candidate_practice_sessions_setup_snapshot_object check (jsonb_typeof(setup_snapshot_json) = 'object')");
        expect(sql).toContain("constraint chk_candidate_practice_sessions_question_plan_object check (jsonb_typeof(question_plan_snapshot_json) = 'object')");
        expect(sql).toContain("constraint chk_candidate_practice_sessions_wording_snapshot_object check (question_wording_snapshot_json is null or jsonb_typeof(question_wording_snapshot_json) = 'object')");
        expect(sql).toContain("constraint chk_candidate_practice_sessions_progress_object check (jsonb_typeof(progress_state_json) = 'object')");
        expect(sql).toContain("constraint chk_candidate_practice_sessions_answer_drafts_object check (jsonb_typeof(answer_drafts_json) = 'object')");
    });

    it("adds query indexes and managed updated_at for candidate session recovery", () => {
        const sql = migrationSql();

        expect(sql).toContain("create index if not exists idx_candidate_practice_sessions_profile_status on public.candidate_practice_sessions(candidate_profile_id, status, updated_at desc)");
        expect(sql).toContain("create index if not exists idx_candidate_practice_sessions_role_profile on public.candidate_practice_sessions(role_profile_id, updated_at desc)");
        expect(sql).toContain("create index if not exists idx_candidate_practice_sessions_launch_session on public.candidate_practice_sessions(candidate_launch_session_id)");
        expect(sql).toContain("create trigger trg_candidate_practice_sessions_updated_at before update on public.candidate_practice_sessions");
    });
});
