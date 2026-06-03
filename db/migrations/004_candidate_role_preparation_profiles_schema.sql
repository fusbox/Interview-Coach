-- Candidate role preparation profile foundation.
-- Target: durable role/JD anchor for dashboard V2 without breaking older draft rows.

create table if not exists public.candidate_role_preparation_profiles (
  role_profile_id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade,
  target_role text not null,
  normalized_target_role text not null,
  job_description_snapshot text not null,
  job_description_hash text not null,
  resume_context_snapshot_json jsonb,
  source text not null default 'manual',
  status text not null default 'active',
  last_practiced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_candidate_role_profiles_target_role_nonempty check (length(trim(target_role)) > 0),
  constraint chk_candidate_role_profiles_normalized_target_role_nonempty check (length(trim(normalized_target_role)) > 0),
  constraint chk_candidate_role_profiles_job_description_nonempty check (length(trim(job_description_snapshot)) > 0),
  constraint chk_candidate_role_profiles_job_description_hash_nonempty check (length(trim(job_description_hash)) > 0),
  constraint chk_candidate_role_profiles_source check (source in ('manual', 'host_platform', 'dev_seed')),
  constraint chk_candidate_role_profiles_status check (status in ('active', 'paused', 'archived')),
  constraint chk_candidate_role_profiles_resume_context_object check (
    resume_context_snapshot_json is null or jsonb_typeof(resume_context_snapshot_json) = 'object'
  )
);

alter table public.candidate_practice_drafts
  add column if not exists role_profile_id uuid references public.candidate_role_preparation_profiles(role_profile_id) on delete set null;

create unique index if not exists ux_candidate_role_profiles_active_role_jd
  on public.candidate_role_preparation_profiles(candidate_profile_id, normalized_target_role, job_description_hash)
  where status <> 'archived';

create index if not exists idx_candidate_role_profiles_profile_status
  on public.candidate_role_preparation_profiles(candidate_profile_id, status, updated_at desc);

create index if not exists idx_candidate_role_profiles_lookup
  on public.candidate_role_preparation_profiles(candidate_profile_id, normalized_target_role, job_description_hash);

create index if not exists idx_candidate_role_profiles_recent_activity
  on public.candidate_role_preparation_profiles(candidate_profile_id, last_practiced_at desc);

create index if not exists idx_candidate_practice_drafts_role_profile
  on public.candidate_practice_drafts(role_profile_id);

drop trigger if exists trg_candidate_role_profiles_updated_at on public.candidate_role_preparation_profiles;
create trigger trg_candidate_role_profiles_updated_at
before update on public.candidate_role_preparation_profiles
for each row execute function public.set_updated_at();
