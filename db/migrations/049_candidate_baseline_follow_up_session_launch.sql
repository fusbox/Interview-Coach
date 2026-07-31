begin;

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
        and (
          exists (
            select 1
            from jsonb_array_elements(
              case
                when jsonb_typeof(source_session.question_wording_snapshot_json -> 'questions') = 'array'
                  then source_session.question_wording_snapshot_json -> 'questions'
                else '[]'::jsonb
              end
            ) source_question
            where source_question ->> 'slotId' = source.item #>> '{source,questionKey}'
              and source_question ->> 'questionText' = source.item #>> '{source,questionText}'
          )
          or (
            source.item ->> 'kind' = 'practice_missing_evidence'
            and not source_session.answer_submissions_json
              ? (source.item #>> '{source,questionKey}')
            and exists (
              select 1
              from public.candidate_role_preparation_profiles role_profile
              where role_profile.role_profile_id = v_intent.role_profile_id
                and role_profile.candidate_profile_id = p_candidate_profile_id
                and exists (
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
                  where baseline_question ->> 'slotId' = source.item #>> '{source,questionKey}'
                    and baseline_question ->> 'questionText'
                      = source.item #>> '{source,questionText}'
                )
            )
          )
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

commit;
