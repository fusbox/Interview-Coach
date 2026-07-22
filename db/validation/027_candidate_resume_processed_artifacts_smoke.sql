begin;

do $$
declare
  candidate_id uuid;
  artifact_id uuid;
  photo_artifact_id uuid;
  role_id uuid;
  session_id uuid;
  first_operation_id uuid := gen_random_uuid();
  replacement_operation_id uuid := gen_random_uuid();
  stale_update_count integer;
  selection_owner_key text;
begin
  select candidate_profile_id
  into candidate_id
  from public.candidate_profiles
  order by created_at
  limit 1;

  if candidate_id is null then
    raise exception 'candidate resume artifact smoke requires a candidate profile';
  end if;

  insert into public.candidate_resume_processed_artifacts (
    candidate_profile_id,
    version,
    source,
    candidate_label,
    normalized_text,
    source_fingerprint,
    normalized_text_fingerprint,
    processing_policy_version,
    pii_policy_version,
    pii_redaction_counts_json
  ) values (
    candidate_id,
    999,
    'document_upload',
    'resume.pdf',
    'Material handler with inventory and shipping experience.',
    repeat('a', 64),
    repeat('b', 64),
    'candidate_resume_text_processing_v1',
    'candidate_resume_direct_pii_v5',
    '{"email": 1}'::jsonb
  ) returning candidate_resume_artifact_id into artifact_id;

  update public.candidate_resume_processed_artifacts
  set review_state = 'accepted',
      review_revision = review_revision + 1,
      accepted_at = now(),
      updated_at = now()
  where candidate_resume_artifact_id = artifact_id
    and candidate_profile_id = candidate_id;

  if not exists (
    select 1
    from public.candidate_resume_processed_artifacts
    where candidate_resume_artifact_id = artifact_id
      and candidate_profile_id = candidate_id
      and review_state = 'accepted'
      and source = 'document_upload'
      and original_retained = false
  ) then
    raise exception 'candidate resume artifact acceptance smoke failed';
  end if;

  selection_owner_key := 'candidate:resume-selection-smoke:' || artifact_id::text;

  insert into public.candidate_setup_resume_selections (
    candidate_profile_id,
    setup_owner_key,
    pending_operation_id,
    lifecycle_state
  ) values (
    candidate_id,
    selection_owner_key,
    first_operation_id,
    'pending'
  );

  update public.candidate_setup_resume_selections
  set pending_operation_id = null,
      candidate_resume_artifact_id = artifact_id,
      lifecycle_state = 'active'
  where candidate_profile_id = candidate_id
    and setup_owner_key = selection_owner_key
    and pending_operation_id = first_operation_id
    and lifecycle_state = 'pending';

  if not exists (
    select 1
    from public.candidate_setup_resume_selections
    where candidate_profile_id = candidate_id
      and setup_owner_key = selection_owner_key
      and candidate_resume_artifact_id = artifact_id
      and lifecycle_state = 'active'
  ) then
    raise exception 'candidate setup resume selection activation smoke failed';
  end if;

  update public.candidate_setup_resume_selections
  set selection_revision = selection_revision + 1,
      pending_operation_id = replacement_operation_id,
      candidate_resume_artifact_id = null,
      lifecycle_state = 'pending'
  where candidate_profile_id = candidate_id
    and setup_owner_key = selection_owner_key;

  update public.candidate_setup_resume_selections
  set pending_operation_id = null,
      candidate_resume_artifact_id = artifact_id,
      lifecycle_state = 'active'
  where candidate_profile_id = candidate_id
    and setup_owner_key = selection_owner_key
    and pending_operation_id = first_operation_id
    and lifecycle_state = 'pending';

  get diagnostics stale_update_count = row_count;
  if stale_update_count <> 0 then
    raise exception 'superseded resume processing operation was allowed to become active';
  end if;

  update public.candidate_setup_resume_selections
  set pending_operation_id = null,
      candidate_resume_artifact_id = artifact_id,
      lifecycle_state = 'active'
  where candidate_profile_id = candidate_id
    and setup_owner_key = selection_owner_key
    and pending_operation_id = replacement_operation_id
    and lifecycle_state = 'pending';

  insert into public.candidate_role_preparation_profiles (
    candidate_profile_id,
    target_role,
    normalized_target_role,
    job_description_snapshot,
    job_description_hash,
    source,
    status
  ) values (
    candidate_id,
    'Resume selection smoke role',
    'resume selection smoke ' || artifact_id::text,
    'Validate exact resume selection consumption.',
    artifact_id::text,
    'dev_seed',
    'active'
  ) returning role_profile_id into role_id;

  insert into public.candidate_practice_sessions (
    candidate_profile_id,
    role_profile_id,
    status,
    setup_snapshot_json,
    question_plan_snapshot_json
  ) values (
    candidate_id,
    role_id,
    'planned',
    '{}'::jsonb,
    '{}'::jsonb
  ) returning candidate_practice_session_id into session_id;

  update public.candidate_setup_resume_selections
  set lifecycle_state = 'consumed',
      consumed_role_profile_id = role_id,
      consumed_candidate_practice_session_id = session_id,
      consumed_at = now()
  where candidate_profile_id = candidate_id
    and setup_owner_key = selection_owner_key
    and candidate_resume_artifact_id = artifact_id
    and lifecycle_state = 'active';

  if not exists (
    select 1
    from public.candidate_setup_resume_selections
    where candidate_profile_id = candidate_id
      and setup_owner_key = selection_owner_key
      and candidate_resume_artifact_id = artifact_id
      and lifecycle_state = 'consumed'
      and consumed_role_profile_id = role_id
      and consumed_candidate_practice_session_id = session_id
  ) then
    raise exception 'candidate setup resume selection consumption smoke failed';
  end if;

  insert into public.candidate_resume_processed_artifacts (
    candidate_profile_id,
    version,
    source,
    candidate_label,
    normalized_text,
    source_fingerprint,
    normalized_text_fingerprint,
    processing_policy_version,
    pii_policy_version,
    pii_redaction_counts_json
  ) values (
    candidate_id,
    1000,
    'photo_capture',
    '2 resume photos',
    'Material handler with inventory and shipping experience.',
    repeat('c', 64),
    repeat('d', 64),
    'candidate_resume_text_processing_v1',
    'candidate_resume_direct_pii_v5',
    '{"phone": 1}'::jsonb
  ) returning candidate_resume_artifact_id into photo_artifact_id;

  update public.candidate_resume_processed_artifacts
  set review_state = 'accepted',
      review_revision = review_revision + 1,
      accepted_at = now(),
      updated_at = now()
  where candidate_resume_artifact_id = photo_artifact_id
    and candidate_profile_id = candidate_id;

  if not exists (
    select 1
    from public.candidate_resume_processed_artifacts
    where candidate_resume_artifact_id = photo_artifact_id
      and candidate_profile_id = candidate_id
      and review_state = 'accepted'
      and source = 'photo_capture'
      and original_retained = false
  ) then
    raise exception 'candidate resume photo artifact acceptance smoke failed';
  end if;
end;
$$;

rollback;
