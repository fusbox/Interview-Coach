-- Rollback-only smoke validation for db/migrations/007_candidate_practice_sessions_schema.sql.
-- Run against a disposable database after applying candidate identity, role-profile, host-launch, and practice-session migrations.

begin;

insert into public.candidate_profiles (
  candidate_profile_id,
  auth_subject,
  email,
  display_name,
  workspace
)
values (
  '51515151-5151-4151-8151-515151515151',
  'local_dev:practice-session-candidate@example.invalid',
  'practice-session-candidate@example.invalid',
  'Practice Session Candidate',
  'local_dev'
);

insert into public.candidate_role_preparation_profiles (
  role_profile_id,
  candidate_profile_id,
  target_role,
  normalized_target_role,
  job_description_snapshot,
  job_description_hash,
  source
)
values (
  '62626262-6262-4262-8262-626262626262',
  '51515151-5151-4151-8151-515151515151',
  'Material Handler',
  'material handler',
  'Move materials safely and track inventory.',
  'material-handler-hash',
  'manual'
);

insert into public.candidate_launch_sessions (
  candidate_launch_session_id,
  candidate_profile_id,
  provider,
  issuer,
  subject,
  platform_candidate_id,
  job_collection_id,
  source_surface,
  launch_context_snapshot_json,
  expires_at
)
values (
  '73737373-7373-4373-8373-737373737373',
  '51515151-5151-4151-8151-515151515151',
  'talentarbor_launch',
  'talentarbor',
  'candidate:515151',
  '515151',
  '9090',
  'TA_JOB_SEARCH',
  '{"candidateId":"515151","jobCollectionId":"9090","sourceSurface":"TA_JOB_SEARCH"}'::jsonb,
  now() + interval '7 days'
);

insert into public.candidate_practice_sessions (
  candidate_practice_session_id,
  candidate_profile_id,
  role_profile_id,
  candidate_launch_session_id,
  status,
  setup_snapshot_json,
  question_plan_snapshot_json,
  question_wording_snapshot_json,
  question_wording_status,
  progress_state_json,
  answer_drafts_json,
  answer_submissions_json,
  answer_analysis_snapshots_json
)
values (
  '84848484-8484-4484-8484-848484848484',
  '51515151-5151-4151-8151-515151515151',
  '62626262-6262-4262-8262-626262626262',
  '73737373-7373-4373-8373-737373737373',
  'planned',
  '{"targetRole":"Material Handler","jobDescription":"Move materials safely and track inventory.","resumeText":null,"interviewStage":"first_interview","questionCount":7,"resumeCaptureMode":"none","createdAt":"2026-07-09T16:00:00.000Z"}'::jsonb,
  '{"interviewStage":"first_interview","questionCount":7,"categoryCounts":{"screening":2,"behavioral":2,"culture_fit":1,"case_scenario":1,"technical_role_specific":1},"slots":[{"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."}]}'::jsonb,
  '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"What interests you about this Material Handler role?"}]}'::jsonb,
  'worded',
  '{"status":"question_preview","currentQuestionIndex":0}'::jsonb,
  '{"slot-1":{"slotId":"slot-1","questionIndex":0,"mode":"text","text":"I would start by confirming the movement ticket.","updatedAt":"2026-07-09T20:00:00.000Z"}}'::jsonb,
  '{"slot-1":{"slotId":"slot-1","questionIndex":0,"mode":"text","text":"I would start by confirming the movement ticket.","submittedAt":"2026-07-09T20:01:00.000Z","status":"pending_analysis"}}'::jsonb,
  '{"slot-1":{"status":"answer_analysis_provider_result","provider":"candidate_v2_answer_evaluator","analyzedAt":"2026-07-09T20:02:00.000Z","answer":{"slotId":"slot-1","questionIndex":0},"coachFeedback":{"acknowledgement":"You named a practical first step.","observation":"The answer would be stronger with the result of your choice.","nextPracticeFocus":"Add what changed after you set the priority."},"evidence":[{"criterionId":"answer_specificity","applicability":"observed","score":3}]}}'::jsonb
);

do $$
declare
  v_session_count integer;
begin
  select count(*) into v_session_count
  from public.candidate_practice_sessions session
  join public.candidate_profiles profile
    on profile.candidate_profile_id = session.candidate_profile_id
  left join public.candidate_role_preparation_profiles role_profile
    on role_profile.role_profile_id = session.role_profile_id
  left join public.candidate_launch_sessions launch_session
    on launch_session.candidate_launch_session_id = session.candidate_launch_session_id
  where session.candidate_practice_session_id = '84848484-8484-4484-8484-848484848484'
    and profile.email = 'practice-session-candidate@example.invalid'
    and role_profile.target_role = 'Material Handler'
    and launch_session.job_collection_id = '9090'
    and session.setup_snapshot_json ->> 'targetRole' = 'Material Handler'
    and session.question_plan_snapshot_json ->> 'questionCount' = '7'
    and session.question_wording_snapshot_json ->> 'status' = 'questions_worded'
    and session.progress_state_json ->> 'status' = 'question_preview'
    and session.answer_drafts_json #>> '{slot-1,text}' = 'I would start by confirming the movement ticket.'
    and session.answer_submissions_json #>> '{slot-1,status}' = 'pending_analysis'
    and session.answer_analysis_snapshots_json #>> '{slot-1,status}' = 'answer_analysis_provider_result';

  if v_session_count <> 1 then
    raise exception 'expected 1 traceable candidate practice session, found %', v_session_count;
  end if;
end;
$$;

do $$
begin
  insert into public.candidate_practice_sessions (
    candidate_profile_id,
    setup_snapshot_json,
    question_plan_snapshot_json,
    question_wording_status,
    progress_state_json
  )
  values (
    '51515151-5151-4151-8151-515151515151',
    '{"targetRole":"Material Handler"}'::jsonb,
    '{"questionCount":7}'::jsonb,
    'worded',
    '[]'::jsonb
  );

  raise exception 'expected array progress state to fail';
exception
  when check_violation then null;
end;
$$;

do $$
begin
  update public.candidate_practice_sessions
  set answer_submissions_json = '[]'::jsonb
  where candidate_practice_session_id = '84848484-8484-4484-8484-848484848484';

  raise exception 'expected array answer submissions to fail';
exception
  when check_violation then null;
end;
$$;

do $$
begin
  update public.candidate_practice_sessions
  set answer_drafts_json = '[]'::jsonb
  where candidate_practice_session_id = '84848484-8484-4484-8484-848484848484';

  raise exception 'expected array answer drafts to fail';
exception
  when check_violation then null;
end;
$$;

do $$
begin
  update public.candidate_practice_sessions
  set answer_analysis_snapshots_json = '[]'::jsonb
  where candidate_practice_session_id = '84848484-8484-4484-8484-848484848484';

  raise exception 'expected array answer analysis snapshots to fail';
exception
  when check_violation then null;
end;
$$;

rollback;
