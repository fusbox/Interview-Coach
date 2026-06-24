-- Candidate app deployed-preview seed data for Irma Castillo.
-- Applies after:
--   npm run db:migrate
--
-- Suggested Vercel preview env:
--   CANDIDATE_AUTH_MODE=preview_test
--   ALLOW_CANDIDATE_PREVIEW_AUTH=true
--   CANDIDATE_PREVIEW_EMAIL=irma.castillo@talentarbor.local
--   CANDIDATE_PREVIEW_DISPLAY_NAME=Irma Castillo

begin;

insert into public.candidate_profiles (
  candidate_profile_id,
  auth_subject,
  email,
  display_name,
  workspace,
  status
)
values (
  '90000000-0000-4000-8000-000000000001',
  'dev_mock:interview-coach-preview:irma.castillo@talentarbor.local',
  'irma.castillo@talentarbor.local',
  'Irma Castillo',
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
values (
  '91000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000001',
  'dev_mock',
  'interview-coach-preview',
  'irma.castillo@talentarbor.local',
  'irma.castillo@talentarbor.local',
  now()
)
on conflict (provider, issuer, subject)
do update set
  candidate_profile_id = excluded.candidate_profile_id,
  email = excluded.email,
  last_seen_at = now();

insert into public.candidate_role_preparation_profiles (
  role_profile_id,
  candidate_profile_id,
  target_role,
  normalized_target_role,
  job_description_snapshot,
  job_description_hash,
  resume_context_snapshot_json,
  source,
  status,
  last_practiced_at
)
values
  (
    '92000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    'Client Services Specialist',
    'client services specialist',
    'Support client service teams with billing questions, account documentation, customer follow-up, and operational handoffs.',
    'preview-irma-client-services-specialist',
    '{"sourceAssets":[],"pastedText":"Detail-oriented administrative and customer-facing professional with billing, records, and service coordination experience.","extractedText":"Detail-oriented administrative and customer-facing professional with billing, records, and service coordination experience.","captureMode":"pasted_text","processedArtifact":{"text":"Detail-oriented administrative and customer-facing professional with billing, records, and service coordination experience.","source":"pasted_text","originalRetained":false}}'::jsonb,
    'dev_seed',
    'active',
    now() - interval '1 hour'
  ),
  (
    '92000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000001',
    'Client Services Executive - WWT',
    'client services executive - wwt',
    'Own client service delivery, coordinate escalations, build trust with stakeholders, and translate account needs into clear internal action.',
    'preview-irma-client-services-executive-wwt',
    '{"sourceAssets":[],"pastedText":"Client service professional with account coordination, documentation, and customer issue-resolution experience.","extractedText":"Client service professional with account coordination, documentation, and customer issue-resolution experience.","captureMode":"pasted_text","processedArtifact":{"text":"Client service professional with account coordination, documentation, and customer issue-resolution experience.","source":"pasted_text","originalRetained":false}}'::jsonb,
    'dev_seed',
    'active',
    now() - interval '2 days'
  )
on conflict (role_profile_id)
do update set
  target_role = excluded.target_role,
  normalized_target_role = excluded.normalized_target_role,
  job_description_snapshot = excluded.job_description_snapshot,
  job_description_hash = excluded.job_description_hash,
  resume_context_snapshot_json = excluded.resume_context_snapshot_json,
  source = excluded.source,
  status = excluded.status,
  last_practiced_at = excluded.last_practiced_at;

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
    '93000000-0000-4000-8000-000000000001',
    null,
    'IN_SESSION',
    1,
    'Client Services Specialist',
    'Support client service teams with billing questions, account documentation, customer follow-up, and operational handoffs.',
    '{"candidate":{"fullName":"Irma Castillo","email":"irma.castillo@talentarbor.local","resumeText":"Detail-oriented administrative and customer-facing professional with billing, records, and service coordination experience."},"questionPlanSnapshot":{"interviewStage":"follow_up_final","questionCount":10,"categoryCounts":{"screening":0,"behavioral":3,"culture_fit":3,"case_scenario":2,"technical_role_specific":2},"slots":[{"id":"slot-1","index":0,"category":"behavioral"},{"id":"slot-2","index":1,"category":"behavioral"},{"id":"slot-3","index":2,"category":"behavioral"},{"id":"slot-4","index":3,"category":"culture_fit"},{"id":"slot-5","index":4,"category":"culture_fit"},{"id":"slot-6","index":5,"category":"culture_fit"},{"id":"slot-7","index":6,"category":"case_scenario"},{"id":"slot-8","index":7,"category":"case_scenario"},{"id":"slot-9","index":8,"category":"technical_role_specific"},{"id":"slot-10","index":9,"category":"technical_role_specific"}]}}'::jsonb,
    'Irma Castillo',
    null
  ),
  (
    '93000000-0000-4000-8000-000000000002',
    null,
    'COMPLETED',
    3,
    'Client Services Executive - WWT',
    'Own client service delivery, coordinate escalations, build trust with stakeholders, and translate account needs into clear internal action.',
    '{"candidate":{"fullName":"Irma Castillo","email":"irma.castillo@talentarbor.local","resumeText":"Client service professional with account coordination, documentation, and customer issue-resolution experience."},"questionPlanSnapshot":{"interviewStage":"follow_up_final","questionCount":5,"categoryCounts":{"screening":0,"behavioral":2,"culture_fit":1,"case_scenario":1,"technical_role_specific":1},"slots":[{"id":"slot-1","index":0,"category":"behavioral"},{"id":"slot-2","index":1,"category":"behavioral"},{"id":"slot-3","index":2,"category":"culture_fit"},{"id":"slot-4","index":3,"category":"case_scenario"},{"id":"slot-5","index":4,"category":"technical_role_specific"}]}}'::jsonb,
    'Irma Castillo',
    'You showed steady client-service judgment and can make the strongest answers sharper by naming the result and the decision rule behind your action.'
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
    '94000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001',
    0,
    'Tell me about a time you helped resolve a billing or account documentation issue.',
    '["customer_service","documentation"]'::jsonb,
    '["focus_relevance","specificity_concreteness","outcome_impact"]'::jsonb,
    'Behavioral'
  ),
  (
    '94000000-0000-4000-8000-000000000002',
    '93000000-0000-4000-8000-000000000001',
    1,
    'How would you handle a client who needs an update before you have the final answer?',
    '["communication","follow_up"]'::jsonb,
    '["flow_sequence","signposting_clarity","resilience_ownership"]'::jsonb,
    'Scenario'
  ),
  (
    '94000000-0000-4000-8000-000000000003',
    '93000000-0000-4000-8000-000000000001',
    2,
    'How do you organize account documentation so handoffs stay clear for the next person?',
    '["documentation","handoff_quality"]'::jsonb,
    '["rationale_judgment","flow_sequence","specificity_concreteness"]'::jsonb,
    'Technical'
  ),
  (
    '94000000-0000-4000-8000-000000000004',
    '93000000-0000-4000-8000-000000000002',
    0,
    'Describe a client escalation you helped calm down or move forward.',
    '["client_service","ownership"]'::jsonb,
    '["focus_relevance","specificity_concreteness","outcome_impact"]'::jsonb,
    'Behavioral'
  ),
  (
    '94000000-0000-4000-8000-000000000005',
    '93000000-0000-4000-8000-000000000002',
    1,
    'How do you decide what to communicate first when multiple stakeholders need updates?',
    '["prioritization","communication"]'::jsonb,
    '["rationale_judgment","flow_sequence","signposting_clarity"]'::jsonb,
    'Technical'
  ),
  (
    '94000000-0000-4000-8000-000000000006',
    '93000000-0000-4000-8000-000000000002',
    2,
    'What kind of team environment helps you do your best client-service work?',
    '["culture_fit","collaboration"]'::jsonb,
    '["focus_relevance","conciseness_pacing"]'::jsonb,
    'Culture Fit'
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
    '95000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000004',
    1,
    'text',
    'I listened first, confirmed the billing concern, gathered the missing account details, and gave the client a clear update cadence while I worked with the internal team.',
    now() - interval '2 days'
  ),
  (
    '95000000-0000-4000-8000-000000000002',
    '93000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000005',
    1,
    'text',
    'I start with the stakeholder who is blocked, then communicate what is known, what is still open, and when I will follow up.',
    now() - interval '2 days'
  ),
  (
    '95000000-0000-4000-8000-000000000003',
    '93000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000006',
    1,
    'text',
    'I do best on a team that values clear handoffs, quick context sharing, and calm follow-through when a client needs help.',
    now() - interval '2 days'
  )
