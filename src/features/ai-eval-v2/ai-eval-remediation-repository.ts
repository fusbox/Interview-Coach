import type {
    AiEvalChangeKind,
    AiEvalFindingLayer,
    AiEvalRecheck,
    AiEvalRecheckCandidate,
    AiEvalRecheckOutcome,
    AiEvalRegressionCase,
    AiEvalRemediation,
    AiEvalRemediationFinding,
    AiEvalRemediationLifecycle,
    AiEvalRemediationTarget,
    AiEvalSeverity,
    AiEvalSourceKind,
    AiEvalSurface,
} from "./ai-eval-workbench-contract";
import type { AiEvalWorkbenchQueryClient } from "./ai-eval-workbench-repository";

export function createAiEvalRemediationRepository(client: AiEvalWorkbenchQueryClient) {
    return {
        async listRemediations(operatorUserId: string): Promise<AiEvalRemediation[]> {
            const result = await client.query(`
                select
                  remediation.*,
                  count(distinct link.ai_eval_finding_id)::integer as finding_count,
                  count(distinct regression.ai_eval_regression_case_id)::integer as regression_case_count,
                  count(distinct recheck.ai_eval_recheck_id)::integer as recheck_count,
                  to_char(remediation.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at_text,
                  to_char(remediation.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at_text
                from public.ai_eval_remediations remediation
                left join public.ai_eval_remediation_findings link
                  on link.ai_eval_remediation_id = remediation.ai_eval_remediation_id
                left join public.ai_eval_regression_cases regression
                  on regression.source_finding_id = link.ai_eval_finding_id
                left join public.ai_eval_rechecks recheck
                  on recheck.ai_eval_remediation_id = remediation.ai_eval_remediation_id
                where public.is_active_ai_eval_operator($1::uuid)
                group by remediation.ai_eval_remediation_id
                order by
                  case remediation.lifecycle_state
                    when 'ready_for_recheck' then 0
                    when 'changed' then 1
                    when 'planned' then 2
                    when 'triaged' then 3
                    when 'observed' then 4
                    else 5
                  end,
                  remediation.updated_at desc,
                  remediation.ai_eval_remediation_id
                limit 100
            `, [operatorUserId]);
            return result.rows.map(mapRemediation).filter((item): item is AiEvalRemediation => item !== null);
        },

        async findRemediation(operatorUserId: string, remediationId: string): Promise<AiEvalRemediation | null> {
            const result = await client.query(`
                select
                  remediation.*,
                  count(distinct link.ai_eval_finding_id)::integer as finding_count,
                  count(distinct regression.ai_eval_regression_case_id)::integer as regression_case_count,
                  count(distinct recheck.ai_eval_recheck_id)::integer as recheck_count,
                  to_char(remediation.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at_text,
                  to_char(remediation.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at_text
                from public.ai_eval_remediations remediation
                left join public.ai_eval_remediation_findings link
                  on link.ai_eval_remediation_id = remediation.ai_eval_remediation_id
                left join public.ai_eval_regression_cases regression
                  on regression.source_finding_id = link.ai_eval_finding_id
                left join public.ai_eval_rechecks recheck
                  on recheck.ai_eval_remediation_id = remediation.ai_eval_remediation_id
                where remediation.ai_eval_remediation_id = $2
                  and public.is_active_ai_eval_operator($1::uuid)
                group by remediation.ai_eval_remediation_id
            `, [operatorUserId, remediationId]);
            return mapRemediation(result.rows[0]);
        },

        async listAvailableFindings(operatorUserId: string): Promise<AiEvalRemediationFinding[]> {
            return readFindings(client, operatorUserId, `
                and not exists (
                  select 1
                  from public.ai_eval_remediation_findings existing_link
                  where existing_link.ai_eval_finding_id = finding.ai_eval_finding_id
                )
            `, []);
        },

        async listLinkedFindings(
            operatorUserId: string,
            remediationId: string,
        ): Promise<AiEvalRemediationFinding[]> {
            return readFindings(client, operatorUserId, `
                and exists (
                  select 1
                  from public.ai_eval_remediation_findings selected_link
                  where selected_link.ai_eval_finding_id = finding.ai_eval_finding_id
                    and selected_link.ai_eval_remediation_id = $2
                )
            `, [remediationId]);
        },

        async createRemediationWithFindings(input: {
            operatorUserId: string;
            creationRequestKey: string;
            targetComponent: AiEvalRemediationTarget;
            title: string;
            hypothesis: string;
            expectedChange: string;
            regressionRisks: string;
            findingIds: string[];
        }): Promise<string | null> {
            const result = await client.query(`
                with requested as materialized (
                  select distinct unnest($8::uuid[]) as ai_eval_finding_id
                ), eligible as materialized (
                  select
                    finding.ai_eval_finding_id,
                    review.ai_eval_work_item_id
                  from requested
                  join public.ai_eval_findings finding using (ai_eval_finding_id)
                  join public.ai_eval_reviews review
                    on review.ai_eval_review_id = finding.ai_eval_review_id
                  where review.lifecycle_state = 'submitted'
                    and public.is_active_ai_eval_operator($1::uuid)
                ), existing as materialized (
                  select remediation.ai_eval_remediation_id
                  from public.ai_eval_remediations remediation
                  where remediation.created_by_operator_user_id = $1
                    and remediation.creation_request_key = $2::uuid
                    and remediation.owner_operator_user_id = $1
                    and remediation.target_component = $3
                    and remediation.title = $4
                    and remediation.hypothesis = $5
                    and remediation.expected_change = $6
                    and remediation.regression_risks = $7
                    and not exists (
                      select 1 from requested
                      where not exists (
                        select 1 from public.ai_eval_remediation_findings link
                        where link.ai_eval_remediation_id = remediation.ai_eval_remediation_id
                          and link.ai_eval_finding_id = requested.ai_eval_finding_id
                      )
                    )
                    and not exists (
                      select 1 from public.ai_eval_remediation_findings link
                      where link.ai_eval_remediation_id = remediation.ai_eval_remediation_id
                        and not exists (
                          select 1 from requested
                          where requested.ai_eval_finding_id = link.ai_eval_finding_id
                        )
                    )
                ), inserted as (
                  insert into public.ai_eval_remediations (
                    creation_request_key,
                    created_by_operator_user_id,
                    owner_operator_user_id,
                    last_updated_by_operator_user_id,
                    target_component,
                    title,
                    hypothesis,
                    expected_change,
                    regression_risks
                  )
                  select $2::uuid, $1::uuid, $1::uuid, $1::uuid, $3, $4, $5, $6, $7
                  where (select count(*) from requested) > 0
                    and (select count(*) from eligible) = (select count(*) from requested)
                    and not exists (select 1 from existing)
                  on conflict (created_by_operator_user_id, creation_request_key) do nothing
                  returning ai_eval_remediation_id
                ), resolved as materialized (
                  select ai_eval_remediation_id from inserted
                  union all
                  select ai_eval_remediation_id from existing
                ), linked as (
                  insert into public.ai_eval_remediation_findings (
                    ai_eval_remediation_id,
                    ai_eval_finding_id,
                    linked_by_operator_user_id
                  )
                  select resolved.ai_eval_remediation_id, eligible.ai_eval_finding_id, $1::uuid
                  from resolved
                  cross join eligible
                  on conflict do nothing
                  returning ai_eval_finding_id
                ), advanced as (
                  update public.ai_eval_work_items work_item
                  set
                    lifecycle_state = 'remediation_in_progress',
                    last_updated_by_operator_user_id = $1::uuid,
                    revision = work_item.revision + 1
                  where work_item.ai_eval_work_item_id in (select ai_eval_work_item_id from eligible)
                    and work_item.lifecycle_state in ('reviewed', 'verified', 'closed')
                    and exists (select 1 from resolved)
                  returning work_item.ai_eval_work_item_id
                )
                select ai_eval_remediation_id
                from resolved
                where exists (select 1 from linked)
                   or exists (select 1 from existing)
                limit 1
            `, [
                input.operatorUserId,
                input.creationRequestKey,
                input.targetComponent,
                input.title,
                input.hypothesis,
                input.expectedChange,
                input.regressionRisks,
                input.findingIds,
            ]);
            return readString(result.rows[0]?.ai_eval_remediation_id) || null;
        },

        async linkFindings(input: {
            operatorUserId: string;
            remediationId: string;
            findingIds: string[];
        }): Promise<boolean> {
            const result = await client.query(`
                with requested as materialized (
                  select distinct unnest($3::uuid[]) as ai_eval_finding_id
                ), eligible as materialized (
                  select finding.ai_eval_finding_id, review.ai_eval_work_item_id
                  from requested
                  join public.ai_eval_findings finding using (ai_eval_finding_id)
                  join public.ai_eval_reviews review
                    on review.ai_eval_review_id = finding.ai_eval_review_id
                  where review.lifecycle_state = 'submitted'
                    and public.is_active_ai_eval_operator($1::uuid)
                    and exists (
                      select 1 from public.ai_eval_remediations remediation
                      where remediation.ai_eval_remediation_id = $2
                        and remediation.lifecycle_state not in ('verified', 'wont_fix', 'duplicate')
                    )
                ), linked as (
                  insert into public.ai_eval_remediation_findings (
                    ai_eval_remediation_id,
                    ai_eval_finding_id,
                    linked_by_operator_user_id
                  )
                  select $2::uuid, eligible.ai_eval_finding_id, $1::uuid
                  from eligible
                  on conflict do nothing
                  returning ai_eval_finding_id
                ), advanced as (
                  update public.ai_eval_work_items work_item
                  set
                    lifecycle_state = 'remediation_in_progress',
                    last_updated_by_operator_user_id = $1::uuid,
                    revision = work_item.revision + 1
                  where work_item.ai_eval_work_item_id in (select ai_eval_work_item_id from eligible)
                    and work_item.lifecycle_state in ('reviewed', 'verified', 'closed')
                    and (
                      exists (select 1 from linked)
                      or (select count(*) from eligible) = (select count(*) from requested)
                    )
                  returning work_item.ai_eval_work_item_id
                )
                select count(*)::integer as linked_count
                from requested
                where (
                  exists (
                    select 1 from public.ai_eval_remediation_findings link
                    where link.ai_eval_remediation_id = $2
                      and link.ai_eval_finding_id = requested.ai_eval_finding_id
                  )
                  or requested.ai_eval_finding_id in (select ai_eval_finding_id from linked)
                )
                  and (select count(*) from eligible) = (select count(*) from requested)
            `, [input.operatorUserId, input.remediationId, input.findingIds]);
            return Number(result.rows[0]?.linked_count) === new Set(input.findingIds).size && input.findingIds.length > 0;
        },

        async updateRemediation(input: {
            operatorUserId: string;
            remediationId: string;
            revision: number;
            lifecycleState: AiEvalRemediationLifecycle;
            changeKind: AiEvalChangeKind | null;
            changedReference: string | null;
            verificationNote: string | null;
        }): Promise<boolean> {
            const result = await client.query(`
                with updated as (
                  update public.ai_eval_remediations remediation
                  set
                    lifecycle_state = $4,
                    change_kind = $5,
                    changed_reference = $6,
                    verification_note = $7,
                    last_updated_by_operator_user_id = $1::uuid,
                    revision = remediation.revision + 1
                  where remediation.ai_eval_remediation_id = $2
                    and remediation.revision = $3
                    and public.is_active_ai_eval_operator($1::uuid)
                  returning remediation.ai_eval_remediation_id, remediation.lifecycle_state
                ), affected_work_items as materialized (
                  select distinct review.ai_eval_work_item_id
                  from public.ai_eval_remediation_findings link
                  join public.ai_eval_findings finding
                    on finding.ai_eval_finding_id = link.ai_eval_finding_id
                  join public.ai_eval_reviews review
                    on review.ai_eval_review_id = finding.ai_eval_review_id
                  where link.ai_eval_remediation_id = $2
                ), reconciled as (
                  update public.ai_eval_work_items work_item
                  set
                    lifecycle_state = case
                      when exists (
                        select 1
                        from public.ai_eval_remediation_findings item_link
                        join public.ai_eval_findings item_finding
                          on item_finding.ai_eval_finding_id = item_link.ai_eval_finding_id
                        join public.ai_eval_reviews item_review
                          on item_review.ai_eval_review_id = item_finding.ai_eval_review_id
                        join public.ai_eval_remediations item_remediation
                          on item_remediation.ai_eval_remediation_id = item_link.ai_eval_remediation_id
                        where item_review.ai_eval_work_item_id = work_item.ai_eval_work_item_id
                          and coalesce(
                            (
                              select updated.lifecycle_state
                              from updated
                              where updated.ai_eval_remediation_id = item_remediation.ai_eval_remediation_id
                            ),
                            item_remediation.lifecycle_state
                          ) not in ('verified', 'wont_fix', 'duplicate')
                      ) then 'remediation_in_progress'
                      when exists (
                        select 1
                        from public.ai_eval_remediation_findings item_link
                        join public.ai_eval_findings item_finding
                          on item_finding.ai_eval_finding_id = item_link.ai_eval_finding_id
                        join public.ai_eval_reviews item_review
                          on item_review.ai_eval_review_id = item_finding.ai_eval_review_id
                        join public.ai_eval_remediations item_remediation
                          on item_remediation.ai_eval_remediation_id = item_link.ai_eval_remediation_id
                        where item_review.ai_eval_work_item_id = work_item.ai_eval_work_item_id
                          and coalesce(
                            (
                              select updated.lifecycle_state
                              from updated
                              where updated.ai_eval_remediation_id = item_remediation.ai_eval_remediation_id
                            ),
                            item_remediation.lifecycle_state
                          ) = 'verified'
                      ) then 'verified'
                      else 'closed'
                    end,
                    last_updated_by_operator_user_id = $1::uuid,
                    revision = work_item.revision + 1
                  where work_item.ai_eval_work_item_id in (select ai_eval_work_item_id from affected_work_items)
                    and work_item.lifecycle_state = 'remediation_in_progress'
                    and exists (
                      select 1 from updated
                      where updated.lifecycle_state in ('verified', 'wont_fix', 'duplicate')
                    )
                  returning work_item.ai_eval_work_item_id
                )
                select ai_eval_remediation_id from updated
            `, [
                input.operatorUserId,
                input.remediationId,
                input.revision,
                input.lifecycleState,
                input.changeKind,
                input.changedReference,
                input.verificationNote,
            ]);
            return result.rows.length === 1;
        },

        async promoteRegressionCase(input: {
            operatorUserId: string;
            remediationId: string;
            findingId: string;
        }): Promise<string | null> {
            const result = await client.query(`
                with eligible as materialized (
                  select finding.ai_eval_finding_id, review.ai_eval_work_item_id
                  from public.ai_eval_findings finding
                  join public.ai_eval_reviews review
                    on review.ai_eval_review_id = finding.ai_eval_review_id
                  join public.ai_eval_remediation_findings link
                    on link.ai_eval_finding_id = finding.ai_eval_finding_id
                  where finding.ai_eval_finding_id = $3
                    and link.ai_eval_remediation_id = $2
                    and review.lifecycle_state = 'submitted'
                    and public.is_active_ai_eval_operator($1::uuid)
                ), inserted as (
                  insert into public.ai_eval_regression_cases (
                    source_finding_id,
                    original_work_item_id,
                    promoted_by_operator_user_id
                  )
                  select ai_eval_finding_id, ai_eval_work_item_id, $1::uuid
                  from eligible
                  on conflict (source_finding_id) do nothing
                  returning ai_eval_regression_case_id
                ), resolved as (
                  select ai_eval_regression_case_id from inserted
                  union all
                  select existing.ai_eval_regression_case_id
                  from public.ai_eval_regression_cases existing
                  join eligible on eligible.ai_eval_finding_id = existing.source_finding_id
                  where not exists (select 1 from inserted)
                )
                select ai_eval_regression_case_id from resolved limit 1
            `, [input.operatorUserId, input.remediationId, input.findingId]);
            return readString(result.rows[0]?.ai_eval_regression_case_id) || null;
        },

        async listRegressionCases(
            operatorUserId: string,
            remediationId: string,
        ): Promise<AiEvalRegressionCase[]> {
            const result = await client.query(`
                select
                  regression.ai_eval_regression_case_id,
                  regression.source_finding_id,
                  regression.original_work_item_id,
                  original_item.surface,
                  finding.failure_label,
                  finding.failure_label_version,
                  finding.layer,
                  latest.outcome as latest_outcome,
                  verification_review.ai_eval_work_item_id as latest_verification_work_item_id,
                  to_char(latest.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as latest_rechecked_at,
                  to_char(regression.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at
                from public.ai_eval_regression_cases regression
                join public.ai_eval_findings finding
                  on finding.ai_eval_finding_id = regression.source_finding_id
                join public.ai_eval_work_items original_item
                  on original_item.ai_eval_work_item_id = regression.original_work_item_id
                join public.ai_eval_remediation_findings link
                  on link.ai_eval_finding_id = regression.source_finding_id
                 and link.ai_eval_remediation_id = $2
                left join lateral (
                  select recheck.*
                  from public.ai_eval_rechecks recheck
                  where recheck.ai_eval_remediation_id = $2
                    and recheck.ai_eval_regression_case_id = regression.ai_eval_regression_case_id
                  order by recheck.created_at desc, recheck.ai_eval_recheck_id desc
                  limit 1
                ) latest on true
                left join public.ai_eval_reviews verification_review
                  on verification_review.ai_eval_review_id = latest.verification_review_id
                where public.is_active_ai_eval_operator($1::uuid)
                order by regression.created_at, regression.ai_eval_regression_case_id
            `, [operatorUserId, remediationId]);
            return result.rows.map(mapRegressionCase).filter((item): item is AiEvalRegressionCase => item !== null);
        },

        async listRecheckCandidates(
            operatorUserId: string,
            remediationId: string,
        ): Promise<Array<AiEvalRecheckCandidate & { regressionCaseId: string }>> {
            const result = await client.query(`
                select
                  regression.ai_eval_regression_case_id,
                  review.ai_eval_review_id,
                  work_item.ai_eval_work_item_id,
                  work_item.surface,
                  work_item.source_kind,
                  work_item.profile_id,
                  work_item.configuration_fingerprint,
                  to_char(work_item.source_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as source_occurred_at
                from public.ai_eval_regression_cases regression
                join public.ai_eval_work_items original_item
                  on original_item.ai_eval_work_item_id = regression.original_work_item_id
                join public.ai_eval_remediation_findings link
                  on link.ai_eval_finding_id = regression.source_finding_id
                 and link.ai_eval_remediation_id = $2
                join public.ai_eval_work_items work_item
                  on work_item.surface = original_item.surface
                 and work_item.source_occurred_at > original_item.source_occurred_at
                 and work_item.ai_eval_work_item_id <> original_item.ai_eval_work_item_id
                join public.ai_eval_reviews review
                  on review.ai_eval_work_item_id = work_item.ai_eval_work_item_id
                 and review.lifecycle_state = 'submitted'
                where public.is_active_ai_eval_operator($1::uuid)
                  and not exists (
                    select 1 from public.ai_eval_rechecks recheck
                    where recheck.ai_eval_remediation_id = $2
                      and recheck.ai_eval_regression_case_id = regression.ai_eval_regression_case_id
                      and recheck.verification_review_id = review.ai_eval_review_id
                  )
                order by work_item.source_occurred_at desc, work_item.ai_eval_work_item_id
                limit 200
            `, [operatorUserId, remediationId]);
            return result.rows.map(mapRecheckCandidate)
                .filter((item): item is AiEvalRecheckCandidate & { regressionCaseId: string } => item !== null);
        },

        async recordRecheck(input: {
            operatorUserId: string;
            remediationId: string;
            regressionCaseId: string;
            verificationReviewId: string;
            outcome: AiEvalRecheckOutcome;
            verificationNote: string;
        }): Promise<string | null> {
            const result = await client.query(`
                with inserted as (
                  insert into public.ai_eval_rechecks (
                    ai_eval_remediation_id,
                    ai_eval_regression_case_id,
                    verification_review_id,
                    verified_by_operator_user_id,
                    outcome,
                    verification_note
                  )
                  select $2::uuid, $3::uuid, $4::uuid, $1::uuid, $5, $6
                  where public.is_active_ai_eval_operator($1::uuid)
                  on conflict (
                    ai_eval_remediation_id,
                    ai_eval_regression_case_id,
                    verification_review_id
                  ) do nothing
                  returning ai_eval_recheck_id
                ), resolved as (
                  select ai_eval_recheck_id from inserted
                  union all
                  select existing.ai_eval_recheck_id
                  from public.ai_eval_rechecks existing
                  where existing.ai_eval_remediation_id = $2
                    and existing.ai_eval_regression_case_id = $3
                    and existing.verification_review_id = $4
                    and existing.outcome = $5
                    and existing.verification_note = $6
                    and public.is_active_ai_eval_operator($1::uuid)
                    and not exists (select 1 from inserted)
                )
                select ai_eval_recheck_id from resolved limit 1
            `, [
                input.operatorUserId,
                input.remediationId,
                input.regressionCaseId,
                input.verificationReviewId,
                input.outcome,
                input.verificationNote,
            ]);
            return readString(result.rows[0]?.ai_eval_recheck_id) || null;
        },

        async listRechecks(operatorUserId: string, remediationId: string): Promise<AiEvalRecheck[]> {
            const result = await client.query(`
                select
                  recheck.ai_eval_recheck_id,
                  recheck.ai_eval_remediation_id,
                  recheck.ai_eval_regression_case_id,
                  recheck.verification_review_id,
                  review.ai_eval_work_item_id as verification_work_item_id,
                  recheck.outcome,
                  recheck.verification_note,
                  to_char(recheck.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at
                from public.ai_eval_rechecks recheck
                join public.ai_eval_reviews review
                  on review.ai_eval_review_id = recheck.verification_review_id
                where recheck.ai_eval_remediation_id = $2
                  and public.is_active_ai_eval_operator($1::uuid)
                order by recheck.created_at desc, recheck.ai_eval_recheck_id desc
            `, [operatorUserId, remediationId]);
            return result.rows.map(mapRecheck).filter((item): item is AiEvalRecheck => item !== null);
        },
    };
}

