-- Immutable evaluator configuration identity for every V2 generation claim.
-- Rows created before this migration are V2 development rows with unknown
-- effective stage settings; they are not treated as production-reproducible.

drop trigger if exists trg_candidate_answer_evaluation_runs_transition
  on public.candidate_answer_evaluation_runs;

drop trigger if exists trg_candidate_answer_evaluation_runs_updated_at
  on public.candidate_answer_evaluation_runs;

alter table public.candidate_answer_evaluation_runs
  add column if not exists configuration_manifest_json jsonb;

alter table public.candidate_answer_evaluation_runs
  add column if not exists configuration_fingerprint text;

update public.candidate_answer_evaluation_runs
set configuration_manifest_json = jsonb_build_object(
  'schemaVersion', 1,
  'configurationStatus', 'pre_manifest_v2',
  'profileId', model_name,
  'pipelineProvider', provider,
  'serviceMode', 'unknown',
  'adapterVersion', 'unknown',
  'promptBundleVersion', prompt_version,
  'evaluatorVersion', evaluator_version,
  'stages', '[]'::jsonb
)
where configuration_manifest_json is null;

update public.candidate_answer_evaluation_runs
set configuration_fingerprint = encode(
  digest(convert_to(configuration_manifest_json::text, 'UTF8'), 'sha256'),
  'hex'
)
where configuration_fingerprint is null;

alter table public.candidate_answer_evaluation_runs
  alter column configuration_manifest_json set not null;

alter table public.candidate_answer_evaluation_runs
  alter column configuration_fingerprint set not null;

alter table public.candidate_answer_evaluation_runs
  drop constraint if exists chk_candidate_answer_evaluation_run_configuration_manifest;

alter table public.candidate_answer_evaluation_runs
  add constraint chk_candidate_answer_evaluation_run_configuration_manifest
  check (
    jsonb_typeof(configuration_manifest_json) = 'object'
    and (configuration_manifest_json ->> 'schemaVersion')::integer = 1
    and configuration_manifest_json ->> 'configurationStatus' in ('resolved', 'pre_manifest_v2')
    and configuration_manifest_json ->> 'profileId' = model_name
    and configuration_manifest_json ->> 'pipelineProvider' = provider
    and configuration_manifest_json ->> 'promptBundleVersion' = prompt_version
    and configuration_manifest_json ->> 'evaluatorVersion' = evaluator_version
    and jsonb_typeof(configuration_manifest_json -> 'stages') = 'array'
    and (
      (
        configuration_manifest_json ->> 'configurationStatus' = 'resolved'
        and jsonb_array_length(configuration_manifest_json -> 'stages') between 2 and 3
      )
      or
      (
        configuration_manifest_json ->> 'configurationStatus' = 'pre_manifest_v2'
        and configuration_manifest_json ->> 'serviceMode' = 'unknown'
        and configuration_manifest_json ->> 'adapterVersion' = 'unknown'
        and jsonb_array_length(configuration_manifest_json -> 'stages') = 0
      )
    )
  );

alter table public.candidate_answer_evaluation_runs
  drop constraint if exists chk_candidate_answer_evaluation_run_configuration_fingerprint;

alter table public.candidate_answer_evaluation_runs
  add constraint chk_candidate_answer_evaluation_run_configuration_fingerprint
  check (configuration_fingerprint ~ '^[a-f0-9]{64}$');

create index if not exists idx_candidate_answer_evaluation_runs_configuration
  on public.candidate_answer_evaluation_runs(configuration_fingerprint, purpose, requested_at desc);

create or replace function public.require_resolved_candidate_answer_evaluator_configuration()
returns trigger
language plpgsql
as $$
begin
  if new.configuration_manifest_json ->> 'configurationStatus' <> 'resolved' then
    raise exception 'new candidate answer evaluator runs require resolved configuration'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_candidate_answer_evaluation_runs_resolved_configuration
  on public.candidate_answer_evaluation_runs;
create trigger trg_candidate_answer_evaluation_runs_resolved_configuration
before insert on public.candidate_answer_evaluation_runs
for each row execute function public.require_resolved_candidate_answer_evaluator_configuration();

create or replace function public.validate_candidate_answer_evaluation_run_transition()
returns trigger
language plpgsql
as $$
begin
  if old.lifecycle_state <> 'requested'
     or new.lifecycle_state not in ('completed', 'failed', 'rejected') then
    raise exception 'candidate answer evaluation runs allow one requested-to-terminal transition'
      using errcode = '55000';
  end if;

  if row(
    new.candidate_answer_evaluation_run_id,
    new.candidate_answer_attempt_id,
    new.purpose,
    new.provider,
    new.model_name,
    new.prompt_version,
    new.evaluator_version,
    new.configuration_manifest_json,
    new.configuration_fingerprint,
    new.input_fingerprint,
    new.idempotency_key,
    new.generation_attempt,
    new.requested_at,
    new.claim_expires_at,
    new.created_at
  ) is distinct from row(
    old.candidate_answer_evaluation_run_id,
    old.candidate_answer_attempt_id,
    old.purpose,
    old.provider,
    old.model_name,
    old.prompt_version,
    old.evaluator_version,
    old.configuration_manifest_json,
    old.configuration_fingerprint,
    old.input_fingerprint,
    old.idempotency_key,
    old.generation_attempt,
    old.requested_at,
    old.claim_expires_at,
    old.created_at
  ) then
    raise exception 'candidate answer evaluation run identity, configuration, generation, lease, and input metadata are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger trg_candidate_answer_evaluation_runs_transition
before update on public.candidate_answer_evaluation_runs
for each row execute function public.validate_candidate_answer_evaluation_run_transition();

create trigger trg_candidate_answer_evaluation_runs_updated_at
before update on public.candidate_answer_evaluation_runs
for each row execute function public.set_updated_at();
