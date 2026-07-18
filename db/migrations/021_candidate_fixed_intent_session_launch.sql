-- Atomic candidate-owned fixed-intent consumption into exactly one follow-up session.

alter table public.candidate_practice_intents
  add column if not exists launch_version bigint;

alter table public.candidate_practice_intents
  add column if not exists expires_at timestamptz;

alter table public.candidate_practice_intents
  add column if not exists consumed_at timestamptz;

update public.candidate_practice_intents
set launch_version = case when lifecycle_state = 'consumed' then 2 else 1 end
where launch_version is null;

update public.candidate_practice_intents
set expires_at = created_at + interval '24 hours'
where expires_at is null;

update public.candidate_practice_intents
set consumed_at = updated_at
where lifecycle_state = 'consumed'
  and consumed_candidate_practice_session_id is not null
  and consumed_at is null;

update public.candidate_practice_intents
set lifecycle_state = 'expired',
    launch_version = launch_version + 1
where lifecycle_state = 'ready'
  and expires_at <= now();

alter table public.candidate_practice_intents
  alter column launch_version set default 1,
  alter column launch_version set not null,
  alter column expires_at set default (now() + interval '24 hours'),
  alter column expires_at set not null;

alter table public.candidate_practice_intents
  drop constraint if exists candidate_practice_intents_consumed_candidate_practice_session_id_fkey;

do $$
begin
  alter table public.candidate_practice_intents
    add constraint fk_candidate_practice_intents_consumed_owned_session
    foreign key (
      consumed_candidate_practice_session_id,
      candidate_profile_id
    )
    references public.candidate_practice_sessions(
      candidate_practice_session_id,
      candidate_profile_id
    )
    on delete cascade;
exception
  when duplicate_object then null;
end;
$$;

alter table public.candidate_practice_intents
  drop constraint if exists chk_candidate_practice_intents_launch_version;

alter table public.candidate_practice_intents
  add constraint chk_candidate_practice_intents_launch_version
  check (launch_version > 0);

alter table public.candidate_practice_intents
  drop constraint if exists chk_candidate_practice_intents_expiry;

alter table public.candidate_practice_intents
  add constraint chk_candidate_practice_intents_expiry
  check (expires_at > created_at);

alter table public.candidate_practice_intents
  drop constraint if exists chk_candidate_practice_intents_terminal_shape;

alter table public.candidate_practice_intents
  add constraint chk_candidate_practice_intents_terminal_shape
  check (
    (
      lifecycle_state = 'consumed'
      and consumed_candidate_practice_session_id is not null
      and consumed_at is not null
    )
    or
    (
      lifecycle_state <> 'consumed'
      and consumed_candidate_practice_session_id is null
      and consumed_at is null
    )
  );

create index if not exists idx_candidate_practice_intents_ready_expiry
  on public.candidate_practice_intents(expires_at)
  where lifecycle_state = 'ready';

create or replace function public.enforce_candidate_practice_intent_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.candidate_profile_id is distinct from old.candidate_profile_id
    or new.source is distinct from old.source
    or new.source_next_round_draft_id is distinct from old.source_next_round_draft_id
    or new.source_next_round_draft_version is distinct from old.source_next_round_draft_version
    or new.role_profile_id is distinct from old.role_profile_id
    or new.target_interview_id is distinct from old.target_interview_id
    or new.target_role is distinct from old.target_role
    or new.setup_context_json is distinct from old.setup_context_json
    or new.items_json is distinct from old.items_json
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at then
    raise exception 'candidate practice intent content is immutable';
  end if;

  if new.lifecycle_state is distinct from old.lifecycle_state then
    if old.lifecycle_state <> 'ready'
      or new.lifecycle_state not in ('consumed', 'cancelled', 'expired')
      or new.launch_version <> old.launch_version + 1 then
      raise exception 'invalid candidate practice intent lifecycle transition';
    end if;
  elsif new.launch_version is distinct from old.launch_version
    or new.consumed_candidate_practice_session_id is distinct from old.consumed_candidate_practice_session_id
    or new.consumed_at is distinct from old.consumed_at then
    raise exception 'candidate practice intent launch state changed without lifecycle transition';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_candidate_practice_intents_launch_immutability
  on public.candidate_practice_intents;
