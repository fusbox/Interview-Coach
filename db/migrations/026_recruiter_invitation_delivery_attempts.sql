-- App-owned recruiter invitation delivery is separate from invitation creation.
-- Each row represents one recipient-specific provider invocation; retry appends a new row.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'uq_recruiter_invitation_recipient_batch_owner'
      and conrelid = 'public.recruiter_invitation_recipients'::regclass
  ) then
    alter table public.recruiter_invitation_recipients
      add constraint uq_recruiter_invitation_recipient_batch_owner
      unique (recruiter_invitation_recipient_id, recruiter_invitation_batch_id, recruiter_id);
  end if;
end;
$$;

create table if not exists public.recruiter_invitation_delivery_attempts (
  recruiter_invitation_delivery_attempt_id uuid primary key,
  recruiter_invitation_batch_id uuid not null,
  recruiter_invitation_recipient_id uuid not null,
  recruiter_id uuid not null,
  retry_of_delivery_attempt_id uuid references public.recruiter_invitation_delivery_attempts(recruiter_invitation_delivery_attempt_id),
  attempt_number integer not null,
  action_key_hash text not null,
  channel text not null default 'email',
  provider text not null,
  lifecycle_state text not null default 'queued',
  provider_reference_id text,
  failure_code text,
  retryable boolean not null default false,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_recruiter_invitation_delivery_recipient_owner
    foreign key (recruiter_invitation_recipient_id, recruiter_invitation_batch_id, recruiter_id)
    references public.recruiter_invitation_recipients(
      recruiter_invitation_recipient_id,
      recruiter_invitation_batch_id,
      recruiter_id
    )
    on delete cascade,
  constraint uq_recruiter_invitation_delivery_attempt_number
    unique (recruiter_invitation_recipient_id, attempt_number),
  constraint uq_recruiter_invitation_delivery_action
    unique (recruiter_id, recruiter_invitation_batch_id, recruiter_invitation_recipient_id, action_key_hash),
  constraint chk_recruiter_invitation_delivery_attempt_number check (attempt_number > 0),
  constraint chk_recruiter_invitation_delivery_action_hash check (action_key_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_recruiter_invitation_delivery_channel check (channel = 'email'),
  constraint chk_recruiter_invitation_delivery_provider check (length(trim(provider)) between 1 and 64),
  constraint chk_recruiter_invitation_delivery_provider_reference check (
    provider_reference_id is null or length(provider_reference_id) between 1 and 500
  ),
  constraint chk_recruiter_invitation_delivery_failure_code check (
    failure_code is null or length(failure_code) between 1 and 100
  ),
  constraint chk_recruiter_invitation_delivery_state check (
    lifecycle_state in ('queued', 'sending', 'provider_accepted', 'failed', 'outcome_unknown')
  ),
  constraint chk_recruiter_invitation_delivery_outcome_shape check (
    (
      lifecycle_state = 'queued'
      and started_at is null
      and completed_at is null
      and provider_reference_id is null
      and failure_code is null
      and retryable = false
    )
    or (
      lifecycle_state = 'sending'
      and started_at is not null
      and completed_at is null
      and provider_reference_id is null
      and failure_code is null
      and retryable = false
    )
    or (
      lifecycle_state = 'provider_accepted'
      and started_at is not null
      and completed_at is not null
      and length(trim(provider_reference_id)) > 0
      and failure_code is null
      and retryable = false
    )
    or (
      lifecycle_state = 'failed'
      and completed_at is not null
      and provider_reference_id is null
      and length(trim(failure_code)) > 0
    )
    or (
      lifecycle_state = 'outcome_unknown'
      and started_at is not null
      and completed_at is not null
      and provider_reference_id is null
      and length(trim(failure_code)) > 0
      and retryable = false
    )
  )
);

alter table public.recruiter_invitation_delivery_attempts
  drop constraint if exists chk_recruiter_invitation_delivery_provider;
alter table public.recruiter_invitation_delivery_attempts
  add constraint chk_recruiter_invitation_delivery_provider
  check (length(trim(provider)) between 1 and 64);

do $$
begin
  alter table public.recruiter_invitation_delivery_attempts
    add constraint chk_recruiter_invitation_delivery_provider_reference
    check (provider_reference_id is null or length(provider_reference_id) between 1 and 500);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.recruiter_invitation_delivery_attempts
    add constraint chk_recruiter_invitation_delivery_failure_code
    check (failure_code is null or length(failure_code) between 1 and 100);
exception
  when duplicate_object then null;
end;
$$;

create index if not exists idx_recruiter_invitation_delivery_batch
  on public.recruiter_invitation_delivery_attempts(recruiter_id, recruiter_invitation_batch_id, created_at desc);

create index if not exists idx_recruiter_invitation_delivery_recipient
  on public.recruiter_invitation_delivery_attempts(recruiter_invitation_recipient_id, attempt_number desc);

create or replace function public.prevent_recruiter_invitation_delivery_attempt_mutation()
returns trigger
language plpgsql
as $$
begin
  if row(
    new.recruiter_invitation_delivery_attempt_id,
    new.recruiter_invitation_batch_id,
    new.recruiter_invitation_recipient_id,
    new.recruiter_id,
    new.retry_of_delivery_attempt_id,
    new.attempt_number,
    new.action_key_hash,
    new.channel,
    new.provider,
    new.queued_at,
    new.created_at
  ) is distinct from row(
    old.recruiter_invitation_delivery_attempt_id,
    old.recruiter_invitation_batch_id,
    old.recruiter_invitation_recipient_id,
    old.recruiter_id,
    old.retry_of_delivery_attempt_id,
    old.attempt_number,
    old.action_key_hash,
    old.channel,
    old.provider,
    old.queued_at,
    old.created_at
  ) then
    raise exception 'recruiter invitation delivery attempt identity is immutable' using errcode = '55000';
  end if;

  if not (
    (old.lifecycle_state = 'queued' and new.lifecycle_state in ('sending', 'failed'))
    or
    (old.lifecycle_state = 'sending' and new.lifecycle_state in ('provider_accepted', 'failed', 'outcome_unknown'))
  ) then
    raise exception 'invalid recruiter invitation delivery lifecycle transition' using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_recruiter_invitation_delivery_attempt_immutable
  on public.recruiter_invitation_delivery_attempts;
create trigger trg_recruiter_invitation_delivery_attempt_immutable
before update on public.recruiter_invitation_delivery_attempts
for each row execute function public.prevent_recruiter_invitation_delivery_attempt_mutation();

create or replace function public.claim_recruiter_invitation_delivery_attempt(
  p_recruiter_id uuid,
  p_recruiter_invitation_batch_id uuid,
  p_recruiter_invitation_recipient_id uuid,
  p_delivery_attempt_id uuid,
  p_action_key_hash text,
  p_provider text
)
returns table (
  claim_outcome text,
  delivery_attempt_id uuid,
  delivery_attempt_number integer,
  delivery_lifecycle_state text,
  delivery_retryable boolean,
  delivery_failure_code text
)
language plpgsql
as $$
declare
  v_existing public.recruiter_invitation_delivery_attempts%rowtype;
  v_latest public.recruiter_invitation_delivery_attempts%rowtype;
  v_attempt_number integer;
begin
  if p_action_key_hash !~ '^[0-9a-f]{64}$' or length(trim(p_provider)) = 0 then
    raise exception 'invalid recruiter invitation delivery claim input' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_recruiter_id::text || ':' || p_recruiter_invitation_recipient_id::text,
    0
  ));

  if not exists (
    select 1
    from public.recruiter_invitation_recipients recipient
    join public.recruiter_invitation_batches batch
      on batch.recruiter_invitation_batch_id = recipient.recruiter_invitation_batch_id
     and batch.recruiter_id = recipient.recruiter_id
    where recipient.recruiter_invitation_recipient_id = p_recruiter_invitation_recipient_id
      and recipient.recruiter_invitation_batch_id = p_recruiter_invitation_batch_id
      and recipient.recruiter_id = p_recruiter_id
      and recipient.lifecycle_state = 'ready'
      and batch.lifecycle_state = 'ready'
  ) then
    return query select 'not_found'::text, null::uuid, null::integer, null::text, false, null::text;
    return;
  end if;

  select * into v_existing
  from public.recruiter_invitation_delivery_attempts attempt
  where attempt.recruiter_id = p_recruiter_id
    and attempt.recruiter_invitation_batch_id = p_recruiter_invitation_batch_id
    and attempt.recruiter_invitation_recipient_id = p_recruiter_invitation_recipient_id
    and attempt.action_key_hash = p_action_key_hash
  limit 1;

  if found then
    if v_existing.lifecycle_state = 'sending'
      and v_existing.started_at < now() - interval '10 minutes' then
      update public.recruiter_invitation_delivery_attempts
      set
        lifecycle_state = 'outcome_unknown',
        failure_code = 'sending_lease_expired',
        retryable = false,
        completed_at = now(),
        updated_at = now()
      where recruiter_invitation_delivery_attempt_id = v_existing.recruiter_invitation_delivery_attempt_id
      returning * into v_existing;
    end if;
    return query select
      'replayed'::text,
      v_existing.recruiter_invitation_delivery_attempt_id,
      v_existing.attempt_number,
      v_existing.lifecycle_state,
      v_existing.retryable,
      v_existing.failure_code;
    return;
  end if;

  select * into v_latest
  from public.recruiter_invitation_delivery_attempts attempt
  where attempt.recruiter_id = p_recruiter_id
    and attempt.recruiter_invitation_batch_id = p_recruiter_invitation_batch_id
    and attempt.recruiter_invitation_recipient_id = p_recruiter_invitation_recipient_id
  order by attempt.attempt_number desc
  limit 1
  for update;

  if found then
    if v_latest.lifecycle_state = 'queued'
      and v_latest.queued_at < now() - interval '5 minutes' then
      update public.recruiter_invitation_delivery_attempts
      set
        lifecycle_state = 'failed',
        failure_code = 'queued_claim_expired',
        retryable = true,
        completed_at = now(),
        updated_at = now()
      where recruiter_invitation_delivery_attempt_id = v_latest.recruiter_invitation_delivery_attempt_id
      returning * into v_latest;
    elsif v_latest.lifecycle_state = 'sending'
      and v_latest.started_at < now() - interval '10 minutes' then
      update public.recruiter_invitation_delivery_attempts
      set
        lifecycle_state = 'outcome_unknown',
        failure_code = 'sending_lease_expired',
        retryable = false,
        completed_at = now(),
        updated_at = now()
      where recruiter_invitation_delivery_attempt_id = v_latest.recruiter_invitation_delivery_attempt_id
      returning * into v_latest;
    end if;

    if v_latest.lifecycle_state = 'provider_accepted' then
      return query select 'already_accepted'::text, v_latest.recruiter_invitation_delivery_attempt_id,
        v_latest.attempt_number, v_latest.lifecycle_state, false, null::text;
      return;
    end if;
    if v_latest.lifecycle_state in ('queued', 'sending') then
      return query select 'in_progress'::text, v_latest.recruiter_invitation_delivery_attempt_id,
        v_latest.attempt_number, v_latest.lifecycle_state, false, null::text;
      return;
    end if;
    if v_latest.lifecycle_state = 'outcome_unknown' then
      return query select 'outcome_unknown'::text, v_latest.recruiter_invitation_delivery_attempt_id,
        v_latest.attempt_number, v_latest.lifecycle_state, false, v_latest.failure_code;
      return;
    end if;
    if v_latest.lifecycle_state = 'failed' and not v_latest.retryable then
      return query select 'not_retryable'::text, v_latest.recruiter_invitation_delivery_attempt_id,
        v_latest.attempt_number, v_latest.lifecycle_state, false, v_latest.failure_code;
      return;
    end if;
  end if;

  v_attempt_number := coalesce(v_latest.attempt_number, 0) + 1;
  insert into public.recruiter_invitation_delivery_attempts (
    recruiter_invitation_delivery_attempt_id,
    recruiter_invitation_batch_id,
    recruiter_invitation_recipient_id,
    recruiter_id,
    retry_of_delivery_attempt_id,
    attempt_number,
    action_key_hash,
    channel,
    provider,
    lifecycle_state
  ) values (
    p_delivery_attempt_id,
    p_recruiter_invitation_batch_id,
    p_recruiter_invitation_recipient_id,
    p_recruiter_id,
    case when v_latest.lifecycle_state = 'failed' then v_latest.recruiter_invitation_delivery_attempt_id else null end,
    v_attempt_number,
    p_action_key_hash,
    'email',
    trim(p_provider),
    'queued'
  );

  return query select 'claimed'::text, p_delivery_attempt_id, v_attempt_number, 'queued'::text, false, null::text;
end;
$$;

comment on table public.recruiter_invitation_delivery_attempts is
  'Recipient-specific app-owned email provider invocations. Retry appends; provider acceptance is not mailbox delivery.';

comment on column public.recruiter_invitation_delivery_attempts.action_key_hash is
  'SHA-256 of a browser action key. The raw key is never persisted.';
