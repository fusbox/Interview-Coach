import {
    AI_EVAL_SOURCE_SURFACE,
    type AiEvalAudience,
    type AiEvalEligibleSource,
    type AiEvalPriority,
    type AiEvalSelectionReason,
    type AiEvalSourceKind,
    type AiEvalSurface,
    type AiEvalWorkItem,
    type AiEvalWorkItemDetail,
    type AiEvalWorkItemLifecycle,
} from "./ai-eval-workbench-contract";

export type AiEvalWorkbenchQueryClient = {
    query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export type AiEvalQueueFilters = {
    surface?: AiEvalSurface;
    sourceKind?: AiEvalSourceKind;
    audience?: AiEvalAudience;
    lifecycleState?: AiEvalWorkItemLifecycle;
    priority?: AiEvalPriority;
    interviewStage?: string;
    questionCategory?: string;
    sourceLifecycleState?: string;
    sourceFailureCode?: string;
    configurationFingerprint?: string;
    limit?: number;
};

export type AiEvalSourceInboxFilters = {
    surface?: AiEvalSurface;
    sourceKind?: AiEvalSourceKind;
    sourceLifecycleState?: string;
    limit?: number;
};

const SOURCE_COLUMNS: Record<AiEvalSourceKind, string> = {
    candidate_answer_evaluation: "candidate_answer_evaluation_run_id",
    invited_answer_evaluation: "invited_answer_evaluation_run_id",
    candidate_coach_update: "candidate_coach_update_artifact_id",
    candidate_question_wording: "candidate_question_wording_role_profile_id",
    recruiter_question_wording: "recruiter_question_wording_set_id",
};

export function createAiEvalWorkbenchRepository(client: AiEvalWorkbenchQueryClient) {
    return {
        async listEligibleSources(
            operatorUserId: string,
            filters: AiEvalSourceInboxFilters = {},
        ): Promise<AiEvalEligibleSource[]> {
            const result = await client.query(ELIGIBLE_SOURCE_INBOX_SQL, [
                operatorUserId,
                filters.surface ?? null,
                filters.sourceKind ?? null,
                filters.sourceLifecycleState ?? null,
                clampLimit(filters.limit),
            ]);
            return result.rows.map(mapEligibleSource).filter((item): item is AiEvalEligibleSource => item !== null);
        },

        async createWorkItem(input: {
            operatorUserId: string;
            sourceKind: AiEvalSourceKind;
            sourceId: string;
            selectionReason: AiEvalSelectionReason;
            priority?: AiEvalPriority;
            assignedOperatorUserId?: string | null;
        }): Promise<AiEvalWorkItem | null> {
            const sourceColumn = SOURCE_COLUMNS[input.sourceKind];
            const result = await client.query(`
                with operator_access as materialized (
                  select app_user.user_id
                  from public.app_users app_user
                  join public.ai_eval_operator_grants operator_grant
                    on operator_grant.user_id = app_user.user_id
                   and operator_grant.lifecycle_state = 'active'
                  where app_user.user_id = $7::uuid
                    and app_user.status = 'active'
                ), inserted as (
                  insert into public.ai_eval_work_items (
                    surface,
                    source_kind,
                    ${sourceColumn},
                    selection_reason,
                    priority,
                    assigned_operator_user_id,
                    created_by_operator_user_id,
                    last_updated_by_operator_user_id,
                    source_lifecycle_state,
                    audience,
                    source_occurred_at
                  )
                  select $1, $2, $3::uuid, $4, $5, $6::uuid, user_id, user_id, 'pending', 'candidate_led', now()
                  from operator_access
                  on conflict do nothing
                  returning *
                ), resolved as (
                  select inserted.*
                  from inserted
                  union all
                  select existing.*
                  from public.ai_eval_work_items existing
                  where existing.${sourceColumn} = $3::uuid
                    and exists (select 1 from operator_access)
                    and not exists (select 1 from inserted)
                )
                select ${WORK_ITEM_SELECT}
                from resolved work_item
                limit 1
            `, [
                AI_EVAL_SOURCE_SURFACE[input.sourceKind],
                input.sourceKind,
                input.sourceId,
                input.selectionReason,
                input.priority ?? "normal",
                input.assignedOperatorUserId ?? null,
                input.operatorUserId,
            ]);
            return mapWorkItem(result.rows[0]);
        },

        async listWorkItems(operatorUserId: string, filters: AiEvalQueueFilters = {}): Promise<AiEvalWorkItem[]> {
            const result = await client.query(`
                with operator_access as materialized (
                  select app_user.user_id
                  from public.app_users app_user
                  join public.ai_eval_operator_grants operator_grant
                    on operator_grant.user_id = app_user.user_id
                   and operator_grant.lifecycle_state = 'active'
                  where app_user.user_id = $1
                    and app_user.status = 'active'
                )
                select ${WORK_ITEM_SELECT}
                from public.ai_eval_work_items work_item
                where exists (select 1 from operator_access)
                  and ($2::text is null or work_item.surface = $2)
                  and ($3::text is null or work_item.source_kind = $3)
                  and ($4::text is null or work_item.audience = $4)
                  and ($5::text is null or work_item.lifecycle_state = $5)
                  and ($6::text is null or work_item.priority = $6)
                  and ($7::text is null or work_item.interview_stage = $7)
                  and ($8::text is null or work_item.question_category = $8)
                  and ($9::text is null or work_item.source_lifecycle_state = $9)
                  and ($10::text is null or work_item.source_failure_code = $10)
                  and ($11::text is null or work_item.configuration_fingerprint = $11)
                order by
                  case work_item.priority
                    when 'urgent' then 1
                    when 'high' then 2
                    when 'normal' then 3
                    else 4
                  end,
                  work_item.source_occurred_at desc,
                  work_item.ai_eval_work_item_id
                limit $12
            `, [
                operatorUserId,
                filters.surface ?? null,
                filters.sourceKind ?? null,
                filters.audience ?? null,
                filters.lifecycleState ?? null,
                filters.priority ?? null,
                filters.interviewStage ?? null,
                filters.questionCategory ?? null,
                filters.sourceLifecycleState ?? null,
                filters.sourceFailureCode ?? null,
                filters.configurationFingerprint ?? null,
                clampLimit(filters.limit),
            ]);

            return result.rows.map(mapWorkItem).filter((item): item is AiEvalWorkItem => item !== null);
        },

        async findWorkItemDetail(operatorUserId: string, workItemId: string): Promise<AiEvalWorkItemDetail | null> {
            const result = await client.query(WORK_ITEM_DETAIL_SQL, [operatorUserId, workItemId]);
            const row = result.rows[0];
            const item = mapWorkItem(row);
            const sourcePayload = readRecord(row?.source_payload);
            if (!item || !sourcePayload) return null;
            if (Number(row?.audit_count) !== 1) {
                throw new Error("AI-eval source detail read did not persist its audit event.");
            }
            return { ...item, sourcePayload };
        },
    };
}

const WORK_ITEM_SELECT = `
  work_item.ai_eval_work_item_id,
  work_item.surface,
  work_item.source_kind,
  work_item.audience,
  work_item.selection_reason,
  work_item.lifecycle_state,
  work_item.priority,
  work_item.assigned_operator_user_id,
  work_item.source_lifecycle_state,
  work_item.source_failure_code,
  work_item.interview_stage,
  work_item.question_category,
  work_item.provider,
  work_item.model_name,
  work_item.profile_id,
  work_item.prompt_version,
  work_item.evaluator_version,
  work_item.configuration_fingerprint,
  to_char(work_item.source_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as source_occurred_at,
  work_item.revision
`;

const ELIGIBLE_SOURCE_INBOX_SQL = `
  with operator_access as materialized (
    select app_user.user_id
    from public.app_users app_user
    join public.ai_eval_operator_grants operator_grant
      on operator_grant.user_id = app_user.user_id
     and operator_grant.lifecycle_state = 'active'
    where app_user.user_id = $1
      and app_user.status = 'active'
  ), eligible as materialized (
    select
      run.candidate_answer_evaluation_run_id as source_id,
      'candidate_answer_evaluation'::text as source_kind,
      'answer_coaching'::text as surface,
      'candidate_led'::text as audience,
      run.lifecycle_state as source_lifecycle_state,
      run.error_code as source_failure_code,
      session.setup_snapshot_json ->> 'interviewStage' as interview_stage,
      coalesce(
        (
          select slot ->> 'category'
          from jsonb_array_elements(
            case when jsonb_typeof(session.question_plan_snapshot_json -> 'slots') = 'array'
              then session.question_plan_snapshot_json -> 'slots' else '[]'::jsonb end
          ) slot
          where slot ->> 'id' = attempt.question_slot_id
          limit 1
        ),
        (
          select question ->> 'category'
          from jsonb_array_elements(
            case when jsonb_typeof(session.question_wording_snapshot_json -> 'questions') = 'array'
              then session.question_wording_snapshot_json -> 'questions' else '[]'::jsonb end
          ) question
          where question ->> 'slotId' = attempt.question_slot_id
          limit 1
        )
      ) as question_category,
      run.provider,
      run.model_name,
      run.configuration_manifest_json ->> 'profileId' as profile_id,
      run.prompt_version,
      run.evaluator_version,
      run.configuration_fingerprint,
      run.requested_at as source_occurred_at
    from public.candidate_answer_evaluation_runs run
    join public.candidate_answer_attempts attempt
      on attempt.candidate_answer_attempt_id = run.candidate_answer_attempt_id
    join public.candidate_practice_sessions session
      on session.candidate_practice_session_id = attempt.candidate_practice_session_id
    where run.purpose = 'candidate_coaching'
      and run.lifecycle_state in ('completed', 'failed', 'rejected')
      and not exists (
        select 1 from public.ai_eval_work_items item
        where item.candidate_answer_evaluation_run_id = run.candidate_answer_evaluation_run_id
      )

    union all

    select
      run.invited_practice_answer_evaluation_run_id,
      'invited_answer_evaluation',
      'answer_coaching',
      'invited',
      run.lifecycle_state,
      run.error_code,
      session.setup_snapshot_json ->> 'interviewStage',
      coalesce(
        (
          select slot ->> 'category'
          from jsonb_array_elements(
            case when jsonb_typeof(session.question_plan_snapshot_json -> 'slots') = 'array'
              then session.question_plan_snapshot_json -> 'slots' else '[]'::jsonb end
          ) slot
          where slot ->> 'id' = attempt.question_slot_id
          limit 1
        ),
        (
          select question ->> 'category'
          from jsonb_array_elements(
            case when jsonb_typeof(session.question_wording_snapshot_json -> 'questions') = 'array'
              then session.question_wording_snapshot_json -> 'questions' else '[]'::jsonb end
          ) question
          where question ->> 'slotId' = attempt.question_slot_id
          limit 1
        )
      ),
      run.provider,
      run.model_name,
      run.configuration_manifest_json ->> 'profileId',
      run.prompt_version,
      run.evaluator_version,
      run.configuration_fingerprint,
      run.requested_at
    from public.invited_practice_answer_evaluation_runs run
    join public.invited_practice_answer_attempts attempt
      on attempt.invited_practice_answer_attempt_id = run.invited_practice_answer_attempt_id
    join public.invited_practice_sessions session
      on session.invited_practice_session_id = attempt.invited_practice_session_id
    where run.purpose = 'candidate_coaching'
      and run.lifecycle_state in ('completed', 'failed', 'rejected')
      and not exists (
        select 1 from public.ai_eval_work_items item
        where item.invited_answer_evaluation_run_id = run.invited_practice_answer_evaluation_run_id
      )

    union all

    select
      artifact.candidate_coach_update_artifact_id,
      'candidate_coach_update',
      'coach_update',
      'candidate_led',
      artifact.lifecycle_state,
      artifact.error_code,
      session.setup_snapshot_json ->> 'interviewStage',
      null,
      artifact.provider,
      artifact.model_name,
      artifact.profile_id,
      artifact.prompt_version,
      artifact.evaluator_version,
      artifact.configuration_fingerprint,
      artifact.requested_at
    from public.candidate_coach_update_artifacts artifact
    join public.candidate_practice_sessions session
      on session.candidate_practice_session_id = artifact.source_candidate_practice_session_id
    where artifact.lifecycle_state in ('completed', 'failed', 'rejected')
      and not exists (
        select 1 from public.ai_eval_work_items item
        where item.candidate_coach_update_artifact_id = artifact.candidate_coach_update_artifact_id
      )

    union all

    select
      profile.role_profile_id,
      'candidate_question_wording',
      'question_wording',
      'candidate_led',
      'completed',
      null,
      profile.rigor_baseline_snapshot_json ->> 'interviewStage',
      null,
      nullif(profile.rigor_baseline_question_wording_snapshot_json #>> '{generation,provider}', ''),
      nullif(profile.rigor_baseline_question_wording_snapshot_json #>> '{generation,modelName}', ''),
      nullif(profile.rigor_baseline_question_wording_snapshot_json #>> '{generation,profileId}', ''),
      nullif(profile.rigor_baseline_question_wording_snapshot_json #>> '{generation,promptVersion}', ''),
      null,
      nullif(profile.rigor_baseline_question_wording_snapshot_json #>> '{generation,configurationFingerprint}', ''),
      profile.created_at
    from public.candidate_role_preparation_profiles profile
    where profile.rigor_baseline_question_wording_snapshot_json ->> 'status' = 'questions_worded'
      and not exists (
        select 1 from public.ai_eval_work_items item
        where item.candidate_question_wording_role_profile_id = profile.role_profile_id
      )

    union all

    select
      question_set.recruiter_invitation_question_set_id,
      'recruiter_question_wording',
      'question_wording',
      'recruiter_invite',
      question_set.lifecycle_state,
      question_set.failure_code,
      question_set.interview_stage,
      null,
      nullif(question_set.question_wording_snapshot_json #>> '{generation,provider}', ''),
      nullif(question_set.question_wording_snapshot_json #>> '{generation,modelName}', ''),
      nullif(question_set.question_wording_snapshot_json #>> '{generation,profileId}', ''),
      nullif(question_set.question_wording_snapshot_json #>> '{generation,promptVersion}', ''),
      null,
      nullif(question_set.question_wording_snapshot_json #>> '{generation,configurationFingerprint}', ''),
      question_set.created_at
    from public.recruiter_invitation_question_sets question_set
    where question_set.source = 'generated'
      and question_set.lifecycle_state in ('ready', 'failed')
      and not exists (
        select 1 from public.ai_eval_work_items item
        where item.recruiter_question_wording_set_id = question_set.recruiter_invitation_question_set_id
      )
  )
  select
    eligible.source_id,
    eligible.source_kind,
    eligible.surface,
    eligible.audience,
    eligible.source_lifecycle_state,
    eligible.source_failure_code,
    eligible.interview_stage,
    eligible.question_category,
    eligible.provider,
    eligible.model_name,
    eligible.profile_id,
    eligible.prompt_version,
    eligible.evaluator_version,
    eligible.configuration_fingerprint,
    to_char(eligible.source_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as source_occurred_at
  from eligible
  where exists (select 1 from operator_access)
    and ($2::text is null or eligible.surface = $2)
    and ($3::text is null or eligible.source_kind = $3)
    and ($4::text is null or eligible.source_lifecycle_state = $4)
  order by eligible.source_occurred_at desc, eligible.source_id
  limit $5
`;

const WORK_ITEM_DETAIL_SQL = `
  with operator_access as materialized (
    select app_user.user_id
    from public.app_users app_user
    join public.ai_eval_operator_grants operator_grant
      on operator_grant.user_id = app_user.user_id
     and operator_grant.lifecycle_state = 'active'
    where app_user.user_id = $1
      and app_user.status = 'active'
  ), item as materialized (
    select work_item.*
    from public.ai_eval_work_items work_item
    where work_item.ai_eval_work_item_id = $2
      and exists (select 1 from operator_access)
  ), source as materialized (
    select
      ${WORK_ITEM_SELECT},
      case work_item.source_kind
        when 'candidate_answer_evaluation' then jsonb_build_object(
          'question', coalesce((
            select question
            from jsonb_array_elements(
              case
                when jsonb_typeof(candidate_session.question_wording_snapshot_json -> 'questions') = 'array'
                  then candidate_session.question_wording_snapshot_json -> 'questions'
                else '[]'::jsonb
              end
            ) question
            where question ->> 'slotId' = candidate_attempt.question_slot_id
            limit 1
          ), '{}'::jsonb),
          'answer', jsonb_build_object(
            'answerAttemptId', candidate_attempt.candidate_answer_attempt_id,
            'slotId', candidate_attempt.question_slot_id,
            'text', candidate_attempt.answer_text,
            'mode', candidate_attempt.mode,
            'attemptNumber', candidate_attempt.attempt_number,
            'trigger', candidate_attempt.trigger,
            'submittedAt', candidate_attempt.submitted_at
          ),
          'evaluation', jsonb_build_object(
            'result', candidate_run.result_json,
            'validation', candidate_run.validation_json,
            'errorCode', candidate_run.error_code,
            'configuration', candidate_run.configuration_manifest_json
          ),
          'context', jsonb_build_object(
            'setup', candidate_session.setup_snapshot_json,
            'questionPlan', candidate_session.question_plan_snapshot_json
          )
        )
        when 'invited_answer_evaluation' then jsonb_build_object(
          'question', coalesce((
            select question
            from jsonb_array_elements(
              case
                when jsonb_typeof(invited_session.question_wording_snapshot_json -> 'questions') = 'array'
                  then invited_session.question_wording_snapshot_json -> 'questions'
                else '[]'::jsonb
              end
            ) question
            where question ->> 'slotId' = invited_attempt.question_slot_id
            limit 1
          ), '{}'::jsonb),
          'answer', jsonb_build_object(
            'answerAttemptId', invited_attempt.invited_practice_answer_attempt_id,
            'slotId', invited_attempt.question_slot_id,
            'text', invited_attempt.answer_text,
            'mode', invited_attempt.mode,
            'attemptNumber', invited_attempt.attempt_number,
            'trigger', invited_attempt.trigger,
            'submittedAt', invited_attempt.submitted_at
          ),
          'evaluation', jsonb_build_object(
            'result', invited_run.result_json,
            'validation', invited_run.validation_json,
            'errorCode', invited_run.error_code,
            'configuration', invited_run.configuration_manifest_json
          ),
          'context', jsonb_build_object(
            'setup', invited_session.setup_snapshot_json,
            'questionPlan', invited_session.question_plan_snapshot_json
          )
        )
        when 'candidate_coach_update' then jsonb_build_object(
          'coachUpdate', coach_update.candidate_safe_content_json,
          'validation', coach_update.validation_json,
          'errorCode', coach_update.error_code,
          'acceptedEvaluationRunIds', coach_update.accepted_evaluation_run_ids_json,
          'context', jsonb_build_object(
            'setup', coach_session.setup_snapshot_json,
            'questionPlan', coach_session.question_plan_snapshot_json,
            'questionWording', coach_session.question_wording_snapshot_json
          )
        )
        when 'candidate_question_wording' then jsonb_build_object(
          'questionPlan', candidate_question_profile.rigor_baseline_snapshot_json,
          'questionWording', candidate_question_profile.rigor_baseline_question_wording_snapshot_json,
          'context', jsonb_build_object(
            'targetRole', candidate_question_profile.target_role,
            'jobDescription', candidate_question_profile.job_description_snapshot,
            'resume', candidate_question_profile.resume_context_snapshot_json
          )
        )
        when 'recruiter_question_wording' then jsonb_build_object(
          'questionPlan', recruiter_question_set.question_plan_snapshot_json,
          'questionWording', recruiter_question_set.question_wording_snapshot_json,
          'failureCode', recruiter_question_set.failure_code,
          'context', jsonb_build_object(
            'targetRole', recruiter_question_set.target_role,
            'jobDescription', recruiter_question_set.job_description,
            'interviewStage', recruiter_question_set.interview_stage
          )
        )
      end as source_payload
    from item work_item
    left join public.candidate_answer_evaluation_runs candidate_run
      on candidate_run.candidate_answer_evaluation_run_id = work_item.candidate_answer_evaluation_run_id
    left join public.candidate_answer_attempts candidate_attempt
      on candidate_attempt.candidate_answer_attempt_id = candidate_run.candidate_answer_attempt_id
    left join public.candidate_practice_sessions candidate_session
      on candidate_session.candidate_practice_session_id = candidate_attempt.candidate_practice_session_id
    left join public.invited_practice_answer_evaluation_runs invited_run
      on invited_run.invited_practice_answer_evaluation_run_id = work_item.invited_answer_evaluation_run_id
    left join public.invited_practice_answer_attempts invited_attempt
      on invited_attempt.invited_practice_answer_attempt_id = invited_run.invited_practice_answer_attempt_id
    left join public.invited_practice_sessions invited_session
      on invited_session.invited_practice_session_id = invited_attempt.invited_practice_session_id
    left join public.candidate_coach_update_artifacts coach_update
      on coach_update.candidate_coach_update_artifact_id = work_item.candidate_coach_update_artifact_id
    left join public.candidate_practice_sessions coach_session
      on coach_session.candidate_practice_session_id = coach_update.source_candidate_practice_session_id
    left join public.candidate_role_preparation_profiles candidate_question_profile
      on candidate_question_profile.role_profile_id = work_item.candidate_question_wording_role_profile_id
    left join public.recruiter_invitation_question_sets recruiter_question_set
      on recruiter_question_set.recruiter_invitation_question_set_id = work_item.recruiter_question_wording_set_id
  ), audited as (
    insert into public.auth_audit_events (user_id, event_type, outcome, metadata)
    select
      operator_access.user_id,
      'ai_eval_source_detail_read',
      'success',
      jsonb_build_object(
        'work_item_id', source.ai_eval_work_item_id,
        'surface', source.surface,
        'source_kind', source.source_kind
      )
    from source
    cross join operator_access
    returning event_id
  )
  select source.*, (select count(*) from audited) as audit_count
  from source
`;

function clampLimit(value: number | undefined) {
    if (!Number.isFinite(value)) return 50;
    return Math.min(100, Math.max(1, Math.trunc(value ?? 50)));
}

function mapWorkItem(row: Record<string, unknown> | undefined): AiEvalWorkItem | null {
    if (!row) return null;
    const workItemId = readString(row.ai_eval_work_item_id);
    const sourceOccurredAt = readString(row.source_occurred_at);
    const surface = readString(row.surface) as AiEvalSurface;
    const sourceKind = readString(row.source_kind) as AiEvalSourceKind;
    const audience = readString(row.audience) as AiEvalAudience;
    const selectionReason = readString(row.selection_reason) as AiEvalSelectionReason;
    const lifecycleState = readString(row.lifecycle_state) as AiEvalWorkItemLifecycle;
    const priority = readString(row.priority) as AiEvalPriority;
    const revision = Number(row.revision);
    if (!workItemId || !sourceOccurredAt || !surface || !sourceKind || !audience || !selectionReason
        || !lifecycleState || !priority || !Number.isInteger(revision) || revision < 1) return null;

    return {
        workItemId,
        surface,
        sourceKind,
        audience,
        selectionReason,
        lifecycleState,
        priority,
        assignedOperatorUserId: readNullableString(row.assigned_operator_user_id),
        sourceLifecycleState: readString(row.source_lifecycle_state),
        sourceFailureCode: readNullableString(row.source_failure_code),
        interviewStage: readNullableString(row.interview_stage),
        questionCategory: readNullableString(row.question_category),
        provider: readNullableString(row.provider),
        modelName: readNullableString(row.model_name),
        profileId: readNullableString(row.profile_id),
        promptVersion: readNullableString(row.prompt_version),
        evaluatorVersion: readNullableString(row.evaluator_version),
        configurationFingerprint: readNullableString(row.configuration_fingerprint),
        sourceOccurredAt,
        revision,
    };
}

function mapEligibleSource(row: Record<string, unknown>): AiEvalEligibleSource | null {
    const sourceId = readString(row.source_id);
    const sourceKind = readString(row.source_kind) as AiEvalSourceKind;
    const surface = readString(row.surface) as AiEvalSurface;
    const audience = readString(row.audience) as AiEvalAudience;
    const sourceLifecycleState = readString(row.source_lifecycle_state);
    const sourceOccurredAt = readString(row.source_occurred_at);
    if (!sourceId || !sourceKind || !surface || !audience || !sourceLifecycleState || !sourceOccurredAt) return null;
    return {
        sourceId,
        sourceKind,
        surface,
        audience,
        sourceLifecycleState,
        sourceFailureCode: readNullableString(row.source_failure_code),
        interviewStage: readNullableString(row.interview_stage),
        questionCategory: readNullableString(row.question_category),
        provider: readNullableString(row.provider),
        modelName: readNullableString(row.model_name),
        profileId: readNullableString(row.profile_id),
        promptVersion: readNullableString(row.prompt_version),
        evaluatorVersion: readNullableString(row.evaluator_version),
        configurationFingerprint: readNullableString(row.configuration_fingerprint),
        sourceOccurredAt,
    };
}

function readString(value: unknown) {
    return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}
