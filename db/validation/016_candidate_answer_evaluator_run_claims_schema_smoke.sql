-- Rollback-only smoke validation for db/migrations/015_candidate_answer_evaluator_run_claims.sql.

begin;

insert into public.candidate_profiles (
  candidate_profile_id, auth_subject, email, display_name, workspace
)
values (
  'b1000000-0000-4000-8000-000000000001',
  'local_dev:evaluator-claims@example.invalid',
  'evaluator-claims@example.invalid',
  'Evaluator Claims',
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
  'b2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'in_progress',
  '{"targetRole":"Material Handler","jobDescription":"Move materials safely.","interviewStage":"first_interview","questionCount":1,"resumeCaptureMode":"none","createdAt":"2026-07-16T18:00:00.000Z"}'::jsonb,
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
  'b3000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'slot-1', 0, 1, 'initial_submit', 'text',
  'I checked the request, moved the materials safely, and documented completion.',
  '2026-07-16T18:01:00.000Z', 'submit-1', 'answer-fingerprint-1'
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
  'b4000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'candidate_coaching', 'fixture', 'fixture-v1', 'prompt-v1', 'evaluator-v1',
  '{"schemaVersion":1,"configurationStatus":"resolved","profileId":"fixture-v1","pipelineProvider":"fixture","serviceMode":"validation_fixture","adapterVersion":"validation_fixture_v1","promptBundleVersion":"prompt-v1","evaluatorVersion":"evaluator-v1","stages":[{"stage":"evidence_extraction","provider":"fixture","model":"fixture-v1","promptVersion":"prompt-v1","responseSchemaVersion":"extract-v1","generation":{"mode":"deterministic","structuredOutput":true}},{"stage":"feedback_composition","provider":"fixture","model":"fixture-v1","promptVersion":"prompt-v1","responseSchemaVersion":"compose-v1","generation":{"mode":"deterministic","structuredOutput":true}}]}'::jsonb,
  repeat('a', 64),
  'input-fingerprint-1', 'analysis-1', 1,
  '2026-07-16T18:02:00.000Z', '2026-07-16T18:03:00.000Z'
);

update public.candidate_answer_evaluation_runs
set lifecycle_state = 'failed',
    validation_json = '{"disposition":"failed","reason":"stale_evaluation_claim"}'::jsonb,
    error_code = 'STALE_EVALUATION_CLAIM',
    completed_at = '2026-07-16T18:03:01.000Z'
where candidate_answer_evaluation_run_id = 'b4000000-0000-4000-8000-000000000001';

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
  'b4000000-0000-4000-8000-000000000002',
  'b3000000-0000-4000-8000-000000000001',
  'candidate_coaching', 'fixture', 'fixture-v1', 'prompt-v1', 'evaluator-v1',
  '{"schemaVersion":1,"configurationStatus":"resolved","profileId":"fixture-v1","pipelineProvider":"fixture","serviceMode":"validation_fixture","adapterVersion":"validation_fixture_v1","promptBundleVersion":"prompt-v1","evaluatorVersion":"evaluator-v1","stages":[{"stage":"evidence_extraction","provider":"fixture","model":"fixture-v1","promptVersion":"prompt-v1","responseSchemaVersion":"extract-v1","generation":{"mode":"deterministic","structuredOutput":true}},{"stage":"feedback_composition","provider":"fixture","model":"fixture-v1","promptVersion":"prompt-v1","responseSchemaVersion":"compose-v1","generation":{"mode":"deterministic","structuredOutput":true}}]}'::jsonb,
  repeat('a', 64),
  'input-fingerprint-1', 'analysis-1', 2,
  '2026-07-16T18:03:01.000Z', '2026-07-16T18:04:01.000Z'
);

do $$
declare
  v_updated integer;
