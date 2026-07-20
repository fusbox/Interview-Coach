-- Invite-owned immutable answer attempts and evaluator-run lineage.

create table if not exists public.invited_practice_answer_attempts (
  invited_practice_answer_attempt_id uuid primary key default gen_random_uuid(),
  invited_practice_session_id uuid not null,
  recruiter_invitation_recipient_id uuid not null,
  question_slot_id text not null,
  question_index integer not null,
  attempt_number integer not null,
  trigger text not null,
  supersedes_invited_practice_answer_attempt_id uuid,
  mode text not null,
  answer_text text not null,
  submitted_at timestamptz not null,
  idempotency_key text not null,
  payload_fingerprint text not null,
  created_at timestamptz not null default now(),
  constraint fk_invited_practice_answer_attempt_session_recipient
    foreign key (invited_practice_session_id, recruiter_invitation_recipient_id)
    references public.invited_practice_sessions(invited_practice_session_id, recruiter_invitation_recipient_id)
    on delete cascade,
  constraint fk_invited_practice_answer_attempt_supersedes
    foreign key (supersedes_invited_practice_answer_attempt_id)
    references public.invited_practice_answer_attempts(invited_practice_answer_attempt_id),
  constraint uq_invited_practice_answer_attempt_identity
    unique (invited_practice_answer_attempt_id, invited_practice_session_id, recruiter_invitation_recipient_id),
  constraint uq_invited_practice_answer_attempt_number
    unique (invited_practice_session_id, question_slot_id, attempt_number),
  constraint uq_invited_practice_answer_attempt_idempotency
    unique (invited_practice_session_id, question_slot_id, idempotency_key),
  constraint chk_invited_practice_answer_attempt_slot check (length(trim(question_slot_id)) > 0),
  constraint chk_invited_practice_answer_attempt_question_index check (question_index >= 0),
  constraint chk_invited_practice_answer_attempt_number check (attempt_number > 0),
  constraint chk_invited_practice_answer_attempt_trigger check (trigger in ('initial_submit', 'feedback_retry')),
  constraint chk_invited_practice_answer_attempt_mode check (mode in ('text', 'voice', 'photo')),
  constraint chk_invited_practice_answer_attempt_text check (length(trim(answer_text)) > 0),
  constraint chk_invited_practice_answer_attempt_idempotency check (length(trim(idempotency_key)) > 0),
  constraint chk_invited_practice_answer_attempt_fingerprint check (length(trim(payload_fingerprint)) > 0),
  constraint chk_invited_practice_answer_attempt_lineage check (
    (attempt_number = 1 and trigger = 'initial_submit' and supersedes_invited_practice_answer_attempt_id is null)
    or
    (attempt_number > 1 and trigger = 'feedback_retry' and supersedes_invited_practice_answer_attempt_id is not null)
  )
);

create index if not exists idx_invited_practice_answer_attempts_recipient_created
  on public.invited_practice_answer_attempts(recruiter_invitation_recipient_id, created_at desc);

create index if not exists idx_invited_practice_answer_attempts_session_slot
  on public.invited_practice_answer_attempts(invited_practice_session_id, question_slot_id, attempt_number desc);

create index if not exists idx_invited_practice_answer_attempts_supersedes
  on public.invited_practice_answer_attempts(supersedes_invited_practice_answer_attempt_id)
  where supersedes_invited_practice_answer_attempt_id is not null;

create or replace function public.validate_invited_practice_answer_attempt_lineage()
returns trigger
language plpgsql
as $$
begin
  if new.attempt_number = 1 then
    return new;
  end if;

  if not exists (
    select 1
    from public.invited_practice_answer_attempts prior
    where prior.invited_practice_answer_attempt_id = new.supersedes_invited_practice_answer_attempt_id
      and prior.invited_practice_session_id = new.invited_practice_session_id
      and prior.recruiter_invitation_recipient_id = new.recruiter_invitation_recipient_id
      and prior.question_slot_id = new.question_slot_id
      and prior.question_index = new.question_index
      and prior.attempt_number = new.attempt_number - 1
  ) then
    raise exception 'invited answer retry must supersede the immediately prior attempt for the same question occurrence'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_invited_practice_answer_attempt_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'invited practice answer attempts are immutable after insertion'
    using errcode = '55000';
end;
$$;

drop trigger if exists trg_invited_practice_answer_attempt_lineage
  on public.invited_practice_answer_attempts;
create trigger trg_invited_practice_answer_attempt_lineage
before insert on public.invited_practice_answer_attempts
for each row execute function public.validate_invited_practice_answer_attempt_lineage();

drop trigger if exists trg_invited_practice_answer_attempt_immutable
  on public.invited_practice_answer_attempts;
create trigger trg_invited_practice_answer_attempt_immutable
before update on public.invited_practice_answer_attempts
for each row execute function public.prevent_invited_practice_answer_attempt_update();

