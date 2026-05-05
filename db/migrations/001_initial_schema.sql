-- Interview Coach Recruiter - neutral Postgres initial schema
-- Target: phase-1 standalone app without Supabase Auth, Supabase RLS, or Supabase service-role access.
-- Source inputs:
--   - docs/04-architecture/postgres-migration/db_schema.md
--   - supabase/schema.sql
--   - supabase/migrations/*.sql
--   - docs/04-architecture/postgres-migration/target_schema_reconciliation.md
--
-- This migration is intended for a fresh target database. Historical Supabase data migration
-- is out of scope for phase 1 unless explicitly reintroduced.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.session_status as enum (
    'NOT_STARTED',
    'GENERATING_QUESTIONS',
    'IN_SESSION',
    'AWAITING_EVAL',
    'ERROR',
    'COMPLETED',
    'PAUSED',
    'REVIEWING',
    'AWAITING_EVALUATION'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.actor_type as enum ('candidate', 'recruiter', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.eval_status as enum ('NONE', 'PENDING', 'COMPLETE', 'FAILED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.modality_type as enum ('text', 'voice');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tts_status as enum ('NONE', 'GENERATING', 'READY', 'FAILED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.session_readiness_level as enum ('RL1', 'RL2', 'RL3', 'RL4');
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- App-owned auth replaces Supabase Auth for recruiter/admin/QA users.
create table if not exists public.app_users (
  user_id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text,
  first_name text,
  last_name text,
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_app_users_email_nonempty check (length(trim(email)) > 0)
);

create unique index if not exists ux_app_users_email_lower on public.app_users (lower(email));
create index if not exists idx_app_users_status on public.app_users (status);

drop trigger if exists trg_app_users_updated_at on public.app_users;
create trigger trg_app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

create table if not exists public.app_user_credentials (
  user_id uuid primary key references public.app_users(user_id) on delete cascade,
  password_hash text not null,
  password_updated_at timestamptz not null default now(),
  failed_login_count integer not null default 0 check (failed_login_count >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_app_user_credentials_updated_at on public.app_user_credentials;
create trigger trg_app_user_credentials_updated_at
before update on public.app_user_credentials
for each row execute function public.set_updated_at();

create table if not exists public.app_sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  ip_address inet,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create index if not exists idx_app_sessions_user_id on public.app_sessions(user_id);
create index if not exists idx_app_sessions_expires_at on public.app_sessions(expires_at);
create index if not exists idx_app_sessions_active on public.app_sessions(user_id, expires_at)
  where revoked_at is null;

create table if not exists public.app_user_roles (
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  role text not null check (role in ('recruiter', 'admin', 'qa')),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.app_users(user_id) on delete set null,
  primary key (user_id, role)
);

create index if not exists idx_app_user_roles_role on public.app_user_roles(role);

create table if not exists public.password_reset_tokens (
  token_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_user_id on public.password_reset_tokens(user_id);
create index if not exists idx_password_reset_tokens_expires_at on public.password_reset_tokens(expires_at);

create table if not exists public.email_verification_tokens (
  token_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_verification_tokens_user_id on public.email_verification_tokens(user_id);
create index if not exists idx_email_verification_tokens_expires_at on public.email_verification_tokens(expires_at);

create table if not exists public.auth_audit_events (
  event_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(user_id) on delete set null,
  event_type text not null,
  outcome text not null check (outcome in ('success', 'failed')),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_audit_events_user_time on public.auth_audit_events(user_id, created_at desc);
create index if not exists idx_auth_audit_events_type_time on public.auth_audit_events(event_type, created_at desc);

create table if not exists public.sessions (
  session_id uuid primary key default gen_random_uuid(),
  recruiter_id uuid references public.app_users(user_id) on delete set null,
  status public.session_status not null default 'NOT_STARTED',
  current_question_index integer not null default 0,
  target_role text,
  job_description text,
  intake_json jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  parent_session_id uuid references public.sessions(session_id) on delete set null,
  attempt_number integer default 1,
  client_name text,
  readiness_band public.session_readiness_level,
  summary_narrative text,
  invitation_sent_at timestamptz,
  constraint chk_sessions_current_question_index_nonneg check (current_question_index >= 0),
  constraint chk_sessions_attempt_number_min check (attempt_number is null or attempt_number >= 1)
);

create index if not exists idx_sessions_recruiter_id on public.sessions(recruiter_id);
create index if not exists idx_sessions_status on public.sessions(status);
create index if not exists idx_sessions_parent_id on public.sessions(parent_session_id);
create index if not exists idx_sessions_readiness on public.sessions(readiness_band);
create index if not exists idx_sessions_invitation_sent_at on public.sessions(invitation_sent_at);

drop trigger if exists trg_sessions_updated_at on public.sessions;
create trigger trg_sessions_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create table if not exists public.candidate_tokens (
  token_id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  session_id uuid not null references public.sessions(session_id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_candidate_tokens_session_id on public.candidate_tokens(session_id);
create index if not exists idx_candidate_tokens_expires_at on public.candidate_tokens(expires_at);

create table if not exists public.events (
  event_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(session_id) on delete cascade,
  event_type text not null,
  actor public.actor_type not null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  correlation_id uuid,
  event_version integer not null default 1,
  schema_hash text,
  created_at timestamptz not null default now(),
  constraint uq_events_idempotency unique (session_id, event_type, idempotency_key)
);

create index if not exists idx_events_session_time on public.events(session_id, occurred_at desc);
create index if not exists idx_events_correlation_id on public.events(correlation_id);

create table if not exists public.questions (
  question_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(session_id) on delete cascade,
  question_index integer not null,
  question_text text not null,
  competencies jsonb,
  scoring_dimensions jsonb,
  tts_state public.tts_status not null default 'NONE',
  tts_audio_ref text,
  tts_generated_at timestamptz,
  created_at timestamptz not null default now(),
  category text not null default 'General',
  constraint uq_questions_session_index unique (session_id, question_index),
  constraint chk_question_index_nonneg check (question_index >= 0)
);

create index if not exists idx_questions_session_id on public.questions(session_id);

create table if not exists public.answers (
  answer_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(session_id) on delete cascade,
  question_id uuid not null references public.questions(question_id) on delete cascade,
  attempt_number integer not null default 1,
  modality public.modality_type not null default 'text',
  draft_text text,
  draft_revision integer not null default 0,
  draft_updated_at timestamptz,
  final_text text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_answers_question_attempt unique (question_id, attempt_number),
  constraint chk_attempt_number_min check (attempt_number >= 1),
  constraint chk_answers_draft_revision_nonneg check (draft_revision >= 0)
);

create index if not exists idx_answers_session_id on public.answers(session_id);
create index if not exists idx_answers_question_id on public.answers(question_id);

drop trigger if exists trg_answers_updated_at on public.answers;
create trigger trg_answers_updated_at
before update on public.answers
for each row execute function public.set_updated_at();

create table if not exists public.eval_results (
  eval_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(session_id) on delete cascade,
  question_id uuid not null references public.questions(question_id) on delete cascade,
  attempt_number integer not null default 1,
  status public.eval_status not null default 'PENDING',
  feedback_json jsonb,
  model_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_eval_question_attempt unique (question_id, attempt_number),
  constraint chk_eval_attempt_number_min check (attempt_number >= 1)
);

create index if not exists idx_eval_session_id on public.eval_results(session_id);
create index if not exists idx_eval_question_id on public.eval_results(question_id);
create index if not exists idx_eval_status on public.eval_results(status);

drop trigger if exists trg_eval_results_updated_at on public.eval_results;
create trigger trg_eval_results_updated_at
before update on public.eval_results
for each row execute function public.set_updated_at();

create table if not exists public.projection_session_now (
  session_id uuid primary key references public.sessions(session_id) on delete cascade,
  state_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_projection_session_now_updated_at on public.projection_session_now;
create trigger trg_projection_session_now_updated_at
before update on public.projection_session_now
for each row execute function public.set_updated_at();

create table if not exists public.recruiter_profiles (
  recruiter_id uuid primary key references public.app_users(user_id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  timezone text default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text
);

drop trigger if exists trg_recruiter_profiles_updated_at on public.recruiter_profiles;
create trigger trg_recruiter_profiles_updated_at
before update on public.recruiter_profiles
for each row execute function public.set_updated_at();

create table if not exists public.recruiter_templates (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.app_users(user_id) on delete cascade,
  name text not null,
  is_shared boolean not null default true,
  target_role text not null,
  questions jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recruiter_templates_recruiter_id on public.recruiter_templates(recruiter_id);
create index if not exists idx_recruiter_templates_is_shared on public.recruiter_templates(is_shared);

drop trigger if exists trg_recruiter_templates_updated_at on public.recruiter_templates;
create trigger trg_recruiter_templates_updated_at
before update on public.recruiter_templates
for each row execute function public.set_updated_at();

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(session_id) on delete set null,
  recruiter_id uuid references public.app_users(user_id) on delete set null,
  type text not null,
  rating integer,
  comment text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint chk_user_feedback_rating_range check (rating is null or rating between 1 and 5)
);

create index if not exists idx_user_feedback_type on public.user_feedback(type);
create index if not exists idx_user_feedback_recruiter_id on public.user_feedback(recruiter_id);
create index if not exists idx_user_feedback_created_at on public.user_feedback(created_at);

create table if not exists public.invite_batches (
  batch_id uuid primary key,
  parent_batch_id uuid references public.invite_batches(batch_id) on delete set null,
  last_retry_batch_id uuid references public.invite_batches(batch_id) on delete set null,
  created_by uuid not null references public.app_users(user_id) on delete restrict,
  role text not null,
  job_description text,
  questions_json jsonb not null default '[]'::jsonb,
  status text not null check (status in ('pending', 'completed', 'failed', 'retry_issued')),
  requested_count integer not null default 0,
  succeeded_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint chk_invite_batches_counts_nonneg check (
    requested_count >= 0 and succeeded_count >= 0 and failed_count >= 0
  )
);

create index if not exists idx_invite_batches_created_by on public.invite_batches(created_by, created_at desc);
create index if not exists idx_invite_batches_parent_batch_id on public.invite_batches(parent_batch_id);

drop trigger if exists trg_invite_batches_updated_at on public.invite_batches;
create trigger trg_invite_batches_updated_at
before update on public.invite_batches
for each row execute function public.set_updated_at();

create table if not exists public.invite_batch_candidates (
  batch_candidate_id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.invite_batches(batch_id) on delete cascade,
  candidate_index integer not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  req_id text not null,
  resume_text text,
  status text not null check (status in ('pending', 'created', 'failed', 'retry_issued')),
  retryable boolean not null default true,
  retry_count integer not null default 0,
  session_id uuid references public.sessions(session_id) on delete set null,
  error_code text,
  error_message text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_invite_batch_candidates_batch_index unique (batch_id, candidate_index),
  constraint chk_invite_batch_candidates_index_nonneg check (candidate_index >= 0),
  constraint chk_invite_batch_candidates_retry_count_nonneg check (retry_count >= 0)
);

create index if not exists idx_invite_batch_candidates_batch_id on public.invite_batch_candidates(batch_id, candidate_index);
create index if not exists idx_invite_batch_candidates_status on public.invite_batch_candidates(batch_id, status);
create index if not exists idx_invite_batch_candidates_session_id on public.invite_batch_candidates(session_id);

drop trigger if exists trg_invite_batch_candidates_updated_at on public.invite_batch_candidates;
create trigger trg_invite_batch_candidates_updated_at
before update on public.invite_batch_candidates
for each row execute function public.set_updated_at();

create table if not exists public.api_idempotency_keys (
  scope text not null,
  actor_id uuid not null,
  key_hash text not null,
  request_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  status_code integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (scope, actor_id, key_hash)
);

create index if not exists idx_api_idempotency_keys_expires_at on public.api_idempotency_keys(expires_at);

create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  count integer not null check (count >= 0),
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_buckets_reset_at on public.rate_limit_buckets(reset_at);

drop trigger if exists trg_rate_limit_buckets_updated_at on public.rate_limit_buckets;
create trigger trg_rate_limit_buckets_updated_at
before update on public.rate_limit_buckets
for each row execute function public.set_updated_at();

create table if not exists public.metric_counter_rollups (
  bucket_start timestamptz not null,
  metric_name text not null,
  tags_key text not null,
  tags jsonb not null default '{}'::jsonb,
  value bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bucket_start, metric_name, tags_key)
);

create table if not exists public.metric_timing_rollups (
  bucket_start timestamptz not null,
  metric_name text not null,
  tags_key text not null,
  tags jsonb not null default '{}'::jsonb,
  count bigint not null default 0,
  total_ms bigint not null default 0,
  min_ms integer not null default 0,
  max_ms integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bucket_start, metric_name, tags_key),
  constraint chk_metric_timing_rollups_values_nonneg check (
    count >= 0 and total_ms >= 0 and min_ms >= 0 and max_ms >= 0
  )
);

create table if not exists public.ai_generations (
  generation_id uuid primary key default gen_random_uuid(),
  app_name text not null,
  surface text not null check (surface in (
    'question_generation',
    'answer_feedback',
    'hint',
    'strong_response',
    'session_debrief'
  )),
  status text not null check (status in ('success', 'failed', 'partial')),
  input_snapshot jsonb not null default '{}'::jsonb,
  context_artifacts jsonb not null default '[]'::jsonb,
  prompt_version text not null,
  model_provider text not null,
  model_name text not null,
  model_params jsonb not null default '{}'::jsonb,
  raw_output jsonb,
  parsed_output jsonb,
  latency_ms integer not null default 0,
  token_usage jsonb,
  cost_estimate numeric,
  trace_id text,
  correlation_id text,
  created_by uuid references public.app_users(user_id) on delete set null,
  session_id uuid references public.sessions(session_id) on delete set null,
  invite_batch_id uuid references public.invite_batches(batch_id) on delete set null,
  candidate_id text,
  error_json jsonb,
  privacy_flags text[] not null default '{}'::text[],
  redaction_status text not null check (redaction_status in ('raw', 'redacted', 'not_applicable')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  prompt_snapshot jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  retention_class text not null default 'eval_redacted' check (
    retention_class in ('eval_redacted', 'eval_raw_restricted', 'operational_debug')
  ),
  retention_until timestamptz,
  constraint chk_ai_generations_latency_nonneg check (latency_ms >= 0)
);

create index if not exists idx_ai_generations_created_at on public.ai_generations(created_at desc);
create index if not exists idx_ai_generations_surface_status on public.ai_generations(surface, status);
create index if not exists idx_ai_generations_surface_created_at on public.ai_generations(surface, created_at desc);
create index if not exists idx_ai_generations_status_created_at on public.ai_generations(status, created_at desc);
create index if not exists idx_ai_generations_session_id on public.ai_generations(session_id);
create index if not exists idx_ai_generations_created_by on public.ai_generations(created_by);
create index if not exists idx_ai_generations_created_by_created_at on public.ai_generations(created_by, created_at desc);
create index if not exists idx_ai_generations_trace_id on public.ai_generations(trace_id);
create index if not exists idx_ai_generations_correlation_id on public.ai_generations(correlation_id);
create index if not exists idx_ai_generations_retention_until on public.ai_generations(retention_until)
  where retention_until is not null;
create index if not exists idx_ai_generations_source_refs on public.ai_generations using gin(source_refs);

comment on table public.ai_generations is
  'AI quality and observability records for captured model generations. Access is mediated by server app authorization.';

comment on column public.ai_generations.prompt_snapshot is
  'Structured prompt snapshot for replay/eval. Prefer redacted content and source references over raw PII.';

comment on column public.ai_generations.source_refs is
  'Pointers to source operational records used to create this generation, such as session/question/answer/eval IDs.';

comment on column public.ai_generations.retention_class is
  'Retention posture for the captured generation: eval_redacted, eval_raw_restricted, or operational_debug.';

create or replace function public.get_ai_generation_summary(
  p_surface text default null,
  p_status text default null,
  p_search text default null
)
returns table (
  total_count bigint,
  success_count bigint,
  partial_count bigint,
  failed_count bigint,
  average_latency_ms numeric
)
language sql
stable
as $$
  with normalized as (
    select nullif(btrim(p_search), '') as search_value
  ),
  filtered as (
    select ag.*
    from public.ai_generations ag
    cross join normalized n
    where (p_surface is null or ag.surface = p_surface)
      and (p_status is null or ag.status = p_status)
      and (
        n.search_value is null
        or ag.generation_id::text ilike '%' || n.search_value || '%'
        or ag.app_name ilike '%' || n.search_value || '%'
        or ag.surface ilike '%' || n.search_value || '%'
        or ag.status ilike '%' || n.search_value || '%'
        or ag.prompt_version ilike '%' || n.search_value || '%'
        or ag.model_provider ilike '%' || n.search_value || '%'
        or ag.model_name ilike '%' || n.search_value || '%'
        or coalesce(ag.trace_id, '') ilike '%' || n.search_value || '%'
        or coalesce(ag.correlation_id, '') ilike '%' || n.search_value || '%'
        or coalesce(ag.created_by::text, '') ilike '%' || n.search_value || '%'
        or coalesce(ag.session_id::text, '') ilike '%' || n.search_value || '%'
        or coalesce(ag.invite_batch_id::text, '') ilike '%' || n.search_value || '%'
        or coalesce(ag.candidate_id, '') ilike '%' || n.search_value || '%'
        or ag.redaction_status ilike '%' || n.search_value || '%'
        or ag.retention_class ilike '%' || n.search_value || '%'
      )
  )
  select
    count(*) as total_count,
    count(*) filter (where status = 'success') as success_count,
    count(*) filter (where status = 'partial') as partial_count,
    count(*) filter (where status = 'failed') as failed_count,
    avg(latency_ms)::numeric as average_latency_ms
  from filtered;
$$;

comment on function public.get_ai_generation_summary(text, text, text) is
  'Filtered aggregate summary for the AI Quality Center generation explorer.';

create or replace function public.increment_session_engagement(
  p_session_id uuid,
  p_delta_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_intake jsonb;
  next_total integer;
begin
  if p_delta_seconds is null or p_delta_seconds < 0 then
    raise exception 'p_delta_seconds must be a non-negative integer';
  end if;

  select coalesce(intake_json, '{}'::jsonb)
  into current_intake
  from public.sessions
  where session_id = p_session_id
  for update;

  if not found then
    raise exception 'session not found';
  end if;

  next_total := coalesce((current_intake ->> 'engaged_time_seconds')::integer, 0) + p_delta_seconds;

  update public.sessions
  set intake_json = jsonb_set(
    coalesce(intake_json, '{}'::jsonb),
    '{engaged_time_seconds}',
    to_jsonb(next_total),
    true
  )
  where session_id = p_session_id;

  return next_total;
end;
$$;

create or replace function public.consume_rate_limit_bucket(
  p_bucket_key text,
  p_max_requests integer,
  p_window_ms integer,
  p_now_ms bigint default null
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at_ms bigint
)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := to_timestamp(coalesce(p_now_ms, floor(extract(epoch from clock_timestamp()) * 1000)) / 1000.0);
  v_window interval := (p_window_ms::text || ' milliseconds')::interval;
  v_count integer;
begin
  if p_max_requests <= 0 then
    raise exception 'p_max_requests must be positive';
  end if;

  if p_window_ms <= 0 then
    raise exception 'p_window_ms must be positive';
  end if;

  loop
    update public.rate_limit_buckets
    set
      count = case when reset_at <= v_now then 1 else count + 1 end,
      reset_at = case when reset_at <= v_now then v_now + v_window else reset_at end
    where bucket_key = p_bucket_key
      and (reset_at <= v_now or count < p_max_requests)
    returning count, floor(extract(epoch from reset_at) * 1000)::bigint
      into v_count, reset_at_ms;

    if found then
      allowed := true;
      remaining := greatest(0, p_max_requests - v_count);
      return next;
      return;
    end if;

    select count, floor(extract(epoch from reset_at) * 1000)::bigint
    into v_count, reset_at_ms
    from public.rate_limit_buckets
    where bucket_key = p_bucket_key;

    if found then
      if reset_at_ms > floor(extract(epoch from v_now) * 1000)::bigint then
        allowed := false;
        remaining := 0;
        return next;
        return;
      end if;

      continue;
    end if;

    begin
      insert into public.rate_limit_buckets (bucket_key, count, reset_at)
      values (p_bucket_key, 1, v_now + v_window)
      returning floor(extract(epoch from reset_at) * 1000)::bigint into reset_at_ms;

      allowed := true;
      remaining := greatest(0, p_max_requests - 1);
      return next;
      return;
    exception when unique_violation then
      continue;
    end;
  end loop;
end;
$$;

create or replace function public.record_metric_counter_rollup(
  p_bucket_start timestamptz,
  p_metric_name text,
  p_tags jsonb,
  p_tags_key text,
  p_value bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.metric_counter_rollups (bucket_start, metric_name, tags_key, tags, value)
  values (p_bucket_start, p_metric_name, p_tags_key, coalesce(p_tags, '{}'::jsonb), p_value)
  on conflict (bucket_start, metric_name, tags_key)
  do update set
    value = public.metric_counter_rollups.value + excluded.value,
    tags = excluded.tags,
    updated_at = now();
end;
$$;

create or replace function public.record_metric_timing_rollup(
  p_bucket_start timestamptz,
  p_metric_name text,
  p_tags jsonb,
  p_tags_key text,
  p_duration_ms integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.metric_timing_rollups (
    bucket_start,
    metric_name,
    tags_key,
    tags,
    count,
    total_ms,
    min_ms,
    max_ms
  )
  values (
    p_bucket_start,
    p_metric_name,
    p_tags_key,
    coalesce(p_tags, '{}'::jsonb),
    1,
    p_duration_ms,
    p_duration_ms,
    p_duration_ms
  )
  on conflict (bucket_start, metric_name, tags_key)
  do update set
    count = public.metric_timing_rollups.count + 1,
    total_ms = public.metric_timing_rollups.total_ms + excluded.total_ms,
    min_ms = least(public.metric_timing_rollups.min_ms, excluded.min_ms),
    max_ms = greatest(public.metric_timing_rollups.max_ms, excluded.max_ms),
    tags = excluded.tags,
    updated_at = now();
end;
$$;

create or replace function public.get_metric_counter_rollups(
  p_since timestamptz
)
returns table (
  metric_name text,
  tags_key text,
  tags jsonb,
  value bigint
)
language sql
security definer
set search_path = public
as $$
  select
    metric_name,
    tags_key,
    (array_agg(tags order by bucket_start desc))[1] as tags,
    sum(value) as value
  from public.metric_counter_rollups
  where bucket_start >= p_since
  group by metric_name, tags_key
  order by metric_name, tags_key;
$$;

create or replace function public.get_metric_timing_rollups(
  p_since timestamptz
)
returns table (
  metric_name text,
  tags_key text,
  tags jsonb,
  count bigint,
  total_ms bigint,
  min_ms integer,
  max_ms integer
)
language sql
security definer
set search_path = public
as $$
  select
    metric_name,
    tags_key,
    (array_agg(tags order by bucket_start desc))[1] as tags,
    sum(count) as count,
    sum(total_ms) as total_ms,
    min(min_ms) as min_ms,
    max(max_ms) as max_ms
  from public.metric_timing_rollups
  where bucket_start >= p_since
  group by metric_name, tags_key
  order by metric_name, tags_key;
$$;

create or replace function public.get_slo_session_start(
  p_since timestamptz
)
returns table (
  success_count bigint,
  failure_count bigint,
  total_count bigint,
  success_rate numeric
)
language sql
security definer
set search_path = public
as $$
  with rollup as (
    select
      coalesce(sum(case when tags ->> 'outcome' = 'success' then value else 0 end), 0) as success_count,
      coalesce(sum(case when tags ->> 'outcome' in ('error', 'rate_limited') then value else 0 end), 0) as failure_count
    from public.metric_counter_rollups
    where bucket_start >= p_since
      and metric_name = 'session_start_total'
  )
  select
    success_count,
    failure_count,
    success_count + failure_count as total_count,
    case
      when success_count + failure_count = 0 then 0
      else round((success_count::numeric / (success_count + failure_count)::numeric) * 100, 2)
    end as success_rate
  from rollup;
$$;

create or replace function public.get_slo_session_progress(
  p_since timestamptz
)
returns table (
  success_count bigint,
  replay_success_count bigint,
  error_count bigint,
  request_in_progress_count bigint,
  idempotency_mismatch_count bigint,
  invalid_request_count bigint,
  sli_numerator bigint,
  sli_denominator bigint,
  success_rate numeric
)
language sql
security definer
set search_path = public
as $$
  with rollup as (
    select
      coalesce(sum(case when tags ->> 'outcome' = 'success' then value else 0 end), 0) as success_count,
      coalesce(sum(case when tags ->> 'outcome' = 'replay_success' then value else 0 end), 0) as replay_success_count,
      coalesce(sum(case when tags ->> 'outcome' = 'error' then value else 0 end), 0) as error_count,
      coalesce(sum(case when tags ->> 'outcome' = 'request_in_progress' then value else 0 end), 0) as request_in_progress_count,
      coalesce(sum(case when tags ->> 'outcome' = 'idempotency_mismatch' then value else 0 end), 0) as idempotency_mismatch_count,
      coalesce(sum(case when tags ->> 'outcome' = 'invalid_request' then value else 0 end), 0) as invalid_request_count
    from public.metric_counter_rollups
    where bucket_start >= p_since
      and metric_name = 'session_submit_total'
  )
  select
    success_count,
    replay_success_count,
    error_count,
    request_in_progress_count,
    idempotency_mismatch_count,
    invalid_request_count,
    success_count + replay_success_count as sli_numerator,
    success_count + replay_success_count + error_count + request_in_progress_count as sli_denominator,
    case
      when success_count + replay_success_count + error_count + request_in_progress_count = 0 then 0
      else round(((success_count + replay_success_count)::numeric / (success_count + replay_success_count + error_count + request_in_progress_count)::numeric) * 100, 2)
    end as success_rate
  from rollup;
$$;

create or replace function public.get_slo_ai_reliability(
  p_since timestamptz
)
returns table (
  operation text,
  success_count bigint,
  error_count bigint,
  malformed_response_count bigint,
  mock_fallback_count bigint,
  total_count bigint,
  success_rate numeric
)
language sql
security definer
set search_path = public
as $$
  with rollup as (
    select
      coalesce(tags ->> 'operation', 'unknown') as operation,
      coalesce(sum(case when tags ->> 'outcome' = 'success' then value else 0 end), 0) as success_count,
      coalesce(sum(case when tags ->> 'outcome' = 'error' then value else 0 end), 0) as error_count,
      coalesce(sum(case when tags ->> 'outcome' = 'malformed_response' then value else 0 end), 0) as malformed_response_count,
      coalesce(sum(case when tags ->> 'outcome' = 'mock_fallback' then value else 0 end), 0) as mock_fallback_count
    from public.metric_counter_rollups
    where bucket_start >= p_since
      and metric_name = 'ai_requests_total'
    group by coalesce(tags ->> 'operation', 'unknown')
  )
  select
    operation,
    success_count,
    error_count,
    malformed_response_count,
    mock_fallback_count,
    success_count + error_count + malformed_response_count + mock_fallback_count as total_count,
    case
      when success_count + error_count + malformed_response_count + mock_fallback_count = 0 then 0
      else round((success_count::numeric / (success_count + error_count + malformed_response_count + mock_fallback_count)::numeric) * 100, 2)
    end as success_rate
  from rollup
  order by operation;
$$;

create or replace function public.get_slo_ai_latency(
  p_since timestamptz
)
returns table (
  operation text,
  count bigint,
  total_ms bigint,
  min_ms integer,
  max_ms integer,
  avg_ms numeric
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(tags ->> 'operation', 'unknown') as operation,
    sum(count) as count,
    sum(total_ms) as total_ms,
    min(min_ms) as min_ms,
    max(max_ms) as max_ms,
    case
      when sum(count) = 0 then 0
      else round(sum(total_ms)::numeric / sum(count)::numeric, 2)
    end as avg_ms
  from public.metric_timing_rollups
  where bucket_start >= p_since
    and metric_name = 'ai_request_duration_ms'
  group by coalesce(tags ->> 'operation', 'unknown')
  order by operation;
$$;

-- Current Supabase repository behavior uses this RPC to atomically create
-- sessions/questions/tokens, then uses invite_batches/invite_batch_candidates
-- as separate tracking tables. The Postgres repository may keep this function
-- or replace it with one application transaction that performs both steps.
create or replace function public.create_invite_batch(
  p_invites jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_invites is null or jsonb_typeof(p_invites) <> 'array' then
    raise exception 'create_invite_batch expects a JSON array payload';
  end if;

  insert into public.sessions (
    session_id,
    recruiter_id,
    target_role,
    job_description,
    status,
    intake_json
  )
  select
    (invite ->> 'session_id')::uuid,
    (invite ->> 'created_by')::uuid,
    invite ->> 'role',
    nullif(invite ->> 'job_description', ''),
    'NOT_STARTED'::public.session_status,
    jsonb_build_object(
      'candidate', coalesce(invite -> 'candidate', '{}'::jsonb),
      'invite_token', invite ->> 'encrypted_token'
    )
  from jsonb_array_elements(p_invites) as invite;

  insert into public.questions (
    session_id,
    question_index,
    question_text,
    category
  )
  select
    (invite ->> 'session_id')::uuid,
    (question ->> 'index')::integer,
    question ->> 'text',
    coalesce(question ->> 'category', 'General')
  from jsonb_array_elements(p_invites) as invite
  cross join lateral jsonb_array_elements(coalesce(invite -> 'questions', '[]'::jsonb)) as question;

  insert into public.candidate_tokens (
    token_hash,
    session_id
  )
  select
    invite ->> 'token_hash',
    (invite ->> 'session_id')::uuid
  from jsonb_array_elements(p_invites) as invite;
end;
$$;
