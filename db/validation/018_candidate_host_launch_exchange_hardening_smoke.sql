begin;

do $$
declare
  v_profile_id uuid := gen_random_uuid();
  v_first_session_id uuid;
  v_replayed_session_id uuid;
begin
  insert into public.candidate_profiles (
    candidate_profile_id,
    auth_subject,
    email,
    workspace
  ) values (
    v_profile_id,
    'host-launch-hardening-smoke:' || v_profile_id::text,
    'host-launch-hardening-smoke@talentarbor.local',
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
    'host-launch-hardening-smoke-jti',
    repeat('a', 64),
    now() + interval '2 minutes',
    '353373',
    null,
    'TA_DASHBOARD',
    '{"candidateId":"353373","jobCollectionId":null,"sourceSurface":"TA_DASHBOARD","hostDomain":null}'::jsonb,
    now() + interval '7 days'
  )
  returning candidate_launch_session_id into v_first_session_id;

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
    'host-launch-hardening-smoke-jti',
    repeat('a', 64),
    now() + interval '2 minutes',
    '353373',
    null,
    'TA_DASHBOARD',
    '{}'::jsonb,
    now() + interval '7 days'
  )
  on conflict do nothing
  returning candidate_launch_session_id into v_replayed_session_id;

  if v_first_session_id is null then
    raise exception 'Expected identity-only launch session to be created';
  end if;

  if v_replayed_session_id is not null then
    raise exception 'Expected replayed launch token to be rejected';
  end if;
end $$;

rollback;