create table if not exists public.invited_practice_answer_evaluation_runs (
  invited_practice_answer_evaluation_run_id uuid primary key default gen_random_uuid(),
  invited_practice_answer_attempt_id uuid not null
    references public.invited_practice_answer_attempts(invited_practice_answer_attempt_id)
    on delete cascade,
  purpose text not null,
  provider text not null,
  model_name text not null,
  prompt_version text not null,
  evaluator_version text not null,
  configuration_manifest_json jsonb not null,
  configuration_fingerprint text not null,
  input_fingerprint text not null,
  idempotency_key text not null,
  generation_attempt integer not null,
  lifecycle_state text not null default 'requested',
  result_json jsonb,
  validation_json jsonb,
  error_code text,
  requested_at timestamptz not null,
  claim_expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_invited_practice_answer_evaluation_generation
    unique (invited_practice_answer_attempt_id, purpose, generation_attempt),
  constraint chk_invited_practice_answer_evaluation_purpose check (purpose in ('candidate_coaching', 'qa_comparison')),
  constraint chk_invited_practice_answer_evaluation_provider check (length(trim(provider)) > 0),
  constraint chk_invited_practice_answer_evaluation_model check (length(trim(model_name)) > 0),
  constraint chk_invited_practice_answer_evaluation_prompt check (length(trim(prompt_version)) > 0),
  constraint chk_invited_practice_answer_evaluation_version check (length(trim(evaluator_version)) > 0),
  constraint chk_invited_practice_answer_evaluation_input check (length(trim(input_fingerprint)) > 0),
  constraint chk_invited_practice_answer_evaluation_idempotency check (length(trim(idempotency_key)) > 0),
  constraint chk_invited_practice_answer_evaluation_generation check (generation_attempt > 0),
  constraint chk_invited_practice_answer_evaluation_state check (lifecycle_state in ('requested', 'completed', 'failed', 'rejected')),
  constraint chk_invited_practice_answer_evaluation_manifest check (
    jsonb_typeof(configuration_manifest_json) = 'object'
    and configuration_manifest_json ->> 'configurationStatus' = 'resolved'
    and (configuration_manifest_json ->> 'schemaVersion')::integer = 1
    and configuration_manifest_json ->> 'profileId' = model_name
    and configuration_manifest_json ->> 'pipelineProvider' = provider
    and configuration_manifest_json ->> 'promptBundleVersion' = prompt_version
    and configuration_manifest_json ->> 'evaluatorVersion' = evaluator_version
    and jsonb_typeof(configuration_manifest_json -> 'stages') = 'array'
    and jsonb_array_length(configuration_manifest_json -> 'stages') between 2 and 3
  ),
  constraint chk_invited_practice_answer_evaluation_configuration_fingerprint
    check (configuration_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_invited_practice_answer_evaluation_claim
    check (claim_expires_at = requested_at + interval '60 seconds'),
  constraint chk_invited_practice_answer_evaluation_result check (result_json is null or jsonb_typeof(result_json) = 'object'),
  constraint chk_invited_practice_answer_evaluation_validation check (validation_json is null or jsonb_typeof(validation_json) = 'object'),
  constraint chk_invited_practice_answer_evaluation_completion check (
    (lifecycle_state = 'requested' and completed_at is null and result_json is null and error_code is null)
    or
    (lifecycle_state = 'completed' and completed_at is not null and result_json is not null and error_code is null)
    or
    (lifecycle_state in ('failed', 'rejected') and completed_at is not null and result_json is null and length(trim(error_code)) > 0)
  )
);

create index if not exists idx_invited_practice_answer_evaluation_attempt
  on public.invited_practice_answer_evaluation_runs(invited_practice_answer_attempt_id, requested_at desc);

create index if not exists idx_invited_practice_answer_evaluation_purpose_state
  on public.invited_practice_answer_evaluation_runs(purpose, lifecycle_state, requested_at desc);

create index if not exists idx_invited_practice_answer_evaluation_configuration
  on public.invited_practice_answer_evaluation_runs(configuration_fingerprint, purpose, requested_at desc);

create unique index if not exists uq_invited_practice_answer_evaluation_requested_coaching
  on public.invited_practice_answer_evaluation_runs(invited_practice_answer_attempt_id, input_fingerprint)
  where purpose = 'candidate_coaching' and lifecycle_state = 'requested';

create unique index if not exists uq_invited_practice_answer_evaluation_completed_coaching
  on public.invited_practice_answer_evaluation_runs(invited_practice_answer_attempt_id, input_fingerprint)
  where purpose = 'candidate_coaching' and lifecycle_state = 'completed';

create or replace function public.validate_invited_practice_answer_evaluation_transition()
returns trigger
language plpgsql
as $$
begin
  if old.lifecycle_state <> 'requested'
     or new.lifecycle_state not in ('completed', 'failed', 'rejected') then
    raise exception 'invited answer evaluation runs allow one requested-to-terminal transition'
      using errcode = '55000';
  end if;

  if row(
    new.invited_practice_answer_evaluation_run_id,
    new.invited_practice_answer_attempt_id,
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
    old.invited_practice_answer_evaluation_run_id,
    old.invited_practice_answer_attempt_id,
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
    raise exception 'invited answer evaluation identity, configuration, generation, lease, and input are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invited_practice_answer_evaluation_transition
  on public.invited_practice_answer_evaluation_runs;
create trigger trg_invited_practice_answer_evaluation_transition
before update on public.invited_practice_answer_evaluation_runs
for each row execute function public.validate_invited_practice_answer_evaluation_transition();

drop trigger if exists trg_invited_practice_answer_evaluation_updated_at
  on public.invited_practice_answer_evaluation_runs;
create trigger trg_invited_practice_answer_evaluation_updated_at
before update on public.invited_practice_answer_evaluation_runs
for each row execute function public.set_updated_at();

comment on table public.invited_practice_answer_attempts is
  'Immutable invited-recipient answer attempts; never candidate-profile-owned rows.';

comment on table public.invited_practice_answer_evaluation_runs is
  'Leased evaluator generations for one immutable invited answer attempt.';
