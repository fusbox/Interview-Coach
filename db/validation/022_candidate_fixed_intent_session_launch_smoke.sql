-- Rollback-only smoke for atomic candidate fixed-intent session launch.

begin;

insert into public.candidate_profiles (
  candidate_profile_id, auth_subject, email, display_name, workspace
) values
  (
    'f1000000-0000-4000-8000-000000000001',
    'local_dev:fixed-intent-owner@example.invalid',
    'fixed-intent-owner@example.invalid',
    'Fixed Intent Owner',
    'local_dev'
  ),
  (
    'f1000000-0000-4000-8000-000000000002',
    'local_dev:other-fixed-intent-owner@example.invalid',
    'other-fixed-intent-owner@example.invalid',
    'Other Fixed Intent Owner',
    'local_dev'
  );

insert into public.candidate_role_preparation_profiles (
  role_profile_id, candidate_profile_id, target_role, normalized_target_role,
  job_description_snapshot, job_description_hash, source
) values
  (
    'f2000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    'Quality Inspector', 'quality inspector', 'Inspect finished goods.',
    'fixed-intent-role-hash', 'manual'
  ),
  (
    'f2000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000002',
    'Quality Inspector', 'quality inspector', 'Inspect finished goods.',
    'other-fixed-intent-role-hash', 'manual'
  );

insert into public.candidate_practice_sessions (
  candidate_practice_session_id, candidate_profile_id, role_profile_id, status,
  setup_snapshot_json, question_plan_snapshot_json, question_wording_snapshot_json,
  question_wording_status, progress_state_json
) values
  (
    'f3000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    'f2000000-0000-4000-8000-000000000001',
    'completed',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","resumeText":null,"interviewStage":"screening","questionCount":1,"resumeCaptureMode":"none","createdAt":"2026-07-18T12:00:00.000Z"}'::jsonb,
    '{"interviewStage":"screening","questionCount":1,"categoryCounts":{"screening":1,"behavioral":0,"culture_fit":0,"case_scenario":0,"technical_role_specific":0},"slots":[{"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."}]}'::jsonb,
    '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"Why does this quality role interest you?"}]}'::jsonb,
    'worded',
    '{"status":"completed","currentQuestionIndex":0}'::jsonb
  ),
  (
    'f3000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000002',
    'f2000000-0000-4000-8000-000000000002',
    'completed',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","resumeText":null,"interviewStage":"screening","questionCount":1,"resumeCaptureMode":"none","createdAt":"2026-07-18T12:00:00.000Z"}'::jsonb,
    '{"interviewStage":"screening","questionCount":1,"categoryCounts":{"screening":1,"behavioral":0,"culture_fit":0,"case_scenario":0,"technical_role_specific":0},"slots":[{"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."}]}'::jsonb,
    '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"Why does this quality role interest you?"}]}'::jsonb,
    'worded',
    '{"status":"completed","currentQuestionIndex":0}'::jsonb
  );

insert into public.candidate_practice_intents (
  candidate_practice_intent_id, candidate_profile_id, source, lifecycle_state,
  role_profile_id, target_interview_id, target_role, setup_context_json, items_json
) values
  (
    'f4000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    'practice_builder', 'ready',
    'f2000000-0000-4000-8000-000000000001',
    'quality inspector', 'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
    '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"f3000000-0000-4000-8000-000000000001","questionKey":"slot-1","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this quality role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one focused answer."}}]'::jsonb
  ),
  (
    'f4000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000001',
    'practice_builder', 'ready',
    'f2000000-0000-4000-8000-000000000001',
    'quality inspector', 'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
    '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"f3000000-0000-4000-8000-000000000001","questionKey":"slot-1","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this quality role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one focused answer."}}]'::jsonb
  ),
  (
    'f4000000-0000-4000-8000-000000000004',
    'f1000000-0000-4000-8000-000000000001',
    'practice_builder', 'ready',
    'f2000000-0000-4000-8000-000000000001',
    'quality inspector', 'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
    '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"f3000000-0000-4000-8000-000000000001","questionKey":"slot-1","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this quality role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one focused answer."}}]'::jsonb
  ),
  (
    'f4000000-0000-4000-8000-000000000006',
    'f1000000-0000-4000-8000-000000000001',
    'practice_builder', 'ready',
    'f2000000-0000-4000-8000-000000000001',
    'quality inspector', 'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
    '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"f3000000-0000-4000-8000-000000000001","questionKey":"slot-1","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this quality role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one focused answer."}}]'::jsonb
  );

