-- Durable synthetic scenario authoring, immutable staging, and recoverable contract-mode runs.
-- Scenario/output content is protected by the individual AI-eval grant and never copied into auth audit metadata.

create table if not exists public.ai_eval_scenario_drafts (
  ai_eval_scenario_draft_id uuid primary key default gen_random_uuid(),
  owner_operator_user_id uuid not null references public.app_users(user_id) on delete restrict,
  creation_request_key uuid not null,
  scenario_key text not null,
  scenario_kind text not null,
  title text not null,
  lifecycle_state text not null default 'active',
  scenario_payload_json jsonb not null,
  coverage_json jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint uq_ai_eval_scenario_draft_creation unique (owner_operator_user_id, creation_request_key),
  constraint uq_ai_eval_scenario_draft_key unique (owner_operator_user_id, scenario_key),
  constraint chk_ai_eval_scenario_draft_key check (scenario_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint chk_ai_eval_scenario_draft_kind check (scenario_kind in ('atomic_answer', 'round_journey')),
  constraint chk_ai_eval_scenario_draft_title check (length(trim(title)) between 1 and 200),
  constraint chk_ai_eval_scenario_draft_state check (lifecycle_state in ('active', 'archived')),
  constraint chk_ai_eval_scenario_draft_payload check (jsonb_typeof(scenario_payload_json) = 'object'),
  constraint chk_ai_eval_scenario_draft_coverage check (jsonb_typeof(coverage_json) = 'object'),
  constraint chk_ai_eval_scenario_draft_revision check (revision > 0),
  constraint chk_ai_eval_scenario_draft_archive check (
    (lifecycle_state = 'active' and archived_at is null)
    or (lifecycle_state = 'archived' and archived_at is not null)
  )
);

create index if not exists idx_ai_eval_scenario_drafts_owner
  on public.ai_eval_scenario_drafts(owner_operator_user_id, lifecycle_state, updated_at desc);

create or replace function public.validate_ai_eval_scenario_draft()
returns trigger
language plpgsql
as $$
begin
  if not public.is_active_ai_eval_operator(new.owner_operator_user_id) then
    raise exception 'AI-eval scenario draft mutation requires an active individual operator grant'
      using errcode = '42501';
  end if;

  if new.scenario_payload_json ->> 'scenarioKey' is distinct from new.scenario_key
     or new.scenario_payload_json ->> 'kind' is distinct from new.scenario_kind
     or new.scenario_payload_json ->> 'title' is distinct from new.title then
    raise exception 'AI-eval scenario draft columns must match the validated payload identity'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if row(
      new.ai_eval_scenario_draft_id,
      new.owner_operator_user_id,
      new.creation_request_key,
      new.scenario_key,
      new.scenario_kind,
      new.created_at
    ) is distinct from row(
      old.ai_eval_scenario_draft_id,
      old.owner_operator_user_id,
      old.creation_request_key,
      old.scenario_key,
      old.scenario_kind,
      old.created_at
    ) then
      raise exception 'AI-eval scenario draft ownership and identity are immutable'
        using errcode = '55000';
    end if;
    if new.revision <> old.revision + 1 then
      raise exception 'AI-eval scenario draft revision must advance by one'
        using errcode = '40001';
    end if;
    if old.lifecycle_state = 'archived' then
      raise exception 'Archived AI-eval scenario drafts are immutable'
        using errcode = '55000';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ai_eval_scenario_draft_validation on public.ai_eval_scenario_drafts;
create trigger trg_ai_eval_scenario_draft_validation
before insert or update on public.ai_eval_scenario_drafts
for each row execute function public.validate_ai_eval_scenario_draft();

create table if not exists public.ai_eval_scenario_versions (
  ai_eval_scenario_version_id uuid primary key default gen_random_uuid(),
  source_draft_id uuid references public.ai_eval_scenario_drafts(ai_eval_scenario_draft_id) on delete restrict,
  source_draft_revision integer,
  staged_by_operator_user_id uuid not null references public.app_users(user_id) on delete restrict,
  source_kind text not null,
  scenario_key text not null,
  scenario_kind text not null,
  title text not null,
  version_number integer not null,
  input_fingerprint text not null,
  scenario_payload_json jsonb not null,
  coverage_json jsonb not null default '{}'::jsonb,
  staged_at timestamptz not null default now(),
  constraint uq_ai_eval_scenario_version unique (source_kind, scenario_key, version_number),
  constraint chk_ai_eval_scenario_version_source check (source_kind in ('baseline', 'operator')),
  constraint chk_ai_eval_scenario_version_source_draft check (
    (source_kind = 'baseline' and source_draft_id is null and source_draft_revision is null)
    or (source_kind = 'operator' and source_draft_id is not null and source_draft_revision > 0)
  ),
  constraint chk_ai_eval_scenario_version_key check (scenario_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint chk_ai_eval_scenario_version_kind check (scenario_kind in ('atomic_answer', 'round_journey')),
  constraint chk_ai_eval_scenario_version_title check (length(trim(title)) between 1 and 200),
  constraint chk_ai_eval_scenario_version_number check (version_number > 0),
  constraint chk_ai_eval_scenario_version_fingerprint check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_ai_eval_scenario_version_payload check (jsonb_typeof(scenario_payload_json) = 'object'),
  constraint chk_ai_eval_scenario_version_coverage check (jsonb_typeof(coverage_json) = 'object')
);

alter table public.ai_eval_scenario_versions
  add column if not exists source_draft_revision integer;

alter table public.ai_eval_scenario_versions
  drop constraint if exists chk_ai_eval_scenario_version_source_draft;

alter table public.ai_eval_scenario_versions
  add constraint chk_ai_eval_scenario_version_source_draft check (
    (source_kind = 'baseline' and source_draft_id is null and source_draft_revision is null)
    or (source_kind = 'operator' and source_draft_id is not null and source_draft_revision > 0)
  );

create unique index if not exists uq_ai_eval_scenario_version_draft_revision
  on public.ai_eval_scenario_versions(source_draft_id, source_draft_revision)
  where source_draft_id is not null;

create index if not exists idx_ai_eval_scenario_versions_key
  on public.ai_eval_scenario_versions(scenario_key, version_number desc);

create or replace function public.validate_ai_eval_scenario_version()
returns trigger
language plpgsql
as $$
declare
  v_draft_owner uuid;
  v_draft_key text;
  v_draft_kind text;
  v_draft_payload jsonb;
  v_draft_revision integer;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Staged AI-eval scenario versions are immutable'
      using errcode = '55000';
  end if;
  if not public.is_active_ai_eval_operator(new.staged_by_operator_user_id) then
    raise exception 'AI-eval scenario staging requires an active individual operator grant'
      using errcode = '42501';
  end if;
  if new.scenario_payload_json ->> 'scenarioKey' is distinct from new.scenario_key
     or new.scenario_payload_json ->> 'kind' is distinct from new.scenario_kind
     or new.scenario_payload_json ->> 'title' is distinct from new.title then
    raise exception 'AI-eval scenario version columns must match the validated payload identity'
      using errcode = '23514';
  end if;
  if new.source_kind = 'operator' then
    select owner_operator_user_id, scenario_key, scenario_kind, scenario_payload_json, revision
      into v_draft_owner, v_draft_key, v_draft_kind, v_draft_payload, v_draft_revision
    from public.ai_eval_scenario_drafts
    where ai_eval_scenario_draft_id = new.source_draft_id
      and lifecycle_state = 'active';
    if v_draft_owner is distinct from new.staged_by_operator_user_id
       or v_draft_key is distinct from new.scenario_key
       or v_draft_kind is distinct from new.scenario_kind
       or v_draft_revision is distinct from new.source_draft_revision
       or v_draft_payload is distinct from new.scenario_payload_json then
      raise exception 'Operator scenario staging requires the exact active owned draft payload'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ai_eval_scenario_version_validation on public.ai_eval_scenario_versions;
create trigger trg_ai_eval_scenario_version_validation
before insert or update or delete on public.ai_eval_scenario_versions
for each row execute function public.validate_ai_eval_scenario_version();

create table if not exists public.ai_eval_scenario_suite_versions (
  ai_eval_scenario_suite_version_id uuid primary key default gen_random_uuid(),
  suite_key text not null,
  suite_version text not null,
  title text not null,
  source_kind text not null,
  manifest_fingerprint text not null,
  created_by_operator_user_id uuid not null references public.app_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint uq_ai_eval_scenario_suite_version unique (suite_key, suite_version),
  constraint chk_ai_eval_scenario_suite_key check (suite_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint chk_ai_eval_scenario_suite_version check (length(trim(suite_version)) between 1 and 120),
  constraint chk_ai_eval_scenario_suite_title check (length(trim(title)) between 1 and 200),
  constraint chk_ai_eval_scenario_suite_source check (source_kind in ('baseline', 'operator')),
  constraint chk_ai_eval_scenario_suite_fingerprint check (manifest_fingerprint ~ '^[a-f0-9]{64}$')
);

create table if not exists public.ai_eval_scenario_suite_members (
  ai_eval_scenario_suite_member_id uuid primary key default gen_random_uuid(),
  ai_eval_scenario_suite_version_id uuid not null
    references public.ai_eval_scenario_suite_versions(ai_eval_scenario_suite_version_id) on delete cascade,
  ai_eval_scenario_version_id uuid not null
    references public.ai_eval_scenario_versions(ai_eval_scenario_version_id) on delete restrict,
  ordinal integer not null,
  constraint uq_ai_eval_scenario_suite_member unique (
    ai_eval_scenario_suite_version_id,
    ai_eval_scenario_version_id
  ),
  constraint uq_ai_eval_scenario_suite_ordinal unique (
    ai_eval_scenario_suite_version_id,
    ordinal
  ),
  constraint chk_ai_eval_scenario_suite_ordinal check (ordinal > 0)
);

create or replace function public.validate_ai_eval_scenario_suite_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'AI-eval scenario suite manifests are immutable'
      using errcode = '55000';
  end if;
  if tg_table_name = 'ai_eval_scenario_suite_versions'
     and not public.is_active_ai_eval_operator(
       nullif(to_jsonb(new) ->> 'created_by_operator_user_id', '')::uuid
     ) then
    raise exception 'AI-eval suite creation requires an active individual operator grant'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ai_eval_scenario_suite_version_immutable on public.ai_eval_scenario_suite_versions;
create trigger trg_ai_eval_scenario_suite_version_immutable
before insert or update or delete on public.ai_eval_scenario_suite_versions
for each row execute function public.validate_ai_eval_scenario_suite_immutable();

drop trigger if exists trg_ai_eval_scenario_suite_member_immutable on public.ai_eval_scenario_suite_members;
create trigger trg_ai_eval_scenario_suite_member_immutable
before insert or update or delete on public.ai_eval_scenario_suite_members
for each row execute function public.validate_ai_eval_scenario_suite_immutable();

create table if not exists public.ai_eval_scenario_runs (
  ai_eval_scenario_run_id uuid primary key default gen_random_uuid(),
  requested_by_operator_user_id uuid not null references public.app_users(user_id) on delete restrict,
  creation_request_key uuid not null,
  request_fingerprint text not null,
  execution_mode text not null,
  ai_eval_scenario_suite_version_id uuid
    references public.ai_eval_scenario_suite_versions(ai_eval_scenario_suite_version_id) on delete restrict,
  profile_id text not null,
  configuration_fingerprint text not null,
  lifecycle_state text not null default 'queued',
  case_count integer not null,
  completed_case_count integer not null default 0,
  failed_case_count integer not null default 0,
  assertion_result text,
  error_code text,
  claim_worker_id text,
  claim_generation integer not null default 0,
  claim_expires_at timestamptz,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  retention_expires_at timestamptz not null default (now() + interval '30 days'),
  constraint uq_ai_eval_scenario_run_request unique (requested_by_operator_user_id, creation_request_key),
  constraint chk_ai_eval_scenario_run_fingerprint check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_ai_eval_scenario_run_mode check (
    execution_mode in ('contract_fixture', 'credentialed_live', 'same_profile_regression')
  ),
  constraint chk_ai_eval_scenario_run_profile check (length(trim(profile_id)) between 1 and 160),
  constraint chk_ai_eval_scenario_run_configuration check (configuration_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_ai_eval_scenario_run_state check (
    lifecycle_state in ('queued', 'running', 'partial', 'completed', 'failed', 'cancelled_before_start')
  ),
  constraint chk_ai_eval_scenario_run_counts check (
    case_count > 0
    and completed_case_count >= 0
    and failed_case_count >= 0
    and completed_case_count + failed_case_count <= case_count
  ),
  constraint chk_ai_eval_scenario_run_assertion check (
    assertion_result is null or assertion_result in ('pass', 'fail', 'review_required')
  ),
  constraint chk_ai_eval_scenario_run_error check (error_code is null or length(trim(error_code)) between 1 and 160),
  constraint chk_ai_eval_scenario_run_claim check (
    (claim_worker_id is null and claim_expires_at is null)
    or (lifecycle_state = 'running' and claim_worker_id is not null and claim_expires_at is not null)
  ),
  constraint chk_ai_eval_scenario_run_times check (
    (started_at is null or started_at >= requested_at)
    and (completed_at is null or (started_at is not null and completed_at >= started_at))
    and retention_expires_at > requested_at
  )
);

create index if not exists idx_ai_eval_scenario_runs_queue
  on public.ai_eval_scenario_runs(lifecycle_state, requested_at, ai_eval_scenario_run_id);

create index if not exists idx_ai_eval_scenario_runs_operator
  on public.ai_eval_scenario_runs(requested_by_operator_user_id, requested_at desc);

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

drop trigger if exists trg_ai_eval_scenario_run_validation on public.ai_eval_scenario_runs;
create trigger trg_ai_eval_scenario_run_validation
before insert or update or delete on public.ai_eval_scenario_runs
for each row execute function public.validate_ai_eval_scenario_run();

create table if not exists public.ai_eval_scenario_run_cases (
  ai_eval_scenario_run_case_id uuid primary key default gen_random_uuid(),
  ai_eval_scenario_run_id uuid not null
    references public.ai_eval_scenario_runs(ai_eval_scenario_run_id) on delete cascade,
  ai_eval_scenario_version_id uuid not null
    references public.ai_eval_scenario_versions(ai_eval_scenario_version_id) on delete restrict,
  ordinal integer not null,
  lifecycle_state text not null default 'queued',
  assertion_result text,
  assertion_reasons_json jsonb not null default '[]'::jsonb,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  constraint uq_ai_eval_scenario_run_case unique (ai_eval_scenario_run_id, ai_eval_scenario_version_id),
  constraint uq_ai_eval_scenario_run_case_ordinal unique (ai_eval_scenario_run_id, ordinal),
  constraint chk_ai_eval_scenario_run_case_ordinal check (ordinal > 0),
  constraint chk_ai_eval_scenario_run_case_state check (lifecycle_state in ('queued', 'running', 'completed', 'failed')),
  constraint chk_ai_eval_scenario_run_case_assertion check (
    assertion_result is null or assertion_result in ('pass', 'fail', 'review_required')
  ),
  constraint chk_ai_eval_scenario_run_case_reasons check (jsonb_typeof(assertion_reasons_json) = 'array'),
  constraint chk_ai_eval_scenario_run_case_error check (error_code is null or length(trim(error_code)) between 1 and 160),
  constraint chk_ai_eval_scenario_run_case_times check (
    completed_at is null or (started_at is not null and completed_at >= started_at)
  )
);

create index if not exists idx_ai_eval_scenario_run_cases_run
  on public.ai_eval_scenario_run_cases(ai_eval_scenario_run_id, ordinal);

create table if not exists public.ai_eval_scenario_run_layers (
  ai_eval_scenario_run_layer_id uuid primary key default gen_random_uuid(),
  ai_eval_scenario_run_case_id uuid not null
    references public.ai_eval_scenario_run_cases(ai_eval_scenario_run_case_id) on delete cascade,
  output_layer text not null,
  lifecycle_state text not null default 'queued',
  assertion_result text,
  assertion_reasons_json jsonb not null default '[]'::jsonb,
  candidate_visible boolean not null,
  output_json jsonb,
  diagnostics_json jsonb,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  constraint uq_ai_eval_scenario_run_layer unique (ai_eval_scenario_run_case_id, output_layer),
  constraint chk_ai_eval_scenario_run_layer_name check (
    output_layer in (
      'evaluator_diagnostics',
      'session_coaching',
      'transcript_evidence',
      'coach_update',
      'invited_completion',
      'candidate_dashboard'
    )
  ),
  constraint chk_ai_eval_scenario_run_layer_state check (lifecycle_state in ('queued', 'running', 'completed', 'failed')),
  constraint chk_ai_eval_scenario_run_layer_assertion check (
    assertion_result is null or assertion_result in ('pass', 'fail', 'review_required')
  ),
  constraint chk_ai_eval_scenario_run_layer_reasons check (jsonb_typeof(assertion_reasons_json) = 'array'),
  constraint chk_ai_eval_scenario_run_layer_output check (output_json is null or jsonb_typeof(output_json) = 'object'),
  constraint chk_ai_eval_scenario_run_layer_diagnostics check (diagnostics_json is null or jsonb_typeof(diagnostics_json) = 'object'),
  constraint chk_ai_eval_scenario_run_layer_error check (error_code is null or length(trim(error_code)) between 1 and 160),
  constraint chk_ai_eval_scenario_run_layer_times check (
    completed_at is null or (started_at is not null and completed_at >= started_at)
  )
);

create index if not exists idx_ai_eval_scenario_run_layers_case
  on public.ai_eval_scenario_run_layers(ai_eval_scenario_run_case_id, output_layer);

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

drop trigger if exists trg_ai_eval_scenario_run_case_transition on public.ai_eval_scenario_run_cases;
create trigger trg_ai_eval_scenario_run_case_transition
before insert or update or delete on public.ai_eval_scenario_run_cases
for each row execute function public.validate_ai_eval_scenario_result_transition();

drop trigger if exists trg_ai_eval_scenario_run_layer_transition on public.ai_eval_scenario_run_layers;
create trigger trg_ai_eval_scenario_run_layer_transition
before insert or update or delete on public.ai_eval_scenario_run_layers
for each row execute function public.validate_ai_eval_scenario_result_transition();

create or replace function public.create_ai_eval_scenario_run_request(
  p_operator_user_id uuid,
  p_creation_request_key uuid,
  p_request_fingerprint text,
  p_execution_mode text,
  p_suite_version_id uuid,
  p_profile_id text,
  p_configuration_fingerprint text,
  p_scenario_version_ids uuid[]
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
    case_count
  ) values (
    p_operator_user_id,
    p_creation_request_key,
    p_request_fingerprint,
    p_execution_mode,
    p_suite_version_id,
    p_profile_id,
    p_configuration_fingerprint,
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

create or replace function public.claim_next_ai_eval_scenario_run(
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns setof public.ai_eval_scenario_runs
language plpgsql
as $$
begin
  if length(trim(coalesce(p_worker_id, ''))) = 0 or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception 'AI-eval scenario worker claim is invalid'
      using errcode = '22023';
  end if;

  return query
  with claimable as (
    select run.ai_eval_scenario_run_id
    from public.ai_eval_scenario_runs run
    where run.execution_mode = 'contract_fixture'
      and (
        run.lifecycle_state in ('queued', 'partial')
        or (
          run.lifecycle_state = 'running'
          and run.claim_expires_at <= now()
        )
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
      started_at = coalesce(run.started_at, now())
  from claimable
  where run.ai_eval_scenario_run_id = claimable.ai_eval_scenario_run_id
  returning run.*;
end;
$$;

create or replace function public.claim_ai_eval_scenario_run(
  p_run_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns setof public.ai_eval_scenario_runs
language plpgsql
as $$
begin
  if length(trim(coalesce(p_worker_id, ''))) = 0 or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception 'AI-eval scenario worker claim is invalid'
      using errcode = '22023';
  end if;

  return query
  update public.ai_eval_scenario_runs run
  set lifecycle_state = 'running',
      claim_worker_id = trim(p_worker_id),
      claim_generation = run.claim_generation + 1,
      claim_expires_at = now() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(run.started_at, now())
  where run.ai_eval_scenario_run_id = p_run_id
    and run.execution_mode = 'contract_fixture'
    and (
      run.lifecycle_state in ('queued', 'partial')
      or (run.lifecycle_state = 'running' and run.claim_expires_at <= now())
    )
  returning run.*;
end;
$$;

create or replace function public.audit_ai_eval_scenario_mutation()
returns trigger
language plpgsql
as $$
declare
  v_user_id uuid;
  v_entity_id uuid;
  v_state text;
  v_new jsonb;
begin
  v_new := to_jsonb(new);
  v_user_id := coalesce(
    nullif(v_new ->> 'owner_operator_user_id', '')::uuid,
    nullif(v_new ->> 'staged_by_operator_user_id', '')::uuid,
    nullif(v_new ->> 'requested_by_operator_user_id', '')::uuid
  );
  v_entity_id := coalesce(
    nullif(v_new ->> 'ai_eval_scenario_draft_id', '')::uuid,
    nullif(v_new ->> 'ai_eval_scenario_version_id', '')::uuid,
    nullif(v_new ->> 'ai_eval_scenario_run_id', '')::uuid
  );
  v_state := case
    when tg_table_name in ('ai_eval_scenario_drafts', 'ai_eval_scenario_runs') then v_new ->> 'lifecycle_state'
    else 'staged'
  end;
  insert into public.auth_audit_events (user_id, event_type, outcome, metadata)
  values (
    v_user_id,
    'ai_eval_scenario_mutated',
    'success',
    jsonb_build_object(
      'entity_type', tg_table_name,
      'entity_id', v_entity_id,
      'action', lower(tg_op),
      'lifecycle_state', v_state
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_ai_eval_scenario_draft_audit on public.ai_eval_scenario_drafts;
create trigger trg_ai_eval_scenario_draft_audit
after insert or update on public.ai_eval_scenario_drafts
for each row execute function public.audit_ai_eval_scenario_mutation();

drop trigger if exists trg_ai_eval_scenario_version_audit on public.ai_eval_scenario_versions;
create trigger trg_ai_eval_scenario_version_audit
after insert on public.ai_eval_scenario_versions
for each row execute function public.audit_ai_eval_scenario_mutation();

drop trigger if exists trg_ai_eval_scenario_run_audit on public.ai_eval_scenario_runs;
create trigger trg_ai_eval_scenario_run_audit
after insert or update on public.ai_eval_scenario_runs
for each row execute function public.audit_ai_eval_scenario_mutation();

comment on table public.ai_eval_scenario_drafts is
  'Operator-owned editable synthetic scenario content protected by the individual AI-eval grant.';
comment on table public.ai_eval_scenario_versions is
  'Immutable staged synthetic scenario versions identified by canonical input fingerprints.';
comment on table public.ai_eval_scenario_suite_versions is
  'Immutable scenario-suite manifests; membership is stored separately and ordered.';
comment on table public.ai_eval_scenario_runs is
  'Durable idempotent scenario execution requests with renewable worker claims and explicit retention deadlines.';
comment on table public.ai_eval_scenario_run_layers is
  'Immutable terminal per-layer scenario outputs and diagnostics; generated content is excluded from auth audit metadata.';
