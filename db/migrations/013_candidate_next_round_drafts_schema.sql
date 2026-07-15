-- Durable, candidate-owned editable next-round drafts.
-- Immutable practice intents remain the executable and historical launch boundary.

create unique index if not exists uq_candidate_practice_sessions_queue_owner
  on public.candidate_practice_sessions(candidate_practice_session_id, candidate_profile_id, role_profile_id);

create table if not exists public.candidate_next_round_drafts (
  candidate_next_round_draft_id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  role_profile_id uuid not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_candidate_next_round_draft_owned_profile
    foreign key (candidate_profile_id, role_profile_id)
    references public.candidate_role_preparation_profiles(candidate_profile_id, role_profile_id)
    on delete cascade,
  constraint chk_candidate_next_round_draft_version check (version > 0),
  constraint uq_candidate_next_round_draft_context unique (candidate_profile_id, role_profile_id),
  constraint uq_candidate_next_round_draft_owner unique (
    candidate_next_round_draft_id,
    candidate_profile_id,
    role_profile_id
  )
);

create table if not exists public.candidate_next_round_draft_items (
  candidate_next_round_draft_item_id uuid primary key default gen_random_uuid(),
  candidate_next_round_draft_id uuid not null,
  candidate_profile_id uuid not null,
  role_profile_id uuid not null,
  source_candidate_practice_session_id uuid not null,
  source_question_key text not null,
  practice_kind text not null,
  provenance text not null,
  display_position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_candidate_next_round_item_owned_draft
    foreign key (
      candidate_next_round_draft_id,
      candidate_profile_id,
      role_profile_id
    )
    references public.candidate_next_round_drafts(
      candidate_next_round_draft_id,
      candidate_profile_id,
      role_profile_id
    )
    on delete cascade,
  constraint fk_candidate_next_round_item_owned_source
    foreign key (
      source_candidate_practice_session_id,
      candidate_profile_id,
      role_profile_id
    )
    references public.candidate_practice_sessions(
      candidate_practice_session_id,
      candidate_profile_id,
      role_profile_id
    )
    on delete no action
    deferrable initially deferred,
  constraint chk_candidate_next_round_item_question_key check (length(trim(source_question_key)) > 0),
  constraint chk_candidate_next_round_item_kind check (
    practice_kind in ('practice_from_feedback', 'practice_missing_evidence')
  ),
  constraint chk_candidate_next_round_item_provenance check (
    provenance in ('coach_update', 'coach_plan', 'practice_next', 'candidate_selection', 'coach_bundle')
  ),
  constraint chk_candidate_next_round_item_position check (display_position between 0 and 19),
  constraint uq_candidate_next_round_item_source unique (
    candidate_next_round_draft_id,
    source_candidate_practice_session_id,
    source_question_key
  ),
  constraint uq_candidate_next_round_item_position unique (
    candidate_next_round_draft_id,
    display_position
  ) deferrable initially immediate
);

-- Source occurrence deletion must not mutate a draft behind its optimistic version.
alter table public.candidate_next_round_draft_items
  drop constraint if exists fk_candidate_next_round_item_owned_source;

alter table public.candidate_next_round_draft_items
  add constraint fk_candidate_next_round_item_owned_source
  foreign key (
    source_candidate_practice_session_id,
    candidate_profile_id,
    role_profile_id
  )
  references public.candidate_practice_sessions(
    candidate_practice_session_id,
    candidate_profile_id,
    role_profile_id
  )
  on delete no action
  deferrable initially deferred;

alter table public.candidate_practice_intents
  add column if not exists source_next_round_draft_id uuid;

alter table public.candidate_practice_intents
  add column if not exists source_next_round_draft_version bigint;

do $$
begin
  alter table public.candidate_practice_intents
    add constraint fk_candidate_practice_intent_source_draft
    foreign key (
      source_next_round_draft_id,
      candidate_profile_id,
      role_profile_id
    )
    references public.candidate_next_round_drafts(
      candidate_next_round_draft_id,
      candidate_profile_id,
      role_profile_id
    );
exception
  when duplicate_object then null;
end;
$$;

alter table public.candidate_practice_intents
  drop constraint if exists chk_candidate_practice_intent_source_draft_pair;

alter table public.candidate_practice_intents
  add constraint chk_candidate_practice_intent_source_draft_pair
  check (
    (source_next_round_draft_id is null and source_next_round_draft_version is null)
    or
    (
      source_next_round_draft_id is not null
      and source_next_round_draft_version is not null
      and source_next_round_draft_version > 0
    )
  );

create unique index if not exists uq_candidate_practice_intent_source_draft_version
  on public.candidate_practice_intents(source_next_round_draft_id, source_next_round_draft_version)
  where source_next_round_draft_id is not null;

