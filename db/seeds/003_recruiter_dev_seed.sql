begin;

insert into public.app_users (
  user_id,
  email,
  display_name,
  first_name,
  last_name,
  status,
  email_verified_at
)
values (
  '20000000-0000-4000-8000-000000000001',
  'recruiter-dev@talentarbor.local',
  'Dev Recruiter',
  'Dev',
  'Recruiter',
  'active',
  now()
)
on conflict (user_id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  status = excluded.status,
  email_verified_at = coalesce(public.app_users.email_verified_at, excluded.email_verified_at);

insert into public.app_user_credentials (
  user_id,
  password_hash,
  password_updated_at,
  failed_login_count,
  locked_until
)
values (
  '20000000-0000-4000-8000-000000000001',
  'scrypt$16384$8$1$recruiter-dev-seed-v1$xIy3duaUM_odQUNPcuRAMFWUlWhpCUay4Ge5dwrpzsYzOCJcTtVPol9AN05khyfMCNe67vyjJA55foZcbDeZiQ',
  now(),
  0,
  null
)
on conflict (user_id) do update set
  password_hash = excluded.password_hash,
  password_updated_at = excluded.password_updated_at,
  failed_login_count = 0,
  locked_until = null;

delete from public.app_user_roles
where user_id = '20000000-0000-4000-8000-000000000001'
  and role <> 'recruiter';

insert into public.app_user_roles (user_id, role)
values ('20000000-0000-4000-8000-000000000001', 'recruiter')
on conflict (user_id, role) do nothing;

insert into public.ai_eval_operator_grants (
  user_id,
  granted_by_user_id,
  reason
)
select
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Local development AI-eval operator'
where not exists (
  select 1
  from public.ai_eval_operator_grants operator_grant
  where operator_grant.user_id = '20000000-0000-4000-8000-000000000001'
    and operator_grant.lifecycle_state = 'active'
);

insert into public.recruiter_profiles (
  recruiter_id,
  first_name,
  last_name,
  title,
  timezone
)
values (
  '20000000-0000-4000-8000-000000000001',
  'Dev',
  'Recruiter',
  'Local development recruiter',
  'America/Chicago'
)
on conflict (recruiter_id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  title = excluded.title,
  timezone = excluded.timezone;

commit;
