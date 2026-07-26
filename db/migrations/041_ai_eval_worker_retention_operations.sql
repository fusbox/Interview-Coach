begin;

create table if not exists public.ai_eval_scenario_retention_operations (
  ai_eval_scenario_retention_operation_id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  request_fingerprint text not null,
  operation_mode text not null,
  cutoff_at timestamptz not null,
  batch_limit integer not null,
  worker_id text not null,
  eligible_run_count integer not null,
  selected_run_count integer not null,
  selected_case_count integer not null,
  selected_layer_count integer not null,
  selected_live_operation_count integer not null,
  deleted_run_count integer not null,
  deleted_case_count integer not null,
  deleted_layer_count integer not null,
  deleted_live_operation_count integer not null,
  remaining_expired_run_count integer not null,
  completed_at timestamptz not null default clock_timestamp(),
  constraint chk_ai_eval_scenario_retention_fingerprint
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_ai_eval_scenario_retention_mode
    check (operation_mode in ('dry_run', 'apply')),
  constraint chk_ai_eval_scenario_retention_batch
    check (batch_limit between 1 and 500),
  constraint chk_ai_eval_scenario_retention_worker
    check (length(trim(worker_id)) between 1 and 200),
  constraint chk_ai_eval_scenario_retention_counts check (
    eligible_run_count >= 0
    and selected_run_count between 0 and batch_limit
    and selected_case_count >= 0
    and selected_layer_count >= 0
    and selected_live_operation_count >= 0
    and deleted_run_count >= 0
    and deleted_case_count >= 0
    and deleted_layer_count >= 0
    and deleted_live_operation_count >= 0
    and remaining_expired_run_count >= 0
  ),
  constraint chk_ai_eval_scenario_retention_mode_counts check (
    (
      operation_mode = 'dry_run'
      and deleted_run_count = 0
      and deleted_case_count = 0
      and deleted_layer_count = 0
      and deleted_live_operation_count = 0
    )
    or (
      operation_mode = 'apply'
      and deleted_run_count = selected_run_count
      and deleted_case_count = selected_case_count
      and deleted_layer_count = selected_layer_count
      and deleted_live_operation_count = selected_live_operation_count
    )
  )
);

create index if not exists idx_ai_eval_scenario_runs_expired_terminal
  on public.ai_eval_scenario_runs(retention_expires_at, ai_eval_scenario_run_id)
  where lifecycle_state in ('completed', 'failed', 'cancelled_before_start')
    and claim_worker_id is null
    and claim_expires_at is null;

create or replace function public.cleanup_expired_ai_eval_scenario_runs(
  p_request_key uuid,
  p_request_fingerprint text,
  p_worker_id text,
  p_cutoff_at timestamptz,
  p_batch_limit integer,
  p_apply boolean default false
)
returns setof public.ai_eval_scenario_retention_operations
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_existing public.ai_eval_scenario_retention_operations%rowtype;
  v_mode text := case when p_apply then 'apply' else 'dry_run' end;
  v_eligible_run_count integer := 0;
  v_selected_run_count integer := 0;
  v_selected_case_count integer := 0;
  v_selected_layer_count integer := 0;
  v_selected_live_operation_count integer := 0;
  v_deleted_run_count integer := 0;
  v_deleted_case_count integer := 0;
  v_deleted_layer_count integer := 0;
  v_deleted_live_operation_count integer := 0;
  v_remaining_expired_run_count integer := 0;
