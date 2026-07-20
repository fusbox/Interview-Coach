do $$
declare
  user_count integer;
  role_count integer;
  profile_count integer;
begin
  select count(*) into user_count
  from public.app_users u
  join public.app_user_credentials c on c.user_id = u.user_id
  where u.user_id = '20000000-0000-4000-8000-000000000001'
    and u.email = 'recruiter-dev@talentarbor.local'
    and u.status = 'active'
    and c.password_hash like 'scrypt$16384$8$1$%'
    and c.failed_login_count = 0
    and c.locked_until is null;

  select count(*) into role_count
  from public.app_user_roles
  where user_id = '20000000-0000-4000-8000-000000000001'
    and role = 'recruiter';

  select count(*) into profile_count
  from public.recruiter_profiles
  where recruiter_id = '20000000-0000-4000-8000-000000000001';

  if user_count <> 1 or role_count <> 1 or profile_count <> 1 then
    raise exception 'Recruiter development seed is incomplete.';
  end if;
end $$;
