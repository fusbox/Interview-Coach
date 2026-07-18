-- Candidate host-launch exchange hardening.
-- A launch token is a short-lived, one-time exchange credential. The resulting
-- Interview Coach session has its own expiry and may be created without job context.

alter table public.candidate_launch_sessions
  add column if not exists launch_token_id text,
  add column if not exists launch_token_fingerprint text,
  add column if not exists launch_token_expires_at timestamptz;

alter table public.candidate_launch_sessions
  alter column job_collection_id drop not null;

alter table public.candidate_launch_sessions
  drop constraint if exists chk_candidate_launch_sessions_job_collection_nonempty;

alter table public.candidate_launch_sessions
  add constraint chk_candidate_launch_sessions_job_collection_nonempty
  check (job_collection_id is null or length(trim(job_collection_id)) > 0);

alter table public.candidate_launch_sessions
  drop constraint if exists chk_candidate_launch_sessions_token_fingerprint;

alter table public.candidate_launch_sessions
  add constraint chk_candidate_launch_sessions_token_fingerprint
  check (
    launch_token_fingerprint is null
    or launch_token_fingerprint ~ '^[0-9a-f]{64}$'
  );

alter table public.candidate_launch_sessions
  drop constraint if exists chk_candidate_launch_sessions_token_expiry_pair;

alter table public.candidate_launch_sessions
  add constraint chk_candidate_launch_sessions_token_expiry_pair
  check (
    (launch_token_fingerprint is null and launch_token_expires_at is null)
    or (launch_token_fingerprint is not null and launch_token_expires_at is not null)
  );

create unique index if not exists uq_candidate_launch_sessions_token_fingerprint
  on public.candidate_launch_sessions(launch_token_fingerprint)
  where launch_token_fingerprint is not null;

create unique index if not exists uq_candidate_launch_sessions_issuer_token_id
  on public.candidate_launch_sessions(issuer, launch_token_id)
  where launch_token_id is not null;
