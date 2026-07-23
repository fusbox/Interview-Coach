-- Individual AI-eval operator grants and source-linked review/remediation workflow.
-- Workflow rows retain references and non-content metadata only. Candidate/output
-- content remains in its authoritative serving artifact and is read just in time.

create table if not exists public.ai_eval_operator_grants (
  ai_eval_operator_grant_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(user_id) on delete restrict,
  lifecycle_state text not null default 'active',
  granted_by_user_id uuid references public.app_users(user_id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by_user_id uuid references public.app_users(user_id) on delete restrict,
  revoked_at timestamptz,
  reason text,
  constraint chk_ai_eval_operator_grant_state check (lifecycle_state in ('active', 'revoked')),
  constraint chk_ai_eval_operator_grant_reason check (reason is null or length(trim(reason)) between 1 and 500),
  constraint chk_ai_eval_operator_grant_lifecycle check (
    (lifecycle_state = 'active' and revoked_by_user_id is null and revoked_at is null)
    or
    (lifecycle_state = 'revoked' and revoked_at is not null and revoked_at >= granted_at)
  )
);

create unique index if not exists uq_ai_eval_operator_grants_active_user
  on public.ai_eval_operator_grants(user_id)
  where lifecycle_state = 'active';

create index if not exists idx_ai_eval_operator_grants_user_history
  on public.ai_eval_operator_grants(user_id, granted_at desc);

create or replace function public.validate_ai_eval_operator_grant_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'AI-eval operator grant history is immutable'
      using errcode = '55000';
  end if;

  if old.lifecycle_state <> 'active'
     or new.lifecycle_state <> 'revoked'
     or new.revoked_at is null then
    raise exception 'AI-eval operator grants allow only active-to-revoked transition'
      using errcode = '55000';
  end if;

  if row(
    new.ai_eval_operator_grant_id,
    new.user_id,
    new.granted_by_user_id,
    new.granted_at,
    new.reason
  ) is distinct from row(
    old.ai_eval_operator_grant_id,
    old.user_id,
    old.granted_by_user_id,
    old.granted_at,
    old.reason
  ) then
    raise exception 'AI-eval operator grant identity is immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ai_eval_operator_grant_transition
  on public.ai_eval_operator_grants;
create trigger trg_ai_eval_operator_grant_transition
before update or delete on public.ai_eval_operator_grants
for each row execute function public.validate_ai_eval_operator_grant_transition();

create or replace function public.is_active_ai_eval_operator(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.app_users app_user
    join public.ai_eval_operator_grants operator_grant
      on operator_grant.user_id = app_user.user_id
     and operator_grant.lifecycle_state = 'active'
    where app_user.user_id = p_user_id
      and app_user.status = 'active'
  );
$$;

create table if not exists public.ai_eval_work_items (
  ai_eval_work_item_id uuid primary key default gen_random_uuid(),
  surface text not null,
  source_kind text not null,
  candidate_answer_evaluation_run_id uuid
    references public.candidate_answer_evaluation_runs(candidate_answer_evaluation_run_id)
    on delete cascade,
  invited_answer_evaluation_run_id uuid
    references public.invited_practice_answer_evaluation_runs(invited_practice_answer_evaluation_run_id)
    on delete cascade,
  candidate_coach_update_artifact_id uuid
    references public.candidate_coach_update_artifacts(candidate_coach_update_artifact_id)
    on delete cascade,
  candidate_question_wording_role_profile_id uuid
    references public.candidate_role_preparation_profiles(role_profile_id)
    on delete cascade,
  recruiter_question_wording_set_id uuid
    references public.recruiter_invitation_question_sets(recruiter_invitation_question_set_id)
    on delete cascade,
  selection_reason text not null,
  lifecycle_state text not null default 'queued',
  priority text not null default 'normal',
  assigned_operator_user_id uuid references public.app_users(user_id) on delete restrict,
  created_by_operator_user_id uuid not null references public.app_users(user_id) on delete restrict,
  last_updated_by_operator_user_id uuid not null references public.app_users(user_id) on delete restrict,
  source_lifecycle_state text not null,
  audience text not null,
  interview_stage text,
  question_category text,
  source_failure_code text,
  provider text,
  model_name text,
  profile_id text,
  prompt_version text,
  evaluator_version text,
  configuration_fingerprint text,
  source_occurred_at timestamptz not null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_ai_eval_work_item_surface check (
    surface in ('answer_coaching', 'coach_update', 'question_wording')
  ),
  constraint chk_ai_eval_work_item_source_kind check (
    source_kind in (
      'candidate_answer_evaluation',
      'invited_answer_evaluation',
      'candidate_coach_update',
      'candidate_question_wording',
      'recruiter_question_wording'
    )
  ),
  constraint chk_ai_eval_work_item_exact_source check (
    num_nonnulls(
      candidate_answer_evaluation_run_id,
      invited_answer_evaluation_run_id,
      candidate_coach_update_artifact_id,
      candidate_question_wording_role_profile_id,
      recruiter_question_wording_set_id
    ) = 1
  ),
  constraint chk_ai_eval_work_item_source_shape check (
    (source_kind = 'candidate_answer_evaluation'
      and surface = 'answer_coaching'
      and candidate_answer_evaluation_run_id is not null)
    or
    (source_kind = 'invited_answer_evaluation'
      and surface = 'answer_coaching'
      and invited_answer_evaluation_run_id is not null)
    or
    (source_kind = 'candidate_coach_update'
      and surface = 'coach_update'
      and candidate_coach_update_artifact_id is not null)
    or
    (source_kind = 'candidate_question_wording'
      and surface = 'question_wording'
      and candidate_question_wording_role_profile_id is not null)
    or
    (source_kind = 'recruiter_question_wording'
      and surface = 'question_wording'
      and recruiter_question_wording_set_id is not null)
  ),
  constraint chk_ai_eval_work_item_selection_reason check (
    selection_reason in ('production_sample', 'provider_failure', 'manual', 'golden', 'incident')
  ),
  constraint chk_ai_eval_work_item_lifecycle check (
    lifecycle_state in ('queued', 'in_review', 'reviewed', 'remediation_in_progress', 'verified', 'closed')
  ),
  constraint chk_ai_eval_work_item_priority check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint chk_ai_eval_work_item_source_lifecycle check (length(trim(source_lifecycle_state)) > 0),
  constraint chk_ai_eval_work_item_audience check (
    audience in ('candidate_led', 'invited', 'recruiter_invite')
  ),
  constraint chk_ai_eval_work_item_interview_stage check (
    interview_stage is null or length(trim(interview_stage)) > 0
  ),
  constraint chk_ai_eval_work_item_question_category check (
    question_category is null or length(trim(question_category)) > 0
  ),
  constraint chk_ai_eval_work_item_failure_code check (
    source_failure_code is null or length(trim(source_failure_code)) > 0
  ),
  constraint chk_ai_eval_work_item_provider check (provider is null or length(trim(provider)) > 0),
  constraint chk_ai_eval_work_item_model check (model_name is null or length(trim(model_name)) > 0),
  constraint chk_ai_eval_work_item_profile check (profile_id is null or length(trim(profile_id)) > 0),
  constraint chk_ai_eval_work_item_prompt check (prompt_version is null or length(trim(prompt_version)) > 0),
  constraint chk_ai_eval_work_item_evaluator check (evaluator_version is null or length(trim(evaluator_version)) > 0),
  constraint chk_ai_eval_work_item_configuration check (
    configuration_fingerprint is null or configuration_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint chk_ai_eval_work_item_revision check (revision > 0)
);

create unique index if not exists uq_ai_eval_work_items_candidate_answer_source
  on public.ai_eval_work_items(candidate_answer_evaluation_run_id)
  where candidate_answer_evaluation_run_id is not null;

create unique index if not exists uq_ai_eval_work_items_invited_answer_source
  on public.ai_eval_work_items(invited_answer_evaluation_run_id)
  where invited_answer_evaluation_run_id is not null;

create unique index if not exists uq_ai_eval_work_items_coach_update_source
  on public.ai_eval_work_items(candidate_coach_update_artifact_id)
  where candidate_coach_update_artifact_id is not null;

create unique index if not exists uq_ai_eval_work_items_candidate_question_source
  on public.ai_eval_work_items(candidate_question_wording_role_profile_id)
  where candidate_question_wording_role_profile_id is not null;

create unique index if not exists uq_ai_eval_work_items_recruiter_question_source
  on public.ai_eval_work_items(recruiter_question_wording_set_id)
  where recruiter_question_wording_set_id is not null;

create index if not exists idx_ai_eval_work_items_queue
  on public.ai_eval_work_items(lifecycle_state, priority, source_occurred_at desc);

create index if not exists idx_ai_eval_work_items_configuration
  on public.ai_eval_work_items(surface, configuration_fingerprint, source_occurred_at desc);

create index if not exists idx_ai_eval_work_items_operator_filters
  on public.ai_eval_work_items(
    surface,
    audience,
    interview_stage,
    question_category,
    source_lifecycle_state,
    source_occurred_at desc
  );

create or replace function public.validate_ai_eval_work_item()
returns trigger
language plpgsql
as $$
declare
  v_source_lifecycle text;
  v_audience text;
  v_interview_stage text;
  v_question_category text;
  v_source_failure_code text;
  v_provider text;
  v_model_name text;
  v_profile_id text;
  v_prompt_version text;
  v_evaluator_version text;
  v_configuration_fingerprint text;
  v_source_occurred_at timestamptz;
begin
  if not public.is_active_ai_eval_operator(new.last_updated_by_operator_user_id) then
    raise exception 'AI-eval work item mutation requires an active individual operator grant'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.created_by_operator_user_id <> new.last_updated_by_operator_user_id then
      raise exception 'AI-eval work item creator must be its initial operator'
        using errcode = '23514';
    end if;
  end if;

  if new.assigned_operator_user_id is not null
     and not public.is_active_ai_eval_operator(new.assigned_operator_user_id) then
    raise exception 'AI-eval work item assignee requires an active individual operator grant'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if row(
      new.ai_eval_work_item_id,
      new.source_kind,
      new.candidate_answer_evaluation_run_id,
      new.invited_answer_evaluation_run_id,
      new.candidate_coach_update_artifact_id,
      new.candidate_question_wording_role_profile_id,
      new.recruiter_question_wording_set_id,
      new.selection_reason,
      new.created_by_operator_user_id,
      new.created_at
    ) is distinct from row(
      old.ai_eval_work_item_id,
      old.source_kind,
      old.candidate_answer_evaluation_run_id,
      old.invited_answer_evaluation_run_id,
      old.candidate_coach_update_artifact_id,
      old.candidate_question_wording_role_profile_id,
      old.recruiter_question_wording_set_id,
      old.selection_reason,
      old.created_by_operator_user_id,
      old.created_at
    ) then
      raise exception 'AI-eval work item source identity is immutable'
        using errcode = '55000';
    end if;
    if new.revision <> old.revision + 1 then
      raise exception 'AI-eval work item revision must advance by one'
        using errcode = '40001';
    end if;
  end if;

  case new.source_kind
    when 'candidate_answer_evaluation' then
      select
        run.lifecycle_state,
        'candidate_led',
        session.setup_snapshot_json ->> 'interviewStage',
        coalesce(
          (
            select slot ->> 'category'
            from jsonb_array_elements(
              case
                when jsonb_typeof(session.question_plan_snapshot_json -> 'slots') = 'array'
                  then session.question_plan_snapshot_json -> 'slots'
                else '[]'::jsonb
              end
            ) slot
            where slot ->> 'id' = attempt.question_slot_id
            limit 1
          ),
          (
            select question ->> 'category'
            from jsonb_array_elements(
              case
                when jsonb_typeof(session.question_wording_snapshot_json -> 'questions') = 'array'
                  then session.question_wording_snapshot_json -> 'questions'
                else '[]'::jsonb
              end
            ) question
            where question ->> 'slotId' = attempt.question_slot_id
            limit 1
          )
        ),
        run.error_code,
        run.provider,
        run.model_name,
        run.configuration_manifest_json ->> 'profileId',
        run.prompt_version,
        run.evaluator_version,
        run.configuration_fingerprint,
        run.requested_at
      into
        v_source_lifecycle,
        v_audience,
        v_interview_stage,
        v_question_category,
        v_source_failure_code,
        v_provider,
        v_model_name,
        v_profile_id,
        v_prompt_version,
        v_evaluator_version,
        v_configuration_fingerprint,
        v_source_occurred_at
      from public.candidate_answer_evaluation_runs run
      join public.candidate_answer_attempts attempt
        on attempt.candidate_answer_attempt_id = run.candidate_answer_attempt_id
      join public.candidate_practice_sessions session
        on session.candidate_practice_session_id = attempt.candidate_practice_session_id
      where run.candidate_answer_evaluation_run_id = new.candidate_answer_evaluation_run_id
        and run.purpose = 'candidate_coaching'
        and run.lifecycle_state in ('completed', 'failed', 'rejected');
    when 'invited_answer_evaluation' then
      select
        run.lifecycle_state,
        'invited',
        session.setup_snapshot_json ->> 'interviewStage',
        coalesce(
          (
            select slot ->> 'category'
            from jsonb_array_elements(
              case
                when jsonb_typeof(session.question_plan_snapshot_json -> 'slots') = 'array'
                  then session.question_plan_snapshot_json -> 'slots'
                else '[]'::jsonb
              end
            ) slot
            where slot ->> 'id' = attempt.question_slot_id
            limit 1
          ),
          (
            select question ->> 'category'
            from jsonb_array_elements(
              case
                when jsonb_typeof(session.question_wording_snapshot_json -> 'questions') = 'array'
                  then session.question_wording_snapshot_json -> 'questions'
                else '[]'::jsonb
              end
            ) question
            where question ->> 'slotId' = attempt.question_slot_id
            limit 1
          )
        ),
        run.error_code,
        run.provider,
        run.model_name,
        run.configuration_manifest_json ->> 'profileId',
        run.prompt_version,
        run.evaluator_version,
        run.configuration_fingerprint,
        run.requested_at
      into
        v_source_lifecycle,
        v_audience,
        v_interview_stage,
        v_question_category,
        v_source_failure_code,
        v_provider,
        v_model_name,
        v_profile_id,
        v_prompt_version,
        v_evaluator_version,
        v_configuration_fingerprint,
        v_source_occurred_at
      from public.invited_practice_answer_evaluation_runs run
      join public.invited_practice_answer_attempts attempt
        on attempt.invited_practice_answer_attempt_id = run.invited_practice_answer_attempt_id
      join public.invited_practice_sessions session
        on session.invited_practice_session_id = attempt.invited_practice_session_id
      where run.invited_practice_answer_evaluation_run_id = new.invited_answer_evaluation_run_id
        and run.purpose = 'candidate_coaching'
        and run.lifecycle_state in ('completed', 'failed', 'rejected');
    when 'candidate_coach_update' then
      select
        artifact.lifecycle_state,
        'candidate_led',
        session.setup_snapshot_json ->> 'interviewStage',
        null,
        artifact.error_code,
        artifact.provider,
        artifact.model_name,
        artifact.profile_id,
        artifact.prompt_version,
        artifact.evaluator_version,
        artifact.configuration_fingerprint,
        artifact.requested_at
      into
        v_source_lifecycle,
        v_audience,
        v_interview_stage,
        v_question_category,
        v_source_failure_code,
        v_provider,
        v_model_name,
        v_profile_id,
        v_prompt_version,
        v_evaluator_version,
        v_configuration_fingerprint,
        v_source_occurred_at
      from public.candidate_coach_update_artifacts artifact
      join public.candidate_practice_sessions session
        on session.candidate_practice_session_id = artifact.source_candidate_practice_session_id
      where artifact.candidate_coach_update_artifact_id = new.candidate_coach_update_artifact_id
        and artifact.lifecycle_state in ('completed', 'failed', 'rejected');
    when 'candidate_question_wording' then
      select
        'completed',
        'candidate_led',
        profile.rigor_baseline_snapshot_json ->> 'interviewStage',
        null,
        null,
        nullif(profile.rigor_baseline_question_wording_snapshot_json #>> '{generation,provider}', ''),
        nullif(profile.rigor_baseline_question_wording_snapshot_json #>> '{generation,modelName}', ''),
        nullif(profile.rigor_baseline_question_wording_snapshot_json #>> '{generation,profileId}', ''),
        nullif(profile.rigor_baseline_question_wording_snapshot_json #>> '{generation,promptVersion}', ''),
        null,
        nullif(profile.rigor_baseline_question_wording_snapshot_json #>> '{generation,configurationFingerprint}', ''),
        profile.created_at
      into
        v_source_lifecycle,
        v_audience,
        v_interview_stage,
        v_question_category,
        v_source_failure_code,
        v_provider,
        v_model_name,
        v_profile_id,
        v_prompt_version,
        v_evaluator_version,
        v_configuration_fingerprint,
        v_source_occurred_at
      from public.candidate_role_preparation_profiles profile
      where profile.role_profile_id = new.candidate_question_wording_role_profile_id
        and profile.rigor_baseline_question_wording_snapshot_json ->> 'status' = 'questions_worded';
    when 'recruiter_question_wording' then
      select
        question_set.lifecycle_state,
        'recruiter_invite',
        question_set.interview_stage,
        null,
        question_set.failure_code,
        nullif(question_set.question_wording_snapshot_json #>> '{generation,provider}', ''),
        nullif(question_set.question_wording_snapshot_json #>> '{generation,modelName}', ''),
        nullif(question_set.question_wording_snapshot_json #>> '{generation,profileId}', ''),
        nullif(question_set.question_wording_snapshot_json #>> '{generation,promptVersion}', ''),
        null,
        nullif(question_set.question_wording_snapshot_json #>> '{generation,configurationFingerprint}', ''),
        question_set.created_at
      into
        v_source_lifecycle,
        v_audience,
        v_interview_stage,
        v_question_category,
        v_source_failure_code,
        v_provider,
        v_model_name,
        v_profile_id,
        v_prompt_version,
        v_evaluator_version,
        v_configuration_fingerprint,
        v_source_occurred_at
      from public.recruiter_invitation_question_sets question_set
      where question_set.recruiter_invitation_question_set_id = new.recruiter_question_wording_set_id
        and question_set.source = 'generated'
        and question_set.lifecycle_state in ('ready', 'failed');
  end case;

  if v_source_lifecycle is null or v_source_occurred_at is null then
    raise exception 'AI-eval work item requires one eligible terminal serving source'
      using errcode = '23514';
  end if;

  new.source_lifecycle_state := v_source_lifecycle;
  new.audience := v_audience;
  new.interview_stage := v_interview_stage;
  new.question_category := v_question_category;
  new.source_failure_code := v_source_failure_code;
  new.provider := v_provider;
  new.model_name := v_model_name;
  new.profile_id := v_profile_id;
  new.prompt_version := v_prompt_version;
  new.evaluator_version := v_evaluator_version;
  new.configuration_fingerprint := v_configuration_fingerprint;
  new.source_occurred_at := v_source_occurred_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ai_eval_work_item_validation on public.ai_eval_work_items;
create trigger trg_ai_eval_work_item_validation
before insert or update on public.ai_eval_work_items
for each row execute function public.validate_ai_eval_work_item();

create table if not exists public.ai_eval_reviews (
  ai_eval_review_id uuid primary key default gen_random_uuid(),
  ai_eval_work_item_id uuid not null references public.ai_eval_work_items(ai_eval_work_item_id) on delete cascade,
  reviewer_user_id uuid not null references public.app_users(user_id) on delete restrict,
  rubric_version text not null,
  lifecycle_state text not null default 'draft',
  disposition text,
  severity text,
  confidence text,
  layer_judgments_json jsonb not null default '{}'::jsonb,
  review_summary text,
  revision integer not null default 1,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_ai_eval_review_rubric check (length(trim(rubric_version)) > 0),
  constraint chk_ai_eval_review_lifecycle check (lifecycle_state in ('draft', 'submitted')),
  constraint chk_ai_eval_review_disposition check (
    disposition is null or disposition in (
      'acceptable',
      'acceptable_with_observation',
      'needs_improvement',
      'unsafe_or_blocking',
      'unable_to_assess'
    )
  ),
  constraint chk_ai_eval_review_severity check (
    severity is null or severity in ('informational', 'minor', 'major', 'blocking')
  ),
  constraint chk_ai_eval_review_confidence check (
    confidence is null or confidence in ('low', 'medium', 'high')
  ),
  constraint chk_ai_eval_review_judgments check (jsonb_typeof(layer_judgments_json) = 'object'),
  constraint chk_ai_eval_review_summary check (
    review_summary is null or length(trim(review_summary)) between 1 and 4000
  ),
  constraint chk_ai_eval_review_revision check (revision > 0),
  constraint chk_ai_eval_review_submission check (
    (lifecycle_state = 'draft' and submitted_at is null)
    or
    (lifecycle_state = 'submitted'
      and disposition is not null
      and severity is not null
      and confidence is not null
      and submitted_at is not null)
  )
);

create unique index if not exists uq_ai_eval_reviews_active_draft
  on public.ai_eval_reviews(ai_eval_work_item_id, reviewer_user_id)
  where lifecycle_state = 'draft';

create index if not exists idx_ai_eval_reviews_work_item
  on public.ai_eval_reviews(ai_eval_work_item_id, created_at desc);

create or replace function public.validate_ai_eval_review()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.lifecycle_state = 'submitted' then
      raise exception 'submitted AI-eval reviews are immutable'
        using errcode = '55000';
    end if;
    return old;
  end if;

  if not public.is_active_ai_eval_operator(new.reviewer_user_id) then
    raise exception 'AI-eval review requires an active individual operator grant'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_each_text(new.layer_judgments_json) judgment
    where length(trim(judgment.key)) = 0
      or length(judgment.key) > 120
      or judgment.value not in (
        'correct',
        'partly_correct',
        'incorrect',
        'not_applicable',
        'unable_to_assess'
      )
  ) then
    raise exception 'AI-eval review contains an invalid layer judgment'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if old.lifecycle_state = 'submitted' then
      raise exception 'submitted AI-eval reviews are immutable'
        using errcode = '55000';
    end if;
    if row(new.ai_eval_review_id, new.ai_eval_work_item_id, new.reviewer_user_id, new.created_at)
       is distinct from
       row(old.ai_eval_review_id, old.ai_eval_work_item_id, old.reviewer_user_id, old.created_at) then
      raise exception 'AI-eval review identity is immutable'
        using errcode = '55000';
    end if;
    if new.revision <> old.revision + 1 then
      raise exception 'AI-eval review revision must advance by one'
        using errcode = '40001';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ai_eval_review_validation on public.ai_eval_reviews;
create trigger trg_ai_eval_review_validation
before insert or update or delete on public.ai_eval_reviews
for each row execute function public.validate_ai_eval_review();

create table if not exists public.ai_eval_failure_label_catalog (
  failure_label_version text not null,
  failure_label text not null,
  layer text not null,
  description text not null,
  lifecycle_state text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (failure_label_version, failure_label, layer),
  constraint chk_ai_eval_failure_label_catalog_version check (length(trim(failure_label_version)) > 0),
  constraint chk_ai_eval_failure_label_catalog_label check (failure_label ~ '^[a-z0-9_]{3,120}$'),
  constraint chk_ai_eval_failure_label_catalog_layer check (
    layer in (
      'source_context', 'answer_usability', 'evidence_span', 'observable_marker',
      'category_signal', 'criterion_appraisal', 'technical_accuracy', 'pattern_gap',
      'verification', 'feedback_composition', 'candidate_projection', 'coach_update',
      'question_wording', 'question_set', 'schema_lifecycle', 'safety'
    )
  ),
  constraint chk_ai_eval_failure_label_catalog_description check (length(trim(description)) between 1 and 500),
  constraint chk_ai_eval_failure_label_catalog_lifecycle check (lifecycle_state in ('active', 'retired'))
);

insert into public.ai_eval_failure_label_catalog (
  failure_label_version,
  failure_label,
  layer,
  description
)
values
  ('ai_eval_failure_labels_v1', 'context_missing', 'source_context', 'Required source context was absent.'),
  ('ai_eval_failure_labels_v1', 'context_excessive', 'source_context', 'Unnecessary context weakened or distorted the output.'),
  ('ai_eval_failure_labels_v1', 'context_stale', 'source_context', 'The output relied on stale context.'),
  ('ai_eval_failure_labels_v1', 'context_mismapped', 'source_context', 'Context was attached to the wrong source fact.'),
  ('ai_eval_failure_labels_v1', 'usability_classification_error', 'answer_usability', 'Answer usability was classified incorrectly.'),
  ('ai_eval_failure_labels_v1', 'evidence_span_miss', 'evidence_span', 'A supportable exact span was not identified.'),
  ('ai_eval_failure_labels_v1', 'evidence_span_false_positive', 'evidence_span', 'An identified span did not support the linked claim.'),
  ('ai_eval_failure_labels_v1', 'evidence_span_unsafe', 'evidence_span', 'A span was unsafe or inappropriate to surface.'),
  ('ai_eval_failure_labels_v1', 'observable_marker_miss', 'observable_marker', 'An observable marker was not identified.'),
  ('ai_eval_failure_labels_v1', 'observable_marker_false_positive', 'observable_marker', 'A marker was inferred without support.'),
  ('ai_eval_failure_labels_v1', 'category_signal_miss', 'category_signal', 'A category-specific signal was not identified.'),
  ('ai_eval_failure_labels_v1', 'category_signal_false_positive', 'category_signal', 'A category-specific signal was inferred without support.'),
  ('ai_eval_failure_labels_v1', 'category_signal_mismatch', 'category_signal', 'The signal lens did not match the question category.'),
  ('ai_eval_failure_labels_v1', 'criterion_applicability_error', 'criterion_appraisal', 'A criterion was applied or omitted incorrectly.'),
  ('ai_eval_failure_labels_v1', 'criterion_evidence_link_error', 'criterion_appraisal', 'A criterion judgment was linked to the wrong evidence.'),
  ('ai_eval_failure_labels_v1', 'criterion_band_error', 'criterion_appraisal', 'The qualitative criterion band did not match the evidence.'),
  ('ai_eval_failure_labels_v1', 'technical_reference_error', 'technical_accuracy', 'The technical reference was missing, unsuitable, or misused.'),
  ('ai_eval_failure_labels_v1', 'technical_accuracy_error', 'technical_accuracy', 'Technical accuracy was judged incorrectly.'),
  ('ai_eval_failure_labels_v1', 'pattern_gap_priority_error', 'pattern_gap', 'The primary pattern or gap was prioritized incorrectly.'),
  ('ai_eval_failure_labels_v1', 'verification_skipped', 'verification', 'Verification was required but skipped.'),
  ('ai_eval_failure_labels_v1', 'verification_unnecessary', 'verification', 'Verification was invoked when it was not needed.'),
  ('ai_eval_failure_labels_v1', 'verification_incorrect', 'verification', 'Verification produced an incorrect disposition.'),
  ('ai_eval_failure_labels_v1', 'feedback_ungrounded', 'feedback_composition', 'Feedback was not grounded in accepted evidence.'),
  ('ai_eval_failure_labels_v1', 'feedback_overclaimed', 'feedback_composition', 'Feedback claimed more than the evidence supports.'),
  ('ai_eval_failure_labels_v1', 'feedback_generic', 'feedback_composition', 'Feedback was too generic to be useful.'),
  ('ai_eval_failure_labels_v1', 'feedback_contradictory', 'feedback_composition', 'Feedback contradicted source or evaluator facts.'),
  ('ai_eval_failure_labels_v1', 'feedback_unnatural', 'feedback_composition', 'Feedback language was awkward or unnatural.'),
  ('ai_eval_failure_labels_v1', 'feedback_unsafe', 'feedback_composition', 'Feedback crossed a safety or product boundary.'),
  ('ai_eval_failure_labels_v1', 'feedback_unactionable', 'feedback_composition', 'Feedback did not offer a useful next move.'),
  ('ai_eval_failure_labels_v1', 'candidate_projection_error', 'candidate_projection', 'The candidate-visible projection omitted or changed approved facts.'),
  ('ai_eval_failure_labels_v1', 'coach_update_source_omission', 'coach_update', 'Coach Update omitted material accepted source evidence.'),
  ('ai_eval_failure_labels_v1', 'coach_update_contradiction', 'coach_update', 'Coach Update contradicted its accepted source evidence.'),
  ('ai_eval_failure_labels_v1', 'coach_update_unsupported_progression', 'coach_update', 'Coach Update claimed progression without comparable evidence.'),
  ('ai_eval_failure_labels_v1', 'coach_update_weak_feedforward', 'coach_update', 'Coach Update did not provide a useful next-practice direction.'),
  ('ai_eval_failure_labels_v1', 'question_ungrounded', 'question_wording', 'A generated question was not grounded in allowed context.'),
  ('ai_eval_failure_labels_v1', 'question_category_purpose_mismatch', 'question_wording', 'Question wording did not match its planned category or purpose.'),
  ('ai_eval_failure_labels_v1', 'question_over_specific', 'question_wording', 'A question assumed unsupported candidate experience or detail.'),
  ('ai_eval_failure_labels_v1', 'question_ambiguous', 'question_wording', 'A question did not ask one clear answerable thing.'),
  ('ai_eval_failure_labels_v1', 'question_inaccessible', 'question_wording', 'Question wording created an avoidable accessibility or comprehension barrier.'),
  ('ai_eval_failure_labels_v1', 'question_repetitive', 'question_wording', 'A question substantially duplicated another item.'),
  ('ai_eval_failure_labels_v1', 'question_unsafe', 'question_wording', 'A question crossed a legal, bias, privacy, or safety boundary.'),
  ('ai_eval_failure_labels_v1', 'question_set_coverage_weak', 'question_set', 'The generated set did not satisfy planned diversity or coverage.'),
  ('ai_eval_failure_labels_v1', 'schema_failure', 'schema_lifecycle', 'The output violated its required schema.'),
  ('ai_eval_failure_labels_v1', 'lifecycle_failure', 'schema_lifecycle', 'The generation lifecycle produced an invalid state transition.'),
  ('ai_eval_failure_labels_v1', 'serving_failure', 'schema_lifecycle', 'A valid artifact did not reach the intended serving surface.'),
  ('ai_eval_failure_labels_v1', 'unsafe_output', 'safety', 'The output violated a safety, privacy, legal, or product boundary.')
on conflict (failure_label_version, failure_label, layer) do nothing;

create table if not exists public.ai_eval_findings (
  ai_eval_finding_id uuid primary key default gen_random_uuid(),
  creation_request_key uuid not null,
  ai_eval_review_id uuid not null references public.ai_eval_reviews(ai_eval_review_id) on delete cascade,
  created_by_operator_user_id uuid not null references public.app_users(user_id) on delete restrict,
  layer text not null,
  failure_label text not null,
  failure_label_version text not null default 'ai_eval_failure_labels_v1',
  severity text not null,
  source_reference_json jsonb not null default '{}'::jsonb,
  rationale text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_ai_eval_finding_layer check (
    layer in (
      'source_context',
      'answer_usability',
      'evidence_span',
      'observable_marker',
      'category_signal',
      'criterion_appraisal',
      'technical_accuracy',
      'pattern_gap',
      'verification',
      'feedback_composition',
      'candidate_projection',
      'coach_update',
      'question_wording',
      'question_set',
      'schema_lifecycle',
      'safety'
    )
  ),
  constraint chk_ai_eval_finding_label check (length(trim(failure_label)) between 1 and 120),
  constraint chk_ai_eval_finding_label_version check (length(trim(failure_label_version)) > 0),
  constraint chk_ai_eval_finding_severity check (severity in ('informational', 'minor', 'major', 'blocking')),
  constraint chk_ai_eval_finding_reference check (jsonb_typeof(source_reference_json) = 'object'),
  constraint chk_ai_eval_finding_rationale check (length(trim(rationale)) between 1 and 4000)
);

alter table public.ai_eval_findings
  add column if not exists creation_request_key uuid;

update public.ai_eval_findings
set creation_request_key = gen_random_uuid()
where creation_request_key is null;

alter table public.ai_eval_findings
  alter column creation_request_key set not null;

create unique index if not exists uq_ai_eval_findings_review_request
  on public.ai_eval_findings(ai_eval_review_id, creation_request_key);

do $$
begin
  alter table public.ai_eval_findings
    add constraint fk_ai_eval_finding_label_catalog
    foreign key (failure_label_version, failure_label, layer)
    references public.ai_eval_failure_label_catalog(failure_label_version, failure_label, layer)
    on delete restrict;
exception
  when duplicate_object then null;
end;
$$;

create index if not exists idx_ai_eval_findings_review
  on public.ai_eval_findings(ai_eval_review_id, created_at);

create index if not exists idx_ai_eval_findings_label
  on public.ai_eval_findings(failure_label_version, failure_label, severity);

create or replace function public.validate_ai_eval_finding_mutation()
returns trigger
language plpgsql
as $$
declare
  v_review_state text;
  v_reviewer_user_id uuid;
begin
  select review.lifecycle_state, review.reviewer_user_id
  into v_review_state, v_reviewer_user_id
  from public.ai_eval_reviews review
  where review.ai_eval_review_id = coalesce(new.ai_eval_review_id, old.ai_eval_review_id);

  if v_review_state <> 'draft' then
    raise exception 'AI-eval findings are mutable only while their review is draft'
      using errcode = '55000';
  end if;

  if tg_op <> 'DELETE' then
    if new.created_by_operator_user_id <> v_reviewer_user_id
       or not public.is_active_ai_eval_operator(new.created_by_operator_user_id) then
      raise exception 'AI-eval finding author must be the active review operator'
        using errcode = '42501';
    end if;
    if exists (
      select 1
      from jsonb_each(new.source_reference_json) reference
      where reference.key not in (
          'spanId', 'slotId', 'questionIndex', 'criterionId',
          'markerId', 'signalId', 'fieldPath'
        )
        or jsonb_typeof(reference.value) not in ('string', 'number')
        or (
          jsonb_typeof(reference.value) = 'string'
          and length(trim(reference.value #>> '{}')) > 200
        )
    ) then
      raise exception 'AI-eval finding source references allow only bounded source pointers'
        using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and row(
      new.ai_eval_finding_id,
      new.ai_eval_review_id,
      new.creation_request_key,
      new.created_by_operator_user_id,
      new.created_at
    ) is distinct from row(
      old.ai_eval_finding_id,
      old.ai_eval_review_id,
      old.creation_request_key,
      old.created_by_operator_user_id,
      old.created_at
    ) then
      raise exception 'AI-eval finding identity is immutable'
        using errcode = '55000';
    end if;
    new.updated_at := now();
    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_ai_eval_finding_validation on public.ai_eval_findings;
create trigger trg_ai_eval_finding_validation
before insert or update or delete on public.ai_eval_findings
for each row execute function public.validate_ai_eval_finding_mutation();

create table if not exists public.ai_eval_remediations (
  ai_eval_remediation_id uuid primary key default gen_random_uuid(),
  created_by_operator_user_id uuid not null references public.app_users(user_id) on delete restrict,
  owner_operator_user_id uuid not null references public.app_users(user_id) on delete restrict,
  last_updated_by_operator_user_id uuid not null references public.app_users(user_id) on delete restrict,
  lifecycle_state text not null default 'observed',
  target_component text not null,
  title text not null,
  hypothesis text not null,
  expected_change text not null,
  regression_risks text not null,
  changed_reference text,
  verification_note text,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_ai_eval_remediation_lifecycle check (
    lifecycle_state in (
      'observed',
      'triaged',
      'planned',
      'changed',
      'ready_for_recheck',
      'verified',
      'wont_fix',
      'duplicate'
    )
  ),
  constraint chk_ai_eval_remediation_target check (
    target_component in (
      'context_assembly',
      'evidence_extraction',
      'exact_span_validation',
      'marker_derivation',
      'category_signal_lens',
      'criterion_appraisal',
      'pattern_gap_prioritization',
      'technical_reference_policy',
      'verification',
      'feedback_composition',
      'candidate_safe_projection',
      'coach_update_synthesis',
      'question_plan',
      'question_wording',
      'ui_rendering',
      'product_specification',
      'test_coverage'
    )
  ),
  constraint chk_ai_eval_remediation_title check (length(trim(title)) between 1 and 180),
  constraint chk_ai_eval_remediation_hypothesis check (length(trim(hypothesis)) between 1 and 4000),
  constraint chk_ai_eval_remediation_expected check (length(trim(expected_change)) between 1 and 4000),
  constraint chk_ai_eval_remediation_risk check (length(trim(regression_risks)) between 1 and 4000),
  constraint chk_ai_eval_remediation_changed_ref check (
    changed_reference is null or length(trim(changed_reference)) between 1 and 500
  ),
  constraint chk_ai_eval_remediation_verification check (
    verification_note is null or length(trim(verification_note)) between 1 and 4000
  ),
  constraint chk_ai_eval_remediation_revision check (revision > 0)
);

create index if not exists idx_ai_eval_remediations_lifecycle
  on public.ai_eval_remediations(lifecycle_state, updated_at desc);

create or replace function public.validate_ai_eval_remediation()
returns trigger
language plpgsql
as $$
begin
  if not public.is_active_ai_eval_operator(new.last_updated_by_operator_user_id) then
    raise exception 'AI-eval remediation mutation requires an active individual operator grant'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT'
     and new.created_by_operator_user_id <> new.last_updated_by_operator_user_id then
    raise exception 'AI-eval remediation creator must be its initial operator'
      using errcode = '23514';
  end if;

  if not public.is_active_ai_eval_operator(new.owner_operator_user_id) then
    raise exception 'AI-eval remediation owner requires an active individual operator grant'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if row(new.ai_eval_remediation_id, new.created_by_operator_user_id, new.created_at)
       is distinct from
       row(old.ai_eval_remediation_id, old.created_by_operator_user_id, old.created_at) then
      raise exception 'AI-eval remediation identity is immutable'
        using errcode = '55000';
    end if;
    if new.revision <> old.revision + 1 then
      raise exception 'AI-eval remediation revision must advance by one'
        using errcode = '40001';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ai_eval_remediation_validation on public.ai_eval_remediations;
create trigger trg_ai_eval_remediation_validation
before insert or update on public.ai_eval_remediations
for each row execute function public.validate_ai_eval_remediation();

create table if not exists public.ai_eval_remediation_findings (
  ai_eval_remediation_id uuid not null
    references public.ai_eval_remediations(ai_eval_remediation_id) on delete cascade,
  ai_eval_finding_id uuid not null
    references public.ai_eval_findings(ai_eval_finding_id) on delete cascade,
  linked_by_operator_user_id uuid not null references public.app_users(user_id) on delete restrict,
  linked_at timestamptz not null default now(),
  primary key (ai_eval_remediation_id, ai_eval_finding_id)
);

create or replace function public.validate_ai_eval_remediation_finding_link()
returns trigger
language plpgsql
as $$
declare
  v_review_state text;
begin
  select review.lifecycle_state
  into v_review_state
  from public.ai_eval_findings finding
  join public.ai_eval_reviews review on review.ai_eval_review_id = finding.ai_eval_review_id
  where finding.ai_eval_finding_id = coalesce(new.ai_eval_finding_id, old.ai_eval_finding_id);

  if v_review_state <> 'submitted' then
    raise exception 'AI-eval remediations may link only submitted review findings'
      using errcode = '23514';
  end if;

  if tg_op <> 'DELETE' and not public.is_active_ai_eval_operator(new.linked_by_operator_user_id) then
    raise exception 'AI-eval remediation finding link requires an active operator grant'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ai_eval_remediation_finding_link
  on public.ai_eval_remediation_findings;
create trigger trg_ai_eval_remediation_finding_link
before insert or delete on public.ai_eval_remediation_findings
for each row execute function public.validate_ai_eval_remediation_finding_link();

create or replace function public.audit_ai_eval_workflow_mutation()
returns trigger
language plpgsql
as $$
declare
  v_user_id uuid;
  v_event_type text;
  v_entity_id uuid;
  v_action text;
begin
  v_action := lower(tg_op);

  if tg_table_name = 'ai_eval_work_items' then
    v_user_id := coalesce(new.last_updated_by_operator_user_id, old.last_updated_by_operator_user_id);
    v_event_type := 'ai_eval_work_item_mutated';
    v_entity_id := coalesce(new.ai_eval_work_item_id, old.ai_eval_work_item_id);
  elsif tg_table_name = 'ai_eval_reviews' then
    v_user_id := coalesce(new.reviewer_user_id, old.reviewer_user_id);
    v_event_type := 'ai_eval_review_mutated';
    v_entity_id := coalesce(new.ai_eval_review_id, old.ai_eval_review_id);
  elsif tg_table_name = 'ai_eval_findings' then
    v_user_id := coalesce(new.created_by_operator_user_id, old.created_by_operator_user_id);
    v_event_type := 'ai_eval_finding_mutated';
    v_entity_id := coalesce(new.ai_eval_finding_id, old.ai_eval_finding_id);
  elsif tg_table_name = 'ai_eval_remediations' then
    v_user_id := coalesce(new.last_updated_by_operator_user_id, old.last_updated_by_operator_user_id);
    v_event_type := 'ai_eval_remediation_mutated';
    v_entity_id := coalesce(new.ai_eval_remediation_id, old.ai_eval_remediation_id);
  else
    v_user_id := coalesce(new.linked_by_operator_user_id, old.linked_by_operator_user_id);
    v_event_type := 'ai_eval_remediation_link_mutated';
    v_entity_id := coalesce(new.ai_eval_remediation_id, old.ai_eval_remediation_id);
  end if;

  insert into public.auth_audit_events (user_id, event_type, outcome, metadata)
  values (
    v_user_id,
    v_event_type,
    'success',
    jsonb_build_object(
      'action', v_action,
      'entity_id', v_entity_id
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.audit_ai_eval_operator_grant_mutation()
returns trigger
language plpgsql
as $$
declare
  v_action text;
  v_actor_user_id uuid;
begin
  v_action := case when tg_op = 'INSERT' then 'grant' else 'revoke' end;
  v_actor_user_id := case
    when tg_op = 'INSERT' then new.granted_by_user_id
    else new.revoked_by_user_id
  end;

  insert into public.auth_audit_events (user_id, event_type, outcome, metadata)
  values (
    v_actor_user_id,
    'ai_eval_operator_access_mutated',
    'success',
    jsonb_build_object(
      'action', v_action,
      'grant_id', new.ai_eval_operator_grant_id,
      'subject_user_id', new.user_id
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_ai_eval_operator_grant_audit
  on public.ai_eval_operator_grants;
create trigger trg_ai_eval_operator_grant_audit
after insert or update on public.ai_eval_operator_grants
for each row execute function public.audit_ai_eval_operator_grant_mutation();

drop trigger if exists trg_ai_eval_work_item_audit on public.ai_eval_work_items;
create trigger trg_ai_eval_work_item_audit
after insert or update on public.ai_eval_work_items
for each row execute function public.audit_ai_eval_workflow_mutation();

drop trigger if exists trg_ai_eval_review_audit on public.ai_eval_reviews;
create trigger trg_ai_eval_review_audit
after insert or update on public.ai_eval_reviews
for each row execute function public.audit_ai_eval_workflow_mutation();

drop trigger if exists trg_ai_eval_finding_audit on public.ai_eval_findings;
create trigger trg_ai_eval_finding_audit
after insert or update or delete on public.ai_eval_findings
for each row execute function public.audit_ai_eval_workflow_mutation();

drop trigger if exists trg_ai_eval_remediation_audit on public.ai_eval_remediations;
create trigger trg_ai_eval_remediation_audit
after insert or update on public.ai_eval_remediations
for each row execute function public.audit_ai_eval_workflow_mutation();

drop trigger if exists trg_ai_eval_remediation_link_audit
  on public.ai_eval_remediation_findings;
create trigger trg_ai_eval_remediation_link_audit
after insert or delete on public.ai_eval_remediation_findings
for each row execute function public.audit_ai_eval_workflow_mutation();

comment on table public.ai_eval_operator_grants is
  'Manually provisioned individual access to cross-owner AI-eval source content.';

comment on table public.ai_eval_work_items is
  'References one exact immutable V2 serving source without copying candidate/output content.';

comment on table public.ai_eval_reviews is
  'Revision-fenced human QA review; submitted rows are immutable.';

comment on table public.ai_eval_findings is
  'Structured actionable findings attached to one human review.';

comment on table public.ai_eval_remediations is
  'Operator-owned remediation hypotheses and lifecycle state.';
