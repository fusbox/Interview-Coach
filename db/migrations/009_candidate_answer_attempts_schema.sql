-- Immutable candidate answer attempts and evaluator-run lineage.
-- Slot-keyed session JSON remains a latest-result compatibility projection during migration.

create unique index if not exists uq_candidate_practice_sessions_id_profile
  on public.candidate_practice_sessions(candidate_practice_session_id, candidate_profile_id);

create table if not exists public.candidate_answer_attempts (
  candidate_answer_attempt_id uuid primary key default gen_random_uuid(),
  candidate_practice_session_id uuid not null,
  candidate_profile_id uuid not null,
  question_slot_id text not null,
  question_index integer not null,
  attempt_number integer not null,
  trigger text not null,
  supersedes_candidate_answer_attempt_id uuid,
  mode text not null,
  answer_text text not null,
  submitted_at timestamptz not null,
  idempotency_key text not null,
  payload_fingerprint text not null,
  created_at timestamptz not null default now(),
  constraint fk_candidate_answer_attempt_session_owner
    foreign key (candidate_practice_session_id, candidate_profile_id)
    references public.candidate_practice_sessions(candidate_practice_session_id, candidate_profile_id)
    on delete cascade,
  constraint fk_candidate_answer_attempt_supersedes
    foreign key (supersedes_candidate_answer_attempt_id)
    references public.candidate_answer_attempts(candidate_answer_attempt_id),
  constraint chk_candidate_answer_attempt_slot_present check (length(trim(question_slot_id)) > 0),
  constraint chk_candidate_answer_attempt_question_index check (question_index >= 0),
  constraint chk_candidate_answer_attempt_number check (attempt_number > 0),
  constraint chk_candidate_answer_attempt_trigger check (trigger in ('initial_submit', 'feedback_retry')),
  constraint chk_candidate_answer_attempt_mode check (mode in ('text', 'voice', 'photo')),
  constraint chk_candidate_answer_attempt_text_present check (length(trim(answer_text)) > 0),
  constraint chk_candidate_answer_attempt_idempotency_key_present check (length(trim(idempotency_key)) > 0),
  constraint chk_candidate_answer_attempt_payload_fingerprint_present check (length(trim(payload_fingerprint)) > 0),
  constraint chk_candidate_answer_attempt_lineage check (
    (attempt_number = 1 and trigger = 'initial_submit' and supersedes_candidate_answer_attempt_id is null)
    or
    (attempt_number > 1 and trigger = 'feedback_retry' and supersedes_candidate_answer_attempt_id is not null)
  ),
  constraint uq_candidate_answer_attempt_number unique (candidate_practice_session_id, question_slot_id, attempt_number),
  constraint uq_candidate_answer_attempt_idempotency unique (candidate_practice_session_id, question_slot_id, idempotency_key)
);

create index if not exists idx_candidate_answer_attempts_profile_created
  on public.candidate_answer_attempts(candidate_profile_id, created_at desc);

create index if not exists idx_candidate_answer_attempts_session_slot
  on public.candidate_answer_attempts(candidate_practice_session_id, question_slot_id, attempt_number desc);

create index if not exists idx_candidate_answer_attempts_supersedes
  on public.candidate_answer_attempts(supersedes_candidate_answer_attempt_id)
  where supersedes_candidate_answer_attempt_id is not null;

create or replace function public.validate_candidate_answer_attempt_lineage()
returns trigger
language plpgsql
as $$
begin
  if new.attempt_number = 1 then
    return new;
  end if;

  if not exists (
    select 1
    from public.candidate_answer_attempts prior
    where prior.candidate_answer_attempt_id = new.supersedes_candidate_answer_attempt_id
      and prior.candidate_practice_session_id = new.candidate_practice_session_id
      and prior.question_slot_id = new.question_slot_id
      and prior.question_index = new.question_index
      and prior.attempt_number = new.attempt_number - 1
  ) then
    raise exception 'candidate answer retry must supersede the immediately prior attempt for the same question occurrence'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_candidate_answer_attempt_lineage on public.candidate_answer_attempts;
create trigger trg_candidate_answer_attempt_lineage
before insert on public.candidate_answer_attempts
for each row execute function public.validate_candidate_answer_attempt_lineage();

create or replace function public.prevent_candidate_answer_attempt_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'candidate answer attempts are immutable after insertion'
    using errcode = '55000';
end;
$$;

drop trigger if exists trg_candidate_answer_attempt_immutable on public.candidate_answer_attempts;
create trigger trg_candidate_answer_attempt_immutable
before update on public.candidate_answer_attempts
for each row execute function public.prevent_candidate_answer_attempt_update();

