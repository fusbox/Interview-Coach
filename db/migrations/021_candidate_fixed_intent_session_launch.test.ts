import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
    process.cwd(),
    "db",
    "migrations",
    "021_candidate_fixed_intent_session_launch.sql",
);

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate fixed-intent session launch migration", () => {
    it("adds explicit version, expiry, terminal shape, and candidate-owned session lineage", () => {
        const sql = migrationSql();
        expect(sql).toContain("add column if not exists launch_version bigint");
        expect(sql).toContain("add column if not exists expires_at timestamptz");
        expect(sql).toContain("add column if not exists consumed_at timestamptz");
        expect(sql).toContain("created_at + interval '24 hours'");
        expect(sql).toContain("foreign key ( consumed_candidate_practice_session_id, candidate_profile_id )");
        expect(sql).toContain("references public.candidate_practice_sessions( candidate_practice_session_id, candidate_profile_id )");
        expect(sql).toContain("chk_candidate_practice_intents_terminal_shape");
    });

    it("makes intent content immutable and allows only terminal transitions from ready", () => {
        const sql = migrationSql();
        expect(sql).toContain("create or replace function public.enforce_candidate_practice_intent_immutability()");
        expect(sql).toContain("candidate practice intent content is immutable");
        expect(sql).toContain("old.lifecycle_state <> 'ready'");
        expect(sql).toContain("new.lifecycle_state not in ('consumed', 'cancelled', 'expired')");
        expect(sql).toContain("new.launch_version <> old.launch_version + 1");
    });

    it("defines one atomic, context-serialized intent-to-session transaction", () => {
        const sql = migrationSql();
        expect(sql).toContain("create or replace function public.start_candidate_practice_intent_session(");
        expect(sql).toContain("for update");
        expect(sql).toContain("pg_advisory_xact_lock");
        expect(sql).toContain("insert into public.candidate_practice_sessions");
        expect(sql).toContain("set lifecycle_state = 'consumed'");
        expect(sql).toContain("consumed_candidate_practice_session_id = v_created_session_id");
        expect(sql).toContain("'replayed'::text");
        expect(sql).toContain("'stale_context'::text");
        expect(sql).toContain("'consumed_mismatch'::text");
        expect(sql).toContain("'invalid_session'::text");
        expect(sql).toContain("source_session.candidate_profile_id = p_candidate_profile_id");
        expect(sql).toContain("source_session.role_profile_id is not distinct from v_intent.role_profile_id");
        expect(sql).toContain("launch.candidate_profile_id = p_candidate_profile_id");
    });
});