begin
  update public.candidate_answer_evaluation_runs
  set lifecycle_state = 'completed',
      result_json = '{"status":"late"}'::jsonb,
      validation_json = '{"disposition":"accepted"}'::jsonb,
      completed_at = '2026-07-16T18:03:02.000Z'
  where candidate_answer_evaluation_run_id = 'b4000000-0000-4000-8000-000000000001'
    and lifecycle_state = 'requested';

  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'expected expired generation to reject late completion';
  end if;
end;
$$;

update public.candidate_answer_evaluation_runs
set lifecycle_state = 'completed',
    result_json = '{"status":"accepted"}'::jsonb,
    validation_json = '{"disposition":"accepted"}'::jsonb,
    completed_at = '2026-07-16T18:03:03.000Z'
where candidate_answer_evaluation_run_id = 'b4000000-0000-4000-8000-000000000002';

do $$
declare
  v_answer_attempts integer;
  v_evaluator_runs integer;
  v_failed_runs integer;
  v_completed_runs integer;
  v_latest_generation integer;
begin
  select count(*)
  into v_answer_attempts
  from public.candidate_answer_attempts
  where candidate_practice_session_id = 'b2000000-0000-4000-8000-000000000001'
    and question_slot_id = 'slot-1';

  select
    count(*),
    count(*) filter (where lifecycle_state = 'failed'),
    count(*) filter (where lifecycle_state = 'completed'),
    max(generation_attempt)
  into v_evaluator_runs, v_failed_runs, v_completed_runs, v_latest_generation
  from public.candidate_answer_evaluation_runs
  where candidate_answer_attempt_id = 'b3000000-0000-4000-8000-000000000001'
    and purpose = 'candidate_coaching';

  if v_answer_attempts <> 1 then
    raise exception 'expected analysis recovery to retain one immutable answer attempt, found %', v_answer_attempts;
  end if;
  if v_evaluator_runs <> 2 or v_failed_runs <> 1 or v_completed_runs <> 1 then
    raise exception 'expected one failed and one completed evaluator generation, found total %, failed %, completed %',
      v_evaluator_runs, v_failed_runs, v_completed_runs;
  end if;
  if v_latest_generation <> 2 then
    raise exception 'expected the recovered evaluator run to be generation 2, found %', v_latest_generation;
  end if;
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
    lifecycle_state,
    result_json,
    validation_json,
    requested_at,
    claim_expires_at,
    completed_at
  ) values (
    'b3000000-0000-4000-8000-000000000001',
    'candidate_coaching', 'fixture', 'fixture-v2', 'prompt-v2', 'evaluator-v2',
    '{"schemaVersion":1,"configurationStatus":"resolved","profileId":"fixture-v2","pipelineProvider":"fixture","serviceMode":"validation_fixture","adapterVersion":"validation_fixture_v2","promptBundleVersion":"prompt-v2","evaluatorVersion":"evaluator-v2","stages":[{"stage":"evidence_extraction","provider":"fixture","model":"fixture-v2","promptVersion":"prompt-v2","responseSchemaVersion":"extract-v2","generation":{"mode":"deterministic","structuredOutput":true}},{"stage":"feedback_composition","provider":"fixture","model":"fixture-v2","promptVersion":"prompt-v2","responseSchemaVersion":"compose-v2","generation":{"mode":"deterministic","structuredOutput":true}}]}'::jsonb,
    repeat('b', 64),
    'input-fingerprint-1', 'analysis-2', 3, 'completed',
    '{"status":"duplicate"}'::jsonb,
    '{"disposition":"accepted"}'::jsonb,
    '2026-07-16T18:04:00.000Z', '2026-07-16T18:05:00.000Z', '2026-07-16T18:04:01.000Z'
  );

  raise exception 'expected a second accepted candidate-coaching result to fail';
exception
  when unique_violation then null;
end;
$$;

do $$
begin
  update public.candidate_answer_evaluation_runs
  set generation_attempt = 9
  where candidate_answer_evaluation_run_id = 'b4000000-0000-4000-8000-000000000002';

  raise exception 'expected evaluator generation mutation to fail';
exception
  when sqlstate '55000' then null;
end;
$$;

rollback;
