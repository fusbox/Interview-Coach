-- Rollback-only smoke validation for db/migrations/004_candidate_role_preparation_profiles_schema.sql.
-- Run against a disposable database after applying candidate identity, draft, and role-profile migrations.

begin;

insert into public.candidate_profiles (
  candidate_profile_id,
  auth_subject,
  email,
  display_name,
  workspace
)
values (
  '88888888-8888-4888-8888-888888888888',
  'local_dev:role-profile-candidate@example.invalid',
  'role-profile-candidate@example.invalid',
  'Role Profile Candidate',
  'local_dev'
);

insert into public.candidate_role_preparation_profiles (
  role_profile_id,
  candidate_profile_id,
  target_role,
  normalized_target_role,
  job_description_snapshot,
  job_description_hash,
  resume_context_snapshot_json,
  source
)
values (
  '99999999-9999-4999-8999-999999999999',
  '88888888-8888-4888-8888-888888888888',
  'Customer Success Manager',
  'customer success manager',
  'Own renewals and customer health.',
  'e3ec1db9b1789f5731d15f83a1db21298f32149e8bad753f1eb048e2252cdb86',
  '{"captureMode":"pasted_text","extractedText":"Managed customer renewals."}'::jsonb,
  'manual'
);

insert into public.candidate_practice_drafts (
  practice_draft_id,
  candidate_profile_id,
  role_profile_id,
  target_role,
  job_description,
  resume_context_json
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999999',
  'Customer Success Manager',
  'Own renewals and customer health.',
  '{"pastedText":"Managed customer renewals.","extractedText":"Managed customer renewals.","captureMode":"pasted_text"}'::jsonb
);

do $$
declare
  v_link_count integer;
begin
  select count(*) into v_link_count
  from public.candidate_practice_drafts draft
  join public.candidate_role_preparation_profiles profile
    on profile.role_profile_id = draft.role_profile_id
  where draft.practice_draft_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and profile.candidate_profile_id = '88888888-8888-4888-8888-888888888888'
    and profile.status = 'active';

  if v_link_count <> 1 then
    raise exception 'expected 1 linked role profile draft, found %', v_link_count;
  end if;
end;
$$;

do $$
begin
  insert into public.candidate_role_preparation_profiles (
    candidate_profile_id,
    target_role,
    normalized_target_role,
    job_description_snapshot,
    job_description_hash,
    source
  )
  values (
    '88888888-8888-4888-8888-888888888888',
    'Customer Success Manager',
    'customer success manager',
    'Own renewals and customer health.',
    'e3ec1db9b1789f5731d15f83a1db21298f32149e8bad753f1eb048e2252cdb86',
    'manual'
  );

  raise exception 'expected duplicate active role profile to fail';
exception
  when unique_violation then null;
end;
$$;

do $$
begin
  insert into public.candidate_role_preparation_profiles (
    candidate_profile_id,
    target_role,
    normalized_target_role,
    job_description_snapshot,
    job_description_hash,
    source
  )
  values (
    '88888888-8888-4888-8888-888888888888',
    'Customer Success Manager',
    'customer success manager',
    '   ',
    'hash',
    'manual'
  );

  raise exception 'expected blank job description snapshot to fail';
exception
  when check_violation then null;
end;
$$;

rollback;