create table if not exists public.candidate_answer_evaluation_runs (
  candidate_answer_evaluation_run_id uuid primary key default gen_random_uuid(),
  candidate_answer_attempt_id uuid not null references public.candidate_answer_attempts(candidate_answer_attempt_id) on delete cascade,
  purpose text not null,
  provider text not null,
  model_name text not null,
  prompt_version text not null,
  evaluator_version text not null,
  input_fingerprint text not null,
  idempotency_key text not null,
  lifecycle_state text not null default 'requested',
  result_json jsonb,
  validation_json jsonb,
  error_code text,
  requested_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_candidate_answer_evaluation_run_purpose check (purpose in ('candidate_coaching', 'qa_comparison')),
  constraint chk_candidate_answer_evaluation_run_provider_present check (length(trim(provider)) > 0),
  constraint chk_candidate_answer_evaluation_run_model_present check (length(trim(model_name)) > 0),
  constraint chk_candidate_answer_evaluation_run_prompt_present check (length(trim(prompt_version)) > 0),
  constraint chk_candidate_answer_evaluation_run_evaluator_present check (length(trim(evaluator_version)) > 0),
  constraint chk_candidate_answer_evaluation_run_input_present check (length(trim(input_fingerprint)) > 0),
  constraint chk_candidate_answer_evaluation_run_idempotency_present check (length(trim(idempotency_key)) > 0),
  constraint chk_candidate_answer_evaluation_run_state check (lifecycle_state in ('requested', 'completed', 'failed', 'rejected')),
  constraint chk_candidate_answer_evaluation_run_result_object check (result_json is null or jsonb_typeof(result_json) = 'object'),
  constraint chk_candidate_answer_evaluation_run_validation_object check (validation_json is null or jsonb_typeof(validation_json) = 'object'),
  constraint chk_candidate_answer_evaluation_run_completion check (
    (lifecycle_state = 'requested' and completed_at is null and result_json is null and error_code is null)
    or
    (lifecycle_state = 'completed' and completed_at is not null and result_json is not null and error_code is null)
    or
    (lifecycle_state in ('failed', 'rejected') and completed_at is not null and result_json is null and length(trim(error_code)) > 0)
  ),
  constraint uq_candidate_answer_evaluation_run_idempotency unique (candidate_answer_attempt_id, idempotency_key)
);

create index if not exists idx_candidate_answer_evaluation_runs_attempt
  on public.candidate_answer_evaluation_runs(candidate_answer_attempt_id, requested_at desc);

create index if not exists idx_candidate_answer_evaluation_runs_purpose_state
  on public.candidate_answer_evaluation_runs(purpose, lifecycle_state, requested_at desc);

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
    new.input_fingerprint,
    new.idempotency_key,
    new.requested_at,
    new.created_at
  ) is distinct from row(
    old.candidate_answer_evaluation_run_id,
    old.candidate_answer_attempt_id,
    old.purpose,
    old.provider,
    old.model_name,
    old.prompt_version,
    old.evaluator_version,
    old.input_fingerprint,
    old.idempotency_key,
    old.requested_at,
    old.created_at
  ) then
    raise exception 'candidate answer evaluation run identity and input metadata are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_candidate_answer_evaluation_runs_transition on public.candidate_answer_evaluation_runs;
create trigger trg_candidate_answer_evaluation_runs_transition
before update on public.candidate_answer_evaluation_runs
for each row execute function public.validate_candidate_answer_evaluation_run_transition();

drop trigger if exists trg_candidate_answer_evaluation_runs_updated_at on public.candidate_answer_evaluation_runs;
create trigger trg_candidate_answer_evaluation_runs_updated_at
before update on public.candidate_answer_evaluation_runs
for each row execute function public.set_updated_at();

-- Preserve valid V2 submissions that predate normalized attempt history.
insert into public.candidate_answer_attempts (
  candidate_practice_session_id,
  candidate_profile_id,
  question_slot_id,
  question_index,
  attempt_number,
  trigger,
  mode,
  answer_text,
  submitted_at,
  idempotency_key,
  payload_fingerprint
)
select
  session.candidate_practice_session_id,
  session.candidate_profile_id,
  submission.key,
  (submission.value ->> 'questionIndex')::integer,
  1,
  'initial_submit',
  case
    when submission.value ->> 'mode' in ('text', 'voice', 'photo') then submission.value ->> 'mode'
    else 'text'
  end,
  submission.value ->> 'text',
  (submission.value ->> 'submittedAt')::timestamptz,
  'migration-backfill:' || submission.key,
  md5(submission.value::text)
from public.candidate_practice_sessions session
cross join lateral jsonb_each(coalesce(session.answer_submissions_json, '{}'::jsonb)) submission
where jsonb_typeof(submission.value) = 'object'
  and submission.value ? 'questionIndex'
  and submission.value ? 'text'
  and submission.value ? 'submittedAt'
  and (submission.value ->> 'questionIndex') ~ '^[0-9]+$'
  and length(trim(submission.value ->> 'text')) > 0
  and (submission.value ->> 'submittedAt') ~* '^[0-9]{4}-[0-9]{2}-[0-9]{2}t'
  and not exists (
    select 1
    from public.candidate_answer_attempts existing
    where existing.candidate_practice_session_id = session.candidate_practice_session_id
      and existing.question_slot_id = submission.key
      and existing.attempt_number = 1
  )
on conflict (candidate_practice_session_id, question_slot_id, attempt_number) do nothing;
