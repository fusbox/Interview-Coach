import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(process.cwd(), "db/migrations/041_ai_eval_worker_retention_operations.sql"),
    "utf8",
);

describe("AI-eval worker retention operations migration", () => {
    it("creates immutable metadata-only retention receipts", () => {
        expect(migration).toContain("create table if not exists public.ai_eval_scenario_retention_operations");
        expect(migration).toContain("request_key uuid not null unique");
        expect(migration).toContain("operation_mode in ('dry_run', 'apply')");
        expect(migration).toContain("AI-eval retention operation receipts are immutable");
        expect(migration).not.toContain("output_json jsonb");
        expect(migration).not.toContain("scenario_payload_json jsonb");
    });

    it("limits cleanup to expired terminal unclaimed runs in bounded batches", () => {
        expect(migration).toContain("create or replace function public.cleanup_expired_ai_eval_scenario_runs");
        expect(migration).toContain("p_batch_limit not between 1 and 500");
        expect(migration).toContain("p_cutoff_at > clock_timestamp()");
        expect(migration).toContain("run.lifecycle_state in ('completed', 'failed', 'cancelled_before_start')");
        expect(migration).toContain("run.claim_worker_id is null");
        expect(migration).toContain("run.claim_expires_at is null");
        expect(migration).toContain("for update of run skip locked");
        expect(migration).toContain("pg_advisory_xact_lock");
    });

    it("keeps direct deletion blocked while permitting only function-owned cascades", () => {
        expect(migration).toContain("public.is_ai_eval_scenario_retention_cleanup()");
        expect(migration).toContain("AI-eval scenario runs cannot be deleted directly");
        expect(migration).toContain("AI-eval scenario run evidence cannot be deleted directly");
        expect(migration).toContain("AI-eval live operation evidence cannot be deleted in place");
        expect(migration).toContain("security definer");
        expect(migration).toContain("revoke all on function public.cleanup_expired_ai_eval_scenario_runs");
    });
});
