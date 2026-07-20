-- Recruiter-owned accepted question sets for idempotent V2 invitation creation.

create table if not exists public.recruiter_invitation_question_sets (
  recruiter_invitation_question_set_id uuid primary key,
  recruiter_id uuid not null references public.app_users(user_id) on delete restrict,
  action_key_hash text not null,
  request_fingerprint text not null,
  source text not null,
  lifecycle_state text not null default 'preparing',
  target_role text not null,
  job_description text not null,
  interview_stage text not null,
  question_plan_snapshot_json jsonb not null,
  question_wording_snapshot_json jsonb,
  failure_code text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  failed_at timestamptz,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint uq_recruiter_invitation_question_set_owner
    unique (recruiter_invitation_question_set_id, recruiter_id),
  constraint uq_recruiter_invitation_question_set_action
    unique (recruiter_id, action_key_hash),
  constraint chk_recruiter_invitation_question_set_action_hash
    check (action_key_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_recruiter_invitation_question_set_fingerprint
    check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint chk_recruiter_invitation_question_set_source
    check (source in ('generated', 'manual')),
  constraint chk_recruiter_invitation_question_set_state
    check (lifecycle_state in ('preparing', 'ready', 'failed')),
  constraint chk_recruiter_invitation_question_set_role
    check (length(trim(target_role)) between 1 and 120),
  constraint chk_recruiter_invitation_question_set_job
    check (length(trim(job_description)) between 1 and 12000),
  constraint chk_recruiter_invitation_question_set_stage
    check (interview_stage in ('practice_only', 'screening', 'first_interview', 'follow_up', 'final_interview')),
  constraint chk_recruiter_invitation_question_set_plan
    check (
      jsonb_typeof(question_plan_snapshot_json) = 'object'
      and jsonb_typeof(question_plan_snapshot_json -> 'slots') = 'array'
      and (question_plan_snapshot_json ->> 'interviewStage') = interview_stage
      and (question_plan_snapshot_json ->> 'questionCount') ~ '^[0-9]+$'
      and jsonb_array_length(question_plan_snapshot_json -> 'slots') =
        (question_plan_snapshot_json ->> 'questionCount')::integer
    ),
  constraint chk_recruiter_invitation_question_set_result check (
    (
      lifecycle_state = 'preparing'
      and question_wording_snapshot_json is null
      and failure_code is null
      and accepted_at is null
      and failed_at is null
    )
    or (
      lifecycle_state = 'ready'
      and jsonb_typeof(question_wording_snapshot_json) = 'object'
      and question_wording_snapshot_json ->> 'status' = 'questions_worded'
      and jsonb_typeof(question_wording_snapshot_json -> 'questions') = 'array'
      and jsonb_array_length(question_wording_snapshot_json -> 'questions') =
        (question_plan_snapshot_json ->> 'questionCount')::integer
      and failure_code is null
      and accepted_at is not null
      and failed_at is null
    )
    or (
      lifecycle_state = 'failed'
      and question_wording_snapshot_json is null
      and length(trim(failure_code)) > 0
      and accepted_at is null
      and failed_at is not null
    )
  ),
  constraint chk_recruiter_invitation_question_set_expiry
    check (expires_at > created_at)
);

create index if not exists idx_recruiter_invitation_question_sets_owner_created
  on public.recruiter_invitation_question_sets(recruiter_id, created_at desc);

create index if not exists idx_recruiter_invitation_question_sets_expiry
  on public.recruiter_invitation_question_sets(expires_at);

alter table public.recruiter_invitation_batches
  add column if not exists source_recruiter_invitation_question_set_id uuid;

do $$
begin
  alter table public.recruiter_invitation_batches
    add constraint fk_recruiter_invitation_batch_question_set_owner
    foreign key (source_recruiter_invitation_question_set_id, recruiter_id)
    references public.recruiter_invitation_question_sets(
      recruiter_invitation_question_set_id,
      recruiter_id
    )
    on delete restrict;
exception
  when duplicate_object then null;
end;
$$;

create unique index if not exists uq_recruiter_invitation_batch_question_set
  on public.recruiter_invitation_batches(source_recruiter_invitation_question_set_id)
  where source_recruiter_invitation_question_set_id is not null;

create or replace function public.prevent_recruiter_invitation_question_set_mutation()
returns trigger
language plpgsql
as $$
begin
  if row(
    new.recruiter_invitation_question_set_id,
    new.recruiter_id,
    new.action_key_hash,
    new.request_fingerprint,
    new.source,
    new.target_role,
    new.job_description,
    new.interview_stage,
    new.question_plan_snapshot_json,
    new.created_at,
    new.expires_at
  ) is distinct from row(
    old.recruiter_invitation_question_set_id,
    old.recruiter_id,
    old.action_key_hash,
    old.request_fingerprint,
    old.source,
    old.target_role,
    old.job_description,
    old.interview_stage,
    old.question_plan_snapshot_json,
    old.created_at,
    old.expires_at
  ) then
    raise exception 'recruiter invitation question-set identity and source are immutable'
      using errcode = '55000';
  end if;

  if old.lifecycle_state <> 'preparing' and row(
    new.lifecycle_state,
    new.question_wording_snapshot_json,
    new.failure_code,
    new.accepted_at,
    new.failed_at
  ) is distinct from row(
    old.lifecycle_state,
    old.question_wording_snapshot_json,
    old.failure_code,
    old.accepted_at,
    old.failed_at
  ) then
    raise exception 'accepted or failed recruiter invitation question set is immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_recruiter_invitation_question_set_immutable
  on public.recruiter_invitation_question_sets;
create trigger trg_recruiter_invitation_question_set_immutable
before update on public.recruiter_invitation_question_sets
for each row execute function public.prevent_recruiter_invitation_question_set_mutation();

drop trigger if exists trg_recruiter_invitation_question_sets_updated_at
  on public.recruiter_invitation_question_sets;
create trigger trg_recruiter_invitation_question_sets_updated_at
before update on public.recruiter_invitation_question_sets
for each row execute function public.set_updated_at();

create or replace function public.prevent_recruiter_invitation_batch_source_update()
returns trigger
language plpgsql
as $$
begin
  if old.source_recruiter_invitation_question_set_id is not null
     and new.source_recruiter_invitation_question_set_id is distinct from old.source_recruiter_invitation_question_set_id then
    raise exception 'recruiter invitation batch question-set source is immutable'
      using errcode = '55000';
  end if;

  if row(
    new.recruiter_invitation_batch_id,
    new.recruiter_id,
    new.target_role,
    new.job_description,
    new.interview_stage,
    new.recipient_count,
    new.question_plan_snapshot_json,
    new.question_wording_snapshot_json,
    new.created_at
  ) is distinct from row(
    old.recruiter_invitation_batch_id,
    old.recruiter_id,
    old.target_role,
    old.job_description,
    old.interview_stage,
    old.recipient_count,
    old.question_plan_snapshot_json,
    old.question_wording_snapshot_json,
    old.created_at
  ) then
    raise exception 'recruiter invitation batch identity and source snapshots are immutable'
      using errcode = '55000';
  end if;

  if old.lifecycle_state = 'revoked' and new.lifecycle_state is distinct from old.lifecycle_state then
    raise exception 'revoked recruiter invitation batch cannot be reactivated'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function public.create_recruiter_invitation_aggregate_from_question_set(
  p_source_question_set_id uuid,
  p_recruiter_id uuid,
  p_idempotency_key_hash text,
  p_request_fingerprint text,
  p_recruiter_invitation_batch_id uuid,
  p_target_role text,
  p_job_description text,
  p_interview_stage text,
  p_question_plan_snapshot jsonb,
  p_question_wording_snapshot jsonb,
  p_recipients jsonb
)
returns table (
  creation_outcome text,
  recruiter_invitation_batch_id uuid
)
language plpgsql
as $$
declare
  v_creation record;
begin
  perform 1
  from public.recruiter_invitation_question_sets question_set
  where question_set.recruiter_invitation_question_set_id = p_source_question_set_id
    and question_set.recruiter_id = p_recruiter_id
    and question_set.action_key_hash = p_idempotency_key_hash
    and question_set.lifecycle_state = 'ready'
    and question_set.expires_at > now()
    and question_set.target_role = trim(p_target_role)
    and question_set.job_description = trim(p_job_description)
    and question_set.interview_stage = p_interview_stage
    and question_set.question_plan_snapshot_json = p_question_plan_snapshot
    and question_set.question_wording_snapshot_json = p_question_wording_snapshot;

  if not found then
    raise exception 'owned ready recruiter invitation question set required'
      using errcode = '42501';
  end if;

  for v_creation in
    select *
    from public.create_recruiter_invitation_aggregate(
      p_recruiter_id,
      p_idempotency_key_hash,
      p_request_fingerprint,
      p_recruiter_invitation_batch_id,
      p_target_role,
      p_job_description,
      p_interview_stage,
      p_question_plan_snapshot,
      p_question_wording_snapshot,
      p_recipients
    )
  loop
    update public.recruiter_invitation_batches batch
    set source_recruiter_invitation_question_set_id = p_source_question_set_id
    where batch.recruiter_invitation_batch_id = v_creation.recruiter_invitation_batch_id
      and batch.recruiter_id = p_recruiter_id
      and (
        batch.source_recruiter_invitation_question_set_id is null
        or batch.source_recruiter_invitation_question_set_id = p_source_question_set_id
      );

    if not found then
      raise exception 'recruiter invitation batch question-set lineage conflict'
        using errcode = '55000';
    end if;

    creation_outcome := v_creation.creation_outcome;
    recruiter_invitation_batch_id := v_creation.recruiter_invitation_batch_id;
    return next;
  end loop;
end;
$$;

comment on table public.recruiter_invitation_question_sets is
  'Recruiter-owned immutable accepted V2 question sets. Raw browser action keys are never stored.';

comment on column public.recruiter_invitation_batches.source_recruiter_invitation_question_set_id is
  'Owned accepted question set that authorized this V2 invitation aggregate; required for newly created V2 batches.';