on conflict (question_id, attempt_number)
do update set
  final_text = excluded.final_text,
  modality = excluded.modality,
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
    '96000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000004',
    1,
    'COMPLETE',
    '{"recommendation":"Name the result of the escalation more directly.","coachSignal":{"focus":"Make the client impact visible","rationale":"Your process is clear; the answer gets stronger when the outcome is explicit.","trySayingThis":"That helped the client understand the next step and reduced repeat follow-up while we resolved the billing issue."},"scores":{"focus_relevance":{"score":4.4,"label":"Stayed tied to the client escalation."},"specificity_concreteness":{"score":4.1,"label":"Named concrete account and billing steps."},"outcome_explicitness":{"score":3.2,"label":"Outcome is present but could be sharper."},"decision_rationale":{"score":3.6,"label":"Shows why follow-up cadence mattered."},"structural_clarity":{"score":4.0,"label":"Clear listen-confirm-act sequence."},"signposting":{"score":3.5,"label":"Sequence is understandable without heavy signposting."},"filler_words":{"score":4.2,"label":"Clean typed delivery."},"conciseness":{"score":4.0,"label":"Answer is focused and efficient."},"resilience":{"score":4.1,"label":"Shows calm ownership under client pressure."}}}'::jsonb,
    '{"provider":"seed","surface":"preview_irma"}'::jsonb
  ),
  (
    '96000000-0000-4000-8000-000000000002',
    '93000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000005',
    1,
    'COMPLETE',
    '{"recommendation":"Explain the decision rule behind your communication order.","coachSignal":{"focus":"Show your prioritization logic","rationale":"The answer is practical; naming the rule makes your judgment easier to trust.","trySayingThis":"I prioritize the person whose work is blocked, then send a concise update to everyone else so no one is guessing."},"scores":{"focus_relevance":{"score":3.8,"label":"Directly answers the prioritization question."},"specificity_concreteness":{"score":3.1,"label":"Useful but could include a concrete example."},"outcome_explicitness":{"score":2.8,"label":"Result is implied more than stated."},"decision_rationale":{"score":4.0,"label":"Clear decision rule for who hears first."},"structural_clarity":{"score":3.9,"label":"Answer has a clean order."},"signposting":{"score":3.6,"label":"Update sequence is easy to follow."},"filler_words":{"score":4.0,"label":"Clean typed delivery."},"conciseness":{"score":4.1,"label":"Concise and not over-explained."},"resilience":{"score":3.5,"label":"Shows steady communication under pressure."}}}'::jsonb,
    '{"provider":"seed","surface":"preview_irma"}'::jsonb
  ),
  (
    '96000000-0000-4000-8000-000000000003',
    '93000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000006',
    1,
    'COMPLETE',
    '{"recommendation":"Add one concrete example of a handoff or team behavior.","coachSignal":{"focus":"Give one example","rationale":"The values are clear; a specific example will make the answer feel grounded.","trySayingThis":"For example, I like confirming the owner and next update time in writing after a client call."},"scores":{"focus_relevance":{"score":3.4,"label":"Mostly relevant to team environment."},"specificity_concreteness":{"score":2.6,"label":"Needs one concrete example."},"outcome_explicitness":{"score":2.4,"label":"Outcome is not yet visible."},"decision_rationale":{"score":3.0,"label":"Some rationale for team preferences."},"structural_clarity":{"score":3.3,"label":"Simple and understandable."},"signposting":{"score":3.0,"label":"Could guide the listener more clearly."},"filler_words":{"score":4.0,"label":"Clean typed delivery."},"conciseness":{"score":3.9,"label":"Tight answer."},"resilience":{"score":3.6,"label":"Shows calm follow-through preference."}}}'::jsonb,
    '{"provider":"seed","surface":"preview_irma"}'::jsonb
  )
