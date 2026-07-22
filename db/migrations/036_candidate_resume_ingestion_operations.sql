-- Durable cross-instance admission, replay, and publication fencing for candidate resume ingestion.
-- This ledger stores operational metadata only; resume content and source fingerprints remain elsewhere.

create table if not exists public.candidate_resume_ingestion_operations (
  candidate_resume_ingestion_operation_id uuid primary key,
  candidate_profile_id uuid not null
    references public.candidate_profiles(candidate_profile_id) on delete cascade,
  setup_owner_key text not null,
  source text not null,
  lifecycle_state text not null,
  claim_generation integer not null,
  requested_at timestamptz not null,
  claim_expires_at timestamptz not null,
  candidate_resume_artifact_id uuid,
  terminal_reason text,
  input_size_class text not null default 'unknown',
  page_count integer not null default 0,
  duration_ms integer,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_candidate_resume_ingestion_artifact
    foreign key (candidate_profile_id, candidate_resume_artifact_id)
    references public.candidate_resume_processed_artifacts(candidate_profile_id, candidate_resume_artifact_id),
  constraint chk_candidate_resume_ingestion_owner
    check (length(trim(setup_owner_key)) between 1 and 320),
  constraint chk_candidate_resume_ingestion_source
    check (source in ('pasted_text', 'document_upload', 'photo_capture')),
  constraint chk_candidate_resume_ingestion_lifecycle
    check (lifecycle_state in ('processing', 'completed', 'failed', 'superseded')),
  constraint chk_candidate_resume_ingestion_generation
    check (claim_generation between 1 and 3),
  constraint chk_candidate_resume_ingestion_lease
    check (claim_expires_at > requested_at),
  constraint chk_candidate_resume_ingestion_reason
    check (terminal_reason is null or terminal_reason in (
      'invalid_request',
      'unsupported_type',
      'too_large',
      'unreadable_source',
      'extraction_failed',
      'empty_extraction',
      'provider_unavailable',
      'provider_rejected',
      'disposal_failed',
      'persistence_failed',
      'stale_claim',
      'generation_limit',
      'superseded_selection'
    )),
  constraint chk_candidate_resume_ingestion_size_class
    check (input_size_class in ('unknown', 'tiny', 'small', 'medium', 'large', 'maximum')),
  constraint chk_candidate_resume_ingestion_page_count
    check (page_count between 0 and 4),
  constraint chk_candidate_resume_ingestion_duration
    check (duration_ms is null or duration_ms between 0 and 300000),
  constraint chk_candidate_resume_ingestion_shape check (
    (
      lifecycle_state = 'processing'
      and candidate_resume_artifact_id is null
      and terminal_reason is null
      and duration_ms is null
      and completed_at is null
    )
    or
    (
      lifecycle_state = 'completed'
      and candidate_resume_artifact_id is not null
      and terminal_reason is null
      and duration_ms is not null
      and completed_at is not null
    )
    or
    (
      lifecycle_state = 'failed'
      and candidate_resume_artifact_id is null
      and terminal_reason is not null
      and duration_ms is not null
      and completed_at is not null
    )
    or
    (
      lifecycle_state = 'superseded'
      and candidate_resume_artifact_id is not null
      and terminal_reason = 'superseded_selection'
      and duration_ms is not null
      and completed_at is not null
    )
  )
);

create index if not exists idx_candidate_resume_ingestion_active_source
  on public.candidate_resume_ingestion_operations(source, claim_expires_at)
  where lifecycle_state = 'processing';

create index if not exists idx_candidate_resume_ingestion_active_owner
  on public.candidate_resume_ingestion_operations(candidate_profile_id, setup_owner_key, claim_expires_at)
  where lifecycle_state = 'processing';

create index if not exists idx_candidate_resume_ingestion_recent_candidate
  on public.candidate_resume_ingestion_operations(candidate_profile_id, source, created_at desc);

drop trigger if exists trg_candidate_resume_ingestion_operations_updated_at
  on public.candidate_resume_ingestion_operations;
