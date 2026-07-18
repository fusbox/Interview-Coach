-- Rollback-only smoke validation for db/migrations/008_candidate_practice_intents_schema.sql.
-- Run against a disposable database after applying candidate identity and practice-intent migrations.

begin;

insert into public.candidate_profiles (
  candidate_profile_id,
  auth_subject,
  email,
  display_name,
  workspace
)
values (
  '91919191-9191-4191-8191-919191919191',
  'local_dev:practice-intent-candidate@example.invalid',
  'practice-intent-candidate@example.invalid',
  'Practice Intent Candidate',
  'local_dev'
);

insert into public.candidate_practice_intents (
  candidate_practice_intent_id,
  candidate_profile_id,
  source,
  lifecycle_state,
  target_interview_id,
  target_role,
  setup_context_json,
  items_json
)
values (
  '92929292-9292-4292-8292-929292929292',
  '91919191-9191-4191-8191-919191919191',
  'practice_builder',
  'ready',
  'material handler i',
  'Material Handler I',
  '{"targetRole":"Material Handler I","jobDescription":"Move materials safely.","interviewStage":"first_interview","questionCount":3,"resumeIncluded":false}'::jsonb,
  '[
    {"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"session-1","questionKey":"slot-1","targetInterviewId":"material handler i","targetRole":"Material Handler I","questionNumber":1,"category":"Screening","questionText":"What interests you about this Material Handler role?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"I found the source coach read for Material Handler I, question 1."}},
    {"kind":"practice_missing_evidence","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"session-1","questionKey":"slot-2","targetInterviewId":"material handler i","targetRole":"Material Handler I","questionNumber":2,"category":"Behavioral","questionText":"Tell me about a time you handled an inventory issue.","evidenceStatus":"missing_practice_evidence"},"display":{"label":"Practice missing evidence","body":"I found the planned Material Handler I question that still needs practice evidence."}}
  ]'::jsonb
);

insert into public.candidate_practice_sessions (
  candidate_practice_session_id,
  candidate_profile_id,
  status,
  setup_snapshot_json,
  question_plan_snapshot_json,
  question_wording_snapshot_json,
  question_wording_status,
  progress_state_json
)
values (
  '93939393-9393-4393-8393-939393939393',
  '91919191-9191-4191-8191-919191919191',
  'planned',
  '{"targetRole":"Material Handler I","jobDescription":"Move materials safely.","interviewStage":"first_interview","questionCount":2,"resumeCaptureMode":"none","createdAt":"2026-07-12T17:00:00.000Z","followUpPractice":{"status":"candidate_follow_up_practice_session","sourceIntentId":"92929292-9292-4292-8292-929292929292","source":"practice_builder","sessionAttemptNumber":1,"itemCount":2,"items":[]}}'::jsonb,
  '{"interviewStage":"first_interview","questionCount":2,"categoryCounts":{"screening":1,"behavioral":1,"culture_fit":0,"case_scenario":0,"technical_role_specific":0},"slots":[{"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."},{"id":"slot-2","index":1,"category":"behavioral","label":"Behavioral","purpose":"Past examples."}]}'::jsonb,
  '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"What interests you about this Material Handler role?"},{"slotId":"slot-2","index":1,"category":"behavioral","questionText":"Tell me about a time you handled an inventory issue."}]}'::jsonb,
  'worded',
  '{"status":"planned","currentQuestionIndex":0}'::jsonb
);

update public.candidate_practice_intents
set lifecycle_state = 'consumed',
    consumed_candidate_practice_session_id = '93939393-9393-4393-8393-939393939393',
    consumed_at = now(),
    launch_version = launch_version + 1
where candidate_practice_intent_id = '92929292-9292-4292-8292-929292929292';

do $$
declare
  v_intent_count integer;
begin
  select count(*) into v_intent_count
  from public.candidate_practice_intents intent
  join public.candidate_profiles profile
    on profile.candidate_profile_id = intent.candidate_profile_id
  where intent.candidate_practice_intent_id = '92929292-9292-4292-8292-929292929292'
    and profile.email = 'practice-intent-candidate@example.invalid'
    and intent.source = 'practice_builder'
    and intent.lifecycle_state = 'consumed'
    and intent.consumed_candidate_practice_session_id = '93939393-9393-4393-8393-939393939393'
    and intent.target_interview_id = 'material handler i'
    and intent.setup_context_json ->> 'targetRole' = 'Material Handler I'
    and jsonb_array_length(intent.items_json) = 2
    and intent.items_json #>> '{0,source,questionKey}' = 'slot-1'
    and intent.items_json #>> '{1,source,questionKey}' = 'slot-2';

  if v_intent_count <> 1 then
    raise exception 'expected 1 traceable candidate practice intent, found %', v_intent_count;
  end if;
end;
$$;

do $$
declare
  v_consumed_count integer;
begin
  select count(*) into v_consumed_count
  from public.candidate_practice_intents intent
  join public.candidate_practice_sessions session
    on session.candidate_practice_session_id = intent.consumed_candidate_practice_session_id
  where intent.candidate_practice_intent_id = '92929292-9292-4292-8292-929292929292'
    and intent.lifecycle_state = 'consumed'
    and session.candidate_profile_id = intent.candidate_profile_id;

  if v_consumed_count <> 1 then
    raise exception 'expected 1 consumed candidate practice intent linked to a candidate-owned session, found %', v_consumed_count;
  end if;
end;
$$;

do $$
begin
  insert into public.candidate_practice_intents (
    candidate_profile_id,
    source,
    lifecycle_state,
    target_interview_id,
    target_role,
    setup_context_json,
    items_json
  )
  values (
    '91919191-9191-4191-8191-919191919191',
    'practice_builder',
    'ready',
    'material handler i',
    'Material Handler I',
    '[]'::jsonb,
    '[]'::jsonb
  );

  raise exception 'expected array setup context to fail';
exception
  when check_violation then null;
end;
$$;

do $$
begin
  insert into public.candidate_practice_intents (
    candidate_profile_id,
    source,
    lifecycle_state,
    target_interview_id,
    target_role,
    setup_context_json,
    items_json
  )
  values (
    '91919191-9191-4191-8191-919191919191',
    'practice_builder',
    'ready',
    'material handler i',
    'Material Handler I',
    '{"targetRole":"Material Handler I"}'::jsonb,
    '{}'::jsonb
  );

  raise exception 'expected object items to fail';
exception
  when check_violation then null;
end;
$$;

do $$
begin
  insert into public.candidate_practice_intents (
    candidate_profile_id,
    source,
    lifecycle_state,
    target_interview_id,
    target_role,
    setup_context_json,
    items_json
  )
  values (
    '91919191-9191-4191-8191-919191919191',
    'practice_builder',
    'ready',
    'material handler i',
    'Material Handler I',
    '{"targetRole":"Material Handler I"}'::jsonb,
    '[]'::jsonb
  );

  raise exception 'expected empty items to fail';
exception
  when check_violation then null;
end;
$$;

rollback;