create index if not exists idx_candidate_next_round_drafts_owner_context
  on public.candidate_next_round_drafts(candidate_profile_id, role_profile_id, updated_at desc);

create index if not exists idx_candidate_next_round_items_draft_position
  on public.candidate_next_round_draft_items(candidate_next_round_draft_id, display_position);

create or replace function public.enforce_candidate_next_round_draft_item_limit()
returns trigger
language plpgsql
as $$
begin
  perform 1
  from public.candidate_next_round_drafts
  where candidate_next_round_draft_id = new.candidate_next_round_draft_id
  for update;

  if (
    select count(*)
    from public.candidate_next_round_draft_items item
    where item.candidate_next_round_draft_id = new.candidate_next_round_draft_id
  ) >= 20 then
    raise exception 'candidate next-round drafts cannot contain more than 20 items'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_candidate_next_round_draft_item_limit
  on public.candidate_next_round_draft_items;
create trigger trg_candidate_next_round_draft_item_limit
before insert on public.candidate_next_round_draft_items
for each row execute function public.enforce_candidate_next_round_draft_item_limit();

create or replace function public.snapshot_candidate_next_round_draft_to_intent(
  p_candidate_next_round_draft_id uuid,
  p_candidate_profile_id uuid,
  p_role_profile_id uuid,
  p_expected_version bigint,
  p_target_interview_id text,
  p_target_role text,
  p_setup_context_json jsonb,
  p_items_json jsonb
)
returns table (
  launch_outcome text,
  candidate_practice_intent_id uuid,
  current_version bigint
)
language plpgsql
as $$
declare
  v_draft public.candidate_next_round_drafts%rowtype;
  v_existing_intent_id uuid;
  v_intent_id uuid;
  v_item_count integer;
  v_eligible_item_count integer;
  v_matched_item_count integer;
  v_deleted_item_count integer;
  v_updated_version bigint;
