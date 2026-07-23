import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
    resolve(process.cwd(), "db/migrations/040_ai_eval_live_scenario_execution.sql"),
    "utf8",
);

describe("AI-eval live scenario execution migration", () => {
    it("requires a frozen live gate and cost preview only for credentialed runs", () => {
        expect(migration).toContain("live_execution_gate_version text");
        expect(migration).toContain("cost_preview_json jsonb not null");
        expect(migration).toContain("ai_eval_scenario_live_gate_v1");
        expect(migration).toContain("ai_eval_live_cost_preview_v1");
        expect(migration).toContain("Non-live AI-eval runs cannot carry live execution controls");
    });

    it("persists immutable provider-operation checkpoints behind the current run claim", () => {
        expect(migration).toContain("create table if not exists public.ai_eval_scenario_live_operations");
        expect(migration).toContain("uq_ai_eval_scenario_live_operation");
        expect(migration).toContain("Accepted AI-eval live operation evidence is immutable");
        expect(migration).toContain("AI-eval live operation requires the current run claim");
        expect(migration).toContain("operation.attempt_count < 3");
    });

    it("provides dedicated renewable live-run claims without making fixture runs claimable", () => {
        expect(migration).toContain("create or replace function public.claim_next_ai_eval_live_scenario_run");
        expect(migration).toContain("create or replace function public.claim_ai_eval_live_scenario_run");
        expect(migration).toContain("run.execution_mode = 'credentialed_live'");
        expect(migration).toContain("for update skip locked");
    });
});
