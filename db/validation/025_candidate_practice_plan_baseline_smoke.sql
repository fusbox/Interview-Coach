-- Candidate practice-plan baseline schema smoke.

begin;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_role_preparation_profiles'
      and column_name = 'rigor_baseline_snapshot_json'
      and data_type = 'jsonb'
  ) then
    raise exception 'rigor baseline snapshot column is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_role_preparation_profiles'
      and column_name = 'rigor_baseline_question_wording_snapshot_json'
      and data_type = 'jsonb'
  ) then
    raise exception 'rigor baseline wording snapshot column is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_candidate_role_profiles_rigor_baseline_immutable'
      and not tgisinternal
  ) then
    raise exception 'rigor baseline immutability trigger is missing';
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
  '25252525-2525-4525-8525-252525252525',
  'local_dev:baseline-smoke@example.invalid',
  'baseline-smoke@example.invalid',
  'Baseline Smoke',
  'local_dev'
);

insert into public.candidate_role_preparation_profiles (
  role_profile_id,
  candidate_profile_id,
  target_role,
  normalized_target_role,
  job_description_snapshot,
  job_description_hash,
  source,
  rigor_baseline_snapshot_json,
  rigor_baseline_question_wording_snapshot_json
)
values (
  '26262626-2626-4626-8626-262626262626',
  '25252525-2525-4525-8525-252525252525',
  'Warehouse lead',
  'warehouse lead',
  'Coordinate daily warehouse work.',
  repeat('a', 64),
  'manual',
  '{"status":"candidate_practice_plan_baseline_v1","questionCount":1,"slots":[{"id":"slot-1"}]}'::jsonb,
  '{"status":"questions_worded","questions":[{"slotId":"slot-1","questionText":"What experience prepares you for this role?"}]}'::jsonb
);

do $$
begin
  begin
    update public.candidate_role_preparation_profiles
    set rigor_baseline_snapshot_json =
      '{"status":"candidate_practice_plan_baseline_v1","questionCount":1,"slots":[{"id":"changed"}]}'::jsonb
    where role_profile_id = '26262626-2626-4626-8626-262626262626';

    raise exception 'expected immutable baseline update to fail';
  exception
    when raise_exception then
      if position('candidate practice-plan baseline is immutable' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.candidate_role_preparation_profiles (
      candidate_profile_id,
      target_role,
      normalized_target_role,
      job_description_snapshot,
      job_description_hash,
      source,
      rigor_baseline_snapshot_json
    )
    values (
      '25252525-2525-4525-8525-252525252525',
      'Operations lead',
      'operations lead',
      'Coordinate daily operations.',
      repeat('b', 64),
      'manual',
      '{"status":"candidate_practice_plan_baseline_v1","questionCount":1,"slots":[{"id":"slot-1"}]}'::jsonb
    );

    raise exception 'expected incomplete baseline pair to fail';
  exception
    when check_violation then null;
  end;
end;
$$;

rollback;