create trigger trg_candidate_resume_ingestion_operations_updated_at
before update on public.candidate_resume_ingestion_operations
for each row execute function public.set_updated_at();

create or replace function public.claim_candidate_resume_ingestion_operation(
  p_operation_id uuid,
  p_candidate_profile_id uuid,
  p_setup_owner_key text,
  p_source text,
  p_requested_at timestamptz,
  p_claim_expires_at timestamptz,
  p_global_active_limit integer,
  p_recent_owner_limit integer,
  p_recent_window_seconds integer,
  p_generation_limit integer
)
returns table (
  claim_outcome text,
  claim_generation integer,
  lifecycle_state text,
  candidate_resume_artifact_id uuid,
  claim_expires_at timestamptz
)
language plpgsql
as $$
declare
  v_existing public.candidate_resume_ingestion_operations%rowtype;
  v_active_count integer;
  v_recent_count integer;
begin
  if p_source not in ('pasted_text', 'document_upload', 'photo_capture')
     or length(trim(p_setup_owner_key)) not between 1 and 320
     or p_claim_expires_at <= p_requested_at
     or p_global_active_limit < 1
     or p_recent_owner_limit < 1
     or p_recent_window_seconds < 1
     or p_generation_limit not between 1 and 3 then
    raise exception 'invalid candidate resume ingestion claim';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('candidate_resume_ingestion_admission_v1', 0));

  select * into v_existing
  from public.candidate_resume_ingestion_operations operation
  where operation.candidate_resume_ingestion_operation_id = p_operation_id
  for update;

  if found then
    if v_existing.candidate_profile_id <> p_candidate_profile_id
       or v_existing.setup_owner_key <> trim(p_setup_owner_key)
       or v_existing.source <> p_source then
      return query select 'ownership_conflict'::text, v_existing.claim_generation,
        v_existing.lifecycle_state, null::uuid, v_existing.claim_expires_at;
      return;
    end if;

    if v_existing.lifecycle_state = 'completed' then
      return query select 'replayed'::text, v_existing.claim_generation,
        v_existing.lifecycle_state, v_existing.candidate_resume_artifact_id, v_existing.claim_expires_at;
      return;
    end if;

    if v_existing.lifecycle_state = 'processing' and v_existing.claim_expires_at > p_requested_at then
      return query select 'in_progress'::text, v_existing.claim_generation,
        v_existing.lifecycle_state, null::uuid, v_existing.claim_expires_at;
      return;
    end if;

    if (
      (v_existing.lifecycle_state = 'processing' and v_existing.claim_expires_at <= p_requested_at)
      or (v_existing.lifecycle_state = 'failed' and v_existing.terminal_reason = 'stale_claim')
    ) then
      if v_existing.claim_generation >= p_generation_limit then
        update public.candidate_resume_ingestion_operations as operation
        set lifecycle_state = 'failed',
            terminal_reason = 'generation_limit',
            duration_ms = least(300000, greatest(0, floor(extract(epoch from (p_requested_at - operation.requested_at)) * 1000)::integer)),
            completed_at = p_requested_at,
            updated_at = p_requested_at
        where candidate_resume_ingestion_operation_id = p_operation_id;
        return query select 'generation_limit'::text, v_existing.claim_generation,
          'failed'::text, null::uuid, v_existing.claim_expires_at;
        return;
      end if;

      select count(*)::integer into v_active_count
      from public.candidate_resume_ingestion_operations operation
      where operation.source = p_source
        and operation.lifecycle_state = 'processing'
        and operation.claim_expires_at > p_requested_at
        and operation.candidate_resume_ingestion_operation_id <> p_operation_id;
      if v_active_count >= p_global_active_limit then
        return query select 'capacity_limited'::text, v_existing.claim_generation,
          v_existing.lifecycle_state, null::uuid, v_existing.claim_expires_at;
        return;
      end if;

      update public.candidate_resume_ingestion_operations as operation
      set lifecycle_state = 'processing',
          claim_generation = operation.claim_generation + 1,
          requested_at = p_requested_at,
          claim_expires_at = p_claim_expires_at,
          candidate_resume_artifact_id = null,
          terminal_reason = null,
          input_size_class = 'unknown',
          page_count = 0,
          duration_ms = null,
          completed_at = null,
          updated_at = p_requested_at
      where candidate_resume_ingestion_operation_id = p_operation_id
      returning * into v_existing;

      return query select 'acquired'::text, v_existing.claim_generation,
        v_existing.lifecycle_state, null::uuid, v_existing.claim_expires_at;
      return;
    end if;

    return query select 'terminal'::text, v_existing.claim_generation,
      v_existing.lifecycle_state, v_existing.candidate_resume_artifact_id, v_existing.claim_expires_at;
    return;
  end if;

  update public.candidate_resume_ingestion_operations as operation
  set lifecycle_state = 'failed',
      terminal_reason = 'stale_claim',
      duration_ms = least(300000, greatest(0, floor(extract(epoch from (p_requested_at - operation.requested_at)) * 1000)::integer)),
      completed_at = p_requested_at,
      updated_at = p_requested_at
  where operation.lifecycle_state = 'processing'
    and operation.claim_expires_at <= p_requested_at;

  if exists (
    select 1
    from public.candidate_resume_ingestion_operations operation
    where operation.candidate_profile_id = p_candidate_profile_id
      and operation.setup_owner_key = trim(p_setup_owner_key)
      and operation.lifecycle_state = 'processing'
      and operation.claim_expires_at > p_requested_at
  ) then
    return query select 'owner_busy'::text, 0, 'processing'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select count(*)::integer into v_recent_count
  from public.candidate_resume_ingestion_operations operation
  where operation.candidate_profile_id = p_candidate_profile_id
    and operation.source = p_source
    and operation.created_at >= p_requested_at - make_interval(secs => p_recent_window_seconds);
  if v_recent_count >= p_recent_owner_limit then
    return query select 'rate_limited'::text, 0, 'failed'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select count(*)::integer into v_active_count
  from public.candidate_resume_ingestion_operations operation
  where operation.source = p_source
    and operation.lifecycle_state = 'processing'
    and operation.claim_expires_at > p_requested_at;
  if v_active_count >= p_global_active_limit then
    return query select 'capacity_limited'::text, 0, 'processing'::text, null::uuid, null::timestamptz;
    return;
  end if;

  insert into public.candidate_resume_ingestion_operations (
    candidate_resume_ingestion_operation_id,
    candidate_profile_id,
    setup_owner_key,
    source,
    lifecycle_state,
    claim_generation,
    requested_at,
    claim_expires_at,
    created_at,
    updated_at
  ) values (
    p_operation_id,
    p_candidate_profile_id,
    trim(p_setup_owner_key),
    p_source,
    'processing',
    1,
    p_requested_at,
    p_claim_expires_at,
    p_requested_at,
    p_requested_at
  ) returning * into v_existing;

  return query select 'acquired'::text, v_existing.claim_generation,
    v_existing.lifecycle_state, null::uuid, v_existing.claim_expires_at;
