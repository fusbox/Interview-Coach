-- App-owned candidate authentication foundation.
-- Host-launch candidate profiles remain unbound to app_users and continue through
-- their independent launch-session contract.

alter table public.app_user_roles
  drop constraint if exists app_user_roles_role_check;

alter table public.app_user_roles
  add constraint app_user_roles_role_check
  check (role in ('candidate', 'recruiter', 'admin', 'qa'));

alter table public.candidate_profiles
  add column if not exists app_user_id uuid
  references public.app_users(user_id) on delete set null;

create unique index if not exists ux_candidate_profiles_app_user_id
  on public.candidate_profiles(app_user_id)
  where app_user_id is not null;

alter table public.candidate_profiles
  drop constraint if exists chk_candidate_profiles_workspace;

alter table public.candidate_profiles
  add constraint chk_candidate_profiles_workspace
  check (workspace in ('interview_coach', 'rangamworks', 'talentarbor', 'local_dev'));

alter table public.candidate_profiles
  drop constraint if exists chk_candidate_profiles_app_user_workspace;

alter table public.candidate_profiles
  add constraint chk_candidate_profiles_app_user_workspace
  check (
    (app_user_id is not null and workspace = 'interview_coach')
    or
    (app_user_id is null and workspace <> 'interview_coach')
  );
