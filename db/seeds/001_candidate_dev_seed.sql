-- Candidate app local development seed data.
-- Applies after:
--   npm run db:apply-schema
--   npm run db:apply-candidate-schema
--   npm run db:apply-candidate-drafts-schema
--
-- Suggested local env for the primary seeded candidate:
--   CANDIDATE_AUTH_MODE=password
--   CANDIDATE_DEV_EMAIL=candidate-dev-primary@talentarbor.local
--   CANDIDATE_DEV_ISSUER=interview-coach-local
--   CANDIDATE_DEV_SUBJECT=candidate-dev-primary@talentarbor.local
--   CANDIDATE_DEV_DISPLAY_NAME=Dev Candidate Primary
--
-- Alternate ownership-check candidate:
--   CANDIDATE_DEV_EMAIL=candidate-dev-alt@talentarbor.local

begin;

-- Clean up local-only mock profiles that may have been created by older smoke
-- runs before the dev_mock identity was tied back to the primary seeded profile.
delete from public.candidate_identities
where candidate_profile_id in (
  select candidate_profile_id
  from public.candidate_profiles
  where auth_subject = 'dev_mock:interview-coach-local:candidate-dev-primary@talentarbor.local'
    and workspace = 'local_dev'
);

delete from public.candidate_profiles
where auth_subject = 'dev_mock:interview-coach-local:candidate-dev-primary@talentarbor.local'
  and workspace = 'local_dev';

insert into public.candidate_profiles (
  candidate_profile_id,
  auth_subject,
  email,
  display_name,
  workspace,
  status
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'password:interview-coach-local:candidate-dev-primary@talentarbor.local',
    'candidate-dev-primary@talentarbor.local',
    'Dev Candidate Primary',
    'local_dev',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'password:interview-coach-local:candidate-dev-alt@talentarbor.local',
    'candidate-dev-alt@talentarbor.local',
    'Dev Candidate Alternate',
    'local_dev',
    'active'
  )
on conflict (auth_subject)
do update set
  email = excluded.email,
  display_name = excluded.display_name,
  workspace = excluded.workspace,
  status = excluded.status;

insert into public.candidate_identities (
  candidate_identity_id,
  candidate_profile_id,
  provider,
  issuer,
  subject,
  email,
  last_seen_at
)
values
  (
    '11000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'password',
    'interview-coach-local',
    'candidate-dev-primary@talentarbor.local',
    'candidate-dev-primary@talentarbor.local',
    now()
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'dev_mock',
    'interview-coach-local',
    'candidate-dev-primary@talentarbor.local',
    'candidate-dev-primary@talentarbor.local',
    now()
  ),
  (
    '11000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    'password',
    'interview-coach-local',
    'candidate-dev-alt@talentarbor.local',
    'candidate-dev-alt@talentarbor.local',
    now()
  )
on conflict (provider, issuer, subject)
do update set
  candidate_profile_id = excluded.candidate_profile_id,
  email = excluded.email,
  last_seen_at = now();

insert into public.sessions (
  session_id,
  recruiter_id,
  status,
  current_question_index,
  target_role,
  job_description,
  intake_json,
  client_name,
  summary_narrative
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    null,
    'IN_SESSION',
    1,
    'Customer Success Manager',
    'Support strategic customers, resolve escalations, and guide adoption.',
    '{"candidate":{"fullName":"Dev Candidate Primary","email":"candidate-dev-primary@talentarbor.local","resumeText":"Customer success leader with SaaS onboarding and renewal experience."}}'::jsonb,
    'Dev Candidate Primary',
    null
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    null,
    'COMPLETED',
    2,
    'Product Operations Analyst',
    'Coordinate product workflows, analyze launches, and improve operating rhythm.',
    '{"candidate":{"fullName":"Dev Candidate Primary","email":"candidate-dev-primary@talentarbor.local","resumeText":"Operations analyst with launch coordination and analytics experience."}}'::jsonb,
    'Dev Candidate Primary',
    'You gave concrete examples and should keep tightening the result portion of each answer.'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    null,
    'IN_SESSION',
    0,
    'Technical Support Specialist',
    'Troubleshoot customer issues and communicate clearly across teams.',
    '{"candidate":{"fullName":"Dev Candidate Alternate","email":"candidate-dev-alt@talentarbor.local","resumeText":"Support specialist with queue management experience."}}'::jsonb,
    'Dev Candidate Alternate',
    null
  )
