import { describe, expect, it, vi } from "vitest";

import { createAiEvalRemediationRepository } from "./ai-eval-remediation-repository";

describe("AI-eval remediation repository", () => {
    it("reads remediation workflow metadata only behind the individual grant", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [remediationRow()] })
            .mockResolvedValueOnce({ rows: [findingRow()] });
        const repository = createAiEvalRemediationRepository({ query });

        await expect(repository.listRemediations("operator-1")).resolves.toEqual([
            expect.objectContaining({ title: "Tighten exact-span validation", findingCount: 2 }),
        ]);
        await expect(repository.listAvailableFindings("operator-1")).resolves.toEqual([
            expect.objectContaining({ failureLabel: "evidence_span_false_positive", surface: "answer_coaching" }),
        ]);

        expect(normalizeSql(query.mock.calls[0]?.[0])).toContain("public.is_active_ai_eval_operator($1::uuid)");
        const findingSql = normalizeSql(query.mock.calls[1]?.[0]);
        expect(findingSql).toContain("review.lifecycle_state = 'submitted'");
        expect(findingSql).not.toMatch(/answer_text|job_description|resume_context|candidate_safe_content/);
    });

    it("creates one target-specific remediation and links only an exact submitted finding set", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [{ ai_eval_remediation_id: "remediation-1" }] });
        const repository = createAiEvalRemediationRepository({ query });

        await expect(repository.createRemediationWithFindings({
            operatorUserId: "operator-1",
            creationRequestKey: "00000000-0000-4000-8000-000000000010",
            targetComponent: "exact_span_validation",
            title: "Tighten exact-span validation",
            hypothesis: "Rejecting unsupported spans will improve grounding.",
            expectedChange: "Unsupported evidence links fail closed.",
            regressionRisks: "Weak but useful spans could be rejected.",
            findingIds: ["00000000-0000-4000-8000-000000000011"],
        })).resolves.toBe("remediation-1");

        const sql = normalizeSql(query.mock.calls[0]?.[0]);
        expect(sql).toContain("review.lifecycle_state = 'submitted'");
        expect(sql).toContain("creation_request_key = $2::uuid");
        expect(sql).toContain("on conflict (created_by_operator_user_id, creation_request_key) do nothing");
        expect(sql).toContain("lifecycle_state = 'remediation_in_progress'");
    });

    it("promotes one linked submitted finding into an idempotent regression case", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [{ ai_eval_regression_case_id: "regression-1" }] });
        const repository = createAiEvalRemediationRepository({ query });

        await expect(repository.promoteRegressionCase({
            operatorUserId: "operator-1",
            remediationId: "00000000-0000-4000-8000-000000000012",
            findingId: "00000000-0000-4000-8000-000000000011",
        })).resolves.toBe("regression-1");

        const sql = normalizeSql(query.mock.calls[0]?.[0]);
        expect(sql).toContain("join public.ai_eval_remediation_findings link");
        expect(sql).toContain("review.lifecycle_state = 'submitted'");
        expect(sql).toContain("on conflict (source_finding_id) do nothing");
    });

    it("records one exact sequential recheck and rejects changed natural-key replay", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [{ ai_eval_recheck_id: "recheck-1" }] });
        const repository = createAiEvalRemediationRepository({ query });

        await expect(repository.recordRecheck({
            operatorUserId: "operator-1",
            remediationId: "00000000-0000-4000-8000-000000000012",
            regressionCaseId: "00000000-0000-4000-8000-000000000013",
            verificationReviewId: "00000000-0000-4000-8000-000000000014",
            outcome: "fixed",
            verificationNote: "The later output no longer cites the unsupported span.",
        })).resolves.toBe("recheck-1");

        const sql = normalizeSql(query.mock.calls[0]?.[0]);
        expect(sql).toContain("on conflict ( ai_eval_remediation_id, ai_eval_regression_case_id, verification_review_id ) do nothing");
        expect(sql).toContain("existing.outcome = $5");
        expect(sql).toContain("existing.verification_note = $6");
        expect(sql).toContain("public.is_active_ai_eval_operator($1::uuid)");
    });

    it("revision-fences lifecycle updates and reconciles overlapping remediation truthfully", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [{ ai_eval_remediation_id: "remediation-1" }] });
        const repository = createAiEvalRemediationRepository({ query });

        await expect(repository.updateRemediation({
            operatorUserId: "operator-1",
            remediationId: "00000000-0000-4000-8000-000000000012",
            revision: 3,
            lifecycleState: "verified",
            changeKind: "code",
            changedReference: "commit abc123",
            verificationNote: "All promoted regression cases are fixed.",
        })).resolves.toBe(true);

        const sql = normalizeSql(query.mock.calls[0]?.[0]);
        expect(sql).toContain("remediation.revision = $3");
        expect(sql).toContain("item_remediation.lifecycle_state ) not in ('verified', 'wont_fix', 'duplicate')");
        expect(sql).toContain("then 'remediation_in_progress'");
        expect(sql).toContain("then 'verified'");
        expect(sql).toContain("else 'closed'");
        expect(sql).toContain("work_item.lifecycle_state = 'remediation_in_progress'");
    });
});

function remediationRow() {
    return {
        ai_eval_remediation_id: "remediation-1",
        owner_operator_user_id: "operator-1",
        lifecycle_state: "planned",
        target_component: "exact_span_validation",
        title: "Tighten exact-span validation",
        hypothesis: "Reject unsupported spans.",
        expected_change: "Fewer false-positive links.",
        regression_risks: "May reject weak spans.",
        change_kind: null,
        changed_reference: null,
        verification_note: null,
        revision: 1,
        finding_count: 2,
        regression_case_count: 1,
        recheck_count: 0,
        created_at_text: "2026-07-22T10:00:00.000000Z",
        updated_at_text: "2026-07-22T10:00:00.000000Z",
    };
}

function findingRow() {
    return {
        ai_eval_finding_id: "finding-1",
        ai_eval_review_id: "review-1",
        ai_eval_work_item_id: "work-1",
        layer: "evidence_span",
        failure_label: "evidence_span_false_positive",
        failure_label_version: "ai_eval_failure_labels_v1",
        severity: "major",
        source_reference_json: { spanId: "span-1" },
        rationale: "The cited span does not support the claim.",
        surface: "answer_coaching",
        source_kind: "candidate_answer_evaluation",
        ai_eval_regression_case_id: null,
        created_at: "2026-07-22T10:00:00.000000Z",
        source_occurred_at: "2026-07-22T09:00:00.000000Z",
    };
}

function normalizeSql(value: unknown) {
    return String(value).replace(/\s+/g, " ").trim().toLowerCase();
}
