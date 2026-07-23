import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { createAiEvalOperatorAccessRepository } from "../src/features/ai-eval-v2/ai-eval-operator-access";
import type {
    AiEvalLayerJudgment,
    AiEvalSourceKind,
    AiEvalSurface,
    AiEvalWorkItem,
    AiEvalWorkItemDetail,
} from "../src/features/ai-eval-v2/ai-eval-workbench-contract";
import { createAiEvalReviewRepository } from "../src/features/ai-eval-v2/ai-eval-review-repository";
import { createAiEvalWorkbenchRepository } from "../src/features/ai-eval-v2/ai-eval-workbench-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const sourceKinds: AiEvalSourceKind[] = [
    "candidate_answer_evaluation",
    "invited_answer_evaluation",
    "candidate_coach_update",
    "candidate_question_wording",
    "recruiter_question_wording",
];

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 1,
        application_name: "interview-coach-ai-eval-operator-milestone-smoke",
    });
    const client = await pool.connect();
    const operatorUserId = randomUUID();

    try {
        await client.query("begin");
        await client.query(`
            insert into public.app_users (user_id, email, display_name, status)
            values ($1, $2, 'AI eval milestone operator', 'active')
        `, [operatorUserId, `ai-eval-milestone-${operatorUserId}@example.invalid`]);
        await client.query(`
            insert into public.ai_eval_operator_grants (user_id, granted_by_user_id, reason)
            values ($1, $1, 'Rollback-only representative milestone audit')
        `, [operatorUserId]);

        const query = (sql: string, values?: unknown[]) => client.query(sql, values);
        const accessRepository = createAiEvalOperatorAccessRepository({ query });
        const workbenchRepository = createAiEvalWorkbenchRepository({ query });
        const reviewRepository = createAiEvalReviewRepository({ query });

        assert(await accessRepository.findActiveGrant(operatorUserId), "Milestone operator grant did not resolve.");

        const auditedSources: Array<{
            sourceKind: AiEvalSourceKind;
            surface: AiEvalSurface;
            workItemId: string;
        }> = [];

        for (const sourceKind of sourceKinds) {
            const workItem = await resolveHealthyWorkItem({
                operatorUserId,
                sourceKind,
                workbenchRepository,
            });
            const detail = await workbenchRepository.findWorkItemDetail(operatorUserId, workItem.workItemId);
            assert(detail, `${sourceKind} exact detail did not resolve.`);
            assertHealthyDetailShape(detail);

            const review = await reviewRepository.createDraftReview({
                operatorUserId,
                workItemId: workItem.workItemId,
                rubricVersion: rubricVersionFor(workItem.surface),
            });
            assert(review, `${sourceKind} review did not start.`);
            const submitted = await reviewRepository.submitReview({
                operatorUserId,
                reviewId: review.reviewId,
                revision: review.revision,
                disposition: "acceptable_with_observation",
                severity: "informational",
                confidence: "high",
                layerJudgments: layerJudgmentsFor(workItem.surface),
                reviewSummary: "Representative milestone source remained reviewable through the operator workflow.",
            });
            assert(submitted?.lifecycleState === "submitted", `${sourceKind} review did not submit.`);
            auditedSources.push({ sourceKind, surface: workItem.surface, workItemId: workItem.workItemId });
        }

        const failedWorkItem = await resolveFailedWorkItem({ operatorUserId, workbenchRepository });
        const failedDetail = await workbenchRepository.findWorkItemDetail(operatorUserId, failedWorkItem.workItemId);
        assert(failedDetail?.sourceFailureCode, "Failed source detail did not preserve its failure code.");
        assert(
            !hasCandidateVisibleOutput(failedDetail),
            "Failed source detail implied candidate-visible output was produced.",
        );

        const audit = await client.query<{ event_type: string; metadata: unknown }>(`
            select event_type, metadata
            from public.auth_audit_events
            where user_id = $1
              and event_type = 'ai_eval_source_detail_read'
            order by created_at, event_id
        `, [operatorUserId]);
        assert(
            audit.rows.length === sourceKinds.length + 1,
            "Not every exact source-detail read produced one audit event.",
        );
        const auditText = JSON.stringify(audit.rows).toLowerCase();
        for (const forbiddenKey of ["answer_text", "job_description", "question_text", "candidate_safe_content"]) {
            assert(!auditText.includes(forbiddenKey), `Audit metadata included restricted content key ${forbiddenKey}.`);
        }

        await client.query(`
            update public.ai_eval_operator_grants
            set lifecycle_state = 'revoked', revoked_by_user_id = $1, revoked_at = now()
            where user_id = $1 and lifecycle_state = 'active'
        `, [operatorUserId]);
        assert(await accessRepository.findActiveGrant(operatorUserId) === null, "Revoked milestone grant remained active.");
        assert(
            (await workbenchRepository.listWorkItems(operatorUserId)).length === 0,
            "Revoked milestone operator retained queue access.",
        );

        console.log(JSON.stringify({
            rollbackOnly: true,
            representativeSources: auditedSources.map(({ sourceKind, surface }) => ({ sourceKind, surface })),
            representativeReviewsSubmitted: auditedSources.length,
            failedSourceInspected: true,
            exactReadsAuditedWithoutContent: true,
            revocationEffective: true,
        }, null, 2));
    } finally {
        await client.query("rollback").catch(() => undefined);
        client.release();
        await pool.end();
    }
}

