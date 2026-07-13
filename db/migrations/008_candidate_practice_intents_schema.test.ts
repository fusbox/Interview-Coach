import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "db", "migrations", "008_candidate_practice_intents_schema.sql");

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate practice intents schema migration", () => {
    it("creates candidate-owned durable practice intents for follow-up rounds", () => {
        const sql = migrationSql();

        expect(sql).toContain("create table if not exists public.candidate_practice_intents");
        expect(sql).toContain("candidate_practice_intent_id uuid primary key default gen_random_uuid()");
        expect(sql).toContain("candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade");
        expect(sql).toContain("source text not null");
        expect(sql).toContain("lifecycle_state text not null default 'ready'");
        expect(sql).toContain("consumed_candidate_practice_session_id uuid references public.candidate_practice_sessions(candidate_practice_session_id) on delete set null");
        expect(sql).toContain("alter table public.candidate_practice_intents add column if not exists consumed_candidate_practice_session_id uuid references public.candidate_practice_sessions(candidate_practice_session_id) on delete set null");
        expect(sql).toContain("target_interview_id text not null");
        expect(sql).toContain("target_role text not null");
    });

    it("stores setup context and an ordered selected-question item array as typed JSON boundaries", () => {
        const sql = migrationSql();

        expect(sql).toContain("setup_context_json jsonb not null");
        expect(sql).toContain("items_json jsonb not null");
        expect(sql).toContain("constraint chk_candidate_practice_intents_setup_context_object check (jsonb_typeof(setup_context_json) = 'object')");
        expect(sql).toContain("constraint chk_candidate_practice_intents_items_array check (jsonb_typeof(items_json) = 'array')");
        expect(sql).toContain("constraint chk_candidate_practice_intents_items_count check (jsonb_array_length(items_json) between 1 and 20)");
        expect(sql).toContain("constraint chk_candidate_practice_intents_source check (source in ('coach_update_detail', 'practice_builder', 'plan_aware_queue', 'coach_bundle'))");
        expect(sql).toContain("constraint chk_candidate_practice_intents_lifecycle_state check (lifecycle_state in ('ready', 'consumed', 'cancelled', 'expired'))");
    });

    it("adds candidate, target, and lifecycle indexes plus managed updated_at", () => {
        const sql = migrationSql();

        expect(sql).toContain("create index if not exists idx_candidate_practice_intents_profile_state on public.candidate_practice_intents(candidate_profile_id, lifecycle_state, updated_at desc)");
        expect(sql).toContain("create index if not exists idx_candidate_practice_intents_profile_target on public.candidate_practice_intents(candidate_profile_id, target_interview_id, updated_at desc)");
        expect(sql).toContain("create trigger trg_candidate_practice_intents_updated_at before update on public.candidate_practice_intents");
    });
});
