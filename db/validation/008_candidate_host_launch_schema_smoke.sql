-- Rollback-only smoke validation for db/migrations/006_candidate_host_launch_schema.sql.
-- Run against a disposable database after applying candidate identity and host-launch migrations.

begin;

insert into public.candidate_profiles (
  candidate_profile_id,
  auth_subject,
  email,
  display_name,
  workspace
)
values (
  '12121212-1212-4121-8121-121212121212',
  'talentarbor:candidate:12345',
  'launch-candidate@example.invalid',
  'Launch Candidate',
  'talentarbor'
);

insert into public.candidate_identities (
  candidate_identity_id,
  candidate_profile_id,
  provider,
  issuer,
  subject,
  email,
  host_candidate_id,
  host_user_id,
  platform_candidate_id,
  workspace,
  last_seen_at
)
values (
  '23232323-2323-4232-8232-232323232323',
  '12121212-1212-4121-8121-121212121212',
  'talentarbor_launch',
  'talentarbor',
  'candidate:12345',
  'launch-candidate@example.invalid',
  '12345',
  '67890',
  '12345',
  'talentarbor',
  now()
);

insert into public.candidate_launch_sessions (
  candidate_launch_session_id,
  candidate_profile_id,
  provider,
  issuer,
  subject,
  platform_candidate_id,
  job_collection_id,
  source_surface,
  host_domain,
  launch_context_snapshot_json,
  expires_at
)
values (
  '34343434-3434-4343-8343-343434343434',
  '12121212-1212-4121-8121-121212121212',
  'talentarbor_launch',
  'talentarbor',
  'candidate:12345',
  '12345',
  '555',
  'TA_JOB_SEARCH',
  'talentarbor.com',
  '{"candidateId":"12345","jobCollectionId":"555","sourceSurface":"TA_JOB_SEARCH","hostDomain":"talentarbor.com"}'::jsonb,
  now() + interval '7 days'
);

do $$
declare
  v_launch_count integer;
begin
  select count(*) into v_launch_count
  from public.candidate_launch_sessions session
  join public.candidate_identities identity
    on identity.candidate_profile_id = session.candidate_profile_id
   and identity.provider = session.provider
   and identity.issuer = session.issuer
   and identity.subject = session.subject
   and identity.platform_candidate_id = session.platform_candidate_id
  where session.candidate_launch_session_id = '34343434-3434-4343-8343-343434343434'
    and session.job_collection_id = '555'
    and session.launch_context_snapshot_json ->> 'sourceSurface' = 'TA_JOB_SEARCH';

  if v_launch_count <> 1 then
    raise exception 'expected 1 traceable launch session, found %', v_launch_count;
  end if;
end;
$$;

do $$
begin
  insert into public.candidate_identities (
    candidate_profile_id,
    provider,
    issuer,
    subject
  )
  values (
    '12121212-1212-4121-8121-121212121212',
    'unknown_launch',
    'talentarbor',
    'candidate:12345'
  );

  raise exception 'expected unknown launch provider to fail';
exception
  when check_violation then null;
end;
$$;

rollback;
