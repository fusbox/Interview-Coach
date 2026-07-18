-- Rollback-only smoke for candidate setup-start request claims and atomic completion.

begin;

do $$
declare
  v_profile_id uuid := gen_random_uuid();
  v_launch_session_id uuid;
  v_role_profile_id uuid;
  v_practice_session_id uuid;
  v_claim_id uuid;
  v_session_count integer;
  v_setup_context_count integer;
  v_claim_state text;
  v_claim_session_id uuid;
begin
  insert into public.candidate_profiles (
    candidate_profile_id, auth_subject, email, workspace
  ) values (
    v_profile_id,
    'setup-start-idempotency-smoke:' || v_profile_id::text,
    'setup-start-idempotency-smoke@talentarbor.local',
    'talentarbor'
  );

  insert into public.candidate_launch_sessions (
    candidate_profile_id, provider, issuer, subject, launch_token_id,
    launch_token_fingerprint, launch_token_expires_at, platform_candidate_id,
    job_collection_id, source_surface, launch_context_snapshot_json, expires_at
  ) values (
    v_profile_id, 'talentarbor_launch', 'talentarbor', 'candidate:353373',
    'setup-start-idempotency-smoke-jti-' || v_profile_id::text,
    encode(digest(v_profile_id::text, 'sha256'), 'hex'),
    now() + interval '2 minutes', '353373', '555', 'TA_JOB_SEARCH',
    '{"candidateId":"353373","jobCollectionId":"555","sourceSurface":"TA_JOB_SEARCH","hostDomain":null}'::jsonb,
    now() + interval '7 days'
  ) returning candidate_launch_session_id into v_launch_session_id;

  insert into public.candidate_launch_setup_contexts (
    candidate_launch_session_id, candidate_profile_id, source_platform,
    job_collection_id, requirement_id, target_role,
    job_description_snapshot, job_description_hash, expires_at
  ) values (
    v_launch_session_id, v_profile_id, 'talentarbor', '555', '777',
    'Warehouse Associate', 'Pick, pack, and prepare shipments safely.',
    encode(digest('Pick, pack, and prepare shipments safely.', 'sha256'), 'hex'),
    now() + interval '7 days'
  );

  insert into public.candidate_role_preparation_profiles (
    candidate_profile_id, target_role, normalized_target_role,
    job_description_snapshot, job_description_hash, source,
    source_platform, source_job_collection_id, source_requirement_id,
    source_launch_session_id, practice_path_number
  ) values (
    v_profile_id, 'Warehouse Associate', 'warehouse associate',
    'Pick, pack, and prepare shipments safely.',
    encode(digest('Pick, pack, and prepare shipments safely.', 'sha256'), 'hex'),
    'host_platform', 'talentarbor', '555', '777', v_launch_session_id, 1
  ) returning role_profile_id into v_role_profile_id;

  insert into public.candidate_setup_start_requests (
    candidate_profile_id, idempotency_key_hash, request_fingerprint,
    lifecycle_state, claim_generation, claim_expires_at, expires_at
  ) values (
    v_profile_id, repeat('a', 64), repeat('b', 64),
    'pending', 1, now() + interval '60 seconds', now() + interval '24 hours'
  ) returning candidate_setup_start_request_id into v_claim_id;

  -- Provider failure leaves staging/session untouched and makes the same request retryable.
  update public.candidate_setup_start_requests
  set lifecycle_state = 'failed',
      claim_expires_at = now(),
      failed_at = now(),
      last_error_code = 'QUESTION_WORDING_PROVIDER_TIMEOUT'
  where candidate_setup_start_request_id = v_claim_id
    and claim_generation = 1;

  update public.candidate_setup_start_requests
  set lifecycle_state = 'pending',
      claim_generation = claim_generation + 1,
      claim_expires_at = now() + interval '60 seconds',
      expires_at = now() + interval '24 hours',
      failed_at = null,
      last_error_code = null
  where candidate_setup_start_request_id = v_claim_id
    and lifecycle_state = 'failed';

  -- The stale first generation cannot consume staging or create a session.
  with eligible_claim as materialized (
    select candidate_setup_start_request_id
    from public.candidate_setup_start_requests
    where candidate_setup_start_request_id = v_claim_id
      and claim_generation = 1
      and lifecycle_state = 'pending'
      and claim_expires_at > now()
    for update
  ), consumed_setup as (
    delete from public.candidate_launch_setup_contexts
    where candidate_launch_session_id = v_launch_session_id
      and exists (select 1 from eligible_claim)
    returning candidate_launch_session_id
  ), inserted_session as (
    insert into public.candidate_practice_sessions (
      candidate_profile_id, role_profile_id, candidate_launch_session_id,
      status, setup_snapshot_json, question_plan_snapshot_json
    )
    select v_profile_id, v_role_profile_id, v_launch_session_id, 'planned',
      '{"targetRole":"Warehouse Associate"}'::jsonb,
      '{"status":"questions_planned","slots":[]}'::jsonb
    where exists (select 1 from eligible_claim)
      and exists (select 1 from consumed_setup)
    returning candidate_practice_session_id
  )
  select candidate_practice_session_id
  into v_practice_session_id
  from inserted_session;

  if v_practice_session_id is not null then
    raise exception 'stale setup-start generation created a session';
  end if;

  select count(*) into v_setup_context_count
  from public.candidate_launch_setup_contexts
  where candidate_launch_session_id = v_launch_session_id;
  if v_setup_context_count <> 1 then
    raise exception 'stale setup-start generation consumed trusted staging';
  end if;

  -- The current generation atomically consumes staging, creates one session, and completes the claim.
  with eligible_claim as materialized (
    select candidate_setup_start_request_id
    from public.candidate_setup_start_requests
    where candidate_setup_start_request_id = v_claim_id
      and claim_generation = 2
      and lifecycle_state = 'pending'
      and claim_expires_at > now()
      and expires_at > now()
    for update
  ), consumed_setup as (
    delete from public.candidate_launch_setup_contexts setup
    using public.candidate_launch_sessions launch
    where setup.candidate_launch_session_id = v_launch_session_id
      and setup.candidate_profile_id = v_profile_id
      and launch.candidate_launch_session_id = setup.candidate_launch_session_id
      and launch.candidate_profile_id = setup.candidate_profile_id
      and launch.revoked_at is null
      and launch.expires_at > now()
      and launch.setup_context_consumed_at is null
      and exists (select 1 from eligible_claim)
    returning setup.candidate_launch_session_id
  ), consumed_launch as (
    update public.candidate_launch_sessions launch
    set setup_context_consumed_at = now()
    where launch.candidate_launch_session_id = v_launch_session_id
      and launch.candidate_profile_id = v_profile_id
      and exists (select 1 from consumed_setup)
    returning launch.candidate_launch_session_id
  ), inserted_session as (
    insert into public.candidate_practice_sessions (
      candidate_profile_id, role_profile_id, candidate_launch_session_id,
      status, setup_snapshot_json, question_plan_snapshot_json
    )
    select v_profile_id, v_role_profile_id, v_launch_session_id, 'planned',
      '{"targetRole":"Warehouse Associate"}'::jsonb,
      '{"status":"questions_planned","slots":[]}'::jsonb
    where exists (select 1 from eligible_claim)
      and exists (select 1 from consumed_launch)
    returning candidate_practice_session_id
  ), completed_claim as (
    update public.candidate_setup_start_requests request
    set lifecycle_state = 'completed',
        candidate_practice_session_id = inserted.candidate_practice_session_id,
        completed_at = now()
    from inserted_session inserted
    where request.candidate_setup_start_request_id = v_claim_id
      and request.claim_generation = 2
    returning request.candidate_practice_session_id
  )
  select candidate_practice_session_id
  into v_practice_session_id
  from completed_claim;

  select count(*) into v_session_count
  from public.candidate_practice_sessions
  where candidate_profile_id = v_profile_id;

  select lifecycle_state, candidate_practice_session_id
  into v_claim_state, v_claim_session_id
  from public.candidate_setup_start_requests
  where candidate_setup_start_request_id = v_claim_id;

  select count(*) into v_setup_context_count
  from public.candidate_launch_setup_contexts
  where candidate_launch_session_id = v_launch_session_id;

  if v_practice_session_id is null
     or v_session_count <> 1
     or v_claim_state <> 'completed'
     or v_claim_session_id <> v_practice_session_id
     or v_setup_context_count <> 0 then
    raise exception 'current setup-start generation did not complete atomically';
  end if;

  begin
    insert into public.candidate_setup_start_requests (
      candidate_profile_id, idempotency_key_hash, request_fingerprint,
      claim_expires_at, expires_at
    ) values (
      v_profile_id, repeat('a', 64), repeat('c', 64),
      now() + interval '60 seconds', now() + interval '24 hours'
    );
    raise exception 'duplicate candidate setup-start key was accepted';
  exception
    when unique_violation then null;
  end;
end $$;

rollback;