end;
$$;

create or replace function public.complete_candidate_resume_ingestion_operation(
  p_operation_id uuid,
  p_candidate_profile_id uuid,
  p_setup_owner_key text,
  p_source text,
  p_claim_generation integer,
  p_candidate_resume_artifact_id uuid,
  p_input_size_class text,
  p_page_count integer,
  p_duration_ms integer,
  p_completed_at timestamptz
)
returns text
language plpgsql
as $$
declare
  v_operation public.candidate_resume_ingestion_operations%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('candidate_resume_ingestion_admission_v1', 0));

  select * into v_operation
  from public.candidate_resume_ingestion_operations operation
  where operation.candidate_resume_ingestion_operation_id = p_operation_id
  for update;

  if not found then return 'stale_claim'; end if;
  if v_operation.candidate_profile_id <> p_candidate_profile_id
     or v_operation.setup_owner_key <> trim(p_setup_owner_key)
     or v_operation.source <> p_source then
    return 'ownership_conflict';
  end if;
  if v_operation.lifecycle_state = 'completed' then return 'replayed'; end if;
  if v_operation.lifecycle_state <> 'processing'
     or v_operation.claim_generation <> p_claim_generation
     or v_operation.claim_expires_at <= p_completed_at then
    return 'stale_claim';
  end if;
  if not exists (
    select 1
    from public.candidate_resume_processed_artifacts artifact
    where artifact.candidate_resume_artifact_id = p_candidate_resume_artifact_id
      and artifact.candidate_profile_id = p_candidate_profile_id
      and artifact.source = p_source
      and artifact.review_state in ('awaiting_review', 'accepted')
  ) then
    return 'ownership_conflict';
  end if;

  update public.candidate_setup_resume_selections selection
  set pending_operation_id = null,
      candidate_resume_artifact_id = p_candidate_resume_artifact_id,
      lifecycle_state = 'active',
      updated_at = p_completed_at
  where selection.candidate_profile_id = p_candidate_profile_id
    and selection.setup_owner_key = trim(p_setup_owner_key)
    and selection.pending_operation_id = p_operation_id
    and selection.lifecycle_state = 'pending';

  if not found then
    update public.candidate_resume_ingestion_operations
    set lifecycle_state = 'superseded',
        candidate_resume_artifact_id = p_candidate_resume_artifact_id,
        terminal_reason = 'superseded_selection',
        input_size_class = p_input_size_class,
        page_count = p_page_count,
        duration_ms = p_duration_ms,
        completed_at = p_completed_at,
        updated_at = p_completed_at
    where candidate_resume_ingestion_operation_id = p_operation_id;
    return 'superseded';
  end if;

  update public.candidate_resume_ingestion_operations
  set lifecycle_state = 'completed',
      candidate_resume_artifact_id = p_candidate_resume_artifact_id,
      terminal_reason = null,
      input_size_class = p_input_size_class,
      page_count = p_page_count,
      duration_ms = p_duration_ms,
      completed_at = p_completed_at,
      updated_at = p_completed_at
  where candidate_resume_ingestion_operation_id = p_operation_id;
  return 'completed';
