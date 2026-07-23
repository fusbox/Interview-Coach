import type {
    AiEvalConfidence,
    AiEvalFailureLabel,
    AiEvalFinding,
    AiEvalFindingLayer,
    AiEvalLayerJudgment,
    AiEvalReview,
    AiEvalReviewDisposition,
    AiEvalSeverity,
} from "./ai-eval-workbench-contract";
import type { AiEvalWorkbenchQueryClient } from "./ai-eval-workbench-repository";

export type AiEvalMutationOutcome = "updated" | "conflict_or_forbidden";

export function createAiEvalReviewRepository(client: AiEvalWorkbenchQueryClient) {
    return {
        async findLatestReview(
            operatorUserId: string,
            workItemId: string,
        ): Promise<AiEvalReview | null> {
            const result = await client.query(`
                select review.*
                from public.ai_eval_reviews review
                where review.ai_eval_work_item_id = $2
                  and review.reviewer_user_id = $1
                  and public.is_active_ai_eval_operator($1::uuid)
                order by
                  case review.lifecycle_state when 'draft' then 0 else 1 end,
                  review.created_at desc
                limit 1
            `, [operatorUserId, workItemId]);
            return mapReview(result.rows[0]);
        },

        async listFindings(operatorUserId: string, reviewId: string): Promise<AiEvalFinding[]> {
            const result = await client.query(`
                select
                  finding.ai_eval_finding_id,
                  finding.ai_eval_review_id,
                  finding.layer,
                  finding.failure_label,
                  finding.failure_label_version,
                  finding.severity,
                  finding.source_reference_json,
                  finding.rationale,
                  to_char(finding.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at
                from public.ai_eval_findings finding
                join public.ai_eval_reviews review
                  on review.ai_eval_review_id = finding.ai_eval_review_id
                where finding.ai_eval_review_id = $2
                  and public.is_active_ai_eval_operator($1::uuid)
                order by finding.created_at, finding.ai_eval_finding_id
            `, [operatorUserId, reviewId]);
            return result.rows.map(mapFinding).filter((finding): finding is AiEvalFinding => finding !== null);
        },

        async listFailureLabels(
            operatorUserId: string,
            layer?: AiEvalFindingLayer,
        ): Promise<AiEvalFailureLabel[]> {
            const result = await client.query(`
                select
                  catalog.failure_label_version,
                  catalog.failure_label,
                  catalog.layer,
                  catalog.description
                from public.ai_eval_failure_label_catalog catalog
                where catalog.lifecycle_state = 'active'
                  and ($2::text is null or catalog.layer = $2)
                  and public.is_active_ai_eval_operator($1::uuid)
                order by catalog.layer, catalog.failure_label
            `, [operatorUserId, layer ?? null]);
            return result.rows.map(mapFailureLabel).filter((label): label is AiEvalFailureLabel => label !== null);
        },

        async createDraftReview(input: {
            operatorUserId: string;
            workItemId: string;
            rubricVersion: string;
        }): Promise<AiEvalReview | null> {
            const result = await client.query(`
                with operator_access as materialized (
                  select app_user.user_id
                  from public.app_users app_user
                  join public.ai_eval_operator_grants operator_grant
                    on operator_grant.user_id = app_user.user_id
                   and operator_grant.lifecycle_state = 'active'
                  where app_user.user_id = $1
                    and app_user.status = 'active'
                ), inserted as (
                  insert into public.ai_eval_reviews (
                    ai_eval_work_item_id,
                    reviewer_user_id,
                    rubric_version
                  )
                  select work_item.ai_eval_work_item_id, operator_access.user_id, $3
                  from public.ai_eval_work_items work_item
                  cross join operator_access
                  where work_item.ai_eval_work_item_id = $2
                  on conflict do nothing
                  returning *
                ), resolved as (
                  select inserted.* from inserted
                  union all
                  select existing.*
                  from public.ai_eval_reviews existing
                  where existing.ai_eval_work_item_id = $2
                    and existing.reviewer_user_id = $1
                    and existing.lifecycle_state = 'draft'
                    and exists (select 1 from operator_access)
                    and not exists (select 1 from inserted)
                ), advanced as (
                  update public.ai_eval_work_items work_item
                  set
                    lifecycle_state = case
                      when work_item.lifecycle_state = 'queued' then 'in_review'
                      else work_item.lifecycle_state
                    end,
                    assigned_operator_user_id = coalesce(work_item.assigned_operator_user_id, $1::uuid),
                    last_updated_by_operator_user_id = $1::uuid,
                    revision = work_item.revision + 1
                  where work_item.ai_eval_work_item_id = (select ai_eval_work_item_id from inserted)
                  returning work_item.ai_eval_work_item_id
                )
                select resolved.*
                from resolved
                where exists (select 1 from advanced)
                   or not exists (select 1 from inserted)
                limit 1
            `, [input.operatorUserId, input.workItemId, input.rubricVersion]);
            return mapReview(result.rows[0]);
        },

        async saveDraftReview(input: {
            operatorUserId: string;
            reviewId: string;
            revision: number;
            disposition: AiEvalReviewDisposition | null;
            severity: AiEvalSeverity | null;
            confidence: AiEvalConfidence | null;
            layerJudgments: Record<string, AiEvalLayerJudgment>;
            reviewSummary: string | null;
        }): Promise<AiEvalReview | null> {
            const result = await client.query(`
                update public.ai_eval_reviews review
                set
                  disposition = $4,
                  severity = $5,
                  confidence = $6,
                  layer_judgments_json = $7::jsonb,
                  review_summary = $8,
                  revision = review.revision + 1
                where review.ai_eval_review_id = $2
                  and review.reviewer_user_id = $1
                  and review.lifecycle_state = 'draft'
                  and review.revision = $3
                  and public.is_active_ai_eval_operator($1::uuid)
                returning review.*
            `, [
                input.operatorUserId,
                input.reviewId,
                input.revision,
                input.disposition,
                input.severity,
                input.confidence,
                JSON.stringify(input.layerJudgments),
                input.reviewSummary,
            ]);
            return mapReview(result.rows[0]);
        },

        async saveDraftReviewWithFinding(input: {
            operatorUserId: string;
            reviewId: string;
            revision: number;
            disposition: AiEvalReviewDisposition | null;
            severity: AiEvalSeverity | null;
            confidence: AiEvalConfidence | null;
            layerJudgments: Record<string, AiEvalLayerJudgment>;
            reviewSummary: string | null;
            creationRequestKey: string;
            layer: AiEvalFindingLayer;
            failureLabel: string;
            failureLabelVersion?: string;
            findingSeverity: AiEvalSeverity;
            sourceReference: Record<string, unknown>;
            rationale: string;
        }): Promise<{ review: AiEvalReview; findingId: string } | null> {
            const result = await client.query(`
                with existing_result as materialized (
                  select
                    review.*,
                    existing.ai_eval_finding_id
                  from public.ai_eval_reviews review
                  join public.ai_eval_findings existing
                    on existing.ai_eval_review_id = review.ai_eval_review_id
                  where review.ai_eval_review_id = $2
                    and review.reviewer_user_id = $1
                    and review.lifecycle_state = 'draft'
                    and review.revision = $3 + 1
                    and review.disposition is not distinct from $4
                    and review.severity is not distinct from $5
                    and review.confidence is not distinct from $6
                    and review.layer_judgments_json = $7::jsonb
                    and review.review_summary is not distinct from $8
                    and existing.creation_request_key = $9::uuid
                    and existing.layer = $10
                    and existing.failure_label = $11
                    and existing.failure_label_version = $12
                    and existing.severity = $13
                    and existing.source_reference_json = $14::jsonb
                    and existing.rationale = $15
                    and public.is_active_ai_eval_operator($1::uuid)
                ), updated_review as materialized (
                  update public.ai_eval_reviews review
                  set
                    disposition = $4,
                    severity = $5,
                    confidence = $6,
                    layer_judgments_json = $7::jsonb,
                    review_summary = $8,
                    revision = review.revision + 1
                  where review.ai_eval_review_id = $2
                    and review.reviewer_user_id = $1
                    and review.lifecycle_state = 'draft'
                    and review.revision = $3
                    and public.is_active_ai_eval_operator($1::uuid)
                    and not exists (
                      select 1
                      from public.ai_eval_findings existing
                      where existing.ai_eval_review_id = review.ai_eval_review_id
                        and existing.creation_request_key = $9::uuid
                    )
                  returning review.*
                ), inserted as (
                  insert into public.ai_eval_findings (
                    creation_request_key,
                    ai_eval_review_id,
                    created_by_operator_user_id,
                    layer,
                    failure_label,
                    failure_label_version,
                    severity,
                    source_reference_json,
                    rationale
                  )
                  select
                    $9::uuid,
                    updated_review.ai_eval_review_id,
                    $1::uuid,
                    $10,
                    $11,
                    $12,
                    $13,
                    $14::jsonb,
                    $15
                  from updated_review
                  on conflict (ai_eval_review_id, creation_request_key) do nothing
                  returning ai_eval_finding_id
                )
                select
                  updated_review.*,
                  inserted.ai_eval_finding_id
                from updated_review
                join inserted on true
                union all
                select existing_result.*
                from existing_result
                where not exists (select 1 from updated_review)
                limit 1
            `, [
                input.operatorUserId,
                input.reviewId,
                input.revision,
                input.disposition,
                input.severity,
                input.confidence,
                JSON.stringify(input.layerJudgments),
                input.reviewSummary,
                input.creationRequestKey,
                input.layer,
                input.failureLabel,
                input.failureLabelVersion ?? "ai_eval_failure_labels_v1",
                input.findingSeverity,
                JSON.stringify(input.sourceReference),
                input.rationale,
            ]);
            const review = mapReview(result.rows[0]);
            const findingId = readString(result.rows[0]?.ai_eval_finding_id);
            return review && findingId ? { review, findingId } : null;
        },

        async submitReview(input: {
            operatorUserId: string;
            reviewId: string;
            revision: number;
            disposition: AiEvalReviewDisposition;
            severity: AiEvalSeverity;
            confidence: AiEvalConfidence;
            layerJudgments: Record<string, AiEvalLayerJudgment>;
            reviewSummary?: string | null;
        }): Promise<AiEvalReview | null> {
            const result = await client.query(`
                with submitted as (
                  update public.ai_eval_reviews review
                  set
                    lifecycle_state = 'submitted',
                    disposition = $4,
                    severity = $5,
                    confidence = $6,
                    layer_judgments_json = $7::jsonb,
                    review_summary = $8,
                    submitted_at = now(),
                    revision = review.revision + 1
                  where review.ai_eval_review_id = $2
                    and review.reviewer_user_id = $1
                    and review.lifecycle_state = 'draft'
                    and review.revision = $3
                    and public.is_active_ai_eval_operator($1::uuid)
                  returning review.*
                ), advanced as (
                  update public.ai_eval_work_items work_item
                  set
                    lifecycle_state = 'reviewed',
                    last_updated_by_operator_user_id = $1::uuid,
                    revision = work_item.revision + 1
                  where work_item.ai_eval_work_item_id = (select ai_eval_work_item_id from submitted)
                  returning work_item.ai_eval_work_item_id
                )
                select submitted.*
                from submitted
                join advanced using (ai_eval_work_item_id)
            `, [
                input.operatorUserId,
                input.reviewId,
                input.revision,
                input.disposition,
                input.severity,
                input.confidence,
                JSON.stringify(input.layerJudgments),
                input.reviewSummary ?? null,
            ]);
            return mapReview(result.rows[0]);
        },

        async createFinding(input: {
            operatorUserId: string;
            reviewId: string;
            creationRequestKey: string;
            layer: AiEvalFindingLayer;
            failureLabel: string;
            failureLabelVersion?: string;
            severity: AiEvalSeverity;
            sourceReference: Record<string, unknown>;
            rationale: string;
        }): Promise<string | null> {
            const result = await client.query(`
                with eligible_review as materialized (
                  select review.ai_eval_review_id
                  from public.ai_eval_reviews review
                  where review.ai_eval_review_id = $2
                    and review.reviewer_user_id = $1
                    and review.lifecycle_state = 'draft'
                    and public.is_active_ai_eval_operator($1::uuid)
                ), inserted as (
                  insert into public.ai_eval_findings (
                  creation_request_key,
                  ai_eval_review_id,
                  created_by_operator_user_id,
                  layer,
                  failure_label,
                  failure_label_version,
                  severity,
                  source_reference_json,
                  rationale
                )
                select
                  $3::uuid,
                  review.ai_eval_review_id,
                  $1::uuid,
                  $4,
                  $5,
                  $6,
                  $7,
                  $8::jsonb,
                  $9
                  from eligible_review review
                  on conflict (ai_eval_review_id, creation_request_key) do nothing
                  returning ai_eval_finding_id
                ), resolved as (
                  select inserted.ai_eval_finding_id from inserted
                  union all
                  select existing.ai_eval_finding_id
                  from public.ai_eval_findings existing
                  join eligible_review
                    on eligible_review.ai_eval_review_id = existing.ai_eval_review_id
                  where existing.creation_request_key = $3::uuid
                    and not exists (select 1 from inserted)
                )
                select ai_eval_finding_id from resolved limit 1
            `, [
                input.operatorUserId,
                input.reviewId,
                input.creationRequestKey,
                input.layer,
                input.failureLabel,
                input.failureLabelVersion ?? "ai_eval_failure_labels_v1",
                input.severity,
                JSON.stringify(input.sourceReference),
                input.rationale,
            ]);
            return readString(result.rows[0]?.ai_eval_finding_id) || null;
        },

        async deleteDraftFinding(input: {
            operatorUserId: string;
            findingId: string;
        }): Promise<boolean> {
            const result = await client.query(`
                delete from public.ai_eval_findings finding
                using public.ai_eval_reviews review
                where finding.ai_eval_finding_id = $2
                  and review.ai_eval_review_id = finding.ai_eval_review_id
                  and review.reviewer_user_id = $1
                  and review.lifecycle_state = 'draft'
                  and public.is_active_ai_eval_operator($1::uuid)
                returning finding.ai_eval_finding_id
            `, [input.operatorUserId, input.findingId]);
            return result.rows.length === 1;
        },

    };
}

