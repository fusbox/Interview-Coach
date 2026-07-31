begin;

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
  join public.candidate_role_preparation_profiles role_profile
    on role_profile.role_profile_id = item.role_profile_id
   and role_profile.candidate_profile_id = item.candidate_profile_id
  where item.candidate_next_round_draft_id = p_candidate_next_round_draft_id
    and (
      (
        item.practice_kind = 'practice_from_feedback'
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
        and (
          exists (
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
          or exists (
            select 1
            from jsonb_array_elements(
              case
                when jsonb_typeof(
                  role_profile.rigor_baseline_question_wording_snapshot_json -> 'questions'
                ) = 'array'
                  then role_profile.rigor_baseline_question_wording_snapshot_json -> 'questions'
                else '[]'::jsonb
              end
            ) baseline_question
            where baseline_question ->> 'slotId' = item.source_question_key
          )
        )
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

commit;
