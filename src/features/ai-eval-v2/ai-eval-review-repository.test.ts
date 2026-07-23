import { describe, expect, it, vi } from "vitest";

import { createAiEvalReviewRepository } from "./ai-eval-review-repository";

describe("AI-eval review repository", () => {
    it("recovers the operator's latest draft with its structured findings", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [reviewRow()] })
            .mockResolvedValueOnce({ rows: [{
                ai_eval_finding_id: "finding-1",
                ai_eval_review_id: "review-1",
                layer: "evidence_span",
                failure_label: "evidence_span_false_positive",
                failure_label_version: "ai_eval_failure_labels_v1",
                severity: "major",
                source_reference_json: { spanId: "span-2" },
                rationale: "The span does not support the claim.",
                created_at: "2026-07-22T10:00:00.000000Z",
            }] });
        const repository = createAiEvalReviewRepository({ query });

        await expect(repository.findLatestReview("operator-1", "work-1"))
            .resolves.toMatchObject({ reviewId: "review-1", lifecycleState: "draft" });
        await expect(repository.listFindings("operator-1", "review-1"))
            .resolves.toMatchObject([{ findingId: "finding-1", sourceReference: { spanId: "span-2" } }]);

        expect(normalizeSql(query.mock.calls[0]?.[0])).toContain("case review.lifecycle_state when 'draft'");
        expect(normalizeSql(query.mock.calls[1]?.[0])).toContain("public.is_active_ai_eval_operator($1::uuid)");
    });

    it("lists the active versioned failure-label vocabulary through the named grant fence", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{
                failure_label_version: "ai_eval_failure_labels_v1",
                failure_label: "evidence_span_false_positive",
                layer: "evidence_span",
                description: "An identified span did not support the linked claim.",
            }],
        });
        const repository = createAiEvalReviewRepository({ query });

        await expect(repository.listFailureLabels("operator-1", "evidence_span")).resolves.toEqual([{
            version: "ai_eval_failure_labels_v1",
            label: "evidence_span_false_positive",
            layer: "evidence_span",
            description: "An identified span did not support the linked claim.",
        }]);
        expect(normalizeSql(query.mock.calls[0]?.[0])).toContain("public.is_active_ai_eval_operator($1::uuid)");
    });

    it("creates a revision-fenced draft and advances the work item in one statement", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [reviewRow()] });
        const repository = createAiEvalReviewRepository({ query });

        await expect(repository.createDraftReview({
            operatorUserId: "operator-1",
            workItemId: "work-1",
            rubricVersion: "answer_coaching_rubric_v1",
        })).resolves.toMatchObject({ reviewId: "review-1", lifecycleState: "draft" });

        const sql = normalizeSql(query.mock.calls[0]?.[0]);
        expect(sql).toContain("ai_eval_operator_grants");
        expect(sql).toContain("insert into public.ai_eval_reviews");
        expect(sql).toContain("then 'in_review'");
        expect(sql).toContain("last_updated_by_operator_user_id = $1::uuid");
        expect(sql).toContain("select existing.*");
    });

    it("saves and submits only the operator's expected draft revision", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ ...reviewRow(), revision: 2 }] })
            .mockResolvedValueOnce({ rows: [{ ...reviewRow(), lifecycle_state: "submitted", revision: 3 }] });
        const repository = createAiEvalReviewRepository({ query });

        await repository.saveDraftReview({
            operatorUserId: "operator-1",
            reviewId: "review-1",
            revision: 1,
            disposition: "needs_improvement",
            severity: "major",
            confidence: "high",
            layerJudgments: { evidence_span: "incorrect" },
            reviewSummary: "The cited evidence does not support the coaching claim.",
        });
        await repository.submitReview({
            operatorUserId: "operator-1",
            reviewId: "review-1",
            revision: 2,
            disposition: "needs_improvement",
            severity: "major",
            confidence: "high",
            layerJudgments: { evidence_span: "incorrect" },
        });

        expect(normalizeSql(query.mock.calls[0]?.[0])).toContain("review.revision = $3");
        const submitSql = normalizeSql(query.mock.calls[1]?.[0]);
        expect(submitSql).toContain("lifecycle_state = 'submitted'");
        expect(submitSql).toContain("lifecycle_state = 'reviewed'");
    });

    it("saves a draft and adds one matching finding atomically", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [{ ...reviewRow(), revision: 2, ai_eval_finding_id: "finding-1" }],
        });
        const repository = createAiEvalReviewRepository({ query });

        await expect(repository.saveDraftReviewWithFinding({
            operatorUserId: "operator-1",
            reviewId: "review-1",
            revision: 1,
            disposition: null,
            severity: null,
            confidence: null,
            layerJudgments: {},
            reviewSummary: "Partial review.",
            creationRequestKey: "00000000-0000-4000-8000-000000000003",
            layer: "evidence_span",
            failureLabel: "evidence_span_false_positive",
            findingSeverity: "major",
            sourceReference: { spanId: "span-2" },
            rationale: "The span does not support the claim.",
        })).resolves.toMatchObject({ findingId: "finding-1", review: { revision: 2 } });

        const sql = normalizeSql(query.mock.calls[0]?.[0]);
        expect(sql).toContain("with existing_result as materialized");
        expect(sql).toContain("review.revision = $3 + 1");
        expect(sql).toContain("updated_review as materialized");
        expect(sql).toContain("review.revision = $3");
        expect(sql).toContain("insert into public.ai_eval_findings");
        expect(sql).toContain("existing.source_reference_json = $14::jsonb");
        expect(sql).toContain("and not exists ( select 1 from public.ai_eval_findings existing");
        expect(sql).toContain("where not exists (select 1 from updated_review)");
    });

    it("creates structured findings without copying source content", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ ai_eval_finding_id: "finding-1" }] });
        const repository = createAiEvalReviewRepository({ query });

        await expect(repository.createFinding({
            operatorUserId: "operator-1",
            reviewId: "review-1",
            creationRequestKey: "00000000-0000-4000-8000-000000000003",
            layer: "evidence_span",
            failureLabel: "evidence_span_false_positive",
            severity: "major",
            sourceReference: { spanId: "span-2" },
            rationale: "The span does not support the claim.",
        })).resolves.toBe("finding-1");
        expect(normalizeSql(query.mock.calls[0]?.[0])).toContain("source_reference_json");
        expect(normalizeSql(query.mock.calls[0]?.[0])).toContain("creation_request_key");
        expect(normalizeSql(query.mock.calls[0]?.[0])).toContain("on conflict (ai_eval_review_id, creation_request_key) do nothing");
    });
});

function reviewRow() {
    return {
        ai_eval_review_id: "review-1",
        ai_eval_work_item_id: "work-1",
        reviewer_user_id: "operator-1",
        rubric_version: "answer_coaching_rubric_v1",
        lifecycle_state: "draft",
        disposition: null,
        severity: null,
        confidence: null,
        layer_judgments_json: {},
        review_summary: null,
        revision: 1,
        submitted_at: null,
    };
}

function normalizeSql(value: unknown) {
    return String(value ?? "").replace(/\s+/g, " ").toLowerCase();
}
