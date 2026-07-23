import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sql = readFileSync("db/migrations/038_ai_eval_remediation_and_recheck.sql", "utf8")
    .replace(/\s+/g, " ")
    .toLowerCase();

describe("AI-eval remediation and recheck migration", () => {
    it("adds replay-safe remediation commands and governed change identity", () => {
        expect(sql).toContain("add column if not exists creation_request_key uuid");
        expect(sql).toContain("uq_ai_eval_remediation_creation_request");
        expect(sql).toContain("add column if not exists change_kind text");
        expect(sql).toContain("ai-eval changed remediation requires a governed change type and reference");
        expect(sql).toContain("ai-eval remediation lifecycle transition is not allowed");
    });

    it("anchors immutable regression cases to submitted findings and exact original work items", () => {
        expect(sql).toContain("create table if not exists public.ai_eval_regression_cases");
        expect(sql).toContain("source_finding_id uuid not null unique");
        expect(sql).toContain("original_work_item_id uuid not null");
        expect(sql).toContain("ai-eval regression cases require one exact submitted finding source");
        expect(sql).toContain("ai-eval regression cases are immutable");
    });

    it("accepts only later submitted same-surface exact outputs for sequential recheck", () => {
        expect(sql).toContain("create table if not exists public.ai_eval_rechecks");
        expect(sql).toContain("verification_review_id uuid not null");
        expect(sql).toContain("outcome in ('fixed', 'unchanged', 'regressed', 'unable_to_assess')");
        expect(sql).toContain("v_verification_occurred_at <= v_original_occurred_at");
        expect(sql).toContain("ai-eval recheck requires a later submitted exact output from the same surface");
        expect(sql).toContain("ai-eval rechecks are immutable");
    });

    it("prevents false verification and audits without source content", () => {
        expect(sql).toContain("ai-eval remediation cannot be verified until every regression case is fixed");
        expect(sql).toContain("ai_eval_regression_case_mutated");
        expect(sql).toContain("ai_eval_recheck_mutated");
        expect(sql).toContain("jsonb_build_object( 'action', lower(tg_op), 'entity_id'");
        expect(sql).not.toMatch(/answer_text|job_description|resume_context|candidate_safe_content/);
    });
});
