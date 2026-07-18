-- Trusted host-launch setup staging.
-- A job-aware launch preserves the canonical host role/JD until the candidate
-- explicitly creates a prep context and practice session. Identity-only launch
-- creates no staging row and remains eligible for candidate-owned manual setup.

alter table public.candidate_role_preparation_profiles
  add column if not exists source_platform text,
  add column if not exists source_job_collection_id text,
  add column if not exists source_requirement_id text,
  add column if not exists source_launch_session_id uuid
    references public.candidate_launch_sessions(candidate_launch_session_id) on delete set null;

alter table public.candidate_launch_sessions
  add column if not exists setup_context_consumed_at timestamptz;

create unique index if not exists ux_candidate_launch_sessions_id_profile
  on public.candidate_launch_sessions(candidate_launch_session_id, candidate_profile_id);

do $$
begin
  alter table public.candidate_launch_sessions
    add constraint chk_candidate_launch_sessions_setup_consumption
    check (setup_context_consumed_at is null or job_collection_id is not null);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.candidate_role_preparation_profiles
    add constraint chk_candidate_role_profiles_source_platform
    check (source_platform is null or source_platform in ('talentarbor', 'rangamworks'));
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.candidate_role_preparation_profiles
    add constraint chk_candidate_role_profiles_source_job_nonempty
    check (source_job_collection_id is null or length(trim(source_job_collection_id)) > 0);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.candidate_role_preparation_profiles
    add constraint chk_candidate_role_profiles_source_requirement_nonempty
    check (source_requirement_id is null or length(trim(source_requirement_id)) > 0);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.candidate_role_preparation_profiles
    add constraint chk_candidate_role_profiles_host_source_identity
    check (
      source <> 'host_platform'
      or (source_platform is not null and source_job_collection_id is not null)
    ) not valid;
exception
  when duplicate_object then null;
end;
$$;

drop index if exists public.ux_candidate_role_profiles_active_role_jd_path;

create unique index if not exists ux_candidate_role_profiles_manual_role_jd_path
  on public.candidate_role_preparation_profiles(
    candidate_profile_id,
    normalized_target_role,
    job_description_hash,
    practice_path_number
  )
  where status <> 'archived' and source in ('manual', 'dev_seed');

create unique index if not exists ux_candidate_role_profiles_host_job_path
  on public.candidate_role_preparation_profiles(
    candidate_profile_id,
    source_platform,
    source_job_collection_id,
    practice_path_number
  )
  where status <> 'archived'
    and source = 'host_platform'
    and source_platform is not null
    and source_job_collection_id is not null;

create index if not exists idx_candidate_role_profiles_host_job
  on public.candidate_role_preparation_profiles(
    candidate_profile_id,
    source_platform,
    source_job_collection_id,
    updated_at desc
  )
  where status in ('active', 'paused') and source = 'host_platform';

create table if not exists public.candidate_launch_setup_contexts (
  candidate_launch_session_id uuid primary key
    references public.candidate_launch_sessions(candidate_launch_session_id) on delete cascade,
  candidate_profile_id uuid not null
    references public.candidate_profiles(candidate_profile_id) on delete cascade,
  source_platform text not null,
  job_collection_id text not null,
  requirement_id text,
  target_role text not null,
  job_description_snapshot text not null,
  job_description_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint chk_candidate_launch_setup_contexts_platform
    check (source_platform in ('talentarbor', 'rangamworks')),
  constraint chk_candidate_launch_setup_contexts_job_nonempty
    check (length(trim(job_collection_id)) > 0),
  constraint chk_candidate_launch_setup_contexts_requirement_nonempty
    check (requirement_id is null or length(trim(requirement_id)) > 0),
  constraint chk_candidate_launch_setup_contexts_role_nonempty
    check (length(trim(target_role)) > 0),
  constraint chk_candidate_launch_setup_contexts_jd_nonempty
    check (length(trim(job_description_snapshot)) > 0),
  constraint chk_candidate_launch_setup_contexts_jd_hash
    check (job_description_hash ~ '^[0-9a-f]{64}$')
);

do $$
begin
  alter table public.candidate_launch_setup_contexts
    add constraint fk_candidate_launch_setup_contexts_session_owner
    foreign key (candidate_launch_session_id, candidate_profile_id)
    references public.candidate_launch_sessions(candidate_launch_session_id, candidate_profile_id)
    on delete cascade;
exception
  when duplicate_object then null;
end;
$$;

create index if not exists idx_candidate_launch_setup_contexts_profile_expires
  on public.candidate_launch_setup_contexts(candidate_profile_id, expires_at desc);
