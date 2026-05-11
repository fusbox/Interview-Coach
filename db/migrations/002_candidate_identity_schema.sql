-- Candidate app identity foundation
-- Target: candidate-owned profile records and provider identity bindings for TalentArbor/RangamWorks handoff,
-- password-backed local dev auth, and explicit mock mode.

create table if not exists public.candidate_profiles (
  candidate_profile_id uuid primary key default gen_random_uuid(),
  auth_subject text not null,
  email text not null,
  display_name text,
  workspace text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_candidate_profiles_email_nonempty check (length(trim(email)) > 0),
  constraint chk_candidate_profiles_auth_subject_nonempty check (length(trim(auth_subject)) > 0),
  constraint chk_candidate_profiles_workspace check (workspace in ('rangamworks', 'talentarbor', 'local_dev'))
);

create unique index if not exists ux_candidate_profiles_auth_subject on public.candidate_profiles(auth_subject);
create index if not exists idx_candidate_profiles_email_lower on public.candidate_profiles(lower(email));
create index if not exists idx_candidate_profiles_workspace on public.candidate_profiles(workspace);
create index if not exists idx_candidate_profiles_status on public.candidate_profiles(status);

drop trigger if exists trg_candidate_profiles_updated_at on public.candidate_profiles;
create trigger trg_candidate_profiles_updated_at
before update on public.candidate_profiles
for each row execute function public.set_updated_at();

create table if not exists public.candidate_identities (
  candidate_identity_id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade,
  provider text not null,
  issuer text not null,
  subject text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  constraint chk_candidate_identities_provider check (provider in ('rangamworks_sso', 'talentarbor_login', 'password', 'dev_mock')),
  constraint chk_candidate_identities_issuer_nonempty check (length(trim(issuer)) > 0),
  constraint chk_candidate_identities_subject_nonempty check (length(trim(subject)) > 0),
  constraint uq_candidate_identities_provider_subject unique (provider, issuer, subject)
);

create index if not exists idx_candidate_identities_profile_id on public.candidate_identities(candidate_profile_id);
create index if not exists idx_candidate_identities_email_lower on public.candidate_identities(lower(email));
create index if not exists idx_candidate_identities_last_seen_at on public.candidate_identities(last_seen_at);

drop trigger if exists trg_candidate_identities_updated_at on public.candidate_identities;
create trigger trg_candidate_identities_updated_at
before update on public.candidate_identities
for each row execute function public.set_updated_at();
