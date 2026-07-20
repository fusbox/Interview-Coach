-- Recruiter-owned invitation aggregate and invite-scoped V2 session identity.
-- No V1 rows are migrated and no candidate-led profile/session row is synthesized.

create table if not exists public.recruiter_invitation_batches (
  recruiter_invitation_batch_id uuid primary key,
  recruiter_id uuid not null references public.app_users(user_id) on delete restrict,
  lifecycle_state text not null default 'ready',
  target_role text not null,
  job_description text,
  interview_stage text not null,
  recipient_count integer not null,
  question_plan_snapshot_json jsonb not null,
  question_wording_snapshot_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_recruiter_invitation_batch_owner unique (recruiter_invitation_batch_id, recruiter_id),
  constraint chk_recruiter_invitation_batch_state check (lifecycle_state in ('ready', 'revoked')),
  constraint chk_recruiter_invitation_batch_role check (length(trim(target_role)) > 0),
  constraint chk_recruiter_invitation_batch_stage check (
    interview_stage in ('practice_only', 'screening', 'first_interview', 'follow_up', 'final_interview')
  ),
  constraint chk_recruiter_invitation_batch_recipient_count check (recipient_count between 1 and 100),
  constraint chk_recruiter_invitation_batch_plan_object check (jsonb_typeof(question_plan_snapshot_json) = 'object'),
  constraint chk_recruiter_invitation_batch_wording_object check (jsonb_typeof(question_wording_snapshot_json) = 'object')
);

create index if not exists idx_recruiter_invitation_batches_owner_created
  on public.recruiter_invitation_batches(recruiter_id, created_at desc);

create table if not exists public.recruiter_invitation_recipients (
  recruiter_invitation_recipient_id uuid primary key,
  recruiter_invitation_batch_id uuid not null,
  recruiter_id uuid not null,
  candidate_index integer not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  normalized_email text not null,
  requisition_reference text,
  lifecycle_state text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_recruiter_invitation_recipient_batch_owner
    foreign key (recruiter_invitation_batch_id, recruiter_id)
    references public.recruiter_invitation_batches(recruiter_invitation_batch_id, recruiter_id)
    on delete cascade,
  constraint uq_recruiter_invitation_recipient_owner unique (recruiter_invitation_recipient_id, recruiter_id),
  constraint uq_recruiter_invitation_recipient_batch_index unique (recruiter_invitation_batch_id, candidate_index),
  constraint uq_recruiter_invitation_recipient_batch_email unique (recruiter_invitation_batch_id, normalized_email),
  constraint chk_recruiter_invitation_recipient_index check (candidate_index >= 0),
  constraint chk_recruiter_invitation_recipient_first_name check (length(trim(first_name)) > 0),
  constraint chk_recruiter_invitation_recipient_last_name check (length(trim(last_name)) > 0),
  constraint chk_recruiter_invitation_recipient_email check (
    normalized_email = lower(trim(email))
    and position('@' in normalized_email) > 1
  ),
  constraint chk_recruiter_invitation_recipient_state check (lifecycle_state in ('ready', 'revoked'))
);

create index if not exists idx_recruiter_invitation_recipients_batch
  on public.recruiter_invitation_recipients(recruiter_invitation_batch_id, candidate_index);