begin
  select intent.candidate_practice_intent_id
  into v_existing_intent_id
  from public.candidate_practice_intents intent
  where intent.source_next_round_draft_id = p_candidate_next_round_draft_id
    and intent.candidate_profile_id = p_candidate_profile_id
    and intent.role_profile_id = p_role_profile_id
    and intent.source_next_round_draft_version = p_expected_version
  limit 1;

  if v_existing_intent_id is not null then
    return query select 'replayed'::text, v_existing_intent_id, null::bigint;
    return;
  end if;

  select draft.*
  into v_draft
  from public.candidate_next_round_drafts draft
  where draft.candidate_next_round_draft_id = p_candidate_next_round_draft_id
    and draft.candidate_profile_id = p_candidate_profile_id
    and draft.role_profile_id = p_role_profile_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::bigint;
    return;
  end if;

  -- A concurrent first launch can finish while this caller waits for the draft lock.
  select intent.candidate_practice_intent_id
  into v_existing_intent_id
  from public.candidate_practice_intents intent
  where intent.source_next_round_draft_id = p_candidate_next_round_draft_id
    and intent.candidate_profile_id = p_candidate_profile_id
    and intent.role_profile_id = p_role_profile_id
    and intent.source_next_round_draft_version = p_expected_version
  limit 1;

  if v_existing_intent_id is not null then
    return query select 'replayed'::text, v_existing_intent_id, v_draft.version;
    return;
  end if;

  if v_draft.version <> p_expected_version then
    return query select 'version_conflict'::text, null::uuid, v_draft.version;
    return;
  end if;

  if p_setup_context_json is null
     or jsonb_typeof(p_setup_context_json) <> 'object'
     or p_items_json is null
     or jsonb_typeof(p_items_json) <> 'array'
     or p_target_interview_id is null
     or length(trim(p_target_interview_id)) = 0
     or p_target_role is null
     or length(trim(p_target_role)) = 0 then
    return query select 'invalid_items'::text, null::uuid, v_draft.version;
    return;
  end if;

  select count(*)::integer
  into v_item_count
  from public.candidate_next_round_draft_items item
  where item.candidate_next_round_draft_id = p_candidate_next_round_draft_id;

  if v_item_count not between 1 and 20
     or jsonb_array_length(p_items_json) <> v_item_count then
    return query select 'invalid_items'::text, null::uuid, v_draft.version;
    return;
  end if;

  select count(*)::integer
  into v_eligible_item_count
  from public.candidate_next_round_draft_items item
  join public.candidate_practice_sessions source_session
    on source_session.candidate_practice_session_id = item.source_candidate_practice_session_id
   and source_session.candidate_profile_id = item.candidate_profile_id
   and source_session.role_profile_id = item.role_profile_id
  where item.candidate_next_round_draft_id = p_candidate_next_round_draft_id
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(source_session.question_wording_snapshot_json -> 'questions') = 'array'
            then source_session.question_wording_snapshot_json -> 'questions'
          else '[]'::jsonb
        end
      ) question
      where question ->> 'slotId' = item.source_question_key
    )
    and (
      (
        item.practice_kind = 'practice_from_feedback'
        and source_session.answer_submissions_json ? item.source_question_key
        and source_session.answer_analysis_snapshots_json ? item.source_question_key
        and source_session.answer_analysis_snapshots_json
              #>> array[item.source_question_key, 'answer', 'slotId'] = item.source_question_key
        and (
          source_session.answer_analysis_snapshots_json
            #>> array[item.source_question_key, 'answer', 'answerAttemptId']
        ) is not distinct from (
          source_session.answer_submissions_json
            #>> array[item.source_question_key, 'answerAttemptId']
        )
      )
      or
      (
        item.practice_kind = 'practice_missing_evidence'
        and not source_session.answer_submissions_json ? item.source_question_key
      )
    );

  select count(*)::integer
  into v_matched_item_count
  from public.candidate_next_round_draft_items item
  where item.candidate_next_round_draft_id = p_candidate_next_round_draft_id
    and exists (
      select 1
      from jsonb_array_elements(p_items_json) payload_item
      where payload_item @> jsonb_build_object(
        'kind', item.practice_kind,
        'source', jsonb_build_object(
          'candidatePracticeSessionId', item.source_candidate_practice_session_id::text,
          'questionKey', item.source_question_key
        ),
        'assembly', jsonb_build_object(
          'source', 'next_round_draft',
          'candidateNextRoundDraftItemId', item.candidate_next_round_draft_item_id::text,
          'provenance', item.provenance,
          'displayPosition', item.display_position
        )
      )
    );

  if v_eligible_item_count <> v_item_count or v_matched_item_count <> v_item_count then
    return query select 'invalid_items'::text, null::uuid, v_draft.version;
    return;
  end if;

  insert into public.candidate_practice_intents (
    candidate_profile_id,
    source,
    lifecycle_state,
    source_next_round_draft_id,
    source_next_round_draft_version,
    role_profile_id,
    target_interview_id,
    target_role,
    setup_context_json,
    items_json
  ) values (
    p_candidate_profile_id,
    'practice_builder',
    'ready',
    p_candidate_next_round_draft_id,
    p_expected_version,
    p_role_profile_id,
    p_target_interview_id,
    p_target_role,
    p_setup_context_json,
    p_items_json
  )
  returning public.candidate_practice_intents.candidate_practice_intent_id
  into v_intent_id;

  delete from public.candidate_next_round_draft_items item
  where item.candidate_next_round_draft_id = p_candidate_next_round_draft_id;
  get diagnostics v_deleted_item_count = row_count;

  if v_deleted_item_count <> v_item_count then
    raise exception 'next-round draft changed during launch';
  end if;

  update public.candidate_next_round_drafts draft
  set version = draft.version + 1
  where draft.candidate_next_round_draft_id = p_candidate_next_round_draft_id
    and draft.candidate_profile_id = p_candidate_profile_id
    and draft.role_profile_id = p_role_profile_id
    and draft.version = p_expected_version
  returning draft.version into v_updated_version;

  if v_updated_version is null then
    raise exception 'next-round draft version changed during launch';
  end if;

  return query select 'created'::text, v_intent_id, v_updated_version;
exception
  when unique_violation then
    select intent.candidate_practice_intent_id
    into v_existing_intent_id
    from public.candidate_practice_intents intent
    where intent.source_next_round_draft_id = p_candidate_next_round_draft_id
      and intent.candidate_profile_id = p_candidate_profile_id
      and intent.role_profile_id = p_role_profile_id
      and intent.source_next_round_draft_version = p_expected_version
    limit 1;

    if v_existing_intent_id is null then
      raise;
    end if;

    return query select 'replayed'::text, v_existing_intent_id, null::bigint;
end;
$$;

drop trigger if exists trg_candidate_next_round_drafts_updated_at
  on public.candidate_next_round_drafts;
create trigger trg_candidate_next_round_drafts_updated_at
before update on public.candidate_next_round_drafts
for each row execute function public.set_updated_at();

drop trigger if exists trg_candidate_next_round_draft_items_updated_at
  on public.candidate_next_round_draft_items;
create trigger trg_candidate_next_round_draft_items_updated_at
before update on public.candidate_next_round_draft_items
for each row execute function public.set_updated_at();
