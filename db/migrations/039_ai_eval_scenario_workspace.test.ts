import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(process.cwd(), "db/migrations/039_ai_eval_scenario_workspace.sql"),
    "utf8",
);

describe("AI-eval scenario workspace migration", () => {
    it("creates operator-owned drafts and immutable staged suite versions", () => {
        expect(migration).toContain("create table if not exists public.ai_eval_scenario_drafts");
        expect(migration).toContain("create table if not exists public.ai_eval_scenario_versions");
        expect(migration).toContain("create table if not exists public.ai_eval_scenario_suite_versions");
        expect(migration).toContain("create table if not exists public.ai_eval_scenario_suite_members");
        expect(migration).toContain("Staged AI-eval scenario versions are immutable");
        expect(migration).toContain("active individual operator grant");
    });

    it("creates idempotent durable runs with renewable worker claims", () => {
        expect(migration).toContain("create table if not exists public.ai_eval_scenario_runs");
        expect(migration).toContain("uq_ai_eval_scenario_run_request");
        expect(migration).toContain("create or replace function public.create_ai_eval_scenario_run_request");
        expect(migration).toContain("idempotency_conflict");
        expect(migration).toContain("create or replace function public.claim_next_ai_eval_scenario_run");
        expect(migration).toContain("create or replace function public.claim_ai_eval_scenario_run");
        expect(migration).toContain("for update skip locked");
        expect(migration).toContain("claim_generation = run.claim_generation + 1");
        expect(migration).toContain("run.execution_mode = 'contract_fixture'");
        expect(migration).toContain("retention_expires_at timestamptz not null default (now() + interval '30 days')");
        expect(migration).toContain("version.staged_by_operator_user_id = p_operator_user_id");
        expect(migration).toContain("uq_ai_eval_scenario_version_draft_revision");
    });

    it("persists recoverable per-case and per-layer evidence without auditing content", () => {
        expect(migration).toContain("create table if not exists public.ai_eval_scenario_run_cases");
        expect(migration).toContain("create table if not exists public.ai_eval_scenario_run_layers");
        expect(migration).toContain("Terminal AI-eval scenario result rows are immutable");
        const auditFunction = migration.slice(
            migration.indexOf("create or replace function public.audit_ai_eval_scenario_mutation"),
            migration.indexOf("comment on table public.ai_eval_scenario_drafts"),
        );
        expect(auditFunction).not.toContain("scenario_payload_json");
        expect(auditFunction).not.toContain("output_json");
        expect(auditFunction).not.toContain("diagnostics_json");
    });
});
