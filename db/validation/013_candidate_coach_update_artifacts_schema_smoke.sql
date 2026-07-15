-- Rollback-only smoke validation for db/migrations/011_candidate_coach_update_artifacts_schema.sql.

begin;

insert into public.candidate_profiles (
  candidate_profile_id, auth_subject, email, display_name, workspace
) values (
  'c1000000-0000-4000-8000-000000000001',
  'local_dev:coach-update-owner@example.invalid',
  'coach-update-owner@example.invalid',
  'Coach Update Owner',
  'local_dev'
);

insert into public.candidate_role_preparation_profiles (
  role_profile_id, candidate_profile_id, target_role, normalized_target_role,
  job_description_snapshot, job_description_hash, source
) values (
  'c2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'Material Handler', 'material handler', 'Move materials safely.',
  'coach-update-role-hash', 'manual'
);

insert into public.candidate_practice_sessions (
  candidate_practice_session_id, candidate_profile_id, role_profile_id, status,
  setup_snapshot_json, question_plan_snapshot_json, question_wording_snapshot_json,
  question_wording_status, progress_state_json, completion_snapshot_json
) values (
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'completed',
  '{"targetRole":"Material Handler","jobDescription":"Move materials safely.","interviewStage":"first_interview","questionCount":1,"resumeCaptureMode":"none","createdAt":"2026-07-15T12:00:00.000Z"}'::jsonb,
  '{"interviewStage":"first_interview","questionCount":1,"categoryCounts":{"screening":1,"behavioral":0,"culture_fit":0,"case_scenario":0,"technical_role_specific":0},"slots":[{"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."}]}'::jsonb,
  '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"What interests you about this role?"}]}'::jsonb,
  'worded',
  '{"status":"completed","currentQuestionIndex":0}'::jsonb,
  '{"status":"candidate_session_completed","sessionId":"c3000000-0000-4000-8000-000000000001","completedAt":"2026-07-15T12:05:00.000Z","finalProgress":{"status":"completed","currentQuestionIndex":0},"questionCount":1,"answeredCount":1,"coachedCount":1,"answeredQuestionKeys":["slot-1"],"coachedQuestionKeys":["slot-1"],"skippedOrUnansweredQuestionKeys":[],"nextRoute":"/candidate/dashboard?prep=c2000000-0000-4000-8000-000000000001"}'::jsonb
);

insert into public.candidate_coach_update_artifacts (
  candidate_coach_update_artifact_id, candidate_profile_id, role_profile_id,
  source_candidate_practice_session_id, source_completion_fingerprint,
  source_answer_attempt_ids_json, accepted_evaluation_run_ids_json,
  synthesis_input_fingerprint, provider, model_name, prompt_version,
  evaluator_version, generation_attempt, requested_at
) values (
  'c4000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000001',
  'completion-fingerprint-1', '["attempt-1"]'::jsonb, '["run-1"]'::jsonb,
  'synthesis-fingerprint-1', 'fixture', 'fixture-v1', 'prompt-v1',
  'evaluator-v1', 1, '2026-07-15T12:05:01.000Z'
);

update public.candidate_coach_update_artifacts
set lifecycle_state = 'completed',
    candidate_safe_content_json = '{"status":"candidate_coach_update_content_v1","targetRole":"Material Handler","title":"Material Handler practice update","summary":"Accepted coaching.","primaryFocus":"Add one concrete detail.","questions":[]}'::jsonb,
    validation_json = '{"disposition":"accepted"}'::jsonb,
    completed_at = '2026-07-15T12:05:02.000Z'
where candidate_coach_update_artifact_id = 'c4000000-0000-4000-8000-000000000001';

do $$
begin
  update public.candidate_coach_update_artifacts
  set candidate_safe_content_json = '{"status":"mutated"}'::jsonb
  where candidate_coach_update_artifact_id = 'c4000000-0000-4000-8000-000000000001';

  raise exception 'expected terminal Coach Update artifact mutation to fail';
exception
  when sqlstate '55000' then null;
end;
$$;

do $$
begin
  insert into public.candidate_coach_update_artifacts (
    candidate_profile_id, role_profile_id, source_candidate_practice_session_id,
    source_completion_fingerprint, source_answer_attempt_ids_json,
    accepted_evaluation_run_ids_json, synthesis_input_fingerprint,
    provider, model_name, prompt_version, evaluator_version,
    generation_attempt, requested_at
  ) values (
    'c1000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000001',
    'completion-fingerprint-2', '{}'::jsonb, '[]'::jsonb,
    'synthesis-fingerprint-2', 'fixture', 'fixture-v1', 'prompt-v1', 'evaluator-v1',
    2, now()
  );

  raise exception 'expected non-array attempt ids to fail';
exception
  when check_violation then null;
end;
$$;

rollback;