create table if not exists public.invited_practice_sessions (
  invited_practice_session_id uuid primary key,
  recruiter_invitation_recipient_id uuid not null,
  recruiter_id uuid not null,
  parent_invited_practice_session_id uuid references public.invited_practice_sessions(invited_practice_session_id),
  attempt_number integer not null default 1,
  status text not null default 'planned',
  setup_snapshot_json jsonb not null,
  question_plan_snapshot_json jsonb not null,
  question_wording_snapshot_json jsonb not null,
  progress_state_json jsonb not null default '{"status":"planned","currentQuestionIndex":0}'::jsonb,
  answer_drafts_json jsonb not null default '{}'::jsonb,
  answer_submissions_json jsonb not null default '{}'::jsonb,
  answer_idempotency_json jsonb not null default '{}'::jsonb,
  answer_analysis_snapshots_json jsonb not null default '{}'::jsonb,
  feedback_actions_json jsonb not null default '{}'::jsonb,
  completion_snapshot_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_invited_practice_session_recipient_owner
    foreign key (recruiter_invitation_recipient_id, recruiter_id)
    references public.recruiter_invitation_recipients(recruiter_invitation_recipient_id, recruiter_id)
    on delete cascade,
  constraint uq_invited_practice_session_recipient_attempt unique (recruiter_invitation_recipient_id, attempt_number),
  constraint uq_invited_practice_session_recipient unique (invited_practice_session_id, recruiter_invitation_recipient_id),
  constraint uq_invited_practice_session_owner unique (invited_practice_session_id, recruiter_id),
  constraint chk_invited_practice_session_attempt check (attempt_number > 0),
  constraint chk_invited_practice_session_lineage_shape check (
    (attempt_number = 1 and parent_invited_practice_session_id is null)
    or
    (attempt_number > 1 and parent_invited_practice_session_id is not null)
  ),
  constraint chk_invited_practice_session_status check (status in ('planned', 'in_progress', 'completed', 'abandoned')),
  constraint chk_invited_practice_session_setup_object check (jsonb_typeof(setup_snapshot_json) = 'object'),
  constraint chk_invited_practice_session_plan_object check (jsonb_typeof(question_plan_snapshot_json) = 'object'),
  constraint chk_invited_practice_session_wording_object check (jsonb_typeof(question_wording_snapshot_json) = 'object'),
  constraint chk_invited_practice_session_progress_object check (jsonb_typeof(progress_state_json) = 'object'),
  constraint chk_invited_practice_session_drafts_object check (jsonb_typeof(answer_drafts_json) = 'object'),
  constraint chk_invited_practice_session_submissions_object check (jsonb_typeof(answer_submissions_json) = 'object'),
  constraint chk_invited_practice_session_idempotency_object check (jsonb_typeof(answer_idempotency_json) = 'object'),
  constraint chk_invited_practice_session_analysis_object check (jsonb_typeof(answer_analysis_snapshots_json) = 'object'),
  constraint chk_invited_practice_session_feedback_object check (jsonb_typeof(feedback_actions_json) = 'object'),
  constraint chk_invited_practice_session_completion_object check (
    completion_snapshot_json is null or jsonb_typeof(completion_snapshot_json) = 'object'
  )
);

create index if not exists idx_invited_practice_sessions_owner_created
  on public.invited_practice_sessions(recruiter_id, created_at desc);

alter table public.invited_practice_sessions
  add column if not exists answer_idempotency_json jsonb not null default '{}'::jsonb;

do $$
begin
  alter table public.invited_practice_sessions
    add constraint chk_invited_practice_session_idempotency_object
    check (jsonb_typeof(answer_idempotency_json) = 'object');
exception
  when duplicate_object then null;
end;
$$;

create index if not exists idx_invited_practice_sessions_recipient_status
  on public.invited_practice_sessions(recruiter_invitation_recipient_id, status, attempt_number desc);

create table if not exists public.invited_practice_access_tokens (
  invited_practice_access_token_id uuid primary key default gen_random_uuid(),
  invited_practice_session_id uuid not null,
  recruiter_invitation_recipient_id uuid not null,
  token_hash text not null unique,
  token_ciphertext text not null,
  encryption_key_id text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fk_invited_practice_access_token_session_recipient
    foreign key (invited_practice_session_id, recruiter_invitation_recipient_id)
    references public.invited_practice_sessions(invited_practice_session_id, recruiter_invitation_recipient_id)
    on delete cascade,
  constraint chk_invited_practice_access_token_hash check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_invited_practice_access_token_ciphertext check (length(trim(token_ciphertext)) > 0),
  constraint chk_invited_practice_access_token_key check (length(trim(encryption_key_id)) > 0),
  constraint chk_invited_practice_access_token_expiry check (expires_at > created_at),
  constraint chk_invited_practice_access_token_revocation check (revoked_at is null or revoked_at >= created_at)
);

create unique index if not exists uq_invited_practice_access_token_active_session
  on public.invited_practice_access_tokens(invited_practice_session_id)
  where revoked_at is null;

create index if not exists idx_invited_practice_access_tokens_recipient
  on public.invited_practice_access_tokens(recruiter_invitation_recipient_id, created_at desc);

create index if not exists idx_invited_practice_access_tokens_expiry
  on public.invited_practice_access_tokens(expires_at)
  where revoked_at is null;