on conflict (question_id, attempt_number)
do update set
  status = excluded.status,
  feedback_json = excluded.feedback_json,
  model_metadata = excluded.model_metadata;

insert into public.candidate_practice_drafts (
  practice_draft_id,
  candidate_profile_id,
  role_profile_id,
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
    '97000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001',
    'in_session',
    'Client Services Specialist',
    'Support client service teams with billing questions, account documentation, customer follow-up, and operational handoffs.',
    '{"sourceAssets":[],"pastedText":"Detail-oriented administrative and customer-facing professional with billing, records, and service coordination experience.","extractedText":"Detail-oriented administrative and customer-facing professional with billing, records, and service coordination experience.","captureMode":"pasted_text","processedArtifact":{"text":"Detail-oriented administrative and customer-facing professional with billing, records, and service coordination experience.","source":"pasted_text","originalRetained":false}}'::jsonb,
    '[]'::jsonb,
    '{"confidenceLevel":"medium","interviewType":null,"interviewStage":"follow_up_final","timeline":null,"concerns":null,"practiceFocus":["client communication","specific examples"],"questionCount":3}'::jsonb,
    '98000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001',
    'session_in_progress',
    now() - interval '2 hours',
    now() - interval '90 minutes',
    now() - interval '30 minutes'
  ),
  (
    '97000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000002',
    'completed',
    'Client Services Executive - WWT',
    'Own client service delivery, coordinate escalations, build trust with stakeholders, and translate account needs into clear internal action.',
    '{"sourceAssets":[],"pastedText":"Client service professional with account coordination, documentation, and customer issue-resolution experience.","extractedText":"Client service professional with account coordination, documentation, and customer issue-resolution experience.","captureMode":"pasted_text","processedArtifact":{"text":"Client service professional with account coordination, documentation, and customer issue-resolution experience.","source":"pasted_text","originalRetained":false}}'::jsonb,
    '[]'::jsonb,
    '{"confidenceLevel":"high","interviewType":null,"interviewStage":"follow_up_final","timeline":null,"concerns":null,"practiceFocus":["executive communication","outcomes"],"questionCount":5}'::jsonb,
    '98000000-0000-4000-8000-000000000002',
    '93000000-0000-4000-8000-000000000002',
    'session_summary',
    now() - interval '3 days',
    now() - interval '3 days',
    now() - interval '2 days'
  )
on conflict (practice_draft_id)
do update set
  candidate_profile_id = excluded.candidate_profile_id,
  role_profile_id = excluded.role_profile_id,
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
