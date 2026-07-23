begin;

alter table public.ai_eval_scenario_runs
  add column if not exists live_execution_gate_version text,
  add column if not exists cost_preview_json jsonb not null default '{}'::jsonb;

alter table public.ai_eval_scenario_runs
  drop constraint if exists chk_ai_eval_scenario_run_live_controls;

alter table public.ai_eval_scenario_runs
  add constraint chk_ai_eval_scenario_run_live_controls check (
    (
      execution_mode = 'credentialed_live'
      and live_execution_gate_version = 'ai_eval_scenario_live_gate_v1'
      and jsonb_typeof(cost_preview_json) = 'object'
      and cost_preview_json ->> 'version' = 'ai_eval_live_cost_preview_v1'
    )
    or (
      execution_mode <> 'credentialed_live'
      and live_execution_gate_version is null
      and jsonb_typeof(cost_preview_json) = 'object'
    )
  );

create or replace function public.validate_ai_eval_scenario_run()
returns trigger
language plpgsql
as $$
begin
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

drop function if exists public.create_ai_eval_scenario_run_request(
  uuid, uuid, text, text, uuid, text, text, uuid[]
);

create or replace function public.create_ai_eval_scenario_run_request(
  p_operator_user_id uuid,
  p_creation_request_key uuid,
  p_request_fingerprint text,
  p_execution_mode text,
  p_suite_version_id uuid,
  p_profile_id text,
  p_configuration_fingerprint text,
  p_scenario_version_ids uuid[],
  p_live_execution_gate_version text default null,
  p_cost_preview_json jsonb default '{}'::jsonb
)
returns table(outcome text, ai_eval_scenario_run_id uuid)
language plpgsql
as $$
declare
  v_existing public.ai_eval_scenario_runs%rowtype;
  v_run_id uuid;
  v_requested_count integer;
  v_available_count integer;
begin
  select * into v_existing
  from public.ai_eval_scenario_runs run
  where run.requested_by_operator_user_id = p_operator_user_id
    and run.creation_request_key = p_creation_request_key;

  if found then
    if v_existing.request_fingerprint = p_request_fingerprint then
      return query select 'replayed'::text, v_existing.ai_eval_scenario_run_id;
    else
      return query select 'idempotency_conflict'::text, v_existing.ai_eval_scenario_run_id;
    end if;
    return;
  end if;

  if p_execution_mode = 'credentialed_live' then
    if p_live_execution_gate_version <> 'ai_eval_scenario_live_gate_v1'
       or jsonb_typeof(p_cost_preview_json) <> 'object'
       or p_cost_preview_json ->> 'version' <> 'ai_eval_live_cost_preview_v1' then
      raise exception 'Credentialed AI-eval runs require an accepted live execution preview'
        using errcode = '23514';
    end if;
  elsif p_live_execution_gate_version is not null or p_cost_preview_json <> '{}'::jsonb then
    raise exception 'Non-live AI-eval runs cannot carry live execution controls'
      using errcode = '23514';
  end if;

  v_requested_count := cardinality(p_scenario_version_ids);
  select count(distinct version_id)
    into v_available_count
  from unnest(p_scenario_version_ids) version_id
  join public.ai_eval_scenario_versions version
    on version.ai_eval_scenario_version_id = version_id
   and (
     version.source_kind = 'baseline'
     or version.staged_by_operator_user_id = p_operator_user_id
   );

  if v_requested_count is null
     or v_requested_count = 0
     or v_requested_count <> v_available_count then
    raise exception 'AI-eval scenario run requires distinct existing staged versions'
      using errcode = '23514';
  end if;

  insert into public.ai_eval_scenario_runs (
    requested_by_operator_user_id,
    creation_request_key,
    request_fingerprint,
    execution_mode,
    ai_eval_scenario_suite_version_id,
    profile_id,
    configuration_fingerprint,
    live_execution_gate_version,
    cost_preview_json,
    case_count
  ) values (
    p_operator_user_id,
    p_creation_request_key,
    p_request_fingerprint,
    p_execution_mode,
    p_suite_version_id,
    p_profile_id,
    p_configuration_fingerprint,
    p_live_execution_gate_version,
    p_cost_preview_json,
    v_requested_count
  ) returning public.ai_eval_scenario_runs.ai_eval_scenario_run_id into v_run_id;

  insert into public.ai_eval_scenario_run_cases (
    ai_eval_scenario_run_id,
    ai_eval_scenario_version_id,
    ordinal
  )
  select v_run_id, version_id, ordinal::integer
  from unnest(p_scenario_version_ids) with ordinality requested(version_id, ordinal);

  insert into public.ai_eval_scenario_run_layers (
    ai_eval_scenario_run_case_id,
    output_layer,
    candidate_visible
  )
  select
    run_case.ai_eval_scenario_run_case_id,
    layer.value,
    layer.value <> 'evaluator_diagnostics'
  from public.ai_eval_scenario_run_cases run_case
  join public.ai_eval_scenario_versions version
    on version.ai_eval_scenario_version_id = run_case.ai_eval_scenario_version_id
  cross join lateral jsonb_array_elements_text(
    version.scenario_payload_json -> 'intendedOutputLayers'
  ) layer(value)
  where run_case.ai_eval_scenario_run_id = v_run_id;

  return query select 'created'::text, v_run_id;
