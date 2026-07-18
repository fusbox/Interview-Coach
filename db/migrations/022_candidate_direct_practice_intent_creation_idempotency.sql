-- Candidate-owned request idempotency for direct one-question and fixed-set intent creation.

create unique index if not exists ux_candidate_practice_intents_owned_identity
  on public.candidate_practice_intents(candidate_practice_intent_id, candidate_profile_id);

create table if not exists public.candidate_practice_intent_creation_requests (
  candidate_practice_intent_creation_request_id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade,
  idempotency_key_hash text not null,
  request_fingerprint text not null,
  candidate_practice_intent_id uuid not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint uq_candidate_practice_intent_creation_request_key
    unique (candidate_profile_id, idempotency_key_hash),
  constraint fk_candidate_practice_intent_creation_request_owned_intent
    foreign key (candidate_practice_intent_id, candidate_profile_id)
    references public.candidate_practice_intents(candidate_practice_intent_id, candidate_profile_id)
    on delete cascade,
  constraint chk_candidate_practice_intent_creation_request_key_hash
    check (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  constraint chk_candidate_practice_intent_creation_request_fingerprint
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_candidate_practice_intent_creation_request_expiry
    check (expires_at > created_at),
  constraint chk_candidate_practice_intent_creation_request_completion
    check (completed_at >= created_at and completed_at < expires_at)
);

create index if not exists idx_candidate_practice_intent_creation_requests_expiry
  on public.candidate_practice_intent_creation_requests(expires_at);

create or replace function public.create_candidate_direct_practice_intent(
  p_candidate_profile_id uuid,
  p_idempotency_key_hash text,
  p_request_fingerprint text,
  p_source text,
  p_role_profile_id uuid,
  p_target_interview_id text,
  p_target_role text,
  p_setup_context_json jsonb,
  p_items_json jsonb
)
returns table (
  creation_outcome text,
  candidate_practice_intent_id uuid,
  intent_lifecycle_state text,
  consumed_candidate_practice_session_id uuid
)
language plpgsql
as $$
declare
  v_request public.candidate_practice_intent_creation_requests%rowtype;
  v_created_intent_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  if p_idempotency_key_hash !~ '^[a-f0-9]{64}$'
    or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid candidate direct practice intent request identity';
  end if;

  if p_source not in ('coach_update_detail', 'plan_aware_queue', 'coach_bundle') then
    raise exception 'invalid candidate direct practice intent source';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_candidate_profile_id::text || ':' || p_idempotency_key_hash, 0)
  );

  select request.*
  into v_request
  from public.candidate_practice_intent_creation_requests request
  where request.candidate_profile_id = p_candidate_profile_id
    and request.idempotency_key_hash = p_idempotency_key_hash;

  if found and v_request.expires_at > v_now then
    if v_request.request_fingerprint <> p_request_fingerprint then
      return query
      select
        'conflict'::text,
        intent.candidate_practice_intent_id,
        intent.lifecycle_state,
        intent.consumed_candidate_practice_session_id
      from public.candidate_practice_intents intent
      where intent.candidate_practice_intent_id = v_request.candidate_practice_intent_id
        and intent.candidate_profile_id = p_candidate_profile_id;
      return;
    end if;

    return query
    select
      'replayed'::text,
      intent.candidate_practice_intent_id,
      intent.lifecycle_state,
      intent.consumed_candidate_practice_session_id
    from public.candidate_practice_intents intent
    where intent.candidate_practice_intent_id = v_request.candidate_practice_intent_id
      and intent.candidate_profile_id = p_candidate_profile_id;
    return;
  end if;

  insert into public.candidate_practice_intents (
    candidate_profile_id,
    source,
    lifecycle_state,
    role_profile_id,
    target_interview_id,
    target_role,
    setup_context_json,
    items_json,
    expires_at
  ) values (
    p_candidate_profile_id,
    p_source,
    'ready',
    p_role_profile_id,
    p_target_interview_id,
    p_target_role,
    p_setup_context_json,
    p_items_json,
    v_now + interval '24 hours'
  )
  returning candidate_practice_intents.candidate_practice_intent_id
  into v_created_intent_id;

  if v_request.candidate_practice_intent_creation_request_id is null then
    insert into public.candidate_practice_intent_creation_requests (
      candidate_profile_id,
      idempotency_key_hash,
      request_fingerprint,
      candidate_practice_intent_id,
      created_at,
      completed_at,
      expires_at
    ) values (
      p_candidate_profile_id,
      p_idempotency_key_hash,
      p_request_fingerprint,
      v_created_intent_id,
      v_now,
      v_now,
      v_now + interval '24 hours'
    );
  else
    update public.candidate_practice_intent_creation_requests request
    set request_fingerprint = p_request_fingerprint,
        candidate_practice_intent_id = v_created_intent_id,
        created_at = v_now,
        completed_at = v_now,
        expires_at = v_now + interval '24 hours'
    where request.candidate_practice_intent_creation_request_id =
      v_request.candidate_practice_intent_creation_request_id;
  end if;

  return query
  select
    'created'::text,
    intent.candidate_practice_intent_id,
    intent.lifecycle_state,
    intent.consumed_candidate_practice_session_id
  from public.candidate_practice_intents intent
  where intent.candidate_practice_intent_id = v_created_intent_id
    and intent.candidate_profile_id = p_candidate_profile_id;
end;
$$;
