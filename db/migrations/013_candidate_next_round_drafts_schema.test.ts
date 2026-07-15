import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "db", "migrations", "013_candidate_next_round_drafts_schema.sql");

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate next-round draft schema migration", () => {
    it("creates one versioned draft per candidate-owned prep context", () => {
        const sql = migrationSql();
        expect(sql).toContain("create table if not exists public.candidate_next_round_drafts");
        expect(sql).toContain("unique (candidate_profile_id, role_profile_id)");
        expect(sql).toContain("foreign key (candidate_profile_id, role_profile_id)");
        expect(sql).toContain("constraint chk_candidate_next_round_draft_version check (version > 0)");
    });

    it("normalizes ordered source-question items under draft and source ownership", () => {
        const sql = migrationSql();
        expect(sql).toContain("create table if not exists public.candidate_next_round_draft_items");
        expect(sql).toContain("fk_candidate_next_round_item_owned_draft");
        expect(sql).toContain("fk_candidate_next_round_item_owned_source");
        expect(sql).toContain("on delete no action");
        expect(sql).toContain("deferrable initially deferred");
        expect(sql).toContain("uq_candidate_next_round_item_source unique");
        expect(sql).toContain("uq_candidate_next_round_item_position unique");
        expect(sql).toContain("enforce_candidate_next_round_draft_item_limit");
    });

    it("links an immutable intent to one source draft version for replay", () => {
        const sql = migrationSql();
        expect(sql).toContain("add column if not exists source_next_round_draft_id uuid");
        expect(sql).toContain("add column if not exists source_next_round_draft_version bigint");
        expect(sql).toContain("fk_candidate_practice_intent_source_draft");
        expect(sql).toContain("uq_candidate_practice_intent_source_draft_version");
        expect(sql).toContain("source_next_round_draft_version is not null");
        expect(sql).toContain("snapshot_candidate_next_round_draft_to_intent");
        expect(sql).toContain("for update");
        expect(sql).toContain("return query select 'replayed'::text");
        expect(sql).toContain("delete from public.candidate_next_round_draft_items");
        expect(sql).toContain("set version = draft.version + 1");
    });
});
