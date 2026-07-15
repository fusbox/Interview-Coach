-- Intentional same-role/JD practice paths.
-- Existing rows remain path 1; later paths are explicit candidate choices.

alter table public.candidate_role_preparation_profiles
  add column if not exists practice_path_number integer not null default 1;

do $$
begin
  alter table public.candidate_role_preparation_profiles
    add constraint chk_candidate_role_profiles_practice_path_number
    check (practice_path_number > 0);
exception
  when duplicate_object then null;
end;
$$;

drop index if exists public.ux_candidate_role_profiles_active_role_jd;

create unique index if not exists ux_candidate_role_profiles_active_role_jd_path
  on public.candidate_role_preparation_profiles(
    candidate_profile_id,
    normalized_target_role,
    job_description_hash,
    practice_path_number
  )
  where status <> 'archived';

create index if not exists idx_candidate_role_profiles_manual_match
  on public.candidate_role_preparation_profiles(
    candidate_profile_id,
    normalized_target_role,
    job_description_hash,
    updated_at desc
  )
  where status in ('active', 'paused');
