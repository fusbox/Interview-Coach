-- Rollback-only smoke validation for db/migrations/003_candidate_practice_drafts_schema.sql.
-- Run against a disposable database after applying 001_initial_schema.sql, 002_candidate_identity_schema.sql,
-- and 003_candidate_practice_drafts_schema.sql.

begin;

insert into public.candidate_profiles (
  candidate_profile_id,
  auth_subject,
  email,
  display_name,
  workspace
)
values (
  '66666666-6666-4666-8666-666666666666',
  'local_dev:draft-candidate@example.invalid',
  'draft-candidate@example.invalid',
  'Draft Candidate',
  'local_dev'
);

insert into public.candidate_practice_drafts (
  practice_draft_id,
  candidate_profile_id,
  target_role,
  job_description,
  resume_context_json
)
values (
  '77777777-7777-4777-8777-777777777777',
  '66666666-6666-4666-8666-666666666666',
  'QA analyst',
  'Test regulated workflows.',
  '{"pastedText":"Validated releases.","extractedText":"Validated releases.","captureMode":"pasted_text"}'::jsonb
);

do $$
declare
  v_draft_count integer;
begin
  select count(*) into v_draft_count
  from public.candidate_practice_drafts
  where practice_draft_id = '77777777-7777-4777-8777-777777777777'
    and candidate_profile_id = '66666666-6666-4666-8666-666666666666'
    and status = 'draft'
    and resume_target_screen = 'practice_setup';

  if v_draft_count <> 1 then
    raise exception 'expected 1 candidate practice draft, found %', v_draft_count;
  end if;
end;
$$;

do $$
begin
  insert into public.candidate_practice_drafts (
    candidate_profile_id,
    status,
    target_role
  )
  values (
    '66666666-6666-4666-8666-666666666666',
    'invalid_status',
    'QA analyst'
  );

  raise exception 'expected invalid draft status to fail';
exception
  when check_violation then null;
end;
$$;

rollback;
