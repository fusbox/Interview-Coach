import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sql = readFileSync("db/migrations/037_ai_eval_operator_workbench_foundation.sql", "utf8")
    .replace(/\s+/g, " ")
    .toLowerCase();

describe("AI-eval operator workbench foundation migration", () => {
    it("uses an individual revocable grant rather than inherited app roles", () => {
        expect(sql).toContain("create table if not exists public.ai_eval_operator_grants");
        expect(sql).toContain("create or replace function public.is_active_ai_eval_operator");
        expect(sql).toContain("uq_ai_eval_operator_grants_active_user");
        expect(sql).toContain("ai-eval operator grant history is immutable");
        expect(sql).not.toContain("app_user_roles");
    });

    it("links each work item to exactly one eligible immutable serving source", () => {
        expect(sql).toContain("num_nonnulls( candidate_answer_evaluation_run_id");
        expect(sql).toContain("chk_ai_eval_work_item_source_shape");
        expect(sql).toContain("run.purpose = 'candidate_coaching'");
        expect(sql).toContain("question_set.source = 'generated'");
        expect(sql).toContain("ai-eval work item requires one eligible terminal serving source");
        expect(sql).toContain("ai-eval work item source identity is immutable");
    });

    it("derives searchable non-content metadata and does not persist source payloads", () => {
        expect(sql).toContain("audience text not null");
        expect(sql).toContain("interview_stage text");
        expect(sql).toContain("question_category text");
        expect(sql).toContain("source_failure_code text");
        const workItemTable = sql.split("create table if not exists public.ai_eval_work_items (")[1]
            ?.split("create unique index")[0] ?? "";
        expect(workItemTable).not.toMatch(/answer_text|job_description|resume_context|result_json|candidate_safe_content/);
    });

    it("revision-fences drafts, freezes submitted reviews, and links remediations only to submitted findings", () => {
        expect(sql).toContain("create table if not exists public.ai_eval_failure_label_catalog");
        expect(sql).toContain("fk_ai_eval_finding_label_catalog");
        expect(sql).toContain("ai-eval finding source references allow only bounded source pointers");
        expect(sql).toContain("ai-eval review contains an invalid layer judgment");
        expect(sql).toContain("submitted ai-eval reviews are immutable");
        expect(sql).toContain("ai-eval review revision must advance by one");
        expect(sql).toContain("ai-eval findings are mutable only while their review is draft");
        expect(sql).toContain("uq_ai_eval_findings_review_request");
        expect(sql).toContain("ai-eval finding identity is immutable");
        expect(sql).toContain("ai-eval remediations may link only submitted review findings");
        expect(sql).toContain("ai-eval remediation revision must advance by one");
    });

    it("audits grants and workflow mutations without source content", () => {
        expect(sql).toContain("ai_eval_operator_access_mutated");
        expect(sql).toContain("ai_eval_work_item_mutated");
        expect(sql).toContain("ai_eval_review_mutated");
        expect(sql).toContain("jsonb_build_object( 'action', v_action, 'entity_id', v_entity_id )");
        expect(sql).not.toContain("metadata jsonb_build_object");
    });
});
