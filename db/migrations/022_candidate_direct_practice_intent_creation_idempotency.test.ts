import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
    process.cwd(),
    "db",
    "migrations",
    "022_candidate_direct_practice_intent_creation_idempotency.sql",
);

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate direct practice intent creation idempotency migration", () => {
    it("stores only candidate-owned request identity and the resulting intent pointer", () => {
        const sql = migrationSql();
        expect(sql).toContain("create table if not exists public.candidate_practice_intent_creation_requests");
        expect(sql).toContain("unique (candidate_profile_id, idempotency_key_hash)");
        expect(sql).toContain("foreign key (candidate_practice_intent_id, candidate_profile_id)");
        expect(sql).toContain("interval '24 hours'");
        expect(sql).not.toContain("job_description_snapshot");
        expect(sql).not.toContain("resume_text");
    });

    it("serializes one candidate action and creates the intent plus request pointer atomically", () => {
        const sql = migrationSql();
        expect(sql).toContain("create or replace function public.create_candidate_direct_practice_intent(");
        expect(sql).toContain("pg_advisory_xact_lock");
        expect(sql).toContain("'conflict'::text");
        expect(sql).toContain("'replayed'::text");
        expect(sql).toContain("insert into public.candidate_practice_intents");
        expect(sql).toContain("insert into public.candidate_practice_intent_creation_requests");
        expect(sql).toContain("p_source not in ('coach_update_detail', 'plan_aware_queue', 'coach_bundle')");
    });
});