function mapFailureLabel(row: Record<string, unknown>): AiEvalFailureLabel | null {
    const version = readString(row.failure_label_version);
    const label = readString(row.failure_label);
    const layer = readString(row.layer) as AiEvalFindingLayer;
    const description = readString(row.description);
    return version && label && layer && description ? { version, label, layer, description } : null;
}

function mapFinding(row: Record<string, unknown>): AiEvalFinding | null {
    const findingId = readString(row.ai_eval_finding_id);
    const reviewId = readString(row.ai_eval_review_id);
    const layer = readString(row.layer) as AiEvalFindingLayer;
    const failureLabel = readString(row.failure_label);
    const failureLabelVersion = readString(row.failure_label_version);
    const severity = readString(row.severity) as AiEvalSeverity;
    const sourceReference = readRecord(row.source_reference_json);
    const rationale = readString(row.rationale);
    const createdAt = readNullableDate(row.created_at);
    if (!findingId || !reviewId || !layer || !failureLabel || !failureLabelVersion
        || !severity || !sourceReference || !rationale || !createdAt) return null;
    return {
        findingId,
        reviewId,
        layer,
        failureLabel,
        failureLabelVersion,
        severity,
        sourceReference: sourceReference as Record<string, string | number>,
        rationale,
        createdAt,
    };
}

