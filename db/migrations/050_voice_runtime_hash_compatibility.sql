begin;

-- pgcrypto is installed in public by ordinary local PostgreSQL images and in
-- extensions by Supabase. Keep that provider-specific schema out of the
-- application role's search path and expose only the SHA-256 operation the
-- voice-source invariant requires.
create or replace function public.interview_coach_sha256_text(value text)
returns text
language plpgsql
stable
strict
parallel safe
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_extension_schema text;
  v_hash text;
begin
  select namespace.nspname
  into v_extension_schema
  from pg_catalog.pg_extension extension
  join pg_catalog.pg_namespace namespace
    on namespace.oid = extension.extnamespace
  where extension.extname = 'pgcrypto';

  if v_extension_schema is null then
    raise exception 'pgcrypto extension is required for answer fingerprinting'
      using errcode = '55000';
  end if;

  execute format(
    'select pg_catalog.encode(%I.digest($1, $2), $3)',
    v_extension_schema
  )
  into v_hash
  using value, 'sha256', 'hex';

  return v_hash;
end;
$$;

revoke all privileges
  on function public.interview_coach_sha256_text(text)
  from public;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'interview_coach_runtime'
  ) then
    execute 'grant execute on function public.interview_coach_sha256_text(text) '
      || 'to interview_coach_runtime';
  end if;
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

  v_submitted_fingerprint := public.interview_coach_sha256_text(trim(new.answer_text));
  v_draft_fingerprint := public.interview_coach_sha256_text(
    trim(v_current_draft ->> 'transcriptText')
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

  v_submitted_fingerprint := public.interview_coach_sha256_text(trim(new.answer_text));
  v_draft_fingerprint := public.interview_coach_sha256_text(
    trim(v_current_draft ->> 'transcriptText')
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

commit;
