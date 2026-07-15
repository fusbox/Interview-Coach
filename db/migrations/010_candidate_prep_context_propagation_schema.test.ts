import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
    process.cwd(),
    "db",
    "migrations",
    "010_candidate_prep_context_propagation_schema.sql",
);

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate prep-context propagation schema migration", () => {
    it("adds an ownership-constrained role profile to durable practice intents", () => {
        const sql = migrationSql();

        expect(sql).toContain("add column if not exists role_profile_id uuid");
        expect(sql).toContain("foreign key (candidate_profile_id, role_profile_id)");
        expect(sql).toContain("references public.candidate_role_preparation_profiles(candidate_profile_id, role_profile_id)");
        expect(sql).toContain("create unique index if not exists ux_candidate_role_profiles_owner_identity on public.candidate_role_preparation_profiles(candidate_profile_id, role_profile_id)");
    });

    it("backfills traceable intents from their candidate-owned source session", () => {
        const sql = migrationSql();

        expect(sql).toContain("update public.candidate_practice_intents intent set role_profile_id = source_session.role_profile_id");
        expect(sql).toContain("source_session.candidate_profile_id = intent.candidate_profile_id");
        expect(sql).toContain("source_session.candidate_practice_session_id::text = intent.items_json #>> '{0,source,candidatepracticesessionid}'");
        expect(sql).toContain("from jsonb_array_elements(intent.items_json) intent_item");
        expect(sql).toContain("item_source_session.candidate_profile_id = intent.candidate_profile_id");
        expect(sql).toContain("item_source_session.role_profile_id = source_session.role_profile_id");
        expect(sql).toContain("item_source_session.candidate_practice_session_id::text = intent_item #>> '{source,candidatepracticesessionid}'");
    });

    it("indexes candidate and prep-context intent reads", () => {
        expect(migrationSql()).toContain(
            "create index if not exists idx_candidate_practice_intents_profile_role_context on public.candidate_practice_intents(candidate_profile_id, role_profile_id, updated_at desc)",
        );
    });
});
