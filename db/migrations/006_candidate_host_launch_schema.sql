-- Candidate host-launch storage contract.
-- Target: traceable TalentArbor/RangamWorks launch identity mappings and app launch sessions.

alter table public.candidate_identities
  drop constraint if exists chk_candidate_identities_provider;

alter table public.candidate_identities
  add column if not exists host_candidate_id text,
  add column if not exists host_user_id text,
  add column if not exists platform_candidate_id text,
  add column if not exists workspace text;

alter table public.candidate_identities
  add constraint chk_candidate_identities_provider
  check (provider in ('rangamworks_sso', 'talentarbor_login', 'password', 'dev_mock', 'talentarbor_launch', 'rangamworks_launch'));

alter table public.candidate_identities
  drop constraint if exists chk_candidate_identities_workspace;

alter table public.candidate_identities
  add constraint chk_candidate_identities_workspace
  check (workspace is null or workspace in ('rangamworks', 'talentarbor', 'local_dev'));

create index if not exists idx_candidate_identities_platform_candidate
  on public.candidate_identities(provider, workspace, platform_candidate_id);

create index if not exists idx_candidate_identities_host_candidate
  on public.candidate_identities(provider, host_candidate_id);

create table if not exists public.candidate_launch_sessions (
  candidate_launch_session_id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade,
  provider text not null,
  issuer text not null,
  subject text not null,
  platform_candidate_id text not null,
  job_collection_id text not null,
  source_surface text not null,
  host_domain text,
  launch_context_snapshot_json jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_candidate_launch_sessions_provider check (provider in ('talentarbor_launch', 'rangamworks_launch')),
  constraint chk_candidate_launch_sessions_issuer_nonempty check (length(trim(issuer)) > 0),
  constraint chk_candidate_launch_sessions_subject_nonempty check (length(trim(subject)) > 0),
  constraint chk_candidate_launch_sessions_platform_candidate_nonempty check (length(trim(platform_candidate_id)) > 0),
  constraint chk_candidate_launch_sessions_job_collection_nonempty check (length(trim(job_collection_id)) > 0),
  constraint chk_candidate_launch_sessions_source_surface_nonempty check (length(trim(source_surface)) > 0),
  constraint chk_candidate_launch_sessions_snapshot_object check (jsonb_typeof(launch_context_snapshot_json) = 'object')
);

create index if not exists idx_candidate_launch_sessions_profile_expires
  on public.candidate_launch_sessions(candidate_profile_id, expires_at desc);

create index if not exists idx_candidate_launch_sessions_context
  on public.candidate_launch_sessions(candidate_profile_id, platform_candidate_id, job_collection_id);

create index if not exists idx_candidate_launch_sessions_active
  on public.candidate_launch_sessions(candidate_profile_id, expires_at desc)
  where revoked_at is null;

drop trigger if exists trg_candidate_launch_sessions_updated_at on public.candidate_launch_sessions;
create trigger trg_candidate_launch_sessions_updated_at
before update on public.candidate_launch_sessions
for each row execute function public.set_updated_at();
