-- Rollback-only smoke for transcript-first candidate and invited voice persistence.

begin;

insert into public.candidate_profiles (
  candidate_profile_id, auth_subject, email, display_name, workspace
) values (
  'c1000000-0000-4000-8000-000000000001',
  'local_dev:voice-candidate@example.invalid',
  'voice-candidate@example.invalid',
  'Voice Candidate',
  'local_dev'
);

insert into public.candidate_practice_sessions (
  candidate_practice_session_id,
  candidate_profile_id,
  status,
  setup_snapshot_json,
  question_plan_snapshot_json,
  question_wording_snapshot_json,
  question_wording_status,
  progress_state_json
) values (
  'c2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'in_progress',
  '{"targetRole":"Quality Inspector","interviewStage":"screening","questionCount":1}'::jsonb,
  '{"interviewStage":"screening","questionCount":1,"slots":[{"id":"slot-1","index":0,"category":"screening"}]}'::jsonb,
  '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"Why are you interested?"}]}'::jsonb,
  'worded',
  '{"status":"active","currentQuestionIndex":0}'::jsonb
);

insert into public.candidate_voice_transcription_runs (
  candidate_voice_transcription_run_id,
  candidate_practice_session_id,
  candidate_profile_id,
  question_slot_id,
  question_index,
  idempotency_key_hash,
  audio_input_fingerprint,
  accepted_mime_type,
  audio_byte_count,
  audio_duration_ms,
  submission_path,
  provider,
  profile_id,
  model_name,
  configuration_fingerprint,
  generation_attempt,
  requested_at,
  claim_expires_at
) values (
  'c3000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'slot-1', 0, repeat('1', 64), repeat('2', 64), 'audio/webm', 2048, 5000, 'quick_submit',
  'fixture', 'fixture-transcription-v1', 'fixture-model', repeat('3', 64), 1,
  now(), now() + interval '60 seconds'
);

update public.candidate_voice_transcription_runs
set lifecycle_state = 'completed',
    output_fingerprint = encode(
      digest('I inspected each package against the documented standard.', 'sha256'),
      'hex'
    ),
    completed_at = now()
where candidate_voice_transcription_run_id = 'c3000000-0000-4000-8000-000000000001';

update public.candidate_practice_sessions
set voice_transcript_drafts_json = jsonb_build_object(
  'slot-1',
  jsonb_build_object(
    'status', 'voice_transcript_draft',
    'slotId', 'slot-1',
    'questionIndex', 0,
    'transcriptText', 'I inspected each package against the documented standard.',
    'sourceTranscriptionRunId', 'c3000000-0000-4000-8000-000000000001',
    'submissionPath', 'quick_submit',
    'updatedAt', now()
  )
)
where candidate_practice_session_id = 'c2000000-0000-4000-8000-000000000001';

insert into public.candidate_answer_attempts (
  candidate_answer_attempt_id,
  candidate_practice_session_id,
  candidate_profile_id,
  question_slot_id,
  question_index,
  attempt_number,
  trigger,
  mode,
  answer_text,
  submitted_at,
  idempotency_key,
  payload_fingerprint,
  source_candidate_voice_transcription_run_id,
  voice_submission_path,
  voice_transcript_edited
) values (
  'c4000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'slot-1', 0, 1, 'initial_submit', 'voice',
  'I inspected each package against the documented standard.', now(),
  'candidate-voice-submit', repeat('5', 64),
  'c3000000-0000-4000-8000-000000000001', 'quick_submit', false
);

insert into public.app_users (user_id, email, display_name, status) values (
  'c5000000-0000-4000-8000-000000000001',
  'voice-recruiter@example.invalid',
  'Voice Recruiter',
  'active'
);

insert into public.recruiter_invitation_batches (
  recruiter_invitation_batch_id,
  recruiter_id,
  lifecycle_state,
  target_role,
  interview_stage,
  recipient_count,
  question_plan_snapshot_json,
  question_wording_snapshot_json
) values (
  'c6000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001',
  'ready', 'Quality Inspector', 'screening', 1,
  '{"interviewStage":"screening","questionCount":1,"slots":[{"id":"slot-1","index":0,"category":"screening"}]}'::jsonb,
  '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"Why are you interested?"}]}'::jsonb
);

insert into public.recruiter_invitation_recipients (
  recruiter_invitation_recipient_id,
  recruiter_invitation_batch_id,
  recruiter_id,
  candidate_index,
  first_name,
  last_name,
  email,
  normalized_email
) values (
  'c7000000-0000-4000-8000-000000000001',
  'c6000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001',
  0, 'Invite', 'Candidate', 'voice-invite@example.invalid', 'voice-invite@example.invalid'
);

insert into public.invited_practice_sessions (
  invited_practice_session_id,
  recruiter_invitation_recipient_id,
  recruiter_id,
  status,
  setup_snapshot_json,
  question_plan_snapshot_json,
  question_wording_snapshot_json,
  progress_state_json
) values (
  'c8000000-0000-4000-8000-000000000001',
  'c7000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001',
  'in_progress',
  '{"targetRole":"Quality Inspector","interviewStage":"screening","questionCount":1}'::jsonb,
  '{"interviewStage":"screening","questionCount":1,"slots":[{"id":"slot-1","index":0,"category":"screening"}]}'::jsonb,
  '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"Why are you interested?"}]}'::jsonb,
  '{"status":"active","currentQuestionIndex":0}'::jsonb
);

