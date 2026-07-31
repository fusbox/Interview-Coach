begin;

create table if not exists public.candidate_question_assistance_artifacts (
  candidate_question_assistance_artifact_id uuid primary key default gen_random_uuid(),
  candidate_practice_session_id uuid not null,
  candidate_profile_id uuid not null,
  question_key text not null,
  assistance_kind text not null,
  request_fingerprint text not null,
  lifecycle_state text not null default 'pending',
  claim_token uuid,
  claim_expires_at timestamptz,
  attempt_count integer not null default 1,
  provider text,
  profile_id text,
  prompt_version text,
  configuration_fingerprint text,
  output_json jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_candidate_question_assistance_identity
    unique (
      candidate_practice_session_id,
      candidate_profile_id,
      question_key,
      assistance_kind
    ),
  constraint fk_candidate_question_assistance_session_owner
    foreign key (candidate_practice_session_id, candidate_profile_id)
    references public.candidate_practice_sessions (
      candidate_practice_session_id,
      candidate_profile_id
    )
    on delete cascade,
  constraint chk_candidate_question_assistance_question_key
    check (length(trim(question_key)) between 1 and 128),
  constraint chk_candidate_question_assistance_kind
    check (assistance_kind in ('hints', 'strong_response')),
  constraint chk_candidate_question_assistance_fingerprint
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_candidate_question_assistance_state
    check (lifecycle_state in ('pending', 'succeeded', 'failed')),
  constraint chk_candidate_question_assistance_attempt_count
    check (attempt_count >= 1),
  constraint chk_candidate_question_assistance_configuration_fingerprint
    check (
      configuration_fingerprint is null
      or configuration_fingerprint ~ '^[a-f0-9]{64}$'
    ),
  constraint chk_candidate_question_assistance_output
    check (
      output_json is null
      or jsonb_typeof(output_json) = 'object'
    ),
  constraint chk_candidate_question_assistance_succeeded
    check (
      lifecycle_state <> 'succeeded'
      or (
        output_json is not null
        and provider is not null
        and profile_id is not null
        and prompt_version is not null
        and configuration_fingerprint is not null
        and claim_token is null
        and claim_expires_at is null
      )
    ),
  constraint chk_candidate_question_assistance_pending
    check (
      lifecycle_state <> 'pending'
      or (
        claim_token is not null
        and claim_expires_at is not null
        and output_json is null
      )
    )
);

create index if not exists idx_candidate_question_assistance_session
  on public.candidate_question_assistance_artifacts (
    candidate_practice_session_id,
    candidate_profile_id,
    question_key
  );

create index if not exists idx_candidate_question_assistance_expired_claim
  on public.candidate_question_assistance_artifacts (claim_expires_at)
  where lifecycle_state = 'pending';

create table if not exists public.invited_question_assistance_artifacts (
  invited_question_assistance_artifact_id uuid primary key default gen_random_uuid(),
  invited_practice_session_id uuid not null,
  recruiter_invitation_recipient_id uuid not null,
  question_key text not null,
  assistance_kind text not null,
  request_fingerprint text not null,
  lifecycle_state text not null default 'pending',
  claim_token uuid,
  claim_expires_at timestamptz,
  attempt_count integer not null default 1,
  provider text,
  profile_id text,
  prompt_version text,
  configuration_fingerprint text,
  output_json jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_invited_question_assistance_identity
    unique (
      invited_practice_session_id,
      recruiter_invitation_recipient_id,
      question_key,
      assistance_kind
    ),
  constraint fk_invited_question_assistance_session_owner
    foreign key (invited_practice_session_id, recruiter_invitation_recipient_id)
    references public.invited_practice_sessions (
      invited_practice_session_id,
      recruiter_invitation_recipient_id
    )
    on delete cascade,
  constraint chk_invited_question_assistance_question_key
    check (length(trim(question_key)) between 1 and 128),
  constraint chk_invited_question_assistance_kind
    check (assistance_kind in ('hints', 'strong_response')),
  constraint chk_invited_question_assistance_fingerprint
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_invited_question_assistance_state
    check (lifecycle_state in ('pending', 'succeeded', 'failed')),
  constraint chk_invited_question_assistance_attempt_count
    check (attempt_count >= 1),
  constraint chk_invited_question_assistance_configuration_fingerprint
    check (
      configuration_fingerprint is null
      or configuration_fingerprint ~ '^[a-f0-9]{64}$'
    ),
  constraint chk_invited_question_assistance_output
    check (
      output_json is null
      or jsonb_typeof(output_json) = 'object'
    ),
  constraint chk_invited_question_assistance_succeeded
    check (
      lifecycle_state <> 'succeeded'
      or (
        output_json is not null
        and provider is not null
        and profile_id is not null
        and prompt_version is not null
        and configuration_fingerprint is not null
        and claim_token is null
        and claim_expires_at is null
      )
    ),
  constraint chk_invited_question_assistance_pending
    check (
      lifecycle_state <> 'pending'
      or (
        claim_token is not null
        and claim_expires_at is not null
        and output_json is null
      )
    )
);

create index if not exists idx_invited_question_assistance_session
  on public.invited_question_assistance_artifacts (
    invited_practice_session_id,
    recruiter_invitation_recipient_id,
    question_key
  );

create index if not exists idx_invited_question_assistance_expired_claim
  on public.invited_question_assistance_artifacts (claim_expires_at)
  where lifecycle_state = 'pending';

drop trigger if exists trg_candidate_question_assistance_updated_at
  on public.candidate_question_assistance_artifacts;
create trigger trg_candidate_question_assistance_updated_at
before update on public.candidate_question_assistance_artifacts
for each row execute function public.set_updated_at();

drop trigger if exists trg_invited_question_assistance_updated_at
  on public.invited_question_assistance_artifacts;
create trigger trg_invited_question_assistance_updated_at
before update on public.invited_question_assistance_artifacts
for each row execute function public.set_updated_at();

alter table public.candidate_question_assistance_artifacts enable row level security;
alter table public.invited_question_assistance_artifacts enable row level security;

drop policy if exists interview_coach_runtime_access
  on public.candidate_question_assistance_artifacts;
drop policy if exists interview_coach_runtime_access
  on public.invited_question_assistance_artifacts;

do $$
begin
  if exists (
    select 1
    from pg_roles
    where rolname = 'interview_coach_runtime'
  ) then
    execute $policy$
      create policy interview_coach_runtime_access
        on public.candidate_question_assistance_artifacts
        for all
        to interview_coach_runtime
        using (true)
        with check (true)
    $policy$;

    execute $policy$
      create policy interview_coach_runtime_access
        on public.invited_question_assistance_artifacts
        for all
        to interview_coach_runtime
        using (true)
        with check (true)
    $policy$;

    execute $grant$
      grant select, insert, update, delete
        on public.candidate_question_assistance_artifacts
        to interview_coach_runtime
    $grant$;

    execute $grant$
      grant select, insert, update, delete
        on public.invited_question_assistance_artifacts
        to interview_coach_runtime
    $grant$;
  end if;
end;
$$;

commit;
