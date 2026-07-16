-- Durable evaluator-run generations, claim leases, and completion fencing.
-- One immutable answer attempt may have multiple terminal evaluation generations,
-- but candidate coaching accepts at most one result for one input fingerprint.

drop trigger if exists trg_candidate_answer_evaluation_runs_transition
  on public.candidate_answer_evaluation_runs;

drop trigger if exists trg_candidate_answer_evaluation_runs_updated_at
  on public.candidate_answer_evaluation_runs;

alter table public.candidate_answer_evaluation_runs
  add column if not exists generation_attempt integer;

alter table public.candidate_answer_evaluation_runs
  add column if not exists claim_expires_at timestamptz;

with ranked as (
  select
    candidate_answer_evaluation_run_id,
    row_number() over (
      partition by candidate_answer_attempt_id, purpose
      order by requested_at, created_at, candidate_answer_evaluation_run_id
    ) as generation_attempt
  from public.candidate_answer_evaluation_runs
)
update public.candidate_answer_evaluation_runs run
set generation_attempt = ranked.generation_attempt
from ranked
where run.candidate_answer_evaluation_run_id = ranked.candidate_answer_evaluation_run_id
  and run.generation_attempt is null;

update public.candidate_answer_evaluation_runs
set claim_expires_at = requested_at + interval '60 seconds'
where claim_expires_at is null;

alter table public.candidate_answer_evaluation_runs
  alter column generation_attempt set not null;

alter table public.candidate_answer_evaluation_runs
  alter column claim_expires_at set not null;

do $$
begin
  alter table public.candidate_answer_evaluation_runs
    add constraint chk_candidate_answer_evaluation_run_generation_attempt
    check (generation_attempt > 0);
exception
  when duplicate_object then null;
end;
$$;

alter table public.candidate_answer_evaluation_runs
  drop constraint if exists chk_candidate_answer_evaluation_run_claim_lease;

alter table public.candidate_answer_evaluation_runs
  add constraint chk_candidate_answer_evaluation_run_claim_lease
  check (claim_expires_at = requested_at + interval '60 seconds');

alter table public.candidate_answer_evaluation_runs
  drop constraint if exists uq_candidate_answer_evaluation_run_idempotency;

create unique index if not exists uq_candidate_answer_evaluation_run_generation
  on public.candidate_answer_evaluation_runs(
    candidate_answer_attempt_id,
    purpose,
    generation_attempt
  );

do $$
begin
  if exists (
    select 1
    from public.candidate_answer_evaluation_runs
    where purpose = 'candidate_coaching'
      and lifecycle_state = 'requested'
    group by candidate_answer_attempt_id, input_fingerprint
    having count(*) > 1
  ) then
    raise exception 'candidate coaching has multiple requested runs for one answer input'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.candidate_answer_evaluation_runs
    where purpose = 'candidate_coaching'
      and lifecycle_state = 'completed'
    group by candidate_answer_attempt_id, input_fingerprint
    having count(*) > 1
  ) then
    raise exception 'candidate coaching has multiple accepted runs for one answer input'
      using errcode = '23505';
  end if;
end;
$$;

create unique index if not exists uq_candidate_answer_evaluation_run_requested_coaching
  on public.candidate_answer_evaluation_runs(candidate_answer_attempt_id, input_fingerprint)
  where purpose = 'candidate_coaching' and lifecycle_state = 'requested';

create unique index if not exists uq_candidate_answer_evaluation_run_completed_coaching
  on public.candidate_answer_evaluation_runs(candidate_answer_attempt_id, input_fingerprint)
  where purpose = 'candidate_coaching' and lifecycle_state = 'completed';

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
    old.input_fingerprint,
    old.idempotency_key,
    old.generation_attempt,
    old.requested_at,
    old.claim_expires_at,
    old.created_at
  ) then
    raise exception 'candidate answer evaluation run identity, generation, lease, and input metadata are immutable'
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