async function resolveHealthyWorkItem({
    operatorUserId,
    sourceKind,
    workbenchRepository,
}: {
    operatorUserId: string;
    sourceKind: AiEvalSourceKind;
    workbenchRepository: ReturnType<typeof createAiEvalWorkbenchRepository>;
}) {
    const existing = (await workbenchRepository.listWorkItems(operatorUserId, { sourceKind, limit: 100 }))
        .find((item) => !item.sourceFailureCode && ["completed", "ready"].includes(item.sourceLifecycleState));
    if (existing) return existing;

    const source = (await workbenchRepository.listEligibleSources(operatorUserId, { sourceKind, limit: 100 }))
        .find((item) => !item.sourceFailureCode && ["completed", "ready"].includes(item.sourceLifecycleState));
    assert(source, `No healthy populated ${sourceKind} source is available for the milestone audit.`);
    const promoted = await workbenchRepository.createWorkItem({
        operatorUserId,
        sourceKind,
        sourceId: source.sourceId,
        selectionReason: "production_sample",
        assignedOperatorUserId: operatorUserId,
    });
    assert(promoted, `${sourceKind} source did not promote.`);
    return promoted;
}

async function resolveFailedWorkItem({
    operatorUserId,
    workbenchRepository,
}: {
    operatorUserId: string;
    workbenchRepository: ReturnType<typeof createAiEvalWorkbenchRepository>;
}) {
    for (const sourceLifecycleState of ["failed", "rejected"]) {
        const existing = (await workbenchRepository.listWorkItems(operatorUserId, {
            sourceLifecycleState,
            limit: 100,
        })).find((item) => Boolean(item.sourceFailureCode));
        if (existing) return existing;

        const source = (await workbenchRepository.listEligibleSources(operatorUserId, {
            sourceLifecycleState,
            limit: 100,
        })).find((item) => Boolean(item.sourceFailureCode));
        if (source) {
            const promoted = await workbenchRepository.createWorkItem({
                operatorUserId,
                sourceKind: source.sourceKind,
                sourceId: source.sourceId,
                selectionReason: "provider_failure",
                assignedOperatorUserId: operatorUserId,
            });
            if (promoted) return promoted;
        }
    }
    throw new Error("No populated failed or rejected AI source is available for the milestone audit.");
}

function assertHealthyDetailShape(detail: AiEvalWorkItemDetail) {
    const payload = detail.sourcePayload;
    if (detail.surface === "answer_coaching") {
        const result = record(record(payload.evaluation).result);
        const accepted = record(result.accepted);
        assert(Object.keys(record(accepted.candidateProjection)).length > 0, `${detail.sourceKind} omitted candidate projection.`);
        assert(Object.keys(record(accepted.feedback)).length > 0, `${detail.sourceKind} omitted feedback composition.`);
        assert(readText(record(payload.answer).text), `${detail.sourceKind} omitted submitted answer text.`);
        return;
    }
    if (detail.surface === "coach_update") {
        const update = record(payload.coachUpdate);
        assert(readText(update.title), "Coach Update omitted its candidate-visible title.");
        assert(readText(update.summary), "Coach Update omitted its candidate-visible summary.");
        return;
    }
    const wording = record(payload.questionWording);
    assert(Array.isArray(wording.questions) && wording.questions.length > 0, `${detail.sourceKind} omitted generated questions.`);
    assert(Object.keys(record(payload.questionPlan)).length > 0, `${detail.sourceKind} omitted its question plan.`);
}

function hasCandidateVisibleOutput(detail: AiEvalWorkItemDetail) {
    const payload = detail.sourcePayload;
    if (detail.surface === "answer_coaching") {
        return Object.keys(record(record(record(record(payload.evaluation).result).accepted).candidateProjection)).length > 0;
    }
    if (detail.surface === "coach_update") return Object.keys(record(payload.coachUpdate)).length > 0;
    return Array.isArray(record(payload.questionWording).questions)
        && (record(payload.questionWording).questions as unknown[]).length > 0;
}

function rubricVersionFor(surface: AiEvalSurface) {
    if (surface === "answer_coaching") return "answer_coaching_rubric_v1";
    if (surface === "coach_update") return "coach_update_rubric_v1";
    return "question_wording_rubric_v1";
}

function layerJudgmentsFor(surface: AiEvalSurface): Record<string, AiEvalLayerJudgment> {
    if (surface === "answer_coaching") return { answer_usability: "correct", candidate_projection: "correct" };
    if (surface === "coach_update") return { coach_update: "correct", candidate_projection: "correct" };
    return { question_wording: "correct", question_set: "correct" };
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function readText(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : "";
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
