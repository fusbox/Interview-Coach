-- Candidate-owned request idempotency for initial setup and question generation.
-- The table retains hashes plus the accepted session pointer, never setup/JD/resume content.

create unique index if not exists ux_candidate_practice_sessions_id_profile
  on public.candidate_practice_sessions(candidate_practice_session_id, candidate_profile_id);

create table if not exists public.candidate_setup_start_requests (
  candidate_setup_start_request_id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null
    references public.candidate_profiles(candidate_profile_id) on delete cascade,
  idempotency_key_hash text not null,
  request_fingerprint text not null,
  lifecycle_state text not null default 'pending',
  claim_generation integer not null default 1,
  claim_expires_at timestamptz not null,
  expires_at timestamptz not null,
  candidate_practice_session_id uuid,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_candidate_setup_start_request_key
    unique (candidate_profile_id, idempotency_key_hash),
  constraint chk_candidate_setup_start_key_hash
    check (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  constraint chk_candidate_setup_start_request_fingerprint
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_candidate_setup_start_lifecycle
    check (lifecycle_state in ('pending', 'completed', 'failed')),
  constraint chk_candidate_setup_start_generation
    check (claim_generation > 0),
  constraint chk_candidate_setup_start_expiry
    check (expires_at > created_at),
  constraint chk_candidate_setup_start_terminal_shape check (
    (
      lifecycle_state = 'completed'
      and candidate_practice_session_id is not null
      and completed_at is not null
      and failed_at is null
      and last_error_code is null
    )
    or
    (
      lifecycle_state = 'pending'
      and candidate_practice_session_id is null
      and completed_at is null
      and failed_at is null
      and last_error_code is null
    )
    or
    (
      lifecycle_state = 'failed'
      and candidate_practice_session_id is null
      and completed_at is null
      and failed_at is not null
      and length(trim(last_error_code)) > 0
    )
  )
);

create index if not exists idx_candidate_setup_start_requests_expiry
  on public.candidate_setup_start_requests(expires_at);

create index if not exists idx_candidate_setup_start_requests_session
  on public.candidate_setup_start_requests(candidate_practice_session_id)
  where candidate_practice_session_id is not null;

alter table public.candidate_setup_start_requests
  drop constraint if exists candidate_setup_start_requests_candidate_practice_session_id_fkey;

do $$
begin
  alter table public.candidate_setup_start_requests
    add constraint fk_candidate_setup_start_request_session_owner
    foreign key (candidate_practice_session_id, candidate_profile_id)
    references public.candidate_practice_sessions(candidate_practice_session_id, candidate_profile_id)
    on delete cascade;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.candidate_setup_start_requests
    add constraint chk_candidate_setup_start_error_code_length
    check (
      last_error_code is null
      or length(trim(last_error_code)) between 1 and 120
    );
exception
  when duplicate_object then null;
end;
$$;

drop trigger if exists trg_candidate_setup_start_requests_updated_at
  on public.candidate_setup_start_requests;

create trigger trg_candidate_setup_start_requests_updated_at
before update on public.candidate_setup_start_requests
for each row execute function public.set_updated_at();
