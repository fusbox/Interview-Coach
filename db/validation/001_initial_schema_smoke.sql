-- Rollback-only smoke validation for db/migrations/001_initial_schema.sql.
-- Run against a disposable database after applying the initial schema.

begin;

insert into public.app_users (
  user_id,
  email,
  display_name,
  email_verified_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  'schema-smoke@example.invalid',
  'Schema Smoke',
  now()
);

insert into public.app_user_roles (
  user_id,
  role
)
values
  ('11111111-1111-4111-8111-111111111111', 'recruiter'),
  ('11111111-1111-4111-8111-111111111111', 'qa');

select public.create_invite_batch(
  jsonb_build_array(
    jsonb_build_object(
      'session_id', '22222222-2222-4222-8222-222222222222',
      'created_by', '11111111-1111-4111-8111-111111111111',
      'role', 'Security Engineer',
      'job_description', 'Own secure application delivery.',
      'candidate', jsonb_build_object(
        'firstName', 'Schema',
        'lastName', 'Smoke',
        'email', 'candidate@example.invalid',
        'reqId', 'REQ-SMOKE'
      ),
      'questions', jsonb_build_array(
        jsonb_build_object(
          'index', 0,
          'text', 'Tell me about a security review you led.',
          'category', 'Behavioral'
        ),
        jsonb_build_object(
          'index', 1,
          'text', 'How do you prioritize vulnerabilities?',
          'category', 'Technical'
        )
      ),
      'token_hash', 'schema-smoke-token-hash',
      'encrypted_token', 'schema-smoke-encrypted-token'
    )
  )
);

insert into public.invite_batches (
  batch_id,
  created_by,
  role,
  job_description,
  questions_json,
  status,
  requested_count,
  succeeded_count,
  failed_count
)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'Security Engineer',
  'Own secure application delivery.',
  jsonb_build_array('Tell me about a security review you led.'),
  'completed',
  1,
  1,
  0
);

insert into public.invite_batch_candidates (
  batch_id,
  candidate_index,
  first_name,
  last_name,
  email,
  req_id,
  status,
  retryable,
  session_id
)
values (
  '33333333-3333-4333-8333-333333333333',
  0,
  'Schema',
  'Smoke',
  'candidate@example.invalid',
  'REQ-SMOKE',
  'created',
  false,
  '22222222-2222-4222-8222-222222222222'
);

insert into public.answers (
  session_id,
  question_id,
  modality,
  final_text,
  submitted_at
)
select
  '22222222-2222-4222-8222-222222222222',
  question_id,
  'text',
  'I led a threat-modeling review and prioritized fixes by exploitability and impact.',
  now()
from public.questions
where session_id = '22222222-2222-4222-8222-222222222222'
  and question_index = 0;

insert into public.eval_results (
  session_id,
  question_id,
  status,
  feedback_json,
  model_metadata
)
select
  '22222222-2222-4222-8222-222222222222',
  question_id,
  'COMPLETE',
  jsonb_build_object('overall', 'clear and specific'),
  jsonb_build_object('provider', 'schema-smoke')
from public.questions
where session_id = '22222222-2222-4222-8222-222222222222'
  and question_index = 0;

insert into public.ai_generations (
  app_name,
  surface,
  status,
  prompt_version,
  model_provider,
  model_name,
  input_snapshot,
  raw_output,
  parsed_output,
  latency_ms,
  redaction_status,
  created_by,
  session_id,
  invite_batch_id
)
values (
  'interview-coach-recruiter',
  'answer_feedback',
  'success',
  'schema-smoke',
  'Google',
  'gemini-2.5-flash',
  jsonb_build_object('surface', 'answer_feedback'),
  jsonb_build_object('text', 'raw smoke output'),
  jsonb_build_object('overall', 'clear and specific'),
  123,
  'redacted',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

select public.increment_session_engagement('22222222-2222-4222-8222-222222222222', 30) as engagement_seconds;

select *
from public.consume_rate_limit_bucket('schema-smoke', 2, 60000);

select public.record_metric_counter_rollup(
  date_trunc('hour', now()),
  'session_start_total',
  jsonb_build_object('outcome', 'success'),
  'outcome=success',
  1
);

select public.record_metric_timing_rollup(
  date_trunc('hour', now()),
  'ai_request_duration_ms',
  jsonb_build_object('operation', 'answer_feedback'),
  'operation=answer_feedback',
  250
);

do $$
declare
  v_session_count integer;
  v_question_count integer;
  v_token_count integer;
  v_answer_count integer;
  v_eval_count integer;
  v_ai_generation_count integer;
begin
  select count(*) into v_session_count from public.sessions where session_id = '22222222-2222-4222-8222-222222222222';
  select count(*) into v_question_count from public.questions where session_id = '22222222-2222-4222-8222-222222222222';
  select count(*) into v_token_count from public.candidate_tokens where session_id = '22222222-2222-4222-8222-222222222222';
  select count(*) into v_answer_count from public.answers where session_id = '22222222-2222-4222-8222-222222222222';
  select count(*) into v_eval_count from public.eval_results where session_id = '22222222-2222-4222-8222-222222222222';
  select count(*) into v_ai_generation_count from public.ai_generations where prompt_version = 'schema-smoke';

  if v_session_count <> 1 then
    raise exception 'expected 1 smoke session, found %', v_session_count;
  end if;

  if v_question_count <> 2 then
    raise exception 'expected 2 smoke questions, found %', v_question_count;
  end if;

  if v_token_count <> 1 then
    raise exception 'expected 1 smoke candidate token, found %', v_token_count;
  end if;

  if v_answer_count <> 1 then
    raise exception 'expected 1 smoke answer, found %', v_answer_count;
  end if;

  if v_eval_count <> 1 then
    raise exception 'expected 1 smoke eval result, found %', v_eval_count;
  end if;

  if v_ai_generation_count <> 1 then
    raise exception 'expected 1 smoke AI generation, found %', v_ai_generation_count;
  end if;
end;
$$;

select *
from public.get_slo_session_start(now() - interval '1 hour');

select *
from public.get_slo_ai_latency(now() - interval '1 hour');

rollback;