begin
  if p_request_key is null
     or p_request_fingerprint !~ '^[a-f0-9]{64}$'
     or length(trim(coalesce(p_worker_id, ''))) not between 1 and 200
     or p_cutoff_at is null
     or p_cutoff_at > clock_timestamp()
     or p_batch_limit not between 1 and 500 then
    raise exception 'AI-eval retention request is invalid'
      using errcode = '22023';
  end if;

  perform set_config('interview_coach.ai_eval_retention_cleanup', 'off', true);
  perform pg_advisory_xact_lock(hashtextextended('ai_eval_scenario_retention_cleanup', 0));

  select *
    into v_existing
  from public.ai_eval_scenario_retention_operations operation
  where operation.request_key = p_request_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception 'AI-eval retention request key was reused with changed inputs'
        using errcode = '23505';
    end if;
    return next v_existing;
    return;
  end if;

  select count(*)::integer
    into v_eligible_run_count
  from public.ai_eval_scenario_runs run
  where run.lifecycle_state in ('completed', 'failed', 'cancelled_before_start')
    and run.retention_expires_at <= p_cutoff_at
    and run.claim_worker_id is null
    and run.claim_expires_at is null;

  create temporary table if not exists pg_temp.ai_eval_retention_targets (
    ai_eval_scenario_run_id uuid primary key
  ) on commit drop;
  truncate table pg_temp.ai_eval_retention_targets;

  insert into pg_temp.ai_eval_retention_targets (ai_eval_scenario_run_id)
  select run.ai_eval_scenario_run_id
  from public.ai_eval_scenario_runs run
  where run.lifecycle_state in ('completed', 'failed', 'cancelled_before_start')
    and run.retention_expires_at <= p_cutoff_at
    and run.claim_worker_id is null
    and run.claim_expires_at is null
  order by run.retention_expires_at, run.ai_eval_scenario_run_id
  for update of run skip locked
  limit p_batch_limit;

  select count(*)::integer
    into v_selected_run_count
  from pg_temp.ai_eval_retention_targets;

  select count(*)::integer
    into v_selected_case_count
  from public.ai_eval_scenario_run_cases run_case
  join pg_temp.ai_eval_retention_targets target
    on target.ai_eval_scenario_run_id = run_case.ai_eval_scenario_run_id;

  select count(*)::integer
    into v_selected_layer_count
  from public.ai_eval_scenario_run_layers layer
  join public.ai_eval_scenario_run_cases run_case
    on run_case.ai_eval_scenario_run_case_id = layer.ai_eval_scenario_run_case_id
  join pg_temp.ai_eval_retention_targets target
    on target.ai_eval_scenario_run_id = run_case.ai_eval_scenario_run_id;

  select count(*)::integer
    into v_selected_live_operation_count
  from public.ai_eval_scenario_live_operations live_operation
  join pg_temp.ai_eval_retention_targets target
    on target.ai_eval_scenario_run_id = live_operation.ai_eval_scenario_run_id;

  if p_apply then
    perform set_config('interview_coach.ai_eval_retention_cleanup', 'on', true);
    delete from public.ai_eval_scenario_runs run
    using pg_temp.ai_eval_retention_targets target
    where run.ai_eval_scenario_run_id = target.ai_eval_scenario_run_id;
    get diagnostics v_deleted_run_count = row_count;
    v_deleted_case_count := v_selected_case_count;
    v_deleted_layer_count := v_selected_layer_count;
    v_deleted_live_operation_count := v_selected_live_operation_count;
  end if;

  select count(*)::integer
    into v_remaining_expired_run_count
  from public.ai_eval_scenario_runs run
  where run.lifecycle_state in ('completed', 'failed', 'cancelled_before_start')
    and run.retention_expires_at <= p_cutoff_at
    and run.claim_worker_id is null
    and run.claim_expires_at is null;

  perform set_config('interview_coach.ai_eval_retention_cleanup', 'on', true);
  insert into public.ai_eval_scenario_retention_operations (
    request_key,
    request_fingerprint,
    operation_mode,
    cutoff_at,
    batch_limit,
    worker_id,
    eligible_run_count,
    selected_run_count,
    selected_case_count,
    selected_layer_count,
    selected_live_operation_count,
    deleted_run_count,
    deleted_case_count,
    deleted_layer_count,
    deleted_live_operation_count,
    remaining_expired_run_count
  ) values (
    p_request_key,
    p_request_fingerprint,
    v_mode,
    p_cutoff_at,
    p_batch_limit,
    trim(p_worker_id),
    v_eligible_run_count,
    v_selected_run_count,
    v_selected_case_count,
    v_selected_layer_count,
    v_selected_live_operation_count,
    v_deleted_run_count,
    v_deleted_case_count,
    v_deleted_layer_count,
    v_deleted_live_operation_count,
    v_remaining_expired_run_count
  )
  returning * into v_existing;

  perform set_config('interview_coach.ai_eval_retention_cleanup', 'off', true);
  return next v_existing;
end;
$$;

create or replace function public.is_ai_eval_scenario_retention_cleanup()
returns boolean
language sql
stable
as $$
  select
    current_setting('interview_coach.ai_eval_retention_cleanup', true) = 'on'
    and current_user = (
      select pg_get_userbyid(procedure.proowner)
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'cleanup_expired_ai_eval_scenario_runs'
        and procedure.pronargs = 6
      order by procedure.oid desc
      limit 1
    );
$$;

create or replace function public.validate_ai_eval_scenario_retention_operation()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'AI-eval retention operation receipts are immutable'
      using errcode = '55000';
  end if;
  if not public.is_ai_eval_scenario_retention_cleanup() then
    raise exception 'AI-eval retention operation receipts are function-owned'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ai_eval_scenario_retention_operation_validation
  on public.ai_eval_scenario_retention_operations;
create trigger trg_ai_eval_scenario_retention_operation_validation
before insert or update or delete on public.ai_eval_scenario_retention_operations
for each row execute function public.validate_ai_eval_scenario_retention_operation();

