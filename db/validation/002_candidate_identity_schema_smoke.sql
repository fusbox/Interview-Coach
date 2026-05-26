-- Rollback-only smoke validation for db/migrations/002_candidate_identity_schema.sql.
-- Run against a disposable database after applying 001_initial_schema.sql and 002_candidate_identity_schema.sql.

begin;

insert into public.candidate_profiles (
  candidate_profile_id,
  auth_subject,
  email,
  display_name,
  workspace
)
values (
  '44444444-4444-4444-8444-444444444444',
  'local_dev:dev-candidate@example.invalid',
  'dev-candidate@example.invalid',
  'Dev Candidate',
  'local_dev'
);

insert into public.candidate_identities (
  candidate_identity_id,
  candidate_profile_id,
  provider,
  issuer,
  subject,
  email,
  last_seen_at
)
values (
  '55555555-5555-4555-8555-555555555555',
  '44444444-4444-4444-8444-444444444444',
  'dev_mock',
  'interview-coach-local',
  'dev-candidate@example.invalid',
  'dev-candidate@example.invalid',
  now()
);

do $$
declare
  v_profile_count integer;
  v_identity_count integer;
begin
  select count(*) into v_profile_count
  from public.candidate_profiles
  where candidate_profile_id = '44444444-4444-4444-8444-444444444444';

  select count(*) into v_identity_count
  from public.candidate_identities
  where candidate_profile_id = '44444444-4444-4444-8444-444444444444'
    and provider = 'dev_mock'
    and issuer = 'interview-coach-local'
    and subject = 'dev-candidate@example.invalid';

  if v_profile_count <> 1 then
    raise exception 'expected 1 candidate profile, found %', v_profile_count;
  end if;

  if v_identity_count <> 1 then
    raise exception 'expected 1 candidate identity, found %', v_identity_count;
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
    '44444444-4444-4444-8444-444444444444',
    'dev_mock',
    'interview-coach-local',
    'dev-candidate@example.invalid'
  );

  raise exception 'expected duplicate candidate identity to fail';
exception
  when unique_violation then null;
end;
$$;

rollback;
