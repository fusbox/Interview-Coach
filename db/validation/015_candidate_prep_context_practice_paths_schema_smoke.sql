-- Rollback-only smoke validation for intentional same-role/JD practice paths.

begin;

insert into public.candidate_profiles (
  candidate_profile_id, auth_subject, email, display_name, workspace
) values (
  'e1000000-0000-4000-8000-000000000001',
  'local_dev:practice-path-owner@example.invalid',
  'practice-path-owner@example.invalid',
  'Practice Path Owner',
  'local_dev'
);

insert into public.candidate_role_preparation_profiles (
  role_profile_id, candidate_profile_id, target_role, normalized_target_role,
  job_description_snapshot, job_description_hash, practice_path_number, source
) values
  (
    'e2000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'Quality Inspector', 'quality inspector', 'Inspect finished goods.',
    'same-role-jd-hash', 1, 'manual'
  ),
  (
    'e2000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000001',
    'Quality Inspector', 'quality inspector', 'Inspect finished goods.',
    'same-role-jd-hash', 2, 'manual'
  );

insert into public.candidate_practice_sessions (
  candidate_practice_session_id, candidate_profile_id, role_profile_id, status,
  setup_snapshot_json, question_plan_snapshot_json, question_wording_status,
  progress_state_json, answer_submissions_json, created_at, updated_at
) values
  (
    'e3000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001',
    'completed',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":2,"resumeCaptureMode":"none","createdAt":"2026-07-10T12:00:00.000Z"}'::jsonb,
    '{"interviewStage":"screening","questionCount":2,"categoryCounts":{},"slots":[]}'::jsonb,
    'not_requested',
    '{"status":"completed","currentQuestionIndex":1}'::jsonb,
    '{"slot-1":{"text":"First"},"slot-2":{"text":"Second"}}'::jsonb,
    '2026-07-10T12:00:00.000Z',
    '2026-07-10T12:20:00.000Z'
  ),
  (
    'e3000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000002',
    'in_progress',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"first_interview","questionCount":3,"resumeCaptureMode":"none","createdAt":"2026-07-14T12:00:00.000Z"}'::jsonb,
    '{"interviewStage":"first_interview","questionCount":3,"categoryCounts":{},"slots":[]}'::jsonb,
    'not_requested',
    '{"status":"live_question","currentQuestionIndex":1}'::jsonb,
    '{"slot-1":{"text":"First"}}'::jsonb,
    '2026-07-14T12:00:00.000Z',
    '2026-07-14T12:10:00.000Z'
  );

do $$
declare
  v_path_count integer;
begin
  select count(*) into v_path_count
  from public.candidate_role_preparation_profiles
  where candidate_profile_id = 'e1000000-0000-4000-8000-000000000001'
    and normalized_target_role = 'quality inspector'
    and job_description_hash = 'same-role-jd-hash';

  if v_path_count <> 2 then
    raise exception 'expected 2 intentional practice paths, found %', v_path_count;
  end if;
end;
$$;

do $$
declare
  v_completed_sessions integer;
  v_completed_questions integer;
  v_active_completed integer;
  v_active_total integer;
begin
  select
    count(*) filter (where status = 'completed')::integer,
    coalesce(sum(
      case
        when status = 'completed' then (
          select count(*) from jsonb_object_keys(answer_submissions_json)
        )
        else 0
      end
    ), 0)::integer
  into v_completed_sessions, v_completed_questions
  from public.candidate_practice_sessions
  where candidate_profile_id = 'e1000000-0000-4000-8000-000000000001'
    and role_profile_id = 'e2000000-0000-4000-8000-000000000001';

  select
    (select count(*)::integer from jsonb_object_keys(answer_submissions_json)),
    (setup_snapshot_json ->> 'questionCount')::integer
  into v_active_completed, v_active_total
  from public.candidate_practice_sessions
  where candidate_profile_id = 'e1000000-0000-4000-8000-000000000001'
    and role_profile_id = 'e2000000-0000-4000-8000-000000000002'
    and status in ('planned', 'in_progress')
  order by updated_at desc
  limit 1;

  if v_completed_sessions <> 1 or v_completed_questions <> 2 then
    raise exception 'unexpected completed practice summary: sessions %, questions %',
      v_completed_sessions, v_completed_questions;
  end if;

  if v_active_completed <> 1 or v_active_total <> 3 then
    raise exception 'unexpected active practice summary: % of %', v_active_completed, v_active_total;
  end if;
end;
$$;

do $$
begin
  insert into public.candidate_role_preparation_profiles (
    candidate_profile_id, target_role, normalized_target_role,
    job_description_snapshot, job_description_hash, practice_path_number, source
  ) values (
    'e1000000-0000-4000-8000-000000000001',
    'Quality Inspector', 'quality inspector', 'Inspect finished goods.',
    'same-role-jd-hash', 2, 'manual'
  );

  raise exception 'expected duplicate practice-path ordinal to fail';
exception
  when unique_violation then null;
end;
$$;

do $$
begin
  insert into public.candidate_role_preparation_profiles (
    candidate_profile_id, target_role, normalized_target_role,
    job_description_snapshot, job_description_hash, practice_path_number, source
  ) values (
    'e1000000-0000-4000-8000-000000000001',
    'Quality Inspector', 'quality inspector', 'Inspect finished goods.',
    'another-hash', 0, 'manual'
  );

  raise exception 'expected nonpositive practice-path ordinal to fail';
exception
  when check_violation then null;
end;
$$;

rollback;
