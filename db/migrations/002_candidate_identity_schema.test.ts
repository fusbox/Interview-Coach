import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "db", "migrations", "002_candidate_identity_schema.sql");

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate identity schema migration", () => {
    it("creates candidate profile and identity tables", () => {
        const sql = migrationSql();

        expect(sql).toContain("create table if not exists public.candidate_profiles");
        expect(sql).toContain("candidate_profile_id uuid primary key default gen_random_uuid()");
        expect(sql).toContain("auth_subject text not null");
        expect(sql).toContain("email text not null");
        expect(sql).toContain("workspace text not null");
        expect(sql).toContain("display_name text");
        expect(sql).toContain("create table if not exists public.candidate_identities");
        expect(sql).toContain("candidate_identity_id uuid primary key default gen_random_uuid()");
        expect(sql).toContain("candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade");
    });

    it("declares candidate ownership and provider uniqueness constraints", () => {
        const sql = migrationSql();

        expect(sql).toContain("constraint chk_candidate_profiles_workspace check (workspace in ('rangamworks', 'talentarbor', 'local_dev'))");
        expect(sql).toContain("constraint chk_candidate_profiles_email_nonempty check (length(trim(email)) > 0)");
        expect(sql).toContain("create unique index if not exists ux_candidate_profiles_auth_subject on public.candidate_profiles(auth_subject)");
        expect(sql).toContain("create index if not exists idx_candidate_profiles_workspace on public.candidate_profiles(workspace)");
        expect(sql).toContain("constraint chk_candidate_identities_provider check (provider in ('rangamworks_sso', 'talentarbor_login', 'password', 'dev_mock'))");
        expect(sql).toContain("constraint uq_candidate_identities_provider_subject unique (provider, issuer, subject)");
        expect(sql).toContain("create index if not exists idx_candidate_identities_profile_id on public.candidate_identities(candidate_profile_id)");
    });

    it("keeps profile and identity updated_at timestamps managed by the shared trigger", () => {
        const sql = migrationSql();

        expect(sql).toContain("drop trigger if exists trg_candidate_profiles_updated_at on public.candidate_profiles");
        expect(sql).toContain("create trigger trg_candidate_profiles_updated_at before update on public.candidate_profiles");
        expect(sql).toContain("drop trigger if exists trg_candidate_identities_updated_at on public.candidate_identities");
        expect(sql).toContain("create trigger trg_candidate_identities_updated_at before update on public.candidate_identities");
        expect(sql).toContain("execute function public.set_updated_at()");
    });
});