create trigger trg_candidate_practice_intents_launch_immutability
before update on public.candidate_practice_intents
for each row execute function public.enforce_candidate_practice_intent_immutability();

create or replace function public.start_candidate_practice_intent_session(
  p_candidate_practice_intent_id uuid,
  p_candidate_profile_id uuid,
  p_expected_launch_version bigint,
  p_expected_prior_session_count integer,
  p_role_profile_id uuid,
  p_candidate_launch_session_id uuid,
  p_setup_snapshot_json jsonb,
  p_question_plan_snapshot_json jsonb,
  p_question_wording_snapshot_json jsonb,
  p_question_wording_status text,
  p_progress_state_json jsonb,
  p_answer_drafts_json jsonb
)
returns table (
  launch_outcome text,
  candidate_practice_session_id uuid
)
language plpgsql
as $$
declare
  v_intent public.candidate_practice_intents%rowtype;
  v_existing_session_id uuid;
  v_created_session_id uuid;
  v_context_session_count integer;
  v_item_count integer;
  v_matched_item_count integer;
  v_context_lock_key text;
begin
  select intent.*
  into v_intent
  from public.candidate_practice_intents intent
  where intent.candidate_practice_intent_id = p_candidate_practice_intent_id
    and intent.candidate_profile_id = p_candidate_profile_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  if v_intent.lifecycle_state = 'consumed' then
    select session.candidate_practice_session_id
    into v_existing_session_id
    from public.candidate_practice_sessions session
    where session.candidate_practice_session_id = v_intent.consumed_candidate_practice_session_id
      and session.candidate_profile_id = p_candidate_profile_id
      and session.setup_snapshot_json #>> '{followUpPractice,sourceIntentId}' = p_candidate_practice_intent_id::text
    limit 1;

    if v_existing_session_id is null then
      return query select 'consumed_mismatch'::text, null::uuid;
    else
      return query select 'replayed'::text, v_existing_session_id;
    end if;
    return;
  end if;

  if v_intent.lifecycle_state = 'cancelled' then
    return query select 'cancelled'::text, null::uuid;
    return;
  end if;

  if v_intent.lifecycle_state = 'expired' then
    return query select 'expired'::text, null::uuid;
    return;
  end if;

  if v_intent.expires_at <= now() then
    update public.candidate_practice_intents intent
    set lifecycle_state = 'expired',
        launch_version = intent.launch_version + 1
    where intent.candidate_practice_intent_id = v_intent.candidate_practice_intent_id;

    return query select 'expired'::text, null::uuid;
    return;
  end if;

  if v_intent.launch_version is distinct from p_expected_launch_version then
    return query select 'mismatched'::text, null::uuid;
    return;
  end if;

  v_context_lock_key := p_candidate_profile_id::text || ':' || coalesce(
    v_intent.role_profile_id::text,
    'legacy:' || lower(regexp_replace(btrim(v_intent.target_role), '\s+', ' ', 'g'))
  );
  perform pg_advisory_xact_lock(hashtextextended(v_context_lock_key, 0));

  if v_intent.role_profile_id is not null then
    select count(*)::integer
    into v_context_session_count
    from public.candidate_practice_sessions session
    where session.candidate_profile_id = p_candidate_profile_id
      and session.role_profile_id = v_intent.role_profile_id;
  else
    select count(*)::integer
    into v_context_session_count
    from public.candidate_practice_sessions session
    where session.candidate_profile_id = p_candidate_profile_id
      and session.role_profile_id is null
      and lower(regexp_replace(btrim(session.setup_snapshot_json ->> 'targetRole'), '\s+', ' ', 'g'))
        = lower(regexp_replace(btrim(v_intent.target_role), '\s+', ' ', 'g'));
  end if;

  if p_expected_prior_session_count is null
    or p_expected_prior_session_count < 0
    or v_context_session_count <> p_expected_prior_session_count then
    return query select 'stale_context'::text, null::uuid;
    return;
  end if;

  v_item_count := jsonb_array_length(v_intent.items_json);
  if p_role_profile_id is distinct from v_intent.role_profile_id
    or (
      p_candidate_launch_session_id is not null
      and not exists (
        select 1
        from public.candidate_launch_sessions launch
        where launch.candidate_launch_session_id = p_candidate_launch_session_id
          and launch.candidate_profile_id = p_candidate_profile_id
      )
    )
    or jsonb_typeof(p_setup_snapshot_json) is distinct from 'object'
    or jsonb_typeof(p_question_plan_snapshot_json) is distinct from 'object'
    or jsonb_typeof(p_question_wording_snapshot_json) is distinct from 'object'
    or jsonb_typeof(p_progress_state_json) is distinct from 'object'
    or jsonb_typeof(p_answer_drafts_json) is distinct from 'object' then
    return query select 'invalid_session'::text, null::uuid;
    return;
  end if;

  if jsonb_typeof(p_setup_snapshot_json #> '{followUpPractice,items}') is distinct from 'array'
    or jsonb_typeof(p_question_plan_snapshot_json -> 'slots') is distinct from 'array'
    or jsonb_typeof(p_question_wording_snapshot_json -> 'questions') is distinct from 'array' then
    return query select 'invalid_session'::text, null::uuid;
    return;
  end if;

  if p_question_wording_status is distinct from 'worded'
    or p_question_wording_snapshot_json ->> 'status' is distinct from 'questions_worded'
    or p_setup_snapshot_json #>> '{followUpPractice,status}' is distinct from 'candidate_follow_up_practice_session'
    or p_setup_snapshot_json #>> '{followUpPractice,sourceIntentId}' is distinct from p_candidate_practice_intent_id::text
    or p_question_plan_snapshot_json #>> '{followUpPractice,sourceIntentId}' is distinct from p_candidate_practice_intent_id::text
    or p_question_wording_snapshot_json #>> '{followUpPractice,sourceIntentId}' is distinct from p_candidate_practice_intent_id::text
    or p_setup_snapshot_json ->> 'targetRole' is distinct from v_intent.target_role
    or p_setup_snapshot_json ->> 'jobDescription' is distinct from v_intent.setup_context_json ->> 'jobDescription'
    or p_setup_snapshot_json ->> 'interviewStage' is distinct from v_intent.setup_context_json ->> 'interviewStage'
    or p_setup_snapshot_json -> 'questionCount' is distinct from to_jsonb(v_item_count)
    or p_setup_snapshot_json #> '{followUpPractice,sessionAttemptNumber}'
      is distinct from to_jsonb(p_expected_prior_session_count + 1)
    or p_setup_snapshot_json #> '{followUpPractice,itemCount}' is distinct from to_jsonb(v_item_count)
    or p_question_plan_snapshot_json -> 'questionCount' is distinct from to_jsonb(v_item_count)
    or jsonb_array_length(p_setup_snapshot_json #> '{followUpPractice,items}') <> v_item_count
    or jsonb_array_length(p_question_plan_snapshot_json -> 'slots') <> v_item_count
    or jsonb_array_length(p_question_wording_snapshot_json -> 'questions') <> v_item_count then
    return query select 'invalid_session'::text, null::uuid;
    return;
  end if;

  select count(*)::integer
  into v_matched_item_count
  from jsonb_array_elements(v_intent.items_json) with ordinality as source(item, ordinal)
  where exists (
      select 1
      from public.candidate_practice_sessions source_session
      where source_session.candidate_practice_session_id::text
          = source.item #>> '{source,candidatePracticeSessionId}'
        and source_session.candidate_profile_id = p_candidate_profile_id
        and source_session.role_profile_id is not distinct from v_intent.role_profile_id
        and exists (
          select 1
          from jsonb_array_elements(source_session.question_wording_snapshot_json -> 'questions') source_question
          where source_question ->> 'slotId' = source.item #>> '{source,questionKey}'
            and source_question ->> 'questionText' = source.item #>> '{source,questionText}'
        )
    )
    and jsonb_array_element(p_setup_snapshot_json #> '{followUpPractice,items}', (source.ordinal - 1)::integer)
          #>> '{sourceCandidatePracticeSessionId}' = source.item #>> '{source,candidatePracticeSessionId}'
    and jsonb_array_element(p_setup_snapshot_json #> '{followUpPractice,items}', (source.ordinal - 1)::integer)
          #>> '{sourceQuestionKey}' = source.item #>> '{source,questionKey}'
    and jsonb_array_element(p_setup_snapshot_json #> '{followUpPractice,items}', (source.ordinal - 1)::integer)
          #>> '{sourceQuestionText}' = source.item #>> '{source,questionText}'
    and jsonb_array_element(p_question_plan_snapshot_json -> 'slots', (source.ordinal - 1)::integer)
          ->> 'id' = 'slot-' || source.ordinal::text
    and jsonb_array_element(p_question_plan_snapshot_json -> 'slots', (source.ordinal - 1)::integer)
          #>> '{sourceQuestion,sourceCandidatePracticeSessionId}' = source.item #>> '{source,candidatePracticeSessionId}'
    and jsonb_array_element(p_question_plan_snapshot_json -> 'slots', (source.ordinal - 1)::integer)
          #>> '{sourceQuestion,sourceQuestionKey}' = source.item #>> '{source,questionKey}'
    and jsonb_array_element(p_question_wording_snapshot_json -> 'questions', (source.ordinal - 1)::integer)
          ->> 'slotId' = 'slot-' || source.ordinal::text
    and jsonb_array_element(p_question_wording_snapshot_json -> 'questions', (source.ordinal - 1)::integer)
          ->> 'questionText' = source.item #>> '{source,questionText}'
    and jsonb_array_element(p_question_wording_snapshot_json -> 'questions', (source.ordinal - 1)::integer)
          #>> '{sourceQuestion,sourceCandidatePracticeSessionId}' = source.item #>> '{source,candidatePracticeSessionId}'
    and jsonb_array_element(p_question_wording_snapshot_json -> 'questions', (source.ordinal - 1)::integer)
          #>> '{sourceQuestion,sourceQuestionKey}' = source.item #>> '{source,questionKey}';

  if v_matched_item_count <> v_item_count then
    return query select 'invalid_session'::text, null::uuid;
    return;
  end if;

  insert into public.candidate_practice_sessions (
    candidate_profile_id,
    role_profile_id,
    candidate_launch_session_id,
    status,
    setup_snapshot_json,
    question_plan_snapshot_json,
    question_wording_snapshot_json,
    question_wording_status,
    progress_state_json,
    answer_drafts_json
  )
  values (
    p_candidate_profile_id,
    p_role_profile_id,
    p_candidate_launch_session_id,
    'planned',
    p_setup_snapshot_json,
    p_question_plan_snapshot_json,
    p_question_wording_snapshot_json,
    p_question_wording_status,
    p_progress_state_json,
    p_answer_drafts_json
  )
  returning public.candidate_practice_sessions.candidate_practice_session_id
  into v_created_session_id;

  update public.candidate_practice_intents intent
  set lifecycle_state = 'consumed',
      consumed_candidate_practice_session_id = v_created_session_id,
      consumed_at = now(),
      launch_version = intent.launch_version + 1
  where intent.candidate_practice_intent_id = v_intent.candidate_practice_intent_id
    and intent.candidate_profile_id = p_candidate_profile_id
    and intent.lifecycle_state = 'ready'
    and intent.launch_version = p_expected_launch_version;

  if not found then
    raise exception 'candidate practice intent changed during atomic launch';
  end if;

  return query select 'created'::text, v_created_session_id;
end;
$$;
