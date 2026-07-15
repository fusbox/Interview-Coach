-- Versioned, candidate-safe post-session Coach Update artifacts.
-- Durable practice and evaluator facts remain authoritative; this table preserves rendered operational coaching.

create unique index if not exists uq_candidate_practice_sessions_artifact_owner
  on public.candidate_practice_sessions(candidate_practice_session_id, candidate_profile_id, role_profile_id);

create table if not exists public.candidate_coach_update_artifacts (
  candidate_coach_update_artifact_id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  role_profile_id uuid not null,
  source_candidate_practice_session_id uuid not null,
  source_completion_fingerprint text not null,
  source_answer_attempt_ids_json jsonb not null,
  accepted_evaluation_run_ids_json jsonb not null,
  synthesis_input_fingerprint text not null,
  provider text not null,
  model_name text not null,
  prompt_version text not null,
  evaluator_version text not null,
  generation_attempt integer not null,
  lifecycle_state text not null default 'requested',
  candidate_safe_content_json jsonb,
  validation_json jsonb,
  error_code text,
  requested_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_candidate_coach_update_owned_role_profile
    foreign key (candidate_profile_id, role_profile_id)
    references public.candidate_role_preparation_profiles(candidate_profile_id, role_profile_id),
  constraint fk_candidate_coach_update_owned_session
    foreign key (source_candidate_practice_session_id, candidate_profile_id, role_profile_id)
    references public.candidate_practice_sessions(candidate_practice_session_id, candidate_profile_id, role_profile_id)
    on delete cascade,
  constraint chk_candidate_coach_update_completion_fingerprint check (length(trim(source_completion_fingerprint)) > 0),
  constraint chk_candidate_coach_update_attempt_ids_array check (jsonb_typeof(source_answer_attempt_ids_json) = 'array'),
  constraint chk_candidate_coach_update_run_ids_array check (jsonb_typeof(accepted_evaluation_run_ids_json) = 'array'),
  constraint chk_candidate_coach_update_input_fingerprint check (length(trim(synthesis_input_fingerprint)) > 0),
  constraint chk_candidate_coach_update_provider check (length(trim(provider)) > 0),
  constraint chk_candidate_coach_update_model check (length(trim(model_name)) > 0),
  constraint chk_candidate_coach_update_prompt check (length(trim(prompt_version)) > 0),
  constraint chk_candidate_coach_update_evaluator check (length(trim(evaluator_version)) > 0),
  constraint chk_candidate_coach_update_generation_attempt check (generation_attempt > 0),
  constraint chk_candidate_coach_update_lifecycle check (lifecycle_state in ('requested', 'completed', 'failed', 'rejected')),
  constraint chk_candidate_coach_update_content_object check (
    candidate_safe_content_json is null or jsonb_typeof(candidate_safe_content_json) = 'object'
  ),
  constraint chk_candidate_coach_update_validation_object check (
    validation_json is null or jsonb_typeof(validation_json) = 'object'
  ),
  constraint chk_candidate_coach_update_terminal_state check (
    (lifecycle_state = 'requested'
      and candidate_safe_content_json is null
      and validation_json is null
      and error_code is null
      and completed_at is null)
    or
    (lifecycle_state = 'completed'
      and candidate_safe_content_json is not null
      and validation_json is not null
      and error_code is null
      and completed_at is not null)
    or
    (lifecycle_state in ('failed', 'rejected')
      and candidate_safe_content_json is null
      and length(trim(error_code)) > 0
      and completed_at is not null)
  ),
  constraint uq_candidate_coach_update_generation_attempt
    unique (source_candidate_practice_session_id, generation_attempt)
);

create index if not exists idx_candidate_coach_update_profile_context_completed
  on public.candidate_coach_update_artifacts(candidate_profile_id, role_profile_id, completed_at desc)
  where lifecycle_state = 'completed';

create index if not exists idx_candidate_coach_update_source_input
  on public.candidate_coach_update_artifacts(source_candidate_practice_session_id, synthesis_input_fingerprint, requested_at desc);

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
    new.source_completion_fingerprint,
    new.source_answer_attempt_ids_json,
    new.accepted_evaluation_run_ids_json,
    new.synthesis_input_fingerprint,
    new.provider,
    new.model_name,
    new.prompt_version,
    new.evaluator_version,
    new.generation_attempt,
    new.requested_at,
    new.created_at
  ) is distinct from row(
    old.candidate_coach_update_artifact_id,
    old.candidate_profile_id,
    old.role_profile_id,
    old.source_candidate_practice_session_id,
    old.source_completion_fingerprint,
    old.source_answer_attempt_ids_json,
    old.accepted_evaluation_run_ids_json,
    old.synthesis_input_fingerprint,
    old.provider,
    old.model_name,
    old.prompt_version,
    old.evaluator_version,
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

drop trigger if exists trg_candidate_coach_update_artifact_transition on public.candidate_coach_update_artifacts;
create trigger trg_candidate_coach_update_artifact_transition
before update on public.candidate_coach_update_artifacts
for each row execute function public.validate_candidate_coach_update_artifact_transition();

drop trigger if exists trg_candidate_coach_update_artifacts_updated_at on public.candidate_coach_update_artifacts;
create trigger trg_candidate_coach_update_artifacts_updated_at
before update on public.candidate_coach_update_artifacts
for each row execute function public.set_updated_at();
