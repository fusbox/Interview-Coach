import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "db", "migrations", "004_candidate_role_preparation_profiles_schema.sql");

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate role preparation profiles schema migration", () => {
    it("creates candidate-owned role preparation profiles with required role and JD anchors", () => {
        const sql = migrationSql();

        expect(sql).toContain("create table if not exists public.candidate_role_preparation_profiles");
        expect(sql).toContain("role_profile_id uuid primary key default gen_random_uuid()");
        expect(sql).toContain("candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade");
        expect(sql).toContain("target_role text not null");
        expect(sql).toContain("normalized_target_role text not null");
        expect(sql).toContain("job_description_snapshot text not null");
        expect(sql).toContain("job_description_hash text not null");
        expect(sql).toContain("constraint chk_candidate_role_profiles_job_description_nonempty check (length(trim(job_description_snapshot)) > 0)");
    });

    it("links candidate practice drafts to role profiles without breaking older rows", () => {
        const sql = migrationSql();

        expect(sql).toContain("alter table public.candidate_practice_drafts add column if not exists role_profile_id uuid");
        expect(sql).toContain("references public.candidate_role_preparation_profiles(role_profile_id) on delete set null");
        expect(sql).toContain("create index if not exists idx_candidate_practice_drafts_role_profile on public.candidate_practice_drafts(role_profile_id)");
    });

    it("declares create-or-resolve indexes and managed updated_at", () => {
        const sql = migrationSql();

        expect(sql).toContain("create unique index if not exists ux_candidate_role_profiles_active_role_jd");
        expect(sql).toContain("where status <> 'archived'");
        expect(sql).toContain("create index if not exists idx_candidate_role_profiles_profile_status on public.candidate_role_preparation_profiles(candidate_profile_id, status, updated_at desc)");
        expect(sql).toContain("create trigger trg_candidate_role_profiles_updated_at before update on public.candidate_role_preparation_profiles");
        expect(sql).toContain("execute function public.set_updated_at()");
    });
});
