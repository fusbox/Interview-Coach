-- Rollback-only smoke validation for db/migrations/009_candidate_answer_attempts_schema.sql.

begin;

insert into public.candidate_profiles (
  candidate_profile_id, auth_subject, email, display_name, workspace
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'local_dev:answer-history-owner@example.invalid',
    'answer-history-owner@example.invalid',
    'Answer History Owner',
    'local_dev'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'local_dev:answer-history-other@example.invalid',
    'answer-history-other@example.invalid',
    'Answer History Other',
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
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'in_progress',
  '{"targetRole":"Material Handler","jobDescription":"Move materials safely.","interviewStage":"first_interview","questionCount":1,"resumeCaptureMode":"none","createdAt":"2026-07-14T18:00:00.000Z"}'::jsonb,
  '{"interviewStage":"first_interview","questionCount":1,"categoryCounts":{"screening":1,"behavioral":0,"culture_fit":0,"case_scenario":0,"technical_role_specific":0},"slots":[{"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."}]}'::jsonb,
  '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"What interests you about this role?"}]}'::jsonb,
  'worded',
  '{"status":"active","currentQuestionIndex":0}'::jsonb
);

insert into public.candidate_answer_attempts (
  candidate_answer_attempt_id, candidate_practice_session_id, candidate_profile_id,
  question_slot_id, question_index, attempt_number, trigger, mode, answer_text,
  submitted_at, idempotency_key, payload_fingerprint
)
values (
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'slot-1', 0, 1, 'initial_submit', 'text',
  'I clarified the task and completed it safely.',
  '2026-07-14T18:01:00.000Z', 'submit-key-1', 'fingerprint-1'
);

insert into public.candidate_answer_attempts (
  candidate_answer_attempt_id, candidate_practice_session_id, candidate_profile_id,
  question_slot_id, question_index, attempt_number, trigger,
  supersedes_candidate_answer_attempt_id, mode, answer_text,
  submitted_at, idempotency_key, payload_fingerprint
)
values (
  'a3000000-0000-4000-8000-000000000002',
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'slot-1', 0, 2, 'feedback_retry',
  'a3000000-0000-4000-8000-000000000001', 'text',
  'I clarified the task, acted safely, and documented the result.',
  '2026-07-14T18:03:00.000Z', 'submit-key-2', 'fingerprint-2'
);

insert into public.candidate_answer_evaluation_runs (
  candidate_answer_evaluation_run_id, candidate_answer_attempt_id, purpose,
  provider, model_name, prompt_version, evaluator_version,
  input_fingerprint, idempotency_key, requested_at
)
values
  (
    'a4000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000002',
    'candidate_coaching', 'fixture', 'fixture-v1', 'prompt-v1', 'evaluator-v1',
    'fixed-input-2', 'analysis-key-1', '2026-07-14T18:04:00.000Z'
  ),
  (
    'a4000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000002',
    'qa_comparison', 'fixture', 'fixture-v2', 'prompt-v2', 'evaluator-v2',
    'fixed-input-2', 'analysis-key-2', '2026-07-14T18:05:00.000Z'
  );

update public.candidate_answer_evaluation_runs
set lifecycle_state = 'completed',
    result_json = '{"status":"answer_analysis_provider_result"}'::jsonb,
    validation_json = '{"mapsToInput":true}'::jsonb,
    completed_at = '2026-07-14T18:04:02.000Z'
where candidate_answer_evaluation_run_id = 'a4000000-0000-4000-8000-000000000001';

do $$
declare
  v_attempt_count integer;
  v_run_count integer;
begin
  select count(*) into v_attempt_count
  from public.candidate_answer_attempts
  where candidate_practice_session_id = 'a2000000-0000-4000-8000-000000000001';

  select count(*) into v_run_count
  from public.candidate_answer_evaluation_runs
  where candidate_answer_attempt_id = 'a3000000-0000-4000-8000-000000000002';

  if v_attempt_count <> 2 or v_run_count <> 2 then
    raise exception 'expected 2 immutable attempts and 2 runs on attempt 2; got attempts %, runs %', v_attempt_count, v_run_count;
  end if;
end;
$$;

do $$
begin
  update public.candidate_answer_attempts
  set answer_text = 'mutated'
  where candidate_answer_attempt_id = 'a3000000-0000-4000-8000-000000000001';

  raise exception 'expected immutable answer-attempt update to fail';
exception
  when sqlstate '55000' then null;
end;
$$;

do $$
begin
  insert into public.candidate_answer_attempts (
    candidate_practice_session_id, candidate_profile_id, question_slot_id, question_index,
    attempt_number, trigger, supersedes_candidate_answer_attempt_id, mode, answer_text,
    submitted_at, idempotency_key, payload_fingerprint
  ) values (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'slot-other', 0, 3, 'feedback_retry',
    'a3000000-0000-4000-8000-000000000002',
    'text', 'Wrong occurrence.', now(), 'bad-lineage', 'bad-lineage'
  );

  raise exception 'expected cross-occurrence retry lineage to fail';
exception
  when check_violation then null;
end;
$$;

do $$
begin
  insert into public.candidate_answer_attempts (
    candidate_practice_session_id, candidate_profile_id, question_slot_id, question_index,
    attempt_number, trigger, mode, answer_text, submitted_at, idempotency_key, payload_fingerprint
  ) values (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    'slot-2', 1, 1, 'initial_submit', 'text', 'Wrong owner.', now(), 'bad-owner', 'bad-owner'
  );

  raise exception 'expected cross-candidate session ownership to fail';
exception
  when foreign_key_violation then null;
end;
$$;

do $$
begin
  insert into public.candidate_answer_evaluation_runs (
    candidate_answer_attempt_id, purpose, provider, model_name, prompt_version,
    evaluator_version, input_fingerprint, idempotency_key, lifecycle_state, requested_at, completed_at
  ) values (
    'a3000000-0000-4000-8000-000000000002',
    'candidate_coaching', 'fixture', 'fixture-v1', 'prompt-v1',
    'evaluator-v1', 'fixed-input-2', 'bad-completion', 'completed', now(), now()
  );

  raise exception 'expected completed evaluator run without a result to fail';
exception
  when check_violation then null;
end;
$$;

do $$
begin
  update public.candidate_answer_evaluation_runs
  set result_json = '{"status":"mutated"}'::jsonb
  where candidate_answer_evaluation_run_id = 'a4000000-0000-4000-8000-000000000001';

  raise exception 'expected terminal evaluator-run mutation to fail';
exception
  when sqlstate '55000' then null;
end;
$$;

delete from public.candidate_practice_sessions
where candidate_practice_session_id = 'a2000000-0000-4000-8000-000000000001';

do $$
declare
  v_attempt_count integer;
  v_run_count integer;
begin
  select count(*) into v_attempt_count
  from public.candidate_answer_attempts
  where candidate_practice_session_id = 'a2000000-0000-4000-8000-000000000001';

  select count(*) into v_run_count
  from public.candidate_answer_evaluation_runs
  where candidate_answer_attempt_id in (
    'a3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000002'
  );

  if v_attempt_count <> 0 or v_run_count <> 0 then
    raise exception 'expected session deletion to cascade through answer history; got attempts %, runs %', v_attempt_count, v_run_count;
  end if;
end;
$$;

rollback;
