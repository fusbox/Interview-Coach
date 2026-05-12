import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "db", "migrations", "003_candidate_practice_drafts_schema.sql");

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate practice drafts schema migration", () => {
    it("creates candidate-owned practice draft storage", () => {
        const sql = migrationSql();

        expect(sql).toContain("create table if not exists public.candidate_practice_drafts");
        expect(sql).toContain("practice_draft_id uuid primary key default gen_random_uuid()");
        expect(sql).toContain("candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade");
        expect(sql).toContain("target_role text not null");
        expect(sql).toContain("job_description text");
        expect(sql).toContain("resume_context_json jsonb not null default '{}'::jsonb");
    });

    it("declares status, resume target, and ownership indexes", () => {
        const sql = migrationSql();

        expect(sql).toContain("constraint chk_candidate_practice_drafts_status check (status in ('draft', 'generating', 'ready', 'in_session', 'completed', 'generation_failed'))");
        expect(sql).toContain("constraint chk_candidate_practice_drafts_resume_target check (resume_target_screen in ('practice_setup', 'practice_generating', 'session_entry', 'session_in_progress', 'session_summary', 'dashboard'))");
        expect(sql).toContain("create index if not exists idx_candidate_practice_drafts_profile_status on public.candidate_practice_drafts(candidate_profile_id, status)");
        expect(sql).toContain("create index if not exists idx_candidate_practice_drafts_last_activity on public.candidate_practice_drafts(candidate_profile_id, last_activity_at desc)");
    });

    it("keeps practice draft updated_at managed by the shared trigger", () => {
        const sql = migrationSql();

        expect(sql).toContain("drop trigger if exists trg_candidate_practice_drafts_updated_at on public.candidate_practice_drafts");
        expect(sql).toContain("create trigger trg_candidate_practice_drafts_updated_at before update on public.candidate_practice_drafts");
        expect(sql).toContain("execute function public.set_updated_at()");
    });
});
