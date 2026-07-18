-- Rollback-only smoke validation for configuration-aware Coach Update claims.

begin;

insert into public.candidate_profiles (
  candidate_profile_id, auth_subject, email, display_name, workspace
) values (
  'd1000000-0000-4000-8000-000000000001',
  'local_dev:coach-update-configuration@example.invalid',
  'coach-update-configuration@example.invalid',
  'Coach Update Configuration',
  'local_dev'
);

insert into public.candidate_role_preparation_profiles (
  role_profile_id, candidate_profile_id, target_role, normalized_target_role,
  job_description_snapshot, job_description_hash, source
) values (
  'd2000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'Material Handler', 'material handler', 'Move materials safely.',
  'coach-update-configuration-role-hash', 'manual'
);

insert into public.candidate_practice_sessions (
  candidate_practice_session_id, candidate_profile_id, role_profile_id, status,
  setup_snapshot_json, question_plan_snapshot_json, question_wording_snapshot_json,
  question_wording_status, progress_state_json, completion_snapshot_json
) values (
  'd3000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'completed',
  '{"targetRole":"Material Handler","jobDescription":"Move materials safely.","interviewStage":"first_interview","questionCount":1,"resumeCaptureMode":"none","createdAt":"2026-07-17T12:00:00.000Z"}'::jsonb,
  '{"interviewStage":"first_interview","questionCount":1,"categoryCounts":{"screening":1,"behavioral":0,"culture_fit":0,"case_scenario":0,"technical_role_specific":0},"slots":[{"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."}]}'::jsonb,
  '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"What interests you about this role?"}]}'::jsonb,
  'worded',
  '{"status":"completed","currentQuestionIndex":0}'::jsonb,
  '{"status":"candidate_session_completed","sessionId":"d3000000-0000-4000-8000-000000000001","completedAt":"2026-07-17T12:05:00.000Z","finalProgress":{"status":"completed","currentQuestionIndex":0},"questionCount":1,"answeredCount":1,"coachedCount":1,"answeredQuestionKeys":["slot-1"],"coachedQuestionKeys":["slot-1"],"skippedOrUnansweredQuestionKeys":[],"nextRoute":"/candidate/dashboard?prep=d2000000-0000-4000-8000-000000000001"}'::jsonb
);

insert into public.candidate_coach_update_artifacts (
  candidate_coach_update_artifact_id, candidate_profile_id, role_profile_id,
  source_candidate_practice_session_id, source_completion_fingerprint,
  source_answer_attempt_ids_json, accepted_evaluation_run_ids_json,
  synthesis_input_fingerprint, provider, model_name, prompt_version,
  evaluator_version, profile_id, configuration_fingerprint,
  generation_attempt, requested_at
) values (
  'd4000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'completion-fingerprint-1', '["attempt-1"]'::jsonb, '["run-1"]'::jsonb,
  'synthesis-fingerprint-1', 'smoke-provider', 'smoke-model',
  'smoke-prompt-v1', 'smoke-evaluator-v1', 'smoke-profile-v1',
  repeat('a', 64), 1, '2026-07-17T12:05:01.000Z'
);

do $$
declare
  source_row public.candidate_coach_update_artifacts%rowtype;
  new_artifact_id uuid := gen_random_uuid();
begin
  select *
  into source_row
  from public.candidate_coach_update_artifacts
  where candidate_coach_update_artifact_id = 'd4000000-0000-4000-8000-000000000001';

  if source_row.candidate_coach_update_artifact_id is null then
    raise exception 'expected at least one Coach Update artifact fixture';
  end if;

  insert into public.candidate_coach_update_artifacts (
    candidate_coach_update_artifact_id,
    candidate_profile_id,
    role_profile_id,
    source_candidate_practice_session_id,
    source_completion_fingerprint,
    source_answer_attempt_ids_json,
    accepted_evaluation_run_ids_json,
    synthesis_input_fingerprint,
    provider,
    model_name,
    prompt_version,
    evaluator_version,
    profile_id,
    configuration_fingerprint,
    generation_attempt,
    requested_at
  ) values (
    new_artifact_id,
    source_row.candidate_profile_id,
    source_row.role_profile_id,
    source_row.source_candidate_practice_session_id,
    source_row.source_completion_fingerprint,
    source_row.source_answer_attempt_ids_json,
    source_row.accepted_evaluation_run_ids_json,
    source_row.synthesis_input_fingerprint,
    'smoke-provider',
    'smoke-model',
    'smoke-prompt-v1',
    'smoke-evaluator-v1',
    'smoke-profile-v1',
    repeat('a', 64),
    source_row.generation_attempt + 1000,
    now()
  );

  update public.candidate_coach_update_artifacts
  set lifecycle_state = 'completed',
      candidate_safe_content_json = '{"status":"candidate_coach_update_content_v1","targetRole":"Smoke","title":"Smoke","summary":"Smoke","primaryFocus":"Smoke","questions":[]}'::jsonb,
      validation_json = '{"disposition":"accepted"}'::jsonb,
      completed_at = now()
  where candidate_coach_update_artifact_id = new_artifact_id;

  begin
    update public.candidate_coach_update_artifacts
    set configuration_fingerprint = repeat('b', 64)
    where candidate_coach_update_artifact_id = new_artifact_id;
    raise exception 'expected terminal configuration mutation to fail';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    insert into public.candidate_coach_update_artifacts (
      candidate_profile_id, role_profile_id, source_candidate_practice_session_id,
      source_completion_fingerprint, source_answer_attempt_ids_json,
      accepted_evaluation_run_ids_json, synthesis_input_fingerprint,
      provider, model_name, prompt_version, evaluator_version,
      generation_attempt, requested_at
    ) values (
      source_row.candidate_profile_id, source_row.role_profile_id,
      source_row.source_candidate_practice_session_id, source_row.source_completion_fingerprint,
      source_row.source_answer_attempt_ids_json, source_row.accepted_evaluation_run_ids_json,
      source_row.synthesis_input_fingerprint, 'smoke-provider', 'smoke-model',
      'smoke-prompt-v1', 'smoke-evaluator-v1', source_row.generation_attempt + 1001, now()
    );
    raise exception 'expected missing configuration identity to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.candidate_coach_update_artifacts (
      candidate_profile_id, role_profile_id, source_candidate_practice_session_id,
      source_completion_fingerprint, source_answer_attempt_ids_json,
      accepted_evaluation_run_ids_json, synthesis_input_fingerprint,
      provider, model_name, prompt_version, evaluator_version,
      profile_id, configuration_fingerprint, generation_attempt, requested_at
    ) values (
      source_row.candidate_profile_id, source_row.role_profile_id,
      source_row.source_candidate_practice_session_id, source_row.source_completion_fingerprint,
      source_row.source_answer_attempt_ids_json, source_row.accepted_evaluation_run_ids_json,
      source_row.synthesis_input_fingerprint, 'smoke-provider', 'smoke-model',
      'smoke-prompt-v1', 'smoke-evaluator-v1', 'smoke-profile-v1', 'not-a-fingerprint',
      source_row.generation_attempt + 1002, now()
    );
    raise exception 'expected invalid configuration fingerprint to fail';
  exception
    when check_violation then null;
  end;
end;
$$;

rollback;
