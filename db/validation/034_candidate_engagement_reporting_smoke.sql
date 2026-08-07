begin;

do $$
begin
  if to_regclass('public.candidate_engagement_slices') is null then
    raise exception 'candidate engagement slice ledger is missing';
  end if;

  if not has_table_privilege('interview_coach_runtime', 'public.candidate_engagement_slices', 'select')
     or not has_table_privilege('interview_coach_runtime', 'public.candidate_engagement_slices', 'insert') then
    raise exception 'runtime role cannot append and read candidate engagement slices';
  end if;

  if has_table_privilege('interview_coach_runtime', 'public.candidate_engagement_slices', 'update')
     or has_table_privilege('interview_coach_runtime', 'public.candidate_engagement_slices', 'delete') then
    raise exception 'runtime role can mutate the append-only candidate engagement ledger';
  end if;
end;
$$;

insert into public.candidate_profiles (
  candidate_profile_id,
  auth_subject,
  email,
  display_name,
  workspace
)
values (
  'f1000000-0000-4000-8000-000000000001',
  'local_dev:engagement-smoke@example.invalid',
  'engagement-smoke@example.invalid',
  'Engagement Smoke Candidate',
  'local_dev'
);

insert into public.candidate_practice_sessions (
  candidate_practice_session_id,
  candidate_profile_id,
  setup_snapshot_json,
  question_plan_snapshot_json
)
values (
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  '{"targetRole":"Quality Inspector"}'::jsonb,
  '{"questionCount":1,"slots":[]}'::jsonb
);

insert into public.candidate_engagement_slices (
  candidate_engagement_slice_id,
  candidate_practice_session_id,
  candidate_profile_id,
  tracker_instance_id,
  sequence_number,
  active_milliseconds,
  client_started_at,
  client_ended_at,
  opened_by,
  last_activity,
  flush_reason
)
values (
  'f3000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001',
  1,
  9500,
  '2026-08-05T15:00:00.000Z',
  '2026-08-05T15:00:09.500Z',
  'interaction',
  'answer_input',
  'periodic'
);

do $$
declare
  v_active_milliseconds bigint;
  v_slice_count integer;
begin
  select coalesce(sum(active_milliseconds), 0), count(*)
  into v_active_milliseconds, v_slice_count
  from public.candidate_engagement_slices
  where candidate_practice_session_id = 'f2000000-0000-4000-8000-000000000001'
    and candidate_profile_id = 'f1000000-0000-4000-8000-000000000001';

  if v_active_milliseconds <> 9500 or v_slice_count <> 1 then
    raise exception 'candidate engagement aggregation did not preserve the accepted slice';
  end if;
end;
$$;

rollback;