async function readFindings(
    client: AiEvalWorkbenchQueryClient,
    operatorUserId: string,
    extraPredicate: string,
    extraValues: unknown[],
) {
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
          review.ai_eval_work_item_id,
          work_item.surface,
          work_item.source_kind,
          regression.ai_eval_regression_case_id,
          to_char(finding.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at,
          to_char(work_item.source_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as source_occurred_at
        from public.ai_eval_findings finding
        join public.ai_eval_reviews review
          on review.ai_eval_review_id = finding.ai_eval_review_id
         and review.lifecycle_state = 'submitted'
        join public.ai_eval_work_items work_item
          on work_item.ai_eval_work_item_id = review.ai_eval_work_item_id
        left join public.ai_eval_regression_cases regression
          on regression.source_finding_id = finding.ai_eval_finding_id
        where public.is_active_ai_eval_operator($1::uuid)
          ${extraPredicate}
        order by finding.created_at desc, finding.ai_eval_finding_id
        limit 200
    `, [operatorUserId, ...extraValues]);
    return result.rows.map(mapRemediationFinding)
        .filter((item): item is AiEvalRemediationFinding => item !== null);
}

function mapRemediation(row: Record<string, unknown> | undefined): AiEvalRemediation | null {
    if (!row) return null;
    const remediationId = readString(row.ai_eval_remediation_id);
    const ownerOperatorUserId = readString(row.owner_operator_user_id);
    const lifecycleState = readString(row.lifecycle_state) as AiEvalRemediationLifecycle;
    const targetComponent = readString(row.target_component) as AiEvalRemediationTarget;
    const title = readString(row.title);
    const hypothesis = readString(row.hypothesis);
    const expectedChange = readString(row.expected_change);
    const regressionRisks = readString(row.regression_risks);
    const revision = Number(row.revision);
    const createdAt = readDate(row.created_at_text ?? row.created_at);
    const updatedAt = readDate(row.updated_at_text ?? row.updated_at);
    if (!remediationId || !ownerOperatorUserId || !lifecycleState || !targetComponent || !title
        || !hypothesis || !expectedChange || !regressionRisks || !Number.isInteger(revision)
        || !createdAt || !updatedAt) return null;
    return {
        remediationId,
        ownerOperatorUserId,
        lifecycleState,
        targetComponent,
        title,
        hypothesis,
        expectedChange,
        regressionRisks,
        changeKind: readNullableString(row.change_kind) as AiEvalChangeKind | null,
        changedReference: readNullableString(row.changed_reference),
        verificationNote: readNullableString(row.verification_note),
        revision,
        findingCount: readCount(row.finding_count),
        regressionCaseCount: readCount(row.regression_case_count),
        recheckCount: readCount(row.recheck_count),
        createdAt,
        updatedAt,
    };
}

function mapRemediationFinding(row: Record<string, unknown>): AiEvalRemediationFinding | null {
    const findingId = readString(row.ai_eval_finding_id);
    const reviewId = readString(row.ai_eval_review_id);
    const workItemId = readString(row.ai_eval_work_item_id);
    const layer = readString(row.layer) as AiEvalFindingLayer;
    const failureLabel = readString(row.failure_label);
    const failureLabelVersion = readString(row.failure_label_version);
    const severity = readString(row.severity) as AiEvalSeverity;
    const rationale = readString(row.rationale);
    const sourceReference = readRecord(row.source_reference_json);
    const surface = readString(row.surface) as AiEvalSurface;
    const sourceKind = readString(row.source_kind) as AiEvalSourceKind;
    const createdAt = readDate(row.created_at);
    const sourceOccurredAt = readDate(row.source_occurred_at);
    if (!findingId || !reviewId || !workItemId || !layer || !failureLabel || !failureLabelVersion
        || !severity || !rationale || !sourceReference || !surface || !sourceKind || !createdAt || !sourceOccurredAt) return null;
    return {
        findingId,
        reviewId,
        workItemId,
        layer,
        failureLabel,
        failureLabelVersion,
        severity,
        rationale,
        sourceReference: sourceReference as Record<string, string | number>,
        surface,
        sourceKind,
        sourceOccurredAt,
        regressionCaseId: readNullableString(row.ai_eval_regression_case_id),
        createdAt,
    };
}

function mapRegressionCase(row: Record<string, unknown>): AiEvalRegressionCase | null {
    const regressionCaseId = readString(row.ai_eval_regression_case_id);
    const sourceFindingId = readString(row.source_finding_id);
    const originalWorkItemId = readString(row.original_work_item_id);
    const surface = readString(row.surface) as AiEvalSurface;
    const failureLabel = readString(row.failure_label);
    const failureLabelVersion = readString(row.failure_label_version);
    const layer = readString(row.layer) as AiEvalFindingLayer;
    const createdAt = readDate(row.created_at);
    if (!regressionCaseId || !sourceFindingId || !originalWorkItemId || !surface
        || !failureLabel || !failureLabelVersion || !layer || !createdAt) return null;
    return {
        regressionCaseId,
        sourceFindingId,
        originalWorkItemId,
        surface,
        failureLabel,
        failureLabelVersion,
        layer,
        latestOutcome: readNullableString(row.latest_outcome) as AiEvalRecheckOutcome | null,
        latestVerificationWorkItemId: readNullableString(row.latest_verification_work_item_id),
        latestRecheckedAt: readDate(row.latest_rechecked_at),
        createdAt,
    };
}

function mapRecheckCandidate(row: Record<string, unknown>): (AiEvalRecheckCandidate & { regressionCaseId: string }) | null {
    const regressionCaseId = readString(row.ai_eval_regression_case_id);
    const reviewId = readString(row.ai_eval_review_id);
    const workItemId = readString(row.ai_eval_work_item_id);
    const surface = readString(row.surface) as AiEvalSurface;
    const sourceKind = readString(row.source_kind) as AiEvalSourceKind;
    const sourceOccurredAt = readDate(row.source_occurred_at);
    if (!regressionCaseId || !reviewId || !workItemId || !surface || !sourceKind || !sourceOccurredAt) return null;
    return {
        regressionCaseId,
        reviewId,
        workItemId,
        surface,
        sourceKind,
        profileId: readNullableString(row.profile_id),
        configurationFingerprint: readNullableString(row.configuration_fingerprint),
        sourceOccurredAt,
    };
}

function mapRecheck(row: Record<string, unknown>): AiEvalRecheck | null {
    const recheckId = readString(row.ai_eval_recheck_id);
    const remediationId = readString(row.ai_eval_remediation_id);
    const regressionCaseId = readString(row.ai_eval_regression_case_id);
    const verificationReviewId = readString(row.verification_review_id);
    const verificationWorkItemId = readString(row.verification_work_item_id);
    const outcome = readString(row.outcome) as AiEvalRecheckOutcome;
    const verificationNote = readString(row.verification_note);
    const createdAt = readDate(row.created_at);
    if (!recheckId || !remediationId || !regressionCaseId || !verificationReviewId
        || !verificationWorkItemId || !outcome || !verificationNote || !createdAt) return null;
    return { recheckId, remediationId, regressionCaseId, verificationReviewId, verificationWorkItemId, outcome, verificationNote, createdAt };
}

function readString(value: unknown) {
    return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function readRecord(value: unknown) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function readDate(value: unknown) {
    if (typeof value === "string" && value.length > 0) return value;
    if (value instanceof Date) return value.toISOString();
    return null;
}

function readCount(value: unknown) {
    const count = Number(value);
    return Number.isInteger(count) && count >= 0 ? count : 0;
}
