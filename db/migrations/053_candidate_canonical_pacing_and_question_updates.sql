-- Canonical baseline V2 and question-settled Coach Update checkpoints.
-- Existing V1 baseline and completed-session artifacts remain readable compatibility rows.

alter table public.candidate_role_preparation_profiles
  drop constraint if exists chk_candidate_role_profiles_rigor_baseline_pair;

alter table public.candidate_role_preparation_profiles
  add constraint chk_candidate_role_profiles_rigor_baseline_pair check (
    (
      rigor_baseline_snapshot_json is null
      and rigor_baseline_question_wording_snapshot_json is null
    )
    or (
      rigor_baseline_snapshot_json is not null
      and rigor_baseline_question_wording_snapshot_json is not null
      and jsonb_typeof(rigor_baseline_snapshot_json) = 'object'
      and jsonb_typeof(rigor_baseline_question_wording_snapshot_json) = 'object'
      and rigor_baseline_snapshot_json ->> 'status' in (
        'candidate_practice_plan_baseline_v1',
        'candidate_practice_plan_baseline_v2'
      )
      and jsonb_typeof(rigor_baseline_snapshot_json -> 'questionCount') = 'number'
      and jsonb_typeof(rigor_baseline_snapshot_json -> 'slots') = 'array'
      and rigor_baseline_question_wording_snapshot_json ->> 'status' = 'questions_worded'
      and jsonb_typeof(rigor_baseline_question_wording_snapshot_json -> 'questions') = 'array'
      and jsonb_array_length(rigor_baseline_snapshot_json -> 'slots') =
        (rigor_baseline_snapshot_json ->> 'questionCount')::integer
      and jsonb_array_length(rigor_baseline_question_wording_snapshot_json -> 'questions') =
        (rigor_baseline_snapshot_json ->> 'questionCount')::integer
      and (
        rigor_baseline_snapshot_json ->> 'status' <> 'candidate_practice_plan_baseline_v2'
        or (
          jsonb_typeof(rigor_baseline_snapshot_json -> 'stageRecommendedQuestionCount') = 'number'
          and jsonb_typeof(rigor_baseline_snapshot_json -> 'paceSize') = 'number'
          and (rigor_baseline_snapshot_json ->> 'stageRecommendedQuestionCount')::integer between 3 and 10
          and (rigor_baseline_snapshot_json ->> 'paceSize')::integer between 3 and 10
          and (rigor_baseline_snapshot_json ->> 'questionCount')::integer >=
            (rigor_baseline_snapshot_json ->> 'stageRecommendedQuestionCount')::integer
          and (rigor_baseline_snapshot_json ->> 'paceSize')::integer <=
            (rigor_baseline_snapshot_json ->> 'questionCount')::integer
        )
      )
    )
  );

alter table public.candidate_coach_update_artifacts
  add column if not exists source_question_key text,
  add column if not exists source_answer_attempt_id uuid,
  add column if not exists source_accepted_evaluation_run_id uuid;

create unique index if not exists uq_candidate_answer_attempt_coach_update_source
  on public.candidate_answer_attempts(
    candidate_answer_attempt_id,
    candidate_practice_session_id,
    candidate_profile_id,
    question_slot_id
  );

create unique index if not exists uq_candidate_answer_evaluation_run_attempt_source
  on public.candidate_answer_evaluation_runs(
    candidate_answer_evaluation_run_id,
    candidate_answer_attempt_id
  );

alter table public.candidate_coach_update_artifacts
  drop constraint if exists fk_candidate_coach_update_source_answer_attempt,
  add constraint fk_candidate_coach_update_source_answer_attempt
    foreign key (
      source_answer_attempt_id,
      source_candidate_practice_session_id,
      candidate_profile_id,
      source_question_key
    )
    references public.candidate_answer_attempts(
      candidate_answer_attempt_id,
      candidate_practice_session_id,
      candidate_profile_id,
      question_slot_id
    )
    on delete cascade,
  drop constraint if exists fk_candidate_coach_update_source_evaluation_run,
  add constraint fk_candidate_coach_update_source_evaluation_run
    foreign key (source_accepted_evaluation_run_id, source_answer_attempt_id)
    references public.candidate_answer_evaluation_runs(
      candidate_answer_evaluation_run_id,
      candidate_answer_attempt_id
    )
    on delete cascade;

alter table public.candidate_coach_update_artifacts
  drop constraint if exists chk_candidate_coach_update_question_checkpoint;

alter table public.candidate_coach_update_artifacts
  add constraint chk_candidate_coach_update_question_checkpoint check (
    (
      source_question_key is null
      and source_answer_attempt_id is null
      and source_accepted_evaluation_run_id is null
    )
    or (
      length(trim(source_question_key)) > 0
      and source_answer_attempt_id is not null
      and source_accepted_evaluation_run_id is not null
      and source_answer_attempt_ids_json = jsonb_build_array(source_answer_attempt_id::text)
      and accepted_evaluation_run_ids_json = jsonb_build_array(source_accepted_evaluation_run_id::text)
    )
  );

alter table public.candidate_coach_update_artifacts
  drop constraint if exists uq_candidate_coach_update_generation_attempt;

create unique index if not exists uq_candidate_coach_update_legacy_generation_attempt
  on public.candidate_coach_update_artifacts(source_candidate_practice_session_id, generation_attempt)
  where source_question_key is null;

create unique index if not exists uq_candidate_coach_update_question_generation_attempt
  on public.candidate_coach_update_artifacts(
    source_candidate_practice_session_id,
    source_question_key,
    generation_attempt
  )
  where source_question_key is not null;

create index if not exists idx_candidate_coach_update_question_checkpoint
  on public.candidate_coach_update_artifacts(
    candidate_profile_id,
    role_profile_id,
    source_question_key,
    completed_at desc
  )
  where source_question_key is not null;

create or replace function public.validate_candidate_coach_update_artifact_transition()
returns trigger
language plpgsql
as $$
begin
  if old.lifecycle_state <> 'requested'
     or new.lifecycle_state not in ('completed', 'failed', 'rejected') then
    raise exception 'candidate Coach Update artifacts allow one requested-to-terminal transition'
      using errcode = '55000';
  end if;

  if row(
    new.candidate_coach_update_artifact_id,
    new.candidate_profile_id,
    new.role_profile_id,
    new.source_candidate_practice_session_id,
    new.source_question_key,
    new.source_answer_attempt_id,
    new.source_accepted_evaluation_run_id,
    new.source_completion_fingerprint,
    new.source_answer_attempt_ids_json,
    new.accepted_evaluation_run_ids_json,
    new.synthesis_input_fingerprint,
    new.provider,
    new.model_name,
    new.prompt_version,
    new.evaluator_version,
    new.profile_id,
    new.configuration_fingerprint,
    new.generation_attempt,
    new.requested_at,
    new.created_at
  ) is distinct from row(
    old.candidate_coach_update_artifact_id,
    old.candidate_profile_id,
    old.role_profile_id,
    old.source_candidate_practice_session_id,
    old.source_question_key,
    old.source_answer_attempt_id,
    old.source_accepted_evaluation_run_id,
    old.source_completion_fingerprint,
    old.source_answer_attempt_ids_json,
    old.accepted_evaluation_run_ids_json,
    old.synthesis_input_fingerprint,
    old.provider,
    old.model_name,
    old.prompt_version,
    old.evaluator_version,
    old.profile_id,
    old.configuration_fingerprint,
    old.generation_attempt,
    old.requested_at,
    old.created_at
  ) then
    raise exception 'candidate Coach Update artifact source and version metadata are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;
