-- Rollback-only smoke validation for db/migrations/016_candidate_answer_evaluator_configuration_manifest.sql.

begin;

insert into public.candidate_profiles (
  candidate_profile_id, auth_subject, email, display_name, workspace
)
values (
  'c1000000-0000-4000-8000-000000000001',
  'local_dev:evaluator-configuration@example.invalid',
  'evaluator-configuration@example.invalid',
  'Evaluator Configuration',
  'local_dev'
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
  'c2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'in_progress',
  '{"targetRole":"Material Handler","jobDescription":"Move materials safely.","interviewStage":"first_interview","questionCount":1,"resumeCaptureMode":"none","createdAt":"2026-07-16T20:00:00.000Z"}'::jsonb,
  '{"interviewStage":"first_interview","questionCount":1,"categoryCounts":{"screening":1,"behavioral":0,"culture_fit":0,"case_scenario":0,"technical_role_specific":0},"slots":[{"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."}]}'::jsonb,
  '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"What interests you about this role?"}]}'::jsonb,
  'worded',
  '{"status":"active","currentQuestionIndex":0}'::jsonb
);

insert into public.candidate_answer_attempts (
  candidate_answer_attempt_id,
  candidate_practice_session_id,
  candidate_profile_id,
  question_slot_id,
  question_index,
  attempt_number,
  trigger,
  mode,
  answer_text,
  submitted_at,
  idempotency_key,
  payload_fingerprint
)
values (
  'c3000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'slot-1', 0, 1, 'initial_submit', 'text',
  'I checked the request, moved the materials safely, and documented completion.',
  '2026-07-16T20:01:00.000Z', 'submit-1', 'answer-fingerprint-1'
);

insert into public.candidate_answer_evaluation_runs (
  candidate_answer_evaluation_run_id,
  candidate_answer_attempt_id,
  purpose,
  provider,
  model_name,
  prompt_version,
  evaluator_version,
  configuration_manifest_json,
  configuration_fingerprint,
  input_fingerprint,
  idempotency_key,
  generation_attempt,
  requested_at,
  claim_expires_at
)
values (
  'c4000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000001',
  'candidate_coaching',
  'candidate_v2_evidence_first_pipeline',
  'deterministic_local_fixture_v1',
  'candidate_evidence_first_prompts_v1',
  'candidate_evidence_first_v1',
  '{
    "schemaVersion": 1,
    "configurationStatus": "resolved",
    "profileId": "deterministic_local_fixture_v1",
    "pipelineProvider": "candidate_v2_evidence_first_pipeline",
    "serviceMode": "local_fixture",
    "adapterVersion": "candidate_answer_analysis_fixture_v1",
    "promptBundleVersion": "candidate_evidence_first_prompts_v1",
    "evaluatorVersion": "candidate_evidence_first_v1",
    "stages": [
      {
        "stage": "evidence_extraction",
        "provider": "deterministic_local_fixture",
        "model": "fixture_evidence_extractor_v1",
        "promptVersion": "fixture_evidence_extractor_prompt_v1",
        "responseSchemaVersion": "evidence_extraction_output_v1",
        "generation": {"mode": "deterministic", "structuredOutput": true}
      },
      {
        "stage": "feedback_composition",
        "provider": "deterministic_local_fixture",
        "model": "fixture_feedback_composer_v1",
        "promptVersion": "fixture_feedback_composer_prompt_v1",
        "responseSchemaVersion": "feedback_composition_output_v1",
        "generation": {"mode": "deterministic", "structuredOutput": true}
      }
    ]
  }'::jsonb,
  repeat('a', 64),
  'input-fingerprint-1',
  'analysis-1',
  1,
  '2026-07-16T20:02:00.000Z',
  '2026-07-16T20:03:00.000Z'
);

do $$
declare
  v_status text;
  v_profile text;
  v_fingerprint text;
begin
  select
    configuration_manifest_json ->> 'configurationStatus',
    configuration_manifest_json ->> 'profileId',
    configuration_fingerprint
  into v_status, v_profile, v_fingerprint
  from public.candidate_answer_evaluation_runs
  where candidate_answer_evaluation_run_id = 'c4000000-0000-4000-8000-000000000001';

  if v_status <> 'resolved' or v_profile <> 'deterministic_local_fixture_v1' then
    raise exception 'expected resolved evaluator configuration identity, found status %, profile %', v_status, v_profile;
  end if;
  if length(v_fingerprint) <> 64 then
    raise exception 'expected a sha-256 configuration fingerprint';
  end if;
end;
$$;

do $$
begin
  update public.candidate_answer_evaluation_runs
  set configuration_fingerprint = repeat('b', 64)
  where candidate_answer_evaluation_run_id = 'c4000000-0000-4000-8000-000000000001';

  raise exception 'expected evaluator configuration mutation to fail';
exception
  when sqlstate '55000' then null;
end;
$$;

do $$
begin
  insert into public.candidate_answer_evaluation_runs (
    candidate_answer_attempt_id,
    purpose,
    provider,
    model_name,
    prompt_version,
    evaluator_version,
    configuration_manifest_json,
    configuration_fingerprint,
    input_fingerprint,
    idempotency_key,
    generation_attempt,
    requested_at,
    claim_expires_at
  ) values (
    'c3000000-0000-4000-8000-000000000001',
    'qa_comparison',
    'candidate_v2_evidence_first_pipeline',
    'deterministic_local_fixture_v1',
    'candidate_evidence_first_prompts_v1',
    'candidate_evidence_first_v1',
    '{
      "schemaVersion": 1,
      "configurationStatus": "pre_manifest_v2",
      "profileId": "deterministic_local_fixture_v1",
      "pipelineProvider": "candidate_v2_evidence_first_pipeline",
      "serviceMode": "unknown",
      "adapterVersion": "unknown",
      "promptBundleVersion": "candidate_evidence_first_prompts_v1",
      "evaluatorVersion": "candidate_evidence_first_v1",
      "stages": []
    }'::jsonb,
    'not-a-sha-256-fingerprint',
    'input-fingerprint-1',
    'qa-analysis-1',
    1,
    '2026-07-16T20:02:00.000Z',
    '2026-07-16T20:03:00.000Z'
  );

  raise exception 'expected an invalid configuration fingerprint to fail';
exception
  when check_violation then null;
end;
$$;

rollback;
