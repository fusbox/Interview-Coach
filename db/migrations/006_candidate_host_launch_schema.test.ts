import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "db", "migrations", "006_candidate_host_launch_schema.sql");

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate host launch schema migration", () => {
    it("supersedes stale identity provider values with explicit host-launch providers", () => {
        const sql = migrationSql();

        expect(sql).toContain("alter table public.candidate_identities drop constraint if exists chk_candidate_identities_provider");
        expect(sql).toContain("constraint chk_candidate_identities_provider check (provider in ('rangamworks_sso', 'talentarbor_login', 'password', 'dev_mock', 'talentarbor_launch', 'rangamworks_launch'))");
    });

    it("adds platform identity columns needed to trace host launches", () => {
        const sql = migrationSql();

        expect(sql).toContain("add column if not exists host_candidate_id text");
        expect(sql).toContain("add column if not exists host_user_id text");
        expect(sql).toContain("add column if not exists platform_candidate_id text");
        expect(sql).toContain("add column if not exists workspace text");
        expect(sql).toContain("create index if not exists idx_candidate_identities_platform_candidate on public.candidate_identities(provider, workspace, platform_candidate_id)");
    });

    it("creates launch sessions with queryable context snapshot columns and json metadata", () => {
        const sql = migrationSql();

        expect(sql).toContain("create table if not exists public.candidate_launch_sessions");
        expect(sql).toContain("candidate_launch_session_id uuid primary key default gen_random_uuid()");
        expect(sql).toContain("candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade");
        expect(sql).toContain("provider text not null");
        expect(sql).toContain("expires_at timestamptz not null");
        expect(sql).toContain("platform_candidate_id text not null");
        expect(sql).toContain("job_collection_id text not null");
        expect(sql).toContain("source_surface text not null");
        expect(sql).toContain("host_domain text");
        expect(sql).toContain("launch_context_snapshot_json jsonb not null default '{}'::jsonb");
        expect(sql).toContain("constraint chk_candidate_launch_sessions_snapshot_object check (jsonb_typeof(launch_context_snapshot_json) = 'object')");
        expect(sql).toContain("create index if not exists idx_candidate_launch_sessions_profile_expires on public.candidate_launch_sessions(candidate_profile_id, expires_at desc)");
        expect(sql).toContain("create index if not exists idx_candidate_launch_sessions_context on public.candidate_launch_sessions(candidate_profile_id, platform_candidate_id, job_collection_id)");
    });
});