insert into public.candidate_practice_intents (
  candidate_practice_intent_id, candidate_profile_id, source, lifecycle_state,
  role_profile_id, target_interview_id, target_role, setup_context_json, items_json,
  created_at, expires_at
) values (
  'f4000000-0000-4000-8000-000000000003',
  'f1000000-0000-4000-8000-000000000001',
  'practice_builder', 'ready',
  'f2000000-0000-4000-8000-000000000001',
  'quality inspector', 'Quality Inspector',
  '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
  '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"f3000000-0000-4000-8000-000000000001","questionKey":"slot-1","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this quality role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one focused answer."}}]'::jsonb,
  now() - interval '2 hours',
  now() - interval '1 hour'
);

insert into public.candidate_practice_intents (
  candidate_practice_intent_id, candidate_profile_id, source, lifecycle_state,
  launch_version, consumed_candidate_practice_session_id, consumed_at,
  role_profile_id, target_interview_id, target_role, setup_context_json, items_json
) values (
  'f4000000-0000-4000-8000-000000000005',
  'f1000000-0000-4000-8000-000000000001',
  'practice_builder', 'consumed', 2,
  'f3000000-0000-4000-8000-000000000001', now(),
  'f2000000-0000-4000-8000-000000000001',
  'quality inspector', 'Quality Inspector',
  '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
  '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"f3000000-0000-4000-8000-000000000001","questionKey":"slot-1","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this quality role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one focused answer."}}]'::jsonb
);

insert into public.candidate_practice_intents (
  candidate_practice_intent_id, candidate_profile_id, source, lifecycle_state,
  role_profile_id, target_interview_id, target_role, setup_context_json, items_json
)
select
  'f4000000-0000-4000-8000-000000000008',
  candidate_profile_id, source, lifecycle_state,
  role_profile_id, target_interview_id, target_role, setup_context_json, items_json
from public.candidate_practice_intents
where candidate_practice_intent_id = 'f4000000-0000-4000-8000-000000000002';

create or replace function public.fail_fixed_intent_smoke_consume()
returns trigger
language plpgsql
as $$
begin
  if new.candidate_practice_intent_id = 'f4000000-0000-4000-8000-000000000008' then
    raise exception 'forced post-insert intent-consume failure';
  end if;
  return new;
end;
$$;

create trigger trg_zz_fail_fixed_intent_smoke_consume
before update on public.candidate_practice_intents
for each row execute function public.fail_fixed_intent_smoke_consume();

do $$
declare
  v_created record;
  v_replayed record;
  v_stale record;
  v_expired record;
  v_mismatched record;
  v_invalid record;
  v_unowned record;
  v_consumed_mismatch record;
  v_session_count integer;
  v_rollback_session_count integer;
  v_rollback_setup jsonb;
  v_rollback_plan jsonb;
  v_rollback_wording jsonb;
