import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
    process.cwd(),
    "db",
    "migrations",
    "020_candidate_setup_start_idempotency.sql",
);

function migrationSql() {
    return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("candidate setup start idempotency migration", () => {
    it("stores candidate-owned request hashes and one accepted session pointer", () => {
        const sql = migrationSql();
        expect(sql).toContain("create table if not exists public.candidate_setup_start_requests");
        expect(sql).toContain("unique (candidate_profile_id, idempotency_key_hash)");
        expect(sql).toContain("request_fingerprint ~ '^[a-f0-9]{64}$'");
        expect(sql).toContain("foreign key (candidate_practice_session_id, candidate_profile_id)");
        expect(sql).toContain("references public.candidate_practice_sessions(candidate_practice_session_id, candidate_profile_id)");
        expect(sql).toContain("on delete cascade");
        expect(sql).toContain("last_error_code is null");
        expect(sql).not.toContain("setup_snapshot_json");
        expect(sql).not.toContain("response_body");
    });

    it("defines pending, completed, and failed lifecycle shapes with lease generations", () => {
        const sql = migrationSql();
        expect(sql).toContain("lifecycle_state in ('pending', 'completed', 'failed')");
        expect(sql).toContain("claim_generation > 0");
        expect(sql).toContain("claim_expires_at timestamptz not null");
        expect(sql).toContain("lifecycle_state = 'completed'");
        expect(sql).toContain("lifecycle_state = 'failed'");
    });
});
