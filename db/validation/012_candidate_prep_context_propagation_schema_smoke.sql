-- Rollback-only smoke validation for db/migrations/010_candidate_prep_context_propagation_schema.sql.

begin;

insert into public.candidate_profiles (
  candidate_profile_id, auth_subject, email, display_name, workspace
)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    'local_dev:prep-context-owner@example.invalid',
    'prep-context-owner@example.invalid',
    'Prep Context Owner',
    'local_dev'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'local_dev:prep-context-other@example.invalid',
    'prep-context-other@example.invalid',
    'Prep Context Other',
    'local_dev'
  );

insert into public.candidate_role_preparation_profiles (
  role_profile_id, candidate_profile_id, target_role, normalized_target_role,
  job_description_snapshot, job_description_hash, source
)
values (
  'b2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'Material Handler',
  'material handler',
  'Move materials safely.',
  'prep-context-hash',
  'manual'
);

insert into public.candidate_practice_intents (
  candidate_practice_intent_id, candidate_profile_id, role_profile_id,
  source, lifecycle_state, target_interview_id, target_role,
  setup_context_json, items_json
)
values (
  'b3000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'practice_builder',
  'ready',
  'material handler',
  'Material Handler',
  '{"targetRole":"Material Handler","jobDescription":"Move materials safely.","interviewStage":"first_interview","questionCount":1,"resumeIncluded":false}'::jsonb,
  '[{"kind":"practice_missing_evidence","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"source-session","questionKey":"slot-1","targetInterviewId":"material handler","targetRole":"Material Handler","questionNumber":1,"category":"Screening","questionText":"What interests you about this role?","evidenceStatus":"missing_practice_evidence"},"display":{"label":"Practice missing evidence","body":"Practice this question."}}]'::jsonb
);

do $$
begin
  insert into public.candidate_practice_intents (
    candidate_profile_id, role_profile_id, source, lifecycle_state,
    target_interview_id, target_role, setup_context_json, items_json
  ) values (
    'b1000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001',
    'practice_builder', 'ready', 'material handler', 'Material Handler',
    '{"targetRole":"Material Handler"}'::jsonb,
    '[{"kind":"practice_missing_evidence"}]'::jsonb
  );

  raise exception 'expected cross-candidate prep context ownership to fail';
exception
  when foreign_key_violation then null;
end;
$$;

rollback;