end;
$$;

create table if not exists public.ai_eval_scenario_live_operations (
  ai_eval_scenario_live_operation_id uuid primary key default gen_random_uuid(),
  ai_eval_scenario_run_id uuid not null
    references public.ai_eval_scenario_runs(ai_eval_scenario_run_id) on delete cascade,
  operation_key text not null,
  operation_kind text not null,
  input_fingerprint text not null,
  profile_id text not null,
  configuration_fingerprint text not null,
  lifecycle_state text not null default 'queued',
  attempt_count integer not null default 0,
  retryable boolean not null default false,
  next_attempt_at timestamptz,
  claim_worker_id text,
  claim_generation integer not null default 0,
  claim_expires_at timestamptz,
  accepted_output_json jsonb,
  failure_json jsonb,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint uq_ai_eval_scenario_live_operation unique (ai_eval_scenario_run_id, operation_key),
  constraint chk_ai_eval_scenario_live_operation_key check (operation_key ~ '^[a-z0-9][a-z0-9_.:-]{2,199}$'),
  constraint chk_ai_eval_scenario_live_operation_kind check (
    operation_kind in ('answer_evaluation', 'coach_update')
  ),
  constraint chk_ai_eval_scenario_live_operation_fingerprint check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_ai_eval_scenario_live_operation_profile check (length(trim(profile_id)) between 1 and 200),
  constraint chk_ai_eval_scenario_live_operation_configuration check (configuration_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_ai_eval_scenario_live_operation_state check (
    lifecycle_state in ('queued', 'running', 'completed', 'failed')
  ),
  constraint chk_ai_eval_scenario_live_operation_attempts check (attempt_count between 0 and 3),
  constraint chk_ai_eval_scenario_live_operation_payloads check (
    (accepted_output_json is null or jsonb_typeof(accepted_output_json) = 'object')
    and (failure_json is null or jsonb_typeof(failure_json) = 'object')
  ),
  constraint chk_ai_eval_scenario_live_operation_claim check (
    (lifecycle_state = 'running' and claim_worker_id is not null and claim_expires_at is not null)
    or (lifecycle_state <> 'running' and claim_worker_id is null and claim_expires_at is null)
  ),
  constraint chk_ai_eval_scenario_live_operation_result check (
    (lifecycle_state in ('queued', 'running') and accepted_output_json is null and failure_json is null and completed_at is null)
    or (lifecycle_state = 'completed' and accepted_output_json is not null and failure_json is null and not retryable and completed_at is not null)
    or (lifecycle_state = 'failed' and accepted_output_json is null and failure_json is not null and completed_at is not null)
  ),
  constraint chk_ai_eval_scenario_live_operation_retry check (
    (retryable and lifecycle_state = 'failed' and next_attempt_at is not null and attempt_count < 3)
    or (not retryable and next_attempt_at is null)
  ),
  constraint chk_ai_eval_scenario_live_operation_times check (
    (started_at is null or started_at >= requested_at)
    and (completed_at is null or (started_at is not null and completed_at >= started_at))
    and updated_at >= requested_at
  )
);

create index if not exists idx_ai_eval_scenario_live_operations_run
  on public.ai_eval_scenario_live_operations(ai_eval_scenario_run_id, lifecycle_state, next_attempt_at);

create or replace function public.validate_ai_eval_scenario_live_operation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
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

drop trigger if exists trg_ai_eval_scenario_live_operation_validation
  on public.ai_eval_scenario_live_operations;
create trigger trg_ai_eval_scenario_live_operation_validation
before insert or update or delete on public.ai_eval_scenario_live_operations
for each row execute function public.validate_ai_eval_scenario_live_operation();

create or replace function public.claim_ai_eval_scenario_live_operation(
  p_run_id uuid,
  p_operation_key text,
  p_operation_kind text,
  p_input_fingerprint text,
  p_profile_id text,
  p_configuration_fingerprint text,
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns setof public.ai_eval_scenario_live_operations
language plpgsql
as $$
declare
  v_existing public.ai_eval_scenario_live_operations%rowtype;
begin
  if length(trim(coalesce(p_worker_id, ''))) = 0 or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'AI-eval live operation worker claim is invalid'
      using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.ai_eval_scenario_runs run
    where run.ai_eval_scenario_run_id = p_run_id
      and run.execution_mode = 'credentialed_live'
      and run.lifecycle_state = 'running'
      and run.claim_worker_id = trim(p_worker_id)
      and run.claim_expires_at > now()
  ) then
    raise exception 'AI-eval live operation requires the current run claim'
      using errcode = '42501';
  end if;

  insert into public.ai_eval_scenario_live_operations (
    ai_eval_scenario_run_id,
    operation_key,
    operation_kind,
    input_fingerprint,
    profile_id,
    configuration_fingerprint
  ) values (
    p_run_id,
    p_operation_key,
    p_operation_kind,
    p_input_fingerprint,
    p_profile_id,
    p_configuration_fingerprint
  ) on conflict (ai_eval_scenario_run_id, operation_key) do nothing;

  select * into v_existing
  from public.ai_eval_scenario_live_operations operation
  where operation.ai_eval_scenario_run_id = p_run_id
    and operation.operation_key = p_operation_key
  for update;

  if v_existing.operation_kind <> p_operation_kind
     or v_existing.input_fingerprint <> p_input_fingerprint
     or v_existing.profile_id <> p_profile_id
     or v_existing.configuration_fingerprint <> p_configuration_fingerprint then
    raise exception 'AI-eval live operation key was reused with changed identity'
      using errcode = '23505';
  end if;

  if v_existing.lifecycle_state = 'completed' then
    return query select v_existing.*;
    return;
  end if;

  return query
  update public.ai_eval_scenario_live_operations operation
  set lifecycle_state = 'running',
      attempt_count = operation.attempt_count + 1,
      retryable = false,
      next_attempt_at = null,
      claim_worker_id = trim(p_worker_id),
      claim_generation = operation.claim_generation + 1,
      claim_expires_at = now() + make_interval(secs => p_lease_seconds),
      failure_json = null,
      started_at = coalesce(operation.started_at, now()),
      completed_at = null,
      updated_at = now()
  where operation.ai_eval_scenario_live_operation_id = v_existing.ai_eval_scenario_live_operation_id
    and operation.attempt_count < 3
    and (
      operation.lifecycle_state = 'queued'
      or (
        operation.lifecycle_state = 'failed'
        and operation.retryable
        and operation.next_attempt_at <= now()
      )
      or (
        operation.lifecycle_state = 'running'
        and operation.claim_expires_at <= now()
      )
    )
  returning operation.*;
end;
$$;

create or replace function public.claim_next_ai_eval_live_scenario_run(
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns setof public.ai_eval_scenario_runs
language plpgsql
as $$
begin
  if length(trim(coalesce(p_worker_id, ''))) = 0 or p_lease_seconds < 60 or p_lease_seconds > 900 then
    raise exception 'AI-eval live scenario worker claim is invalid'
      using errcode = '22023';
  end if;

  return query
  with claimable as (
    select run.ai_eval_scenario_run_id
    from public.ai_eval_scenario_runs run
    where run.execution_mode = 'credentialed_live'
      and (
        run.lifecycle_state = 'queued'
        or (
          run.lifecycle_state = 'partial'
          and (
            run.error_code = 'PROJECTION_RETRY_REQUIRED'
            or exists (
              select 1
              from public.ai_eval_scenario_live_operations operation
              where operation.ai_eval_scenario_run_id = run.ai_eval_scenario_run_id
                and operation.lifecycle_state = 'failed'
                and operation.retryable
                and operation.next_attempt_at <= now()
            )
          )
        )
        or (run.lifecycle_state = 'running' and run.claim_expires_at <= now())
      )
    order by run.requested_at, run.ai_eval_scenario_run_id
    for update skip locked
    limit 1
  )
  update public.ai_eval_scenario_runs run
  set lifecycle_state = 'running',
      claim_worker_id = trim(p_worker_id),
      claim_generation = run.claim_generation + 1,
      claim_expires_at = now() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(run.started_at, now()),
      error_code = null
  from claimable
  where run.ai_eval_scenario_run_id = claimable.ai_eval_scenario_run_id
  returning run.*;
end;
$$;

create or replace function public.claim_ai_eval_live_scenario_run(
  p_run_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns setof public.ai_eval_scenario_runs
language plpgsql
as $$
begin
  if length(trim(coalesce(p_worker_id, ''))) = 0 or p_lease_seconds < 60 or p_lease_seconds > 900 then
    raise exception 'AI-eval live scenario worker claim is invalid'
      using errcode = '22023';
  end if;
  return query
  update public.ai_eval_scenario_runs run
  set lifecycle_state = 'running',
      claim_worker_id = trim(p_worker_id),
      claim_generation = run.claim_generation + 1,
      claim_expires_at = now() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(run.started_at, now()),
      error_code = null
  where run.ai_eval_scenario_run_id = p_run_id
    and run.execution_mode = 'credentialed_live'
    and (
      run.lifecycle_state = 'queued'
      or (
        run.lifecycle_state = 'partial'
        and (
          run.error_code = 'PROJECTION_RETRY_REQUIRED'
          or exists (
            select 1
            from public.ai_eval_scenario_live_operations operation
            where operation.ai_eval_scenario_run_id = run.ai_eval_scenario_run_id
              and operation.lifecycle_state = 'failed'
              and operation.retryable
              and operation.next_attempt_at <= now()
          )
        )
      )
      or (run.lifecycle_state = 'running' and run.claim_expires_at <= now())
    )
  returning run.*;
end;
$$;

commit;
