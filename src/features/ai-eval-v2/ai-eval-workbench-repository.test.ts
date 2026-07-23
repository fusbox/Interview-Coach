import { describe, expect, it, vi } from "vitest";

import { createAiEvalWorkbenchRepository } from "./ai-eval-workbench-repository";

describe("AI-eval workbench repository", () => {
    it("lists unqueued eligible serving sources without selecting candidate identity or content", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [eligibleSourceRow()] });
        const repository = createAiEvalWorkbenchRepository({ query });

        await expect(repository.listEligibleSources("operator-1", {
            surface: "answer_coaching",
            sourceLifecycleState: "completed",
        })).resolves.toMatchObject([{
            sourceId: "00000000-0000-4000-8000-000000000002",
            sourceKind: "candidate_answer_evaluation",
            surface: "answer_coaching",
        }]);

        const sql = normalizeSql(query.mock.calls[0]?.[0]);
        expect(sql).toContain("not exists ( select 1 from public.ai_eval_work_items");
        expect(sql).toContain("question_set.source = 'generated'");
        expect(sql).toContain("public.ai_eval_operator_grants");
        expect(sql).not.toContain("candidate_profiles");
        expect(sql).not.toContain("answer_text");
        expect(sql).not.toContain("job_description as");
    });

    it("creates a source-linked work item and lets the database derive filter metadata", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [workItemRow()] });
        const repository = createAiEvalWorkbenchRepository({ query });

        await expect(repository.createWorkItem({
            operatorUserId: "00000000-0000-4000-8000-000000000001",
            sourceKind: "candidate_answer_evaluation",
            sourceId: "00000000-0000-4000-8000-000000000002",
            selectionReason: "production_sample",
        })).resolves.toMatchObject({
            surface: "answer_coaching",
            sourceKind: "candidate_answer_evaluation",
        });

        const sql = normalizeSql(query.mock.calls[0]?.[0]);
        expect(sql).toContain("candidate_answer_evaluation_run_id");
        expect(sql).toContain("last_updated_by_operator_user_id");
        expect(sql).toContain("ai_eval_operator_grants");
        expect(sql).toContain("from public.ai_eval_work_items existing");
        expect(sql).toContain("not exists (select 1 from inserted)");
        expect(sql).not.toContain("answer_text");
    });

    it("lists metadata through the individual grant fence and supports quality-workflow filters", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [workItemRow()] });
        const repository = createAiEvalWorkbenchRepository({ query });

        const items = await repository.listWorkItems("operator-1", {
            surface: "answer_coaching",
            audience: "candidate_led",
            questionCategory: "behavioral",
            sourceFailureCode: "PROVIDER_UNAVAILABLE",
            limit: 500,
        });

        expect(items).toHaveLength(1);
        expect(query.mock.calls[0]?.[1]?.at(-1)).toBe(100);
        const sql = normalizeSql(query.mock.calls[0]?.[0]);
        expect(sql).toContain("ai_eval_operator_grants");
        expect(sql).toContain("work_item.question_category = $8");
        expect(sql).toContain("work_item.source_failure_code = $10");
        expect(sql).not.toContain("candidate_profiles");
        expect(sql).not.toContain("recruiter_invitation_recipients");
    });

    it("reads the exact serving source just in time and atomically audits the content access", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{ ...workItemRow(), source_payload: { answer: { text: "A bounded answer." } }, audit_count: "1" }],
        });
        const repository = createAiEvalWorkbenchRepository({ query });

        await expect(repository.findWorkItemDetail("operator-1", "work-1")).resolves.toMatchObject({
            workItemId: "work-1",
            sourcePayload: { answer: { text: "A bounded answer." } },
        });
        const sql = normalizeSql(query.mock.calls[0]?.[0]);
        expect(sql).toContain("candidate_answer_evaluation_runs");
        expect(sql).toContain("invited_practice_answer_evaluation_runs");
        expect(sql).toContain("candidate_coach_update_artifacts");
        expect(sql).toContain("recruiter_invitation_question_sets");
        expect(sql).toContain("'answerattemptid', candidate_attempt.candidate_answer_attempt_id");
        expect(sql).toContain("'slotid', candidate_attempt.question_slot_id");
        expect(sql).toContain("'answerattemptid', invited_attempt.invited_practice_answer_attempt_id");
        expect(sql).toContain("'slotid', invited_attempt.question_slot_id");
        expect(sql).toContain("'ai_eval_source_detail_read'");
        expect(sql).not.toContain("recipient.email");
        expect(sql).not.toContain("app_user.email");
    });

    it("rejects a detail result when its metadata-only audit was not persisted", async () => {
        const repository = createAiEvalWorkbenchRepository({
            query: vi.fn().mockResolvedValue({
                rows: [{ ...workItemRow(), source_payload: {}, audit_count: "0" }],
            }),
        });

        await expect(repository.findWorkItemDetail("operator-1", "work-1"))
            .rejects.toThrow("did not persist its audit event");
    });
});

function workItemRow() {
    return {
        ai_eval_work_item_id: "work-1",
        surface: "answer_coaching",
        source_kind: "candidate_answer_evaluation",
        audience: "candidate_led",
        selection_reason: "production_sample",
        lifecycle_state: "queued",
        priority: "normal",
        assigned_operator_user_id: null,
        source_lifecycle_state: "completed",
        source_failure_code: null,
        interview_stage: "first_interview",
        question_category: "behavioral",
        provider: "google_genai",
        model_name: "gemini-2.5-flash",
        profile_id: "google_gemini_2_5_flash_v1",
        prompt_version: "prompt-v1",
        evaluator_version: "evaluator-v1",
        configuration_fingerprint: "a".repeat(64),
        source_occurred_at: "2026-07-22T10:00:00.000000Z",
        revision: 1,
    };
}

function eligibleSourceRow() {
    return {
        source_id: "00000000-0000-4000-8000-000000000002",
        source_kind: "candidate_answer_evaluation",
        surface: "answer_coaching",
        audience: "candidate_led",
        source_lifecycle_state: "completed",
        source_failure_code: null,
        interview_stage: "first_interview",
        question_category: "behavioral",
        provider: "google_genai",
        model_name: "gemini-2.5-flash",
        profile_id: "google_gemini_2_5_flash_v1",
        prompt_version: "prompt-v1",
        evaluator_version: "evaluator-v1",
        configuration_fingerprint: "a".repeat(64),
        source_occurred_at: "2026-07-22T10:00:00.000000Z",
    };
}

function normalizeSql(value: unknown) {
    return String(value ?? "").replace(/\s+/g, " ").toLowerCase();
}