create table if not exists public.recruiter_invitation_creation_requests (
  recruiter_id uuid not null,
  idempotency_key_hash text not null,
  request_fingerprint text not null,
  recruiter_invitation_batch_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (recruiter_id, idempotency_key_hash),
  constraint fk_recruiter_invitation_creation_request_batch_owner
    foreign key (recruiter_invitation_batch_id, recruiter_id)
    references public.recruiter_invitation_batches(recruiter_invitation_batch_id, recruiter_id)
    on delete cascade,
  constraint chk_recruiter_invitation_creation_key_hash check (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_recruiter_invitation_creation_fingerprint check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint chk_recruiter_invitation_creation_expiry check (expires_at > created_at)
);

create index if not exists idx_recruiter_invitation_creation_requests_expiry
  on public.recruiter_invitation_creation_requests(expires_at);

create or replace function public.prevent_recruiter_invitation_owner_update()
returns trigger
language plpgsql
as $$
begin
  if new.recruiter_id is distinct from old.recruiter_id then
    raise exception 'recruiter invitation ownership is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_recruiter_invitation_batch_source_update()
returns trigger
language plpgsql
as $$
begin
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
    raise exception 'recruiter invitation batch identity and source snapshots are immutable' using errcode = '55000';
  end if;
  if old.lifecycle_state = 'revoked' and new.lifecycle_state is distinct from old.lifecycle_state then
    raise exception 'revoked recruiter invitation batch cannot be reactivated' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_recruiter_invitation_recipient_identity_update()
returns trigger
language plpgsql
as $$
begin
  if row(
    new.recruiter_invitation_recipient_id,
    new.recruiter_invitation_batch_id,
    new.recruiter_id,
    new.candidate_index,
    new.first_name,
    new.last_name,
    new.email,
    new.normalized_email,
    new.requisition_reference,
    new.created_at
  ) is distinct from row(
    old.recruiter_invitation_recipient_id,
    old.recruiter_invitation_batch_id,
    old.recruiter_id,
    old.candidate_index,
    old.first_name,
    old.last_name,
    old.email,
    old.normalized_email,
    old.requisition_reference,
    old.created_at
  ) then
    raise exception 'recruiter invitation recipient identity is immutable' using errcode = '55000';
  end if;
  if old.lifecycle_state = 'revoked' and new.lifecycle_state is distinct from old.lifecycle_state then
    raise exception 'revoked recruiter invitation recipient cannot be reactivated' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recruiter_invitation_batch_owner_immutable on public.recruiter_invitation_batches;
create trigger trg_recruiter_invitation_batch_owner_immutable
before update on public.recruiter_invitation_batches
for each row execute function public.prevent_recruiter_invitation_owner_update();

drop trigger if exists trg_recruiter_invitation_batch_source_immutable on public.recruiter_invitation_batches;
create trigger trg_recruiter_invitation_batch_source_immutable
before update on public.recruiter_invitation_batches
for each row execute function public.prevent_recruiter_invitation_batch_source_update();

drop trigger if exists trg_recruiter_invitation_recipient_owner_immutable on public.recruiter_invitation_recipients;
create trigger trg_recruiter_invitation_recipient_owner_immutable
before update on public.recruiter_invitation_recipients
for each row execute function public.prevent_recruiter_invitation_owner_update();

drop trigger if exists trg_recruiter_invitation_recipient_identity_immutable on public.recruiter_invitation_recipients;
create trigger trg_recruiter_invitation_recipient_identity_immutable
before update on public.recruiter_invitation_recipients
for each row execute function public.prevent_recruiter_invitation_recipient_identity_update();

drop trigger if exists trg_invited_practice_session_owner_immutable on public.invited_practice_sessions;
create trigger trg_invited_practice_session_owner_immutable
before update on public.invited_practice_sessions
for each row execute function public.prevent_recruiter_invitation_owner_update();

create or replace function public.validate_invited_practice_session_lineage()
returns trigger
language plpgsql
as $$
begin
  if new.attempt_number = 1 then
    return new;
  end if;

  if not exists (
    select 1
    from public.invited_practice_sessions prior
    where prior.invited_practice_session_id = new.parent_invited_practice_session_id
      and prior.recruiter_invitation_recipient_id = new.recruiter_invitation_recipient_id
      and prior.recruiter_id = new.recruiter_id
      and prior.attempt_number = new.attempt_number - 1
  ) then
    raise exception 'invited practice retry must follow the immediately prior session for the same recipient and recruiter'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invited_practice_session_lineage on public.invited_practice_sessions;
create trigger trg_invited_practice_session_lineage
before insert on public.invited_practice_sessions
for each row execute function public.validate_invited_practice_session_lineage();

create or replace function public.prevent_invited_practice_session_identity_update()
returns trigger
language plpgsql
as $$
begin
  if row(
    new.invited_practice_session_id,
    new.recruiter_invitation_recipient_id,
    new.recruiter_id,
    new.parent_invited_practice_session_id,
    new.attempt_number,
    new.setup_snapshot_json,
    new.question_plan_snapshot_json,
    new.question_wording_snapshot_json,
    new.created_at
  ) is distinct from row(
    old.invited_practice_session_id,
    old.recruiter_invitation_recipient_id,
    old.recruiter_id,
    old.parent_invited_practice_session_id,
    old.attempt_number,
    old.setup_snapshot_json,
    old.question_plan_snapshot_json,
    old.question_wording_snapshot_json,
    old.created_at
  ) then
    raise exception 'invited practice session identity and source snapshots are immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invited_practice_session_identity_immutable on public.invited_practice_sessions;
create trigger trg_invited_practice_session_identity_immutable
before update on public.invited_practice_sessions
for each row execute function public.prevent_invited_practice_session_identity_update();

create or replace function public.prevent_invited_practice_access_token_identity_update()
returns trigger
language plpgsql
as $$
begin
  if row(
    new.invited_practice_access_token_id,
    new.invited_practice_session_id,
    new.recruiter_invitation_recipient_id,
    new.token_hash,
    new.token_ciphertext,
    new.encryption_key_id,
    new.expires_at,
    new.created_at
  ) is distinct from row(
    old.invited_practice_access_token_id,
    old.invited_practice_session_id,
    old.recruiter_invitation_recipient_id,
    old.token_hash,
    old.token_ciphertext,
    old.encryption_key_id,
    old.expires_at,
    old.created_at
  ) then
    raise exception 'invited practice access token identity is immutable' using errcode = '55000';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'revoked invited practice access token cannot be reactivated' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invited_practice_access_token_identity_immutable on public.invited_practice_access_tokens;
create trigger trg_invited_practice_access_token_identity_immutable
before update on public.invited_practice_access_tokens
for each row execute function public.prevent_invited_practice_access_token_identity_update();

drop trigger if exists trg_recruiter_invitation_batches_updated_at on public.recruiter_invitation_batches;
create trigger trg_recruiter_invitation_batches_updated_at
before update on public.recruiter_invitation_batches
for each row execute function public.set_updated_at();

drop trigger if exists trg_recruiter_invitation_recipients_updated_at on public.recruiter_invitation_recipients;
create trigger trg_recruiter_invitation_recipients_updated_at
before update on public.recruiter_invitation_recipients
for each row execute function public.set_updated_at();

drop trigger if exists trg_invited_practice_sessions_updated_at on public.invited_practice_sessions;
create trigger trg_invited_practice_sessions_updated_at
before update on public.invited_practice_sessions
for each row execute function public.set_updated_at();

create or replace function public.create_recruiter_invitation_aggregate(
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
  v_existing_request public.recruiter_invitation_creation_requests%rowtype;
  v_recipient record;
  v_recipient_count integer;
  v_distinct_index_count integer;
  v_min_index integer;
  v_max_index integer;
  v_question_count integer;
  v_created_at timestamptz := now();
begin
  if not exists (
    select 1
    from public.app_users app_user
    join public.app_user_roles app_role on app_role.user_id = app_user.user_id
    where app_user.user_id = p_recruiter_id
      and app_user.status = 'active'
      and app_role.role in ('recruiter', 'admin')
  ) then
    raise exception 'active recruiter authorization required' using errcode = '42501';
  end if;

  if p_idempotency_key_hash !~ '^[0-9a-f]{64}$'
     or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid recruiter invitation request identity' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_target_role, ''))) = 0
     or p_interview_stage not in ('practice_only', 'screening', 'first_interview', 'follow_up', 'final_interview') then
    raise exception 'invalid recruiter invitation role or stage' using errcode = '22023';
  end if;

  if jsonb_typeof(p_question_plan_snapshot) <> 'object'
     or jsonb_typeof(p_question_wording_snapshot) <> 'object'
     or jsonb_typeof(p_question_plan_snapshot -> 'slots') <> 'array'
     or p_question_wording_snapshot ->> 'status' <> 'questions_worded'
     or jsonb_typeof(p_question_wording_snapshot -> 'questions') <> 'array' then
    raise exception 'accepted V2 question plan and wording snapshots are required' using errcode = '22023';
  end if;

  if (p_question_plan_snapshot ->> 'interviewStage') is distinct from p_interview_stage
     or (p_question_plan_snapshot ->> 'questionCount') !~ '^[0-9]+$' then
    raise exception 'question plan does not match the invitation stage' using errcode = '22023';
  end if;

  v_question_count := (p_question_plan_snapshot ->> 'questionCount')::integer;
  if v_question_count < 1
     or v_question_count > 20
     or jsonb_array_length(p_question_plan_snapshot -> 'slots') <> v_question_count
     or jsonb_array_length(p_question_wording_snapshot -> 'questions') <> v_question_count then
    raise exception 'question plan and wording counts do not match' using errcode = '22023';
  end if;

  if jsonb_typeof(p_recipients) <> 'array' then
    raise exception 'recipients must be a JSON array' using errcode = '22023';
  end if;

  select
    count(*),
    count(distinct recipient."candidateIndex"),
    min(recipient."candidateIndex"),
    max(recipient."candidateIndex")
  into v_recipient_count, v_distinct_index_count, v_min_index, v_max_index
  from jsonb_to_recordset(p_recipients) as recipient(
    "candidateIndex" integer,
    "recipientId" uuid,
    "sessionId" uuid,
    "firstName" text,
    "lastName" text,
    "email" text,
    "requisitionReference" text,
    "resumeText" text,
    "tokenHash" text,
    "tokenCiphertext" text,
    "encryptionKeyId" text,
    "tokenExpiresAt" timestamptz
  );

  if v_recipient_count < 1
     or v_recipient_count > 100
     or v_distinct_index_count <> v_recipient_count
     or v_min_index <> 0
     or v_max_index <> v_recipient_count - 1 then
    raise exception 'recipients require one contiguous unique candidate index' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_recipients) as recipient(
      "candidateIndex" integer,
      "recipientId" uuid,
      "sessionId" uuid,
      "firstName" text,
      "lastName" text,
      "email" text,
      "requisitionReference" text,
      "resumeText" text,
      "tokenHash" text,
      "tokenCiphertext" text,
      "encryptionKeyId" text,
      "tokenExpiresAt" timestamptz
    )
    where length(trim(coalesce(recipient."firstName", ''))) = 0
       or length(trim(coalesce(recipient."lastName", ''))) = 0
       or position('@' in lower(trim(coalesce(recipient."email", '')))) <= 1
       or recipient."tokenHash" !~ '^[0-9a-f]{64}$'
       or length(trim(coalesce(recipient."tokenCiphertext", ''))) = 0
       or length(trim(coalesce(recipient."encryptionKeyId", ''))) = 0
       or recipient."tokenExpiresAt" <= v_created_at
  ) then
    raise exception 'one or more invitation recipients are invalid' using errcode = '22023';
  end if;

  if (
    select count(distinct lower(trim(recipient."email")))
    from jsonb_to_recordset(p_recipients) as recipient("email" text)
  ) <> v_recipient_count then
    raise exception 'recipient email must be unique within an invitation batch' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_recruiter_id::text || ':' || p_idempotency_key_hash, 0));

  delete from public.recruiter_invitation_creation_requests request
  where request.recruiter_id = p_recruiter_id
    and request.idempotency_key_hash = p_idempotency_key_hash
    and request.expires_at <= v_created_at;

  select * into v_existing_request
  from public.recruiter_invitation_creation_requests request
  where request.recruiter_id = p_recruiter_id
    and request.idempotency_key_hash = p_idempotency_key_hash
  for update;

  if found then
    if v_existing_request.request_fingerprint = p_request_fingerprint then
      return query select 'replayed'::text, v_existing_request.recruiter_invitation_batch_id;
    else
      return query select 'conflict'::text, v_existing_request.recruiter_invitation_batch_id;
    end if;
    return;
  end if;

  insert into public.recruiter_invitation_batches (
    recruiter_invitation_batch_id,
    recruiter_id,
    lifecycle_state,
    target_role,
    job_description,
    interview_stage,
    recipient_count,
    question_plan_snapshot_json,
    question_wording_snapshot_json,
    created_at,
    updated_at
  ) values (
    p_recruiter_invitation_batch_id,
    p_recruiter_id,
    'ready',
    trim(p_target_role),
    nullif(trim(coalesce(p_job_description, '')), ''),
    p_interview_stage,
    v_recipient_count,
    p_question_plan_snapshot,
    p_question_wording_snapshot,
    v_created_at,
    v_created_at
  );

  for v_recipient in
    select *
    from jsonb_to_recordset(p_recipients) as recipient(
      "candidateIndex" integer,
      "recipientId" uuid,
      "sessionId" uuid,
      "firstName" text,
      "lastName" text,
      "email" text,
      "requisitionReference" text,
      "resumeText" text,
      "tokenHash" text,
      "tokenCiphertext" text,
      "encryptionKeyId" text,
      "tokenExpiresAt" timestamptz
    )
    order by recipient."candidateIndex"
  loop
    insert into public.recruiter_invitation_recipients (
      recruiter_invitation_recipient_id,
      recruiter_invitation_batch_id,
      recruiter_id,
      candidate_index,
      first_name,
      last_name,
      email,
      normalized_email,
      requisition_reference,
      lifecycle_state,
      created_at,
      updated_at
    ) values (
      v_recipient."recipientId",
      p_recruiter_invitation_batch_id,
      p_recruiter_id,
      v_recipient."candidateIndex",
      trim(v_recipient."firstName"),
      trim(v_recipient."lastName"),
      trim(v_recipient."email"),
      lower(trim(v_recipient."email")),
      nullif(trim(coalesce(v_recipient."requisitionReference", '')), ''),
      'ready',
      v_created_at,
      v_created_at
    );

    insert into public.invited_practice_sessions (
      invited_practice_session_id,
      recruiter_invitation_recipient_id,
      recruiter_id,
      parent_invited_practice_session_id,
      attempt_number,
      status,
      setup_snapshot_json,
      question_plan_snapshot_json,
      question_wording_snapshot_json,
      progress_state_json,
      created_at,
      updated_at
    ) values (
      v_recipient."sessionId",
      v_recipient."recipientId",
      p_recruiter_id,
      null,
      1,
      'planned',
      jsonb_build_object(
        'status', 'invited_practice_setup_snapshot_v1',
        'targetRole', trim(p_target_role),
        'jobDescription', nullif(trim(coalesce(p_job_description, '')), ''),
        'interviewStage', p_interview_stage,
        'questionCount', v_question_count,
        'resumeIncluded', length(trim(coalesce(v_recipient."resumeText", ''))) > 0,
        'resumeText', nullif(trim(coalesce(v_recipient."resumeText", '')), ''),
        'createdAt', v_created_at
      ),
      p_question_plan_snapshot,
      p_question_wording_snapshot,
      '{"status":"planned","currentQuestionIndex":0}'::jsonb,
      v_created_at,
      v_created_at
    );

    insert into public.invited_practice_access_tokens (
      invited_practice_session_id,
      recruiter_invitation_recipient_id,
      token_hash,
      token_ciphertext,
      encryption_key_id,
      expires_at,
      created_at
    ) values (
      v_recipient."sessionId",
      v_recipient."recipientId",
      v_recipient."tokenHash",
      v_recipient."tokenCiphertext",
      v_recipient."encryptionKeyId",
      v_recipient."tokenExpiresAt",
      v_created_at
    );
  end loop;

  insert into public.recruiter_invitation_creation_requests (
    recruiter_id,
    idempotency_key_hash,
    request_fingerprint,
    recruiter_invitation_batch_id,
    created_at,
    expires_at
  ) values (
    p_recruiter_id,
    p_idempotency_key_hash,
    p_request_fingerprint,
    p_recruiter_invitation_batch_id,
    v_created_at,
    v_created_at + interval '24 hours'
  );

  return query select 'created'::text, p_recruiter_invitation_batch_id;
end;
$$;

comment on table public.recruiter_invitation_recipients is
  'Invite-scoped intended recipients. These rows are not authenticated candidate-led profiles.';

comment on table public.invited_practice_sessions is
  'Recruiter-invited V2 session envelopes projected through the shared session runtime.';

comment on column public.invited_practice_access_tokens.token_ciphertext is
  'Authenticated encrypted bearer-token material for trusted server-side link recovery; never plaintext or telemetry.';
