import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(process.cwd(), "db", "migrations", "012_candidate_practice_session_status_backfill.sql");

describe("candidate practice-session status backfill", () => {
    it("promotes answered planned rounds without changing completed sessions", () => {
        const sql = readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();

        expect(sql).toContain("update public.candidate_practice_sessions set status = 'in_progress'");
        expect(sql).toContain("where status = 'planned'");
        expect(sql).toContain("completion_snapshot_json is null");
        expect(sql).toContain("coalesce(answer_submissions_json, '{}'::jsonb) <> '{}'::jsonb");
    });
});