on conflict (session_id)
do update set
  status = excluded.status,
  current_question_index = excluded.current_question_index,
  target_role = excluded.target_role,
  job_description = excluded.job_description,
  intake_json = excluded.intake_json,
  client_name = excluded.client_name,
  summary_narrative = excluded.summary_narrative;

insert into public.questions (
  question_id,
  session_id,
  question_index,
  question_text,
  competencies,
  scoring_dimensions,
  category
)
values
  (
    '21000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    0,
    'Tell me about a time you improved a customer onboarding process.',
    '["customer_empathy","process_improvement"]'::jsonb,
    '["situation","action","result"]'::jsonb,
    'Behavioral'
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    1,
    'How would you handle a frustrated stakeholder asking for a feature your team cannot prioritize?',
    '["communication","prioritization"]'::jsonb,
    '["clarity","judgment","empathy"]'::jsonb,
    'Scenario'
  ),
  (
    '21000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    0,
    'Describe a launch risk you identified early and how you handled it.',
    '["risk_management","collaboration"]'::jsonb,
    '["context","action","impact"]'::jsonb,
    'Behavioral'
  ),
  (
    '21000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002',
    1,
    'How do you decide which operating metric deserves attention first?',
    '["analytics","prioritization"]'::jsonb,
    '["reasoning","tradeoffs","next_steps"]'::jsonb,
    'Technical'
  ),
  (
    '21000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000003',
    0,
    'Walk me through how you troubleshoot an unclear customer issue.',
    '["troubleshooting","communication"]'::jsonb,
    '["structure","clarity","follow_up"]'::jsonb,
    'Scenario'
  )
on conflict (session_id, question_index)
do update set
  question_text = excluded.question_text,
  competencies = excluded.competencies,
  scoring_dimensions = excluded.scoring_dimensions,
  category = excluded.category;

insert into public.answers (
  answer_id,
  session_id,
  question_id,
  attempt_number,
  modality,
  final_text,
  submitted_at
)
values
  (
    '22000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000003',
    1,
    'text',
    'I noticed launch dependencies were not visible, created a shared checklist, and reduced last-minute escalations.',
    now() - interval '2 days'
  ),
  (
    '22000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000004',
    1,
    'text',
    'I compare customer impact, delivery risk, and available evidence, then choose the metric most tied to the current goal.',
    now() - interval '2 days'
  )
on conflict (question_id, attempt_number)
do update set
  final_text = excluded.final_text,
  submitted_at = excluded.submitted_at;

insert into public.eval_results (
  eval_id,
  session_id,
  question_id,
  attempt_number,
  status,
  feedback_json,
  model_metadata
)
values
  (
    '23000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000003',
    1,
    'COMPLETE',
    '{"recommendation":"Add a measurable outcome to your next answer.","contentPulse":{"headline":"Make the result visible","body":"You described the action clearly; now connect it to an operating result."}}'::jsonb,
    '{"provider":"seed","surface":"candidate_setup_to_summary"}'::jsonb
  ),
  (
    '23000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000004',
    1,
    'COMPLETE',
    '{"recommendation":"Name the tradeoff and the decision rule you used.","contentPulse":{"headline":"Show your prioritization logic","body":"Your answer has a useful framework; make the choice criteria explicit."}}'::jsonb,
    '{"provider":"seed","surface":"candidate_setup_to_summary"}'::jsonb
  )
