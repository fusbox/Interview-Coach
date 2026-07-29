begin;

insert into public.app_users (
  user_id,
  email,
  display_name,
  status,
  email_verified_at
)
values (
  '42000000-0000-4000-8000-000000000001',
  'candidate-app-auth-smoke@talentarbor.local',
  'Candidate App Auth Smoke',
  'active',
  now()
);

insert into public.app_user_roles (user_id, role)
values ('42000000-0000-4000-8000-000000000001', 'candidate');

insert into public.candidate_profiles (
  candidate_profile_id,
  app_user_id,
  auth_subject,
  email,
  display_name,
  workspace
)
values (
  '42000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000001',
  'interview_coach:42000000-0000-4000-8000-000000000001',
  'candidate-app-auth-smoke@talentarbor.local',
  'Candidate App Auth Smoke',
  'interview_coach'
);

do $$
begin
  if not exists (
    select 1
    from public.candidate_profiles profile
    join public.app_user_roles app_role
      on app_role.user_id = profile.app_user_id
     and app_role.role = 'candidate'
    where profile.candidate_profile_id = '42000000-0000-4000-8000-000000000002'
      and profile.workspace = 'interview_coach'
  ) then
    raise exception 'App-owned candidate profile binding was not created.';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.candidate_profiles (
      candidate_profile_id,
      app_user_id,
      auth_subject,
      email,
      workspace
    )
    values (
      '42000000-0000-4000-8000-000000000003',
      '42000000-0000-4000-8000-000000000001',
      'interview_coach:duplicate-binding',
      'candidate-app-auth-smoke-duplicate@talentarbor.local',
      'interview_coach'
    );
    raise exception 'Expected one app user to bind at most one candidate profile.';
  exception
    when unique_violation then null;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.candidate_profiles (
      candidate_profile_id,
      app_user_id,
      auth_subject,
      email,
      workspace
    )
    values (
      '42000000-0000-4000-8000-000000000004',
      '42000000-0000-4000-8000-000000000001',
      'talentarbor:host-profile-cannot-bind-app-user',
      'candidate-app-auth-host-smoke@talentarbor.local',
      'talentarbor'
    );
    raise exception 'Expected host workspace profiles to reject app-user binding.';
  exception
    when check_violation then null;
  end;
end;
$$;

rollback;
