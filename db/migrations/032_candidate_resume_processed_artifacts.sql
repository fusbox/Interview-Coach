-- Candidate-owned processed resume text. Raw source text and source bytes are request-only material.

create table if not exists public.candidate_resume_processed_artifacts (
  candidate_resume_artifact_id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade,
  role_profile_id uuid,
  version integer not null,
  review_revision integer not null default 1,
  source text not null,
  candidate_label text not null,
  normalized_text text not null,
  source_fingerprint text not null,
  normalized_text_fingerprint text not null,
  processing_policy_version text not null,
  pii_policy_version text not null,
  pii_redaction_counts_json jsonb not null default '{}'::jsonb,
  review_state text not null default 'awaiting_review',
  original_retained boolean not null default false,
  accepted_at timestamptz,
  replaced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_candidate_resume_artifact_owned_role_profile
    foreign key (candidate_profile_id, role_profile_id)
    references public.candidate_role_preparation_profiles(candidate_profile_id, role_profile_id),
  constraint uq_candidate_resume_artifact_version unique (candidate_profile_id, version),
  constraint uq_candidate_resume_artifact_source_policy unique (
    candidate_profile_id,
    source,
    source_fingerprint,
    processing_policy_version,
    pii_policy_version
  ),
  constraint chk_candidate_resume_artifact_version check (version > 0),
  constraint chk_candidate_resume_artifact_review_revision check (review_revision > 0),
  constraint chk_candidate_resume_artifact_source check (source in ('pasted_text', 'trusted_host')),
  constraint chk_candidate_resume_artifact_label check (length(trim(candidate_label)) between 1 and 80),
  constraint chk_candidate_resume_artifact_text check (length(trim(normalized_text)) between 1 and 24000),
  constraint chk_candidate_resume_artifact_source_fingerprint check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_candidate_resume_artifact_text_fingerprint check (normalized_text_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_candidate_resume_artifact_processing_policy check (length(trim(processing_policy_version)) > 0),
  constraint chk_candidate_resume_artifact_pii_policy check (length(trim(pii_policy_version)) > 0),
  constraint chk_candidate_resume_artifact_redaction_counts check (jsonb_typeof(pii_redaction_counts_json) = 'object'),
  constraint chk_candidate_resume_artifact_review_state check (review_state in ('awaiting_review', 'accepted', 'replaced')),
  constraint chk_candidate_resume_artifact_no_original check (original_retained = false),
  constraint chk_candidate_resume_artifact_lifecycle check (
    (review_state = 'awaiting_review' and accepted_at is null and replaced_at is null)
    or
    (review_state = 'accepted' and accepted_at is not null and replaced_at is null)
    or
    (review_state = 'replaced' and accepted_at is not null and replaced_at is not null)
  )
);

create index if not exists idx_candidate_resume_artifacts_owner_state
  on public.candidate_resume_processed_artifacts(candidate_profile_id, review_state, version desc);

create or replace function public.validate_candidate_resume_artifact_transition()
returns trigger
language plpgsql
as $$
begin
  if row(
    new.candidate_resume_artifact_id,
    new.candidate_profile_id,
    new.role_profile_id,
    new.version,
    new.source,
    new.candidate_label,
    new.source_fingerprint,
    new.processing_policy_version,
    new.pii_policy_version,
    new.original_retained,
    new.created_at
  ) is distinct from row(
    old.candidate_resume_artifact_id,
    old.candidate_profile_id,
    old.role_profile_id,
    old.version,
    old.source,
    old.candidate_label,
    old.source_fingerprint,
    old.processing_policy_version,
    old.pii_policy_version,
    old.original_retained,
    old.created_at
  ) then
    raise exception 'candidate resume artifact identity and processing provenance are immutable'
      using errcode = '55000';
  end if;

  if old.review_state = 'awaiting_review' then
    if new.review_state not in ('awaiting_review', 'accepted')
       or new.review_revision <> old.review_revision + 1 then
      raise exception 'candidate resume review permits one revision-fenced review or acceptance step'
        using errcode = '55000';
    end if;
  elsif old.review_state = 'accepted' then
    if new.review_state <> 'replaced'
       or new.normalized_text is distinct from old.normalized_text
       or new.normalized_text_fingerprint is distinct from old.normalized_text_fingerprint
       or new.pii_redaction_counts_json is distinct from old.pii_redaction_counts_json
       or new.review_revision <> old.review_revision then
      raise exception 'accepted candidate resume text is immutable'
        using errcode = '55000';
    end if;
  else
    raise exception 'replaced candidate resume artifacts are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_candidate_resume_artifact_transition on public.candidate_resume_processed_artifacts;
create trigger trg_candidate_resume_artifact_transition
before update on public.candidate_resume_processed_artifacts
for each row execute function public.validate_candidate_resume_artifact_transition();
