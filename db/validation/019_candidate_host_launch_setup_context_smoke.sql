begin;

do $$
declare
  v_profile_id uuid := gen_random_uuid();
  v_launch_session_id uuid;
  v_role_profile_id uuid;
  v_duplicate_role_profile_id uuid;
  v_practice_session_id uuid;
  v_setup_context_count integer;
  v_consumed_at timestamptz;
begin
  insert into public.candidate_profiles (
    candidate_profile_id,
    auth_subject,
    email,
    workspace
  ) values (
    v_profile_id,
    'host-setup-context-smoke:' || v_profile_id::text,
    'host-setup-context-smoke@talentarbor.local',
    'talentarbor'
  );

  insert into public.candidate_launch_sessions (
    candidate_profile_id,
    provider,
    issuer,
    subject,
    launch_token_id,
    launch_token_fingerprint,
    launch_token_expires_at,
    platform_candidate_id,
    job_collection_id,
    source_surface,
    launch_context_snapshot_json,
    expires_at
  ) values (
    v_profile_id,
    'talentarbor_launch',
    'talentarbor',
    'candidate:353373',
    'host-setup-context-smoke-jti',
    repeat('b', 64),
    now() + interval '2 minutes',
    '353373',
    '555',
    'TA_JOB_SEARCH',
    '{"candidateId":"353373","jobCollectionId":"555","sourceSurface":"TA_JOB_SEARCH","hostDomain":null}'::jsonb,
    now() + interval '7 days'
  )
  returning candidate_launch_session_id into v_launch_session_id;

  insert into public.candidate_launch_setup_contexts (
    candidate_launch_session_id,
    candidate_profile_id,
    source_platform,
    job_collection_id,
    requirement_id,
    target_role,
    job_description_snapshot,
    job_description_hash,
    expires_at
  ) values (
    v_launch_session_id,
    v_profile_id,
    'talentarbor',
    '555',
    '777',
    'Warehouse Associate',
    'Pick, pack, and prepare shipments safely.',
    encode(digest('Pick, pack, and prepare shipments safely.', 'sha256'), 'hex'),
    now() + interval '7 days'
  );

  insert into public.candidate_role_preparation_profiles (
    candidate_profile_id,
    target_role,
    normalized_target_role,
    job_description_snapshot,
    job_description_hash,
    source,
    source_platform,
    source_job_collection_id,
    source_requirement_id,
    source_launch_session_id,
    practice_path_number
  ) values (
    v_profile_id,
    'Warehouse Associate',
    'warehouse associate',
    'Pick, pack, and prepare shipments safely.',
    encode(digest('Pick, pack, and prepare shipments safely.', 'sha256'), 'hex'),
    'host_platform',
    'talentarbor',
    '555',
    '777',
    v_launch_session_id,
    1
  )
  returning role_profile_id into v_role_profile_id;

  insert into public.candidate_role_preparation_profiles (
    candidate_profile_id,
    target_role,
    normalized_target_role,
    job_description_snapshot,
    job_description_hash,
    source,
    source_platform,
    source_job_collection_id,
    practice_path_number
  ) values (
    v_profile_id,
    'A renamed but identical host job',
    'a renamed but identical host job',
    'Different text cannot change the host identity.',
    encode(digest('Different text cannot change the host identity.', 'sha256'), 'hex'),
    'host_platform',
    'talentarbor',
    '555',
    1
  )
  on conflict do nothing
  returning role_profile_id into v_duplicate_role_profile_id;

  if v_role_profile_id is null then
    raise exception 'Expected a host-backed prep context';
  end if;

  if v_duplicate_role_profile_id is not null then
    raise exception 'Expected host job identity to reject a duplicate path';
  end if;

  with consumed_setup_context as (
    delete from public.candidate_launch_setup_contexts setup
    using public.candidate_launch_sessions launch
    where setup.candidate_launch_session_id = v_launch_session_id
      and setup.candidate_profile_id = v_profile_id
      and setup.expires_at > now()
      and launch.candidate_launch_session_id = setup.candidate_launch_session_id
      and launch.candidate_profile_id = setup.candidate_profile_id
      and launch.revoked_at is null
      and launch.expires_at > now()
      and launch.setup_context_consumed_at is null
    returning setup.candidate_launch_session_id
  ), consumed_launch_session as (
    update public.candidate_launch_sessions launch
    set setup_context_consumed_at = now()
    where launch.candidate_launch_session_id = v_launch_session_id
      and launch.candidate_profile_id = v_profile_id
      and launch.setup_context_consumed_at is null
      and exists (select 1 from consumed_setup_context)
    returning launch.candidate_launch_session_id
  ), inserted_practice_session as (
    insert into public.candidate_practice_sessions (
      candidate_profile_id,
      role_profile_id,
      candidate_launch_session_id,
      status,
      setup_snapshot_json,
      question_plan_snapshot_json
    )
    select
      v_profile_id,
      v_role_profile_id,
      v_launch_session_id,
      'planned',
      '{"targetRole":"Warehouse Associate"}'::jsonb,
      '{"status":"questions_planned","slots":[]}'::jsonb
    where exists (select 1 from consumed_launch_session)
    returning candidate_practice_session_id
  )
  select candidate_practice_session_id
  into v_practice_session_id
  from inserted_practice_session;

  select count(*)
  into v_setup_context_count
  from public.candidate_launch_setup_contexts
  where candidate_launch_session_id = v_launch_session_id;

  select setup_context_consumed_at
  into v_consumed_at
  from public.candidate_launch_sessions
  where candidate_launch_session_id = v_launch_session_id;

  if v_practice_session_id is null or v_setup_context_count <> 0 or v_consumed_at is null then
    raise exception 'Expected setup consume and practice-session creation to succeed atomically';
  end if;
end $$;

rollback;
