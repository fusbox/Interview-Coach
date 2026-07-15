import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "db", "migrations", "014_candidate_prep_context_practice_paths_schema.sql");

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate prep-context practice-path schema migration", () => {
    it("adds a positive path ordinal and permits explicit same-role/JD paths", () => {
        const sql = migrationSql();

        expect(sql).toContain("add column if not exists practice_path_number integer not null default 1");
        expect(sql).toContain("constraint chk_candidate_role_profiles_practice_path_number");
        expect(sql).toContain("check (practice_path_number > 0)");
        expect(sql).toContain("drop index if exists public.ux_candidate_role_profiles_active_role_jd");
        expect(sql).toContain("create unique index if not exists ux_candidate_role_profiles_active_role_jd_path");
        expect(sql).toContain("job_description_hash, practice_path_number");
        expect(sql).toContain("where status <> 'archived'");
    });

    it("keeps exact manual-match lookup indexed independently of path identity", () => {
        const sql = migrationSql();

        expect(sql).toContain("create index if not exists idx_candidate_role_profiles_manual_match");
        expect(sql).toContain("job_description_hash, updated_at desc");
        expect(sql).toContain("where status in ('active', 'paused')");
    });
});