create or replace function public.validate_ai_eval_scenario_run()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if public.is_ai_eval_scenario_retention_cleanup()
       and old.lifecycle_state in ('completed', 'failed', 'cancelled_before_start')
       and old.retention_expires_at <= clock_timestamp()
       and old.claim_worker_id is null
       and old.claim_expires_at is null then
      return old;
    end if;
    raise exception 'AI-eval scenario runs cannot be deleted directly'
      using errcode = '55000';
  end if;

  if tg_op = 'INSERT' then
    if not public.is_active_ai_eval_operator(new.requested_by_operator_user_id) then
      raise exception 'AI-eval scenario run submission requires an active individual operator grant'
        using errcode = '42501';
    end if;
    if new.lifecycle_state <> 'queued' or new.claim_generation <> 0 then
      raise exception 'AI-eval scenario runs must begin queued and unclaimed'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if row(
    new.ai_eval_scenario_run_id,
    new.requested_by_operator_user_id,
    new.creation_request_key,
    new.request_fingerprint,
    new.execution_mode,
    new.ai_eval_scenario_suite_version_id,
    new.profile_id,
    new.configuration_fingerprint,
    new.live_execution_gate_version,
    new.cost_preview_json,
    new.case_count,
    new.requested_at,
    new.retention_expires_at
  ) is distinct from row(
    old.ai_eval_scenario_run_id,
    old.requested_by_operator_user_id,
    old.creation_request_key,
    old.request_fingerprint,
    old.execution_mode,
    old.ai_eval_scenario_suite_version_id,
    old.profile_id,
    old.configuration_fingerprint,
    old.live_execution_gate_version,
    old.cost_preview_json,
    old.case_count,
    old.requested_at,
    old.retention_expires_at
  ) then
    raise exception 'AI-eval scenario run request identity is immutable'
      using errcode = '55000';
  end if;

  if new.lifecycle_state <> old.lifecycle_state and not (
    (old.lifecycle_state = 'queued' and new.lifecycle_state in ('running', 'cancelled_before_start'))
    or (old.lifecycle_state = 'running' and new.lifecycle_state in ('partial', 'completed', 'failed'))
    or (old.lifecycle_state = 'partial' and new.lifecycle_state in ('running', 'completed', 'failed'))
  ) then
    raise exception 'AI-eval scenario run lifecycle transition is not allowed'
      using errcode = '23514';
  end if;

  if old.lifecycle_state in ('completed', 'failed', 'cancelled_before_start') then
    raise exception 'Terminal AI-eval scenario runs are immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.validate_ai_eval_scenario_result_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.lifecycle_state <> 'queued' then
      raise exception 'AI-eval scenario result rows must begin queued'
        using errcode = '23514';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if public.is_ai_eval_scenario_retention_cleanup() then
      return old;
    end if;
    raise exception 'AI-eval scenario run evidence cannot be deleted directly'
      using errcode = '55000';
  end if;
  if old.lifecycle_state = 'completed' then
    raise exception 'Terminal AI-eval scenario result rows are immutable'
      using errcode = '55000';
  end if;
  if new.lifecycle_state <> old.lifecycle_state and not (
    (old.lifecycle_state = 'queued' and new.lifecycle_state in ('running', 'completed', 'failed'))
    or (old.lifecycle_state = 'running' and new.lifecycle_state in ('completed', 'failed'))
    or (old.lifecycle_state = 'failed' and new.lifecycle_state in ('running', 'completed'))
  ) then
    raise exception 'AI-eval scenario result lifecycle transition is not allowed'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_ai_eval_scenario_live_operation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if public.is_ai_eval_scenario_retention_cleanup() then
      return old;
    end if;
    raise exception 'AI-eval live operation evidence cannot be deleted in place'
      using errcode = '55000';
  end if;
  if tg_op = 'INSERT' then
    if new.lifecycle_state <> 'queued' or new.attempt_count <> 0 or new.claim_generation <> 0 then
      raise exception 'AI-eval live operations must begin queued and unclaimed'
        using errcode = '23514';
    end if;
    return new;
  end if;
  if row(
    new.ai_eval_scenario_live_operation_id,
    new.ai_eval_scenario_run_id,
    new.operation_key,
    new.operation_kind,
    new.input_fingerprint,
    new.profile_id,
    new.configuration_fingerprint,
    new.requested_at
  ) is distinct from row(
    old.ai_eval_scenario_live_operation_id,
    old.ai_eval_scenario_run_id,
    old.operation_key,
    old.operation_kind,
    old.input_fingerprint,
    old.profile_id,
    old.configuration_fingerprint,
    old.requested_at
  ) then
    raise exception 'AI-eval live operation identity is immutable'
      using errcode = '55000';
  end if;
  if new.lifecycle_state <> old.lifecycle_state and not (
    (old.lifecycle_state = 'queued' and new.lifecycle_state = 'running')
    or (old.lifecycle_state = 'running' and new.lifecycle_state in ('completed', 'failed'))
    or (old.lifecycle_state = 'failed' and old.retryable and new.lifecycle_state = 'running')
  ) then
    raise exception 'AI-eval live operation lifecycle transition is not allowed'
      using errcode = '23514';
  end if;
  if old.lifecycle_state = 'completed' then
    raise exception 'Accepted AI-eval live operation evidence is immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on table public.ai_eval_scenario_retention_operations from public;
revoke all on function public.cleanup_expired_ai_eval_scenario_runs(
  uuid, text, text, timestamptz, integer, boolean
) from public;

comment on table public.ai_eval_scenario_retention_operations is
  'Immutable metadata-only receipts for idempotent dry-run and apply cleanup of expired AI-eval run artifacts.';
comment on function public.cleanup_expired_ai_eval_scenario_runs(
  uuid, text, text, timestamptz, integer, boolean
) is
  'Owner-executed bounded retention operation. Production must grant only EXECUTE to a dedicated maintenance role.';

commit;