on conflict (question_id, attempt_number)
do update set
  status = excluded.status,
  feedback_json = excluded.feedback_json,
  model_metadata = excluded.model_metadata;

insert into public.candidate_practice_drafts (
  practice_draft_id,
  candidate_profile_id,
  status,
  target_role,
  job_description,
  resume_context_json,
  custom_questions_json,
  intake_responses_json,
  question_set_snapshot_id,
  session_id,
  resume_target_screen,
  generation_started_at,
  generation_finished_at,
  last_activity_at
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'draft',
    'Customer Success Manager',
    'Support strategic customers, resolve escalations, and guide adoption.',
    '{"sourceAssets":[],"pastedText":"Customer success leader with SaaS onboarding and renewal experience.","extractedText":"Customer success leader with SaaS onboarding and renewal experience.","captureMode":"pasted_text","processedArtifact":{"text":"Customer success leader with SaaS onboarding and renewal experience.","source":"pasted_text","originalRetained":false}}'::jsonb,
    '[]'::jsonb,
    '{"confidenceLevel":"medium","interviewType":null,"timeline":null,"concerns":null,"practiceFocus":["structure","examples"]}'::jsonb,
    null,
    null,
    'practice_setup',
    null,
    null,
    now() - interval '1 hour'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'in_session',
    'Customer Success Manager',
    'Support strategic customers, resolve escalations, and guide adoption.',
    '{"sourceAssets":[],"pastedText":null,"extractedText":"","captureMode":"none","processedArtifact":null}'::jsonb,
    '[]'::jsonb,
    '{"confidenceLevel":null,"interviewType":null,"timeline":null,"concerns":null,"practiceFocus":[]}'::jsonb,
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'session_in_progress',
    now() - interval '2 hours',
    now() - interval '90 minutes',
    now() - interval '20 minutes'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'completed',
    'Product Operations Analyst',
    'Coordinate product workflows, analyze launches, and improve operating rhythm.',
    '{"sourceAssets":[],"pastedText":"Operations analyst with launch coordination and analytics experience.","extractedText":"Operations analyst with launch coordination and analytics experience.","captureMode":"pasted_text","processedArtifact":{"text":"Operations analyst with launch coordination and analytics experience.","source":"pasted_text","originalRetained":false}}'::jsonb,
    '[]'::jsonb,
    '{"confidenceLevel":"high","interviewType":null,"timeline":null,"concerns":null,"practiceFocus":[]}'::jsonb,
    '40000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'session_summary',
    now() - interval '4 days',
    now() - interval '4 days',
    now() - interval '2 days'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000002',
    'in_session',
    'Technical Support Specialist',
    'Troubleshoot customer issues and communicate clearly across teams.',
    '{"sourceAssets":[],"pastedText":null,"extractedText":"","captureMode":"none","processedArtifact":null}'::jsonb,
    '[]'::jsonb,
    '{"confidenceLevel":null,"interviewType":null,"timeline":null,"concerns":null,"practiceFocus":[]}'::jsonb,
    '40000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'session_in_progress',
    now() - interval '1 day',
    now() - interval '1 day',
    now() - interval '1 day'
  )
on conflict (practice_draft_id)
do update set
  candidate_profile_id = excluded.candidate_profile_id,
  status = excluded.status,
  target_role = excluded.target_role,
  job_description = excluded.job_description,
  resume_context_json = excluded.resume_context_json,
  custom_questions_json = excluded.custom_questions_json,
  intake_responses_json = excluded.intake_responses_json,
  question_set_snapshot_id = excluded.question_set_snapshot_id,
  session_id = excluded.session_id,
  resume_target_screen = excluded.resume_target_screen,
  generation_started_at = excluded.generation_started_at,
  generation_finished_at = excluded.generation_finished_at,
  generation_error = null,
  last_activity_at = excluded.last_activity_at;

commit;
