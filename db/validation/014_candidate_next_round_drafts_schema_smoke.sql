-- Rollback-only smoke validation for db/migrations/013_candidate_next_round_drafts_schema.sql.

begin;

insert into public.candidate_profiles (
  candidate_profile_id, auth_subject, email, display_name, workspace
) values
  (
    'd1000000-0000-4000-8000-000000000001',
    'local_dev:queue-owner@example.invalid',
    'queue-owner@example.invalid',
    'Queue Owner',
    'local_dev'
  ),
  (
    'd1000000-0000-4000-8000-000000000002',
    'local_dev:other-queue-owner@example.invalid',
    'other-queue-owner@example.invalid',
    'Other Queue Owner',
    'local_dev'
  );

insert into public.candidate_role_preparation_profiles (
  role_profile_id, candidate_profile_id, target_role, normalized_target_role,
  job_description_snapshot, job_description_hash, source
) values
  (
    'd2000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'Quality Inspector', 'quality inspector', 'Inspect finished goods.',
    'queue-owner-role-hash', 'manual'
  ),
  (
    'd2000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000002',
    'Quality Inspector', 'quality inspector', 'Inspect finished goods.',
    'other-queue-owner-role-hash', 'manual'
  );

insert into public.candidate_practice_sessions (
  candidate_practice_session_id, candidate_profile_id, role_profile_id, status,
  setup_snapshot_json, question_plan_snapshot_json, question_wording_snapshot_json,
  question_wording_status, progress_state_json, answer_submissions_json,
  answer_analysis_snapshots_json
) values
  (
    'd3000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'in_progress',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":2,"resumeCaptureMode":"none","createdAt":"2026-07-15T12:00:00.000Z"}'::jsonb,
    '{"interviewStage":"screening","questionCount":2,"categoryCounts":{"screening":1,"behavioral":1,"culture_fit":0,"case_scenario":0,"technical_role_specific":0},"slots":[{"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."},{"id":"slot-2","index":1,"category":"behavioral","label":"Behavioral","purpose":"Past evidence."}]}'::jsonb,
    '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"Why this role?"},{"slotId":"slot-2","index":1,"category":"behavioral","questionText":"Tell me about finding a defect."}]}'::jsonb,
    'worded',
    '{"status":"live_question","currentQuestionIndex":1}'::jsonb,
    '{"slot-1":{"slotId":"slot-1","questionIndex":0,"mode":"text","text":"I care about quality.","submittedAt":"2026-07-15T12:01:00.000Z","status":"analyzed","answerAttemptId":"attempt-1","attemptNumber":1,"trigger":"initial_submit","supersedesAnswerAttemptId":null}}'::jsonb,
    '{"slot-1":{"status":"candidate_answer_analysis_ready","answer":{"slotId":"slot-1","questionIndex":0,"answerAttemptId":"attempt-1","attemptNumber":1,"trigger":"initial_submit"}}}'::jsonb
  ),
  (
    'd3000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000002',
    'd2000000-0000-4000-8000-000000000002',
    'planned',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":1,"resumeCaptureMode":"none","createdAt":"2026-07-15T12:00:00.000Z"}'::jsonb,
    '{"interviewStage":"screening","questionCount":1,"categoryCounts":{"screening":1,"behavioral":0,"culture_fit":0,"case_scenario":0,"technical_role_specific":0},"slots":[{"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."}]}'::jsonb,
    '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"Why this role?"}]}'::jsonb,
    'worded',
    '{"status":"live_question","currentQuestionIndex":0}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.candidate_next_round_drafts (
  candidate_next_round_draft_id, candidate_profile_id, role_profile_id
) values (
  'd4000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001'
);

insert into public.candidate_next_round_draft_items (
  candidate_next_round_draft_item_id, candidate_next_round_draft_id,
  candidate_profile_id, role_profile_id, source_candidate_practice_session_id,
  source_question_key, practice_kind, provenance, display_position
) values (
  'd5000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'slot-1', 'practice_from_feedback', 'coach_update', 0
);

do $$
begin
  insert into public.candidate_next_round_draft_items (
    candidate_next_round_draft_id, candidate_profile_id, role_profile_id,
    source_candidate_practice_session_id, source_question_key,
    practice_kind, provenance, display_position
  ) values (
    'd4000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000002',
    'slot-1', 'practice_missing_evidence', 'coach_plan', 1
  );

  set constraints fk_candidate_next_round_item_owned_source immediate;

  raise exception 'expected cross-candidate source ownership to fail';
exception
  when foreign_key_violation then null;
end;
$$;

