-- Add exact serving-profile identity to Coach Update artifact claims.
-- Existing V2 development rows remain nullable rather than receiving invented configuration history.

alter table public.candidate_coach_update_artifacts
  add column if not exists profile_id text,
  add column if not exists configuration_fingerprint text;

alter table public.candidate_coach_update_artifacts
  drop constraint if exists chk_candidate_coach_update_configuration_identity;

alter table public.candidate_coach_update_artifacts
  add constraint chk_candidate_coach_update_configuration_identity check (
    profile_id is not null
    and configuration_fingerprint is not null
    and length(trim(profile_id)) > 0
    and configuration_fingerprint ~ '^[a-f0-9]{64}$'
  ) not valid;

create index if not exists idx_candidate_coach_update_source_configuration
  on public.candidate_coach_update_artifacts(
    source_candidate_practice_session_id,
    synthesis_input_fingerprint,
    configuration_fingerprint,
    requested_at desc
  );

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
