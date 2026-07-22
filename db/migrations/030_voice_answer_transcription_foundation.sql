-- Transcript-first voice-answer persistence for candidate-led and invited practice.
-- Raw audio is request-only material and must never be stored in these tables or projections.

alter table public.candidate_practice_sessions
  add column if not exists voice_transcript_drafts_json jsonb not null default '{}'::jsonb;

alter table public.invited_practice_sessions
  add column if not exists voice_transcript_drafts_json jsonb not null default '{}'::jsonb;

do $$
begin
  alter table public.candidate_practice_sessions
    add constraint chk_candidate_practice_sessions_voice_transcript_drafts_object
    check (jsonb_typeof(voice_transcript_drafts_json) = 'object');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.invited_practice_sessions
    add constraint chk_invited_practice_sessions_voice_transcript_drafts_object
    check (jsonb_typeof(voice_transcript_drafts_json) = 'object');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.candidate_voice_transcription_runs (
  candidate_voice_transcription_run_id uuid primary key default gen_random_uuid(),
  candidate_practice_session_id uuid not null,
  candidate_profile_id uuid not null,
  question_slot_id text not null,
  question_index integer not null,
  idempotency_key_hash text not null,
  audio_input_fingerprint text not null,
  accepted_mime_type text not null,
  audio_byte_count integer not null,
  audio_duration_ms integer,
  provider text not null,
  profile_id text not null,
  model_name text not null,
  configuration_fingerprint text not null,
  generation_attempt integer not null,
  lifecycle_state text not null default 'requested',
  output_fingerprint text,
  error_code text,
  requested_at timestamptz not null,
  claim_expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_candidate_voice_transcription_session_owner
    foreign key (candidate_practice_session_id, candidate_profile_id)
    references public.candidate_practice_sessions(candidate_practice_session_id, candidate_profile_id)
    on delete cascade,
  constraint uq_candidate_voice_transcription_run_source
    unique (
      candidate_voice_transcription_run_id,
      candidate_practice_session_id,
      candidate_profile_id,
      question_slot_id,
      question_index
    ),
  constraint uq_candidate_voice_transcription_generation
    unique (candidate_practice_session_id, question_slot_id, idempotency_key_hash, generation_attempt),
  constraint chk_candidate_voice_transcription_slot check (length(trim(question_slot_id)) > 0),
  constraint chk_candidate_voice_transcription_question_index check (question_index >= 0),
  constraint chk_candidate_voice_transcription_idempotency_hash check (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  constraint chk_candidate_voice_transcription_audio_fingerprint check (audio_input_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_candidate_voice_transcription_mime check (length(trim(accepted_mime_type)) > 0),
  constraint chk_candidate_voice_transcription_bytes check (audio_byte_count > 0),
  constraint chk_candidate_voice_transcription_duration check (audio_duration_ms is null or audio_duration_ms > 0),
  constraint chk_candidate_voice_transcription_provider check (length(trim(provider)) > 0),
  constraint chk_candidate_voice_transcription_profile check (length(trim(profile_id)) > 0),
  constraint chk_candidate_voice_transcription_model check (length(trim(model_name)) > 0),
  constraint chk_candidate_voice_transcription_configuration check (configuration_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_candidate_voice_transcription_generation check (generation_attempt > 0),
  constraint chk_candidate_voice_transcription_state check (lifecycle_state in ('requested', 'completed', 'failed')),
  constraint chk_candidate_voice_transcription_output check (output_fingerprint is null or output_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_candidate_voice_transcription_error check (error_code is null or error_code ~ '^[A-Z0-9_]+$'),
  constraint chk_candidate_voice_transcription_claim check (claim_expires_at > requested_at),
  constraint chk_candidate_voice_transcription_completion check (
    (lifecycle_state = 'requested' and output_fingerprint is null and error_code is null and completed_at is null)
    or
    (lifecycle_state = 'completed' and output_fingerprint is not null and error_code is null and completed_at is not null)
    or
    (lifecycle_state = 'failed' and output_fingerprint is null and length(trim(error_code)) > 0 and completed_at is not null)
  )
);

create index if not exists idx_candidate_voice_transcription_session_slot
  on public.candidate_voice_transcription_runs(candidate_practice_session_id, question_slot_id, generation_attempt desc);

create index if not exists idx_candidate_voice_transcription_profile_state
  on public.candidate_voice_transcription_runs(profile_id, lifecycle_state, requested_at desc);

create table if not exists public.invited_practice_voice_transcription_runs (
  invited_practice_voice_transcription_run_id uuid primary key default gen_random_uuid(),
  invited_practice_session_id uuid not null,
  recruiter_invitation_recipient_id uuid not null,
  question_slot_id text not null,
  question_index integer not null,
  idempotency_key_hash text not null,
  audio_input_fingerprint text not null,
  accepted_mime_type text not null,
  audio_byte_count integer not null,
  audio_duration_ms integer,
  provider text not null,
  profile_id text not null,
  model_name text not null,
  configuration_fingerprint text not null,
  generation_attempt integer not null,
  lifecycle_state text not null default 'requested',
  output_fingerprint text,
  error_code text,
  requested_at timestamptz not null,
  claim_expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_invited_voice_transcription_session_recipient
    foreign key (invited_practice_session_id, recruiter_invitation_recipient_id)
    references public.invited_practice_sessions(invited_practice_session_id, recruiter_invitation_recipient_id)
    on delete cascade,
  constraint uq_invited_voice_transcription_run_source
    unique (
      invited_practice_voice_transcription_run_id,
      invited_practice_session_id,
      recruiter_invitation_recipient_id,
      question_slot_id,
      question_index
    ),
  constraint uq_invited_voice_transcription_generation
    unique (invited_practice_session_id, question_slot_id, idempotency_key_hash, generation_attempt),
  constraint chk_invited_voice_transcription_slot check (length(trim(question_slot_id)) > 0),
  constraint chk_invited_voice_transcription_question_index check (question_index >= 0),
  constraint chk_invited_voice_transcription_idempotency_hash check (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  constraint chk_invited_voice_transcription_audio_fingerprint check (audio_input_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_invited_voice_transcription_mime check (length(trim(accepted_mime_type)) > 0),
  constraint chk_invited_voice_transcription_bytes check (audio_byte_count > 0),
  constraint chk_invited_voice_transcription_duration check (audio_duration_ms is null or audio_duration_ms > 0),
  constraint chk_invited_voice_transcription_provider check (length(trim(provider)) > 0),
  constraint chk_invited_voice_transcription_profile check (length(trim(profile_id)) > 0),
  constraint chk_invited_voice_transcription_model check (length(trim(model_name)) > 0),
  constraint chk_invited_voice_transcription_configuration check (configuration_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_invited_voice_transcription_generation check (generation_attempt > 0),
  constraint chk_invited_voice_transcription_state check (lifecycle_state in ('requested', 'completed', 'failed')),
  constraint chk_invited_voice_transcription_output check (output_fingerprint is null or output_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint chk_invited_voice_transcription_error check (error_code is null or error_code ~ '^[A-Z0-9_]+$'),
  constraint chk_invited_voice_transcription_claim check (claim_expires_at > requested_at),
  constraint chk_invited_voice_transcription_completion check (
    (lifecycle_state = 'requested' and output_fingerprint is null and error_code is null and completed_at is null)
    or
    (lifecycle_state = 'completed' and output_fingerprint is not null and error_code is null and completed_at is not null)
    or
    (lifecycle_state = 'failed' and output_fingerprint is null and length(trim(error_code)) > 0 and completed_at is not null)
  )
);

create index if not exists idx_invited_voice_transcription_session_slot
  on public.invited_practice_voice_transcription_runs(invited_practice_session_id, question_slot_id, generation_attempt desc);

create index if not exists idx_invited_voice_transcription_profile_state
  on public.invited_practice_voice_transcription_runs(profile_id, lifecycle_state, requested_at desc);

create or replace function public.validate_candidate_voice_transcription_transition()
returns trigger
language plpgsql
as $$
begin
  if old.lifecycle_state <> 'requested'
     or new.lifecycle_state not in ('completed', 'failed') then
    raise exception 'candidate voice transcription runs allow one requested-to-terminal transition'
      using errcode = '55000';
  end if;

  if row(
    new.candidate_voice_transcription_run_id,
    new.candidate_practice_session_id,
    new.candidate_profile_id,
    new.question_slot_id,
    new.question_index,
    new.idempotency_key_hash,
    new.audio_input_fingerprint,
    new.accepted_mime_type,
    new.audio_byte_count,
    new.audio_duration_ms,
    new.provider,
    new.profile_id,
    new.model_name,
    new.configuration_fingerprint,
    new.generation_attempt,
    new.requested_at,
    new.claim_expires_at,
    new.created_at
  ) is distinct from row(
    old.candidate_voice_transcription_run_id,
    old.candidate_practice_session_id,
    old.candidate_profile_id,
    old.question_slot_id,
    old.question_index,
    old.idempotency_key_hash,
    old.audio_input_fingerprint,
    old.accepted_mime_type,
    old.audio_byte_count,
    old.audio_duration_ms,
    old.provider,
    old.profile_id,
    old.model_name,
    old.configuration_fingerprint,
    old.generation_attempt,
    old.requested_at,
    old.claim_expires_at,
    old.created_at
  ) then
    raise exception 'candidate voice transcription identity, media metadata, configuration, and claim are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function public.validate_invited_voice_transcription_transition()
returns trigger
language plpgsql
as $$
begin
  if old.lifecycle_state <> 'requested'
     or new.lifecycle_state not in ('completed', 'failed') then
    raise exception 'invited voice transcription runs allow one requested-to-terminal transition'
      using errcode = '55000';
  end if;

  if row(
    new.invited_practice_voice_transcription_run_id,
    new.invited_practice_session_id,
    new.recruiter_invitation_recipient_id,
    new.question_slot_id,
    new.question_index,
    new.idempotency_key_hash,
    new.audio_input_fingerprint,
    new.accepted_mime_type,
    new.audio_byte_count,
    new.audio_duration_ms,
    new.provider,
    new.profile_id,
    new.model_name,
    new.configuration_fingerprint,
    new.generation_attempt,
    new.requested_at,
    new.claim_expires_at,
    new.created_at
  ) is distinct from row(
    old.invited_practice_voice_transcription_run_id,
    old.invited_practice_session_id,
    old.recruiter_invitation_recipient_id,
    old.question_slot_id,
    old.question_index,
    old.idempotency_key_hash,
    old.audio_input_fingerprint,
    old.accepted_mime_type,
    old.audio_byte_count,
    old.audio_duration_ms,
    old.provider,
    old.profile_id,
    old.model_name,
    old.configuration_fingerprint,
    old.generation_attempt,
    old.requested_at,
    old.claim_expires_at,
    old.created_at
  ) then
    raise exception 'invited voice transcription identity, media metadata, configuration, and claim are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_candidate_voice_transcription_transition
  on public.candidate_voice_transcription_runs;
create trigger trg_candidate_voice_transcription_transition
before update on public.candidate_voice_transcription_runs
for each row execute function public.validate_candidate_voice_transcription_transition();

drop trigger if exists trg_candidate_voice_transcription_updated_at
  on public.candidate_voice_transcription_runs;
create trigger trg_candidate_voice_transcription_updated_at
before update on public.candidate_voice_transcription_runs
for each row execute function public.set_updated_at();

drop trigger if exists trg_invited_voice_transcription_transition
  on public.invited_practice_voice_transcription_runs;
create trigger trg_invited_voice_transcription_transition
before update on public.invited_practice_voice_transcription_runs
for each row execute function public.validate_invited_voice_transcription_transition();

drop trigger if exists trg_invited_voice_transcription_updated_at
  on public.invited_practice_voice_transcription_runs;
create trigger trg_invited_voice_transcription_updated_at
before update on public.invited_practice_voice_transcription_runs
for each row execute function public.set_updated_at();

alter table public.candidate_answer_attempts
  add column if not exists source_candidate_voice_transcription_run_id uuid;
alter table public.candidate_answer_attempts
  add column if not exists voice_submission_path text;
alter table public.candidate_answer_attempts
  add column if not exists voice_transcript_edited boolean;

alter table public.invited_practice_answer_attempts
  add column if not exists source_invited_voice_transcription_run_id uuid;
alter table public.invited_practice_answer_attempts
  add column if not exists voice_submission_path text;
alter table public.invited_practice_answer_attempts
  add column if not exists voice_transcript_edited boolean;

do $$
begin
  alter table public.candidate_answer_attempts
    add constraint fk_candidate_answer_attempt_voice_source
    foreign key (
      source_candidate_voice_transcription_run_id,
      candidate_practice_session_id,
      candidate_profile_id,
      question_slot_id,
      question_index
    ) references public.candidate_voice_transcription_runs(
      candidate_voice_transcription_run_id,
      candidate_practice_session_id,
      candidate_profile_id,
      question_slot_id,
      question_index
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.invited_practice_answer_attempts
    add constraint fk_invited_answer_attempt_voice_source
    foreign key (
      source_invited_voice_transcription_run_id,
      invited_practice_session_id,
      recruiter_invitation_recipient_id,
      question_slot_id,
      question_index
    ) references public.invited_practice_voice_transcription_runs(
      invited_practice_voice_transcription_run_id,
      invited_practice_session_id,
      recruiter_invitation_recipient_id,
      question_slot_id,
      question_index
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.candidate_answer_attempts
    add constraint chk_candidate_answer_attempt_voice_source
    check (
      (
        mode = 'voice'
        and source_candidate_voice_transcription_run_id is not null
        and voice_submission_path in ('quick_submit', 'transcript_review')
        and voice_transcript_edited is not null
      )
      or
      (
        mode <> 'voice'
        and source_candidate_voice_transcription_run_id is null
        and voice_submission_path is null
        and voice_transcript_edited is null
      )
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.invited_practice_answer_attempts
    add constraint chk_invited_answer_attempt_voice_source
    check (
      (
        mode = 'voice'
        and source_invited_voice_transcription_run_id is not null
        and voice_submission_path in ('quick_submit', 'transcript_review')
        and voice_transcript_edited is not null
      )
      or
      (
        mode <> 'voice'
        and source_invited_voice_transcription_run_id is null
        and voice_submission_path is null
        and voice_transcript_edited is null
      )
    );
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.validate_candidate_answer_attempt_voice_source()
returns trigger
language plpgsql
as $$
declare
  v_output_fingerprint text;
  v_current_draft jsonb;
  v_draft_fingerprint text;
  v_submitted_fingerprint text;
begin
  if new.mode <> 'voice' then
    return new;
  end if;

  select
    run.output_fingerprint,
    session.voice_transcript_drafts_json -> new.question_slot_id
  into v_output_fingerprint, v_current_draft
  from public.candidate_voice_transcription_runs run
  join public.candidate_practice_sessions session
    on session.candidate_practice_session_id = run.candidate_practice_session_id
   and session.candidate_profile_id = run.candidate_profile_id
  where run.candidate_voice_transcription_run_id = new.source_candidate_voice_transcription_run_id
    and run.candidate_practice_session_id = new.candidate_practice_session_id
    and run.candidate_profile_id = new.candidate_profile_id
    and run.question_slot_id = new.question_slot_id
    and run.question_index = new.question_index
    and run.lifecycle_state = 'completed'
    and session.voice_transcript_drafts_json -> new.question_slot_id ->> 'sourceTranscriptionRunId'
      = run.candidate_voice_transcription_run_id::text;

  if not found then
    raise exception 'candidate voice answer requires a completed same-owner transcription source'
      using errcode = '23514';
  end if;

  if v_current_draft ->> 'status' is distinct from 'voice_transcript_draft'
     or v_current_draft ->> 'slotId' is distinct from new.question_slot_id
     or v_current_draft ->> 'questionIndex' is distinct from new.question_index::text
     or v_current_draft ->> 'submissionPath' is distinct from new.voice_submission_path
     or nullif(trim(v_current_draft ->> 'transcriptText'), '') is null then
    raise exception 'candidate voice answer requires the exact current transcript draft'
      using errcode = '23514';
  end if;

  v_submitted_fingerprint := encode(digest(trim(new.answer_text), 'sha256'), 'hex');
  v_draft_fingerprint := encode(
    digest(trim(v_current_draft ->> 'transcriptText'), 'sha256'),
    'hex'
  );
  if v_draft_fingerprint is distinct from v_submitted_fingerprint then
    raise exception 'candidate voice answer must match the current candidate-authorized transcript draft'
      using errcode = '23514';
  end if;

  if new.voice_transcript_edited is distinct from (v_submitted_fingerprint <> v_output_fingerprint) then
    raise exception 'candidate voice transcript edit provenance must match the source fingerprint'
      using errcode = '23514';
  end if;

  if new.voice_submission_path = 'quick_submit'
     and v_submitted_fingerprint <> v_output_fingerprint then
    raise exception 'candidate quick-submit transcript must match the completed transcription output'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_candidate_voice_transcription_slot()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.candidate_practice_sessions session
    cross join lateral jsonb_array_elements(
      coalesce(session.question_wording_snapshot_json -> 'questions', '[]'::jsonb)
    ) question
    where session.candidate_practice_session_id = new.candidate_practice_session_id
      and session.candidate_profile_id = new.candidate_profile_id
      and session.status in ('planned', 'in_progress')
      and question ->> 'slotId' = new.question_slot_id
      and question ->> 'index' = new.question_index::text
  ) then
    raise exception 'candidate voice transcription requires an active same-owner question slot'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_invited_voice_transcription_slot()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.invited_practice_sessions session
    cross join lateral jsonb_array_elements(session.question_wording_snapshot_json -> 'questions') question
    where session.invited_practice_session_id = new.invited_practice_session_id
      and session.recruiter_invitation_recipient_id = new.recruiter_invitation_recipient_id
      and session.status in ('planned', 'in_progress')
      and question ->> 'slotId' = new.question_slot_id
      and question ->> 'index' = new.question_index::text
  ) then
    raise exception 'invited voice transcription requires an active same-recipient question slot'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_invited_answer_attempt_voice_source()
returns trigger
language plpgsql
as $$
declare
  v_output_fingerprint text;
  v_current_draft jsonb;
  v_draft_fingerprint text;
  v_submitted_fingerprint text;
begin
  if new.mode <> 'voice' then
    return new;
  end if;

  select
    run.output_fingerprint,
    session.voice_transcript_drafts_json -> new.question_slot_id
  into v_output_fingerprint, v_current_draft
  from public.invited_practice_voice_transcription_runs run
  join public.invited_practice_sessions session
    on session.invited_practice_session_id = run.invited_practice_session_id
   and session.recruiter_invitation_recipient_id = run.recruiter_invitation_recipient_id
  where run.invited_practice_voice_transcription_run_id = new.source_invited_voice_transcription_run_id
    and run.invited_practice_session_id = new.invited_practice_session_id
    and run.recruiter_invitation_recipient_id = new.recruiter_invitation_recipient_id
    and run.question_slot_id = new.question_slot_id
    and run.question_index = new.question_index
    and run.lifecycle_state = 'completed'
    and session.voice_transcript_drafts_json -> new.question_slot_id ->> 'sourceTranscriptionRunId'
      = run.invited_practice_voice_transcription_run_id::text;

  if not found then
    raise exception 'invited voice answer requires a completed same-recipient transcription source'
      using errcode = '23514';
  end if;

  if v_current_draft ->> 'status' is distinct from 'voice_transcript_draft'
     or v_current_draft ->> 'slotId' is distinct from new.question_slot_id
     or v_current_draft ->> 'questionIndex' is distinct from new.question_index::text
     or v_current_draft ->> 'submissionPath' is distinct from new.voice_submission_path
     or nullif(trim(v_current_draft ->> 'transcriptText'), '') is null then
    raise exception 'invited voice answer requires the exact current transcript draft'
      using errcode = '23514';
  end if;

  v_submitted_fingerprint := encode(digest(trim(new.answer_text), 'sha256'), 'hex');
  v_draft_fingerprint := encode(
    digest(trim(v_current_draft ->> 'transcriptText'), 'sha256'),
    'hex'
  );
  if v_draft_fingerprint is distinct from v_submitted_fingerprint then
    raise exception 'invited voice answer must match the current candidate-authorized transcript draft'
      using errcode = '23514';
  end if;

  if new.voice_transcript_edited is distinct from (v_submitted_fingerprint <> v_output_fingerprint) then
    raise exception 'invited voice transcript edit provenance must match the source fingerprint'
      using errcode = '23514';
  end if;

  if new.voice_submission_path = 'quick_submit'
     and v_submitted_fingerprint <> v_output_fingerprint then
    raise exception 'invited quick-submit transcript must match the completed transcription output'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_candidate_answer_attempt_voice_source
  on public.candidate_answer_attempts;
create trigger trg_candidate_answer_attempt_voice_source
before insert on public.candidate_answer_attempts
for each row execute function public.validate_candidate_answer_attempt_voice_source();

drop trigger if exists trg_invited_answer_attempt_voice_source
  on public.invited_practice_answer_attempts;
create trigger trg_invited_answer_attempt_voice_source
before insert on public.invited_practice_answer_attempts
for each row execute function public.validate_invited_answer_attempt_voice_source();

drop trigger if exists trg_candidate_voice_transcription_slot
  on public.candidate_voice_transcription_runs;
create trigger trg_candidate_voice_transcription_slot
before insert on public.candidate_voice_transcription_runs
for each row execute function public.validate_candidate_voice_transcription_slot();

drop trigger if exists trg_invited_voice_transcription_slot
  on public.invited_practice_voice_transcription_runs;
create trigger trg_invited_voice_transcription_slot
before insert on public.invited_practice_voice_transcription_runs
for each row execute function public.validate_invited_voice_transcription_slot();

comment on table public.candidate_voice_transcription_runs is
  'Candidate-owned voice transcription metadata. Raw audio and transcript text are intentionally absent.';

comment on table public.invited_practice_voice_transcription_runs is
  'Invite-recipient-owned voice transcription metadata. Raw audio and transcript text are intentionally absent.';

comment on column public.candidate_practice_sessions.voice_transcript_drafts_json is
  'Current per-slot recoverable transcript drafts; raw audio is never stored.';

comment on column public.invited_practice_sessions.voice_transcript_drafts_json is
  'Current per-slot recoverable transcript drafts; raw audio is never stored.';