insert into public.invited_practice_voice_transcription_runs (
  invited_practice_voice_transcription_run_id,
  invited_practice_session_id,
  recruiter_invitation_recipient_id,
  question_slot_id,
  question_index,
  idempotency_key_hash,
  audio_input_fingerprint,
  accepted_mime_type,
  audio_byte_count,
  submission_path,
  provider,
  profile_id,
  model_name,
  configuration_fingerprint,
  generation_attempt,
  requested_at,
  claim_expires_at
) values (
  'c9000000-0000-4000-8000-000000000001',
  'c8000000-0000-4000-8000-000000000001',
  'c7000000-0000-4000-8000-000000000001',
  'slot-1', 0, repeat('6', 64), repeat('7', 64), 'audio/webm', 3072, 'transcript_review',
  'fixture', 'fixture-transcription-v1', 'fixture-model', repeat('8', 64), 1,
  now(), now() + interval '60 seconds'
);

update public.invited_practice_voice_transcription_runs
set lifecycle_state = 'completed',
    output_fingerprint = encode(
      digest('Machine transcript before candidate correction.', 'sha256'),
      'hex'
    ),
    completed_at = now()
where invited_practice_voice_transcription_run_id = 'c9000000-0000-4000-8000-000000000001';

update public.invited_practice_sessions
set voice_transcript_drafts_json = jsonb_build_object(
  'slot-1',
  jsonb_build_object(
    'status', 'voice_transcript_draft',
    'slotId', 'slot-1',
    'questionIndex', 0,
    'transcriptText', 'I inspected each package against the documented standard.',
    'sourceTranscriptionRunId', 'c9000000-0000-4000-8000-000000000001',
    'submissionPath', 'transcript_review',
    'updatedAt', now()
  )
)
where invited_practice_session_id = 'c8000000-0000-4000-8000-000000000001';

insert into public.invited_practice_answer_attempts (
  invited_practice_answer_attempt_id,
  invited_practice_session_id,
  recruiter_invitation_recipient_id,
  question_slot_id,
  question_index,
  attempt_number,
  trigger,
  mode,
  answer_text,
  submitted_at,
  idempotency_key,
  payload_fingerprint,
  source_invited_voice_transcription_run_id,
  voice_submission_path,
  voice_transcript_edited
) values (
  'ca000000-0000-4000-8000-000000000001',
  'c8000000-0000-4000-8000-000000000001',
  'c7000000-0000-4000-8000-000000000001',
  'slot-1', 0, 1, 'initial_submit', 'voice',
  'I inspected each package against the documented standard.', now(),
  'invited-voice-submit', repeat('a', 64),
  'c9000000-0000-4000-8000-000000000001', 'transcript_review', true
);

do $$
declare
  v_forbidden_columns integer;
begin
  select count(*) into v_forbidden_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('candidate_voice_transcription_runs', 'invited_practice_voice_transcription_runs')
    and column_name in ('raw_audio', 'audio_bytes', 'transcript_text', 'transcript_json');
  if v_forbidden_columns <> 0 then
    raise exception 'voice run tables contain forbidden raw audio or transcript columns';
  end if;

  begin
    update public.candidate_voice_transcription_runs
    set model_name = 'mutated-model'
    where candidate_voice_transcription_run_id = 'c3000000-0000-4000-8000-000000000001';
    raise exception 'expected terminal candidate transcription mutation to fail';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    insert into public.candidate_answer_attempts (
      candidate_practice_session_id,
      candidate_profile_id,
      question_slot_id,
      question_index,
      attempt_number,
      trigger,
      mode,
      answer_text,
      submitted_at,
      idempotency_key,
      payload_fingerprint
    ) values (
      'c2000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'slot-2', 0, 1, 'initial_submit', 'voice', 'Missing source', now(),
      'missing-source', repeat('b', 64)
    );
    raise exception 'expected voice answer without source lineage to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.candidate_answer_attempts (
      candidate_practice_session_id,
      candidate_profile_id,
      question_slot_id,
      question_index,
      attempt_number,
      trigger,
      mode,
      answer_text,
      submitted_at,
      idempotency_key,
      payload_fingerprint,
      source_candidate_voice_transcription_run_id,
      voice_submission_path,
      voice_transcript_edited
    ) values (
      'c2000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'slot-2', 0, 1, 'initial_submit', 'text', 'Typed answer', now(),
      'typed-with-voice-source', repeat('c', 64),
      'c3000000-0000-4000-8000-000000000001', 'quick_submit', false
    );
    raise exception 'expected typed answer with voice source lineage to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.candidate_answer_attempts (
      candidate_practice_session_id,
      candidate_profile_id,
      question_slot_id,
      question_index,
      attempt_number,
      trigger,
      mode,
      answer_text,
      submitted_at,
      idempotency_key,
      payload_fingerprint,
      source_candidate_voice_transcription_run_id,
      voice_submission_path,
      voice_transcript_edited
    ) values (
      'c2000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'slot-1', 0, 2, 'retry_after_feedback', 'voice',
      'A stale tab changed this transcript without updating the current draft.', now(),
      'candidate-stale-voice-submit', repeat('d', 64),
      'c3000000-0000-4000-8000-000000000001', 'transcript_review', true
    );
    raise exception 'expected voice answer that differs from the current draft to fail';
  exception
    when check_violation then null;
  end;
end;
$$;

rollback;