end;
$$;

create or replace function public.fail_candidate_resume_ingestion_operation(
  p_operation_id uuid,
  p_candidate_profile_id uuid,
  p_setup_owner_key text,
  p_source text,
  p_claim_generation integer,
  p_terminal_reason text,
  p_input_size_class text,
  p_page_count integer,
  p_duration_ms integer,
  p_completed_at timestamptz
)
returns text
language plpgsql
as $$
declare
  v_operation public.candidate_resume_ingestion_operations%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('candidate_resume_ingestion_admission_v1', 0));
  select * into v_operation
  from public.candidate_resume_ingestion_operations operation
  where operation.candidate_resume_ingestion_operation_id = p_operation_id
  for update;

  if not found then return 'stale_claim'; end if;
  if v_operation.candidate_profile_id <> p_candidate_profile_id
     or v_operation.setup_owner_key <> trim(p_setup_owner_key)
     or v_operation.source <> p_source then
    return 'ownership_conflict';
  end if;
  if v_operation.lifecycle_state <> 'processing'
     or v_operation.claim_generation <> p_claim_generation
     or v_operation.claim_expires_at <= p_completed_at then
    return 'stale_claim';
  end if;

  update public.candidate_resume_ingestion_operations
  set lifecycle_state = 'failed',
      terminal_reason = p_terminal_reason,
      input_size_class = p_input_size_class,
      page_count = p_page_count,
      duration_ms = p_duration_ms,
      completed_at = p_completed_at,
      updated_at = p_completed_at
  where candidate_resume_ingestion_operation_id = p_operation_id;
  return 'failed';
end;
$$;