do $$
begin
  insert into public.candidate_next_round_draft_items (
    candidate_next_round_draft_id, candidate_profile_id, role_profile_id,
    source_candidate_practice_session_id, source_question_key,
    practice_kind, provenance, display_position
  ) values (
    'd4000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000001',
    'slot-1', 'practice_from_feedback', 'coach_update', 1
  );

  raise exception 'expected duplicate source question to fail';
exception
  when unique_violation then null;
end;
$$;

do $$
begin
  insert into public.candidate_practice_intents (
    candidate_profile_id, source, lifecycle_state, role_profile_id,
    target_interview_id, target_role, setup_context_json, items_json,
    source_next_round_draft_id
  ) values (
    'd1000000-0000-4000-8000-000000000001',
    'practice_builder', 'ready',
    'd2000000-0000-4000-8000-000000000001',
    'quality inspector', 'Quality Inspector',
    '{"targetRole":"Quality Inspector"}'::jsonb,
    '[{"kind":"practice_from_feedback"}]'::jsonb,
    'd4000000-0000-4000-8000-000000000001'
  );

  raise exception 'expected incomplete source draft lineage to fail';
exception
  when check_violation then null;
end;
$$;

do $$
declare
  v_created record;
  v_replayed record;
  v_invalid record;
  v_item_count integer;
  v_intent_count integer;
  v_draft_version bigint;
begin
  select * into v_created
  from public.snapshot_candidate_next_round_draft_to_intent(
    'd4000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    1,
    'quality inspector',
    'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":2,"resumeIncluded":false}'::jsonb,
    '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"d3000000-0000-4000-8000-000000000001","questionKey":"slot-1","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":1,"category":"Screening","questionText":"Why this role?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice question 1."},"assembly":{"source":"next_round_draft","candidateNextRoundDraftItemId":"d5000000-0000-4000-8000-000000000001","provenance":"coach_update","displayPosition":0}}]'::jsonb
  );

  if v_created.launch_outcome <> 'created' or v_created.candidate_practice_intent_id is null then
    raise exception 'expected atomic draft snapshot to create one intent';
  end if;

  select count(*) into v_item_count
  from public.candidate_next_round_draft_items
  where candidate_next_round_draft_id = 'd4000000-0000-4000-8000-000000000001';

  select version into v_draft_version
  from public.candidate_next_round_drafts
  where candidate_next_round_draft_id = 'd4000000-0000-4000-8000-000000000001';

  if v_item_count <> 0 or v_draft_version <> 2 then
    raise exception 'expected successful launch to clear items and advance draft version';
  end if;

  select * into v_replayed
  from public.snapshot_candidate_next_round_draft_to_intent(
    'd4000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    1,
    'quality inspector',
    'Quality Inspector',
    '{"targetRole":"Quality Inspector"}'::jsonb,
    '[]'::jsonb
  );

  if v_replayed.launch_outcome <> 'replayed'
     or v_replayed.candidate_practice_intent_id <> v_created.candidate_practice_intent_id then
    raise exception 'expected duplicate launch to recover the first immutable intent';
  end if;

  insert into public.candidate_next_round_draft_items (
    candidate_next_round_draft_item_id, candidate_next_round_draft_id,
    candidate_profile_id, role_profile_id, source_candidate_practice_session_id,
    source_question_key, practice_kind, provenance, display_position
  ) values (
    'd5000000-0000-4000-8000-000000000002',
    'd4000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000001',
    'slot-1', 'practice_from_feedback', 'coach_update', 0
  );

  select * into v_invalid
  from public.snapshot_candidate_next_round_draft_to_intent(
    'd4000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    2,
    'quality inspector',
    'Quality Inspector',
    '{"targetRole":"Quality Inspector"}'::jsonb,
    '[{"kind":"practice_from_feedback","source":{"candidatePracticeSessionId":"d3000000-0000-4000-8000-000000000001","questionKey":"slot-1"},"assembly":{"source":"next_round_draft","candidateNextRoundDraftItemId":"wrong-item","provenance":"coach_update","displayPosition":0}}]'::jsonb
  );

  select count(*) into v_item_count
  from public.candidate_next_round_draft_items
  where candidate_next_round_draft_id = 'd4000000-0000-4000-8000-000000000001';

  select count(*) into v_intent_count
  from public.candidate_practice_intents
  where source_next_round_draft_id = 'd4000000-0000-4000-8000-000000000001';

  if v_invalid.launch_outcome <> 'invalid_items' or v_item_count <> 1 or v_intent_count <> 1 then
    raise exception 'expected invalid launch payload to leave the mutable draft untouched';
  end if;
end;
$$;

rollback;