begin
  select * into v_created
  from public.start_candidate_practice_intent_session(
    'f4000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    1,
    1,
    'f2000000-0000-4000-8000-000000000001',
    null,
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","resumeText":null,"interviewStage":"screening","questionCount":1,"resumeCaptureMode":"none","createdAt":"2026-07-18T13:00:00.000Z","followUpPractice":{"status":"candidate_follow_up_practice_session","sourceIntentId":"f4000000-0000-4000-8000-000000000001","source":"practice_builder","sessionAttemptNumber":2,"itemCount":1,"items":[{"localSlotId":"slot-1","localQuestionNumber":1,"candidatePracticeSessionId":"f3000000-0000-4000-8000-000000000001","questionKey":"slot-1","sourceCandidatePracticeSessionId":"f3000000-0000-4000-8000-000000000001","sourceQuestionKey":"slot-1","sourceQuestionNumber":1,"sourceQuestionText":"Why does this quality role interest you?","sourceCategory":"Screening","questionAttemptNumber":2,"practiceKind":"practice_from_feedback"}]}}'::jsonb,
    '{"interviewStage":"screening","questionCount":1,"categoryCounts":{"screening":1,"behavioral":0,"culture_fit":0,"case_scenario":0,"technical_role_specific":0},"followUpPractice":{"sourceIntentId":"f4000000-0000-4000-8000-000000000001","source":"practice_builder","sessionAttemptNumber":2,"itemCount":1},"slots":[{"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Practice one focused answer.","sourceQuestion":{"sourceCandidatePracticeSessionId":"f3000000-0000-4000-8000-000000000001","sourceQuestionKey":"slot-1"}}]}'::jsonb,
    '{"status":"questions_worded","followUpPractice":{"sourceIntentId":"f4000000-0000-4000-8000-000000000001","source":"practice_builder","sessionAttemptNumber":2,"itemCount":1},"questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"Why does this quality role interest you?","sourceQuestion":{"sourceCandidatePracticeSessionId":"f3000000-0000-4000-8000-000000000001","sourceQuestionKey":"slot-1"}}]}'::jsonb,
    'worded',
    '{"status":"live_question","currentQuestionIndex":0}'::jsonb,
    '{}'::jsonb
  );

  if v_created.launch_outcome <> 'created' or v_created.candidate_practice_session_id is null then
    raise exception 'expected one created fixed-intent session';
  end if;

  select * into v_replayed
  from public.start_candidate_practice_intent_session(
    'f4000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    1, 0, null, null, null, null, null, null, null, null
  );

  if v_replayed.launch_outcome <> 'replayed'
    or v_replayed.candidate_practice_session_id <> v_created.candidate_practice_session_id then
    raise exception 'expected response-loss replay to return the same session';
  end if;

  select
    session.setup_snapshot_json,
    session.question_plan_snapshot_json,
    session.question_wording_snapshot_json
  into v_rollback_setup, v_rollback_plan, v_rollback_wording
  from public.candidate_practice_sessions session
  where session.candidate_practice_session_id = v_created.candidate_practice_session_id;

  v_rollback_setup := jsonb_set(
    jsonb_set(
      v_rollback_setup,
      '{followUpPractice,sourceIntentId}',
      to_jsonb('f4000000-0000-4000-8000-000000000008'::text)
    ),
    '{followUpPractice,sessionAttemptNumber}',
    '3'::jsonb
  );
  v_rollback_plan := jsonb_set(
    jsonb_set(
      v_rollback_plan,
      '{followUpPractice,sourceIntentId}',
      to_jsonb('f4000000-0000-4000-8000-000000000008'::text)
    ),
    '{followUpPractice,sessionAttemptNumber}',
    '3'::jsonb
  );
  v_rollback_wording := jsonb_set(
    jsonb_set(
      v_rollback_wording,
      '{followUpPractice,sourceIntentId}',
      to_jsonb('f4000000-0000-4000-8000-000000000008'::text)
    ),
    '{followUpPractice,sessionAttemptNumber}',
    '3'::jsonb
  );

  begin
    perform *
    from public.start_candidate_practice_intent_session(
      'f4000000-0000-4000-8000-000000000008',
      'f1000000-0000-4000-8000-000000000001',
      1,
      2,
      'f2000000-0000-4000-8000-000000000001',
      null,
      v_rollback_setup,
      v_rollback_plan,
      v_rollback_wording,
      'worded',
      '{"status":"live_question","currentQuestionIndex":0}'::jsonb,
      '{}'::jsonb
    );
    raise exception 'expected the post-insert consume trigger to fail';
  exception
    when raise_exception then
      if sqlerrm = 'expected the post-insert consume trigger to fail' then
        raise;
      end if;
      if sqlerrm <> 'forced post-insert intent-consume failure' then
        raise;
      end if;
  end;

  select count(*)::integer
  into v_rollback_session_count
  from public.candidate_practice_sessions session
  where session.setup_snapshot_json #>> '{followUpPractice,sourceIntentId}'
    = 'f4000000-0000-4000-8000-000000000008';

  if v_rollback_session_count <> 0 then
    raise exception 'expected post-insert failure to roll back the session';
  end if;

  select * into v_stale
  from public.start_candidate_practice_intent_session(
    'f4000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000001',
    1, 1, 'f2000000-0000-4000-8000-000000000001', null,
    null, null, null, null, null, null
  );
  if v_stale.launch_outcome <> 'stale_context' then
    raise exception 'expected stale prep-context attempt count';
  end if;

  select * into v_expired
  from public.start_candidate_practice_intent_session(
    'f4000000-0000-4000-8000-000000000003',
    'f1000000-0000-4000-8000-000000000001',
    1, 0, null, null, null, null, null, null, null, null
  );
  if v_expired.launch_outcome <> 'expired' then
    raise exception 'expected expired intent to fail before session mutation';
  end if;

  select * into v_mismatched
  from public.start_candidate_practice_intent_session(
    'f4000000-0000-4000-8000-000000000004',
    'f1000000-0000-4000-8000-000000000001',
    99, 2, 'f2000000-0000-4000-8000-000000000001', null,
    null, null, null, null, null, null
  );
  if v_mismatched.launch_outcome <> 'mismatched' then
    raise exception 'expected changed intent version to fail';
  end if;

  select * into v_invalid
  from public.start_candidate_practice_intent_session(
    'f4000000-0000-4000-8000-000000000006',
    'f1000000-0000-4000-8000-000000000001',
    1, 2, 'f2000000-0000-4000-8000-000000000001', null,
    null, null, null, null, null, null
  );
  if v_invalid.launch_outcome <> 'invalid_session' then
    raise exception 'expected mismatched session snapshots to fail';
  end if;

  select * into v_unowned
  from public.start_candidate_practice_intent_session(
    'f4000000-0000-4000-8000-000000000004',
    'f1000000-0000-4000-8000-000000000002',
    1, 0, null, null, null, null, null, null, null, null
  );
  if v_unowned.launch_outcome <> 'not_found' then
    raise exception 'expected cross-candidate intent lookup to fail closed';
  end if;

  select * into v_consumed_mismatch
  from public.start_candidate_practice_intent_session(
    'f4000000-0000-4000-8000-000000000005',
    'f1000000-0000-4000-8000-000000000001',
    2, 0, null, null, null, null, null, null, null, null
  );
  if v_consumed_mismatch.launch_outcome <> 'consumed_mismatch' then
    raise exception 'expected unrelated consumed session pointer to fail closed';
  end if;

  select count(*)::integer into v_session_count
  from public.candidate_practice_sessions session
  where session.candidate_profile_id = 'f1000000-0000-4000-8000-000000000001'
    and session.role_profile_id = 'f2000000-0000-4000-8000-000000000001';

  if v_session_count <> 2 then
    raise exception 'expected exactly one new session, found context count %', v_session_count;
  end if;
end;
$$;

do $$
begin
  update public.candidate_practice_intents
  set target_role = 'Changed role'
  where candidate_practice_intent_id = 'f4000000-0000-4000-8000-000000000002';

  raise exception 'expected immutable intent content update to fail';
exception
  when raise_exception then
    if sqlerrm = 'expected immutable intent content update to fail' then
      raise;
    end if;
end;
$$;

do $$
begin
  insert into public.candidate_practice_intents (
    candidate_practice_intent_id, candidate_profile_id, source, lifecycle_state,
    launch_version, consumed_candidate_practice_session_id, consumed_at,
    role_profile_id, target_interview_id, target_role, setup_context_json, items_json
  ) values (
    'f4000000-0000-4000-8000-000000000007',
    'f1000000-0000-4000-8000-000000000001',
    'practice_builder', 'consumed', 2,
    'f3000000-0000-4000-8000-000000000002', now(),
    'f2000000-0000-4000-8000-000000000001',
    'quality inspector', 'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
    '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"f3000000-0000-4000-8000-000000000001","questionKey":"slot-1","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this quality role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one focused answer."}}]'::jsonb
  );

  raise exception 'expected cross-candidate consumed session pointer to fail';
exception
  when foreign_key_violation then null;
end;
$$;

rollback;