function mapReview(row: Record<string, unknown> | undefined): AiEvalReview | null {
    if (!row) return null;
    const reviewId = readString(row.ai_eval_review_id);
    const workItemId = readString(row.ai_eval_work_item_id);
    const reviewerUserId = readString(row.reviewer_user_id);
    const rubricVersion = readString(row.rubric_version);
    const lifecycleState = readString(row.lifecycle_state);
    const layerJudgments = readRecord(row.layer_judgments_json);
    const revision = Number(row.revision);
    if (!reviewId || !workItemId || !reviewerUserId || !rubricVersion
        || (lifecycleState !== "draft" && lifecycleState !== "submitted")
        || !layerJudgments || !Number.isInteger(revision) || revision < 1) return null;

    return {
        reviewId,
        workItemId,
        reviewerUserId,
        rubricVersion,
        lifecycleState,
        disposition: readNullableString(row.disposition) as AiEvalReview["disposition"],
        severity: readNullableString(row.severity) as AiEvalReview["severity"],
        confidence: readNullableString(row.confidence) as AiEvalReview["confidence"],
        layerJudgments: layerJudgments as Record<string, AiEvalLayerJudgment>,
        reviewSummary: readNullableString(row.review_summary),
        revision,
        submittedAt: readNullableDate(row.submitted_at),
    };
}

function readString(value: unknown) {
    return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function readNullableDate(value: unknown) {
    if (typeof value === "string") return value;
    if (value instanceof Date) return value.toISOString();
    return null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}
