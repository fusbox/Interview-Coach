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
    '{"candidate":{"fullName":"Irma Castillo","email":"irma.castillo@talentarbor.local","resumeText":"Detail-oriented administrative and customer-facing professional with billing, records, and service coordination experience."},"questionPlanSnapshot":{"interviewStage":"follow_up_final","questionCount":3,"categoryCounts":{"screening":0,"behavioral":1,"culture_fit":1,"case_scenario":1,"technical_role_specific":0},"slots":[{"id":"slot-1","index":0,"category":"behavioral"},{"id":"slot-2","index":1,"category":"case_scenario"},{"id":"slot-3","index":2,"category":"culture_fit"}]},"rigorBaselineSnapshot":{"interviewStage":"follow_up_final","questionCount":10,"categoryCounts":{"screening":0,"behavioral":3,"culture_fit":3,"case_scenario":2,"technical_role_specific":2},"slots":[{"id":"baseline-1","index":0,"category":"behavioral"},{"id":"baseline-2","index":1,"category":"behavioral"},{"id":"baseline-3","index":2,"category":"behavioral"},{"id":"baseline-4","index":3,"category":"culture_fit"},{"id":"baseline-5","index":4,"category":"culture_fit"},{"id":"baseline-6","index":5,"category":"culture_fit"},{"id":"baseline-7","index":6,"category":"case_scenario"},{"id":"baseline-8","index":7,"category":"case_scenario"},{"id":"baseline-9","index":8,"category":"technical_role_specific"},{"id":"baseline-10","index":9,"category":"technical_role_specific"}]}}'::jsonb,
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
    '{"candidate":{"fullName":"Irma Castillo","email":"irma.castillo@talentarbor.local","resumeText":"Client service professional with account coordination, documentation, and customer issue-resolution experience."},"questionPlanSnapshot":{"interviewStage":"follow_up_final","questionCount":3,"categoryCounts":{"screening":0,"behavioral":1,"culture_fit":1,"case_scenario":0,"technical_role_specific":1},"slots":[{"id":"slot-1","index":0,"category":"behavioral"},{"id":"slot-2","index":1,"category":"technical_role_specific"},{"id":"slot-3","index":2,"category":"culture_fit"}]},"rigorBaselineSnapshot":{"interviewStage":"follow_up_final","questionCount":5,"categoryCounts":{"screening":0,"behavioral":2,"culture_fit":1,"case_scenario":1,"technical_role_specific":1},"slots":[{"id":"baseline-1","index":0,"category":"behavioral"},{"id":"baseline-2","index":1,"category":"behavioral"},{"id":"baseline-3","index":2,"category":"culture_fit"},{"id":"baseline-4","index":3,"category":"case_scenario"},{"id":"baseline-5","index":4,"category":"technical_role_specific"}]}}'::jsonb,
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
    'What kind of team environment helps you deliver reliable client follow-up?',
    '["culture_fit","client_service"]'::jsonb,
    '["focus_relevance","specificity_concreteness","conciseness_pacing"]'::jsonb,
    'Culture Fit'
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
values (
  '92000000-0000-4000-8000-000000000003',
  '90000000-0000-4000-8000-000000000001',
  'Client Services Representative',
  'client services representative',
  'Represent the client services team in a first interview context: answer screening, behavioral, culture-fit, scenario, and role-specific questions about customer follow-up, documentation, account support, escalation handling, and service reliability.',
  'preview-irma-client-services-representative-first-interview',
  '{"sourceAssets":[],"pastedText":"Client services candidate with customer support, documentation, billing follow-up, and account coordination experience.","extractedText":"Client services candidate with customer support, documentation, billing follow-up, and account coordination experience.","captureMode":"pasted_text","processedArtifact":{"text":"Client services candidate with customer support, documentation, billing follow-up, and account coordination experience.","source":"pasted_text","originalRetained":false}}'::jsonb,
  'dev_seed',
  'active',
  now() - interval '1 hour'
)
on conflict (role_profile_id)
do update set
  candidate_profile_id = excluded.candidate_profile_id,
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
  summary_narrative,
  readiness_band
)
values (
  '93000000-0000-4000-8000-000000000003',
  null,
  'COMPLETED',
  3,
  'Client Services Representative',
  'Represent the client services team in a first interview context: answer screening, behavioral, culture-fit, scenario, and role-specific questions about customer follow-up, documentation, account support, escalation handling, and service reliability.',
  '{"candidate":{"fullName":"Irma Castillo","email":"irma.castillo@talentarbor.local","resumeText":"Client services candidate with customer support, documentation, billing follow-up, and account coordination experience."},"questionPlanSnapshot":{"interviewStage":"initial_interview","questionCount":3,"categoryCounts":{"screening":1,"behavioral":1,"culture_fit":1,"case_scenario":0,"technical_role_specific":0},"slots":[{"id":"slot-1","index":0,"category":"screening"},{"id":"slot-2","index":1,"category":"behavioral"},{"id":"slot-3","index":2,"category":"culture_fit"}]},"rigorBaselineSnapshot":{"interviewStage":"initial_interview","questionCount":7,"categoryCounts":{"screening":2,"behavioral":2,"culture_fit":1,"case_scenario":1,"technical_role_specific":1},"slots":[{"id":"baseline-1","index":0,"category":"screening"},{"id":"baseline-2","index":1,"category":"behavioral"},{"id":"baseline-3","index":2,"category":"culture_fit"},{"id":"baseline-4","index":3,"category":"case_scenario"},{"id":"baseline-5","index":4,"category":"technical_role_specific"},{"id":"baseline-6","index":5,"category":"screening"},{"id":"baseline-7","index":6,"category":"behavioral"}]}}'::jsonb,
  'Irma Castillo',
  'Your first round shows clear structure in two answers and one emerging answer where the substance needs more concrete client-service detail. I would keep building with the strongest remediation target and the remaining first-interview coverage.',
  'RL2'
)
on conflict (session_id)
do update set
  status = excluded.status,
  current_question_index = excluded.current_question_index,
  target_role = excluded.target_role,
  job_description = excluded.job_description,
  intake_json = excluded.intake_json,
  client_name = excluded.client_name,
  summary_narrative = excluded.summary_narrative,
  readiness_band = excluded.readiness_band;

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
    '94000000-0000-4000-8000-000000000007',
    '93000000-0000-4000-8000-000000000003',
    0,
    'Walk me through your client services background and the kinds of customer or account support responsibilities you have handled.',
    '["screening","client_service","account_support"]'::jsonb,
    '["focus_relevance","specificity_concreteness","outcome_explicitness","decision_rationale","structural_clarity","signposting","filler_words","conciseness","resilience"]'::jsonb,
    'Screening'
  ),
  (
    '94000000-0000-4000-8000-000000000008',
    '93000000-0000-4000-8000-000000000003',
    1,
    'Tell me about a time you helped a customer or internal partner get unstuck when the answer was not immediately available.',
    '["behavioral","follow_up","service_ownership"]'::jsonb,
    '["focus_relevance","specificity_concreteness","outcome_explicitness","decision_rationale","structural_clarity","signposting","filler_words","conciseness","resilience"]'::jsonb,
    'Behavioral'
  ),
  (
    '94000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000003',
    2,
    'What kind of team environment helps you deliver reliable service for clients and teammates?',
    '["culture_fit","collaboration","service_reliability"]'::jsonb,
    '["focus_relevance","specificity_concreteness","outcome_explicitness","decision_rationale","structural_clarity","signposting","filler_words","conciseness","resilience"]'::jsonb,
    'Culture Fit'
  ),
  (
    '94000000-0000-4000-8000-000000000010',
    '93000000-0000-4000-8000-000000000003',
    3,
    'Imagine a client says they were promised an update yesterday, but you do not yet have a final answer from another team. What would you do first?',
    '["case_scenario","client_communication","follow_up"]'::jsonb,
    '["focus_relevance","specificity_concreteness","outcome_explicitness","decision_rationale","structural_clarity","signposting","filler_words","conciseness","resilience"]'::jsonb,
    'Case / Scenario'
  ),
  (
    '94000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000003',
    4,
    'How do you keep client records, account notes, or follow-up tasks organized so another teammate can pick up the work if needed?',
    '["technical_role_specific","documentation","handoffs"]'::jsonb,
    '["focus_relevance","specificity_concreteness","outcome_explicitness","decision_rationale","structural_clarity","signposting","filler_words","conciseness","resilience"]'::jsonb,
    'Technical / Role-Specific'
  ),
  (
    '94000000-0000-4000-8000-000000000012',
    '93000000-0000-4000-8000-000000000003',
    5,
    'What would you want me to know about your communication style with clients or teammates?',
    '["screening","communication","service_style"]'::jsonb,
    '["focus_relevance","specificity_concreteness","outcome_explicitness","decision_rationale","structural_clarity","signposting","filler_words","conciseness","resilience"]'::jsonb,
    'Screening'
  ),
  (
    '94000000-0000-4000-8000-000000000013',
    '93000000-0000-4000-8000-000000000003',
    6,
    'Tell me about a time you had to balance speed and accuracy in client service work.',
    '["behavioral","judgment","service_quality"]'::jsonb,
    '["focus_relevance","specificity_concreteness","outcome_explicitness","decision_rationale","structural_clarity","signposting","filler_words","conciseness","resilience"]'::jsonb,
    'Behavioral'
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
    '95000000-0000-4000-8000-000000000004',
    '93000000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000007',
    1,
    'voice',
    'I have supported customers by keeping account notes current, tracking billing questions, and following up when someone needed an update. In my last role I often had to gather the right details, confirm what the client needed, and make sure the next step was clear before I closed the loop.',
    now() - interval '1 hour'
  ),
  (
    '95000000-0000-4000-8000-000000000005',
    '93000000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000008',
    1,
    'voice',
    'I would usually check what information was missing and then let the person know I was still working on it. I tried to be responsive and make sure they knew I had not forgotten them. Sometimes I would ask another teammate if they knew who owned the next step.',
    now() - interval '55 minutes'
  ),
  (
    '95000000-0000-4000-8000-000000000006',
    '93000000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000009',
    1,
    'voice',
    'I do best on a team where people document decisions and share context early. That helps me give clients reliable follow-up because I can see what happened before, who owns the next step, and when I should circle back.',
    now() - interval '50 minutes'
  )
on conflict (question_id, attempt_number)
do update set
  session_id = excluded.session_id,
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
    '96000000-0000-4000-8000-000000000004',
    '93000000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000007',
    1,
    'COMPLETE',
    '{"ack":"You gave a clear overview of your client services background.","recommendation":"Keep this answer tied to one concrete client-service example.","feedbackPlan":{"centralRead":"Clear overall: your background is relevant and easy to follow, and one sharper example would make the value more memorable.","signal":{"valence":"mixed","detectability":"moderate"},"primaryAnchor":{"source":"content","signalType":"pattern","dimension":"specificity_concreteness","candidateEvidence":"I have supported customers by keeping account notes current, tracking billing questions, and following up","interviewerValue":"The interviewer can see relevant service experience."},"intervention":{"type":"sharpen_signal","reason":"The answer is clear but would be stronger with one concrete service moment."}},"coachSignal":{"focus":"Anchor the background in one example","rationale":"Your overview is relevant; a specific moment will make it easier to remember.","trySayingThis":"For example, I tracked a billing question from intake through follow-up so the client knew exactly when to expect the next update."},"scores":{"focus_relevance":{"score":3.0,"label":"Relevant client services background."},"specificity_concreteness":{"score":3.0,"label":"Some concrete responsibilities, but one example would help."},"outcome_explicitness":{"applicability":"insufficient_data","label":"The screening prompt did not elicit a concrete outcome."},"decision_rationale":{"score":3.0,"label":"Shows why follow-up mattered."},"structural_clarity":{"score":3.0,"label":"Easy to follow."},"signposting":{"score":3.0,"label":"Sequence is understandable."},"filler_words":{"score":1.1,"label":"Voice delivery has enough evidence to score, with filler control still emerging."},"conciseness":{"score":4.0,"label":"Focused answer."},"resilience":{"score":4.0,"label":"Shows steady ownership."}},"meta":{"tier":1,"modality":"voice","confidence":"medium","readinessLevel":"RL3"},"transcript":"I have supported customers by keeping account notes current, tracking billing questions, and following up when someone needed an update. In my last role I often had to gather the right details, confirm what the client needed, and make sure the next step was clear before I closed the loop."}'::jsonb,
    '{"provider":"seed","surface":"preview_irma_representative_first_interview","expectedDimensionCounts":{"null":1,"emerging":1,"clear":5,"strong":2},"expectedQuestionRead":"clear"}'::jsonb
  ),
  (
    '96000000-0000-4000-8000-000000000005',
    '93000000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000008',
    1,
    'COMPLETE',
    '{"ack":"You showed a service-minded instinct to follow up and ask for help.","recommendation":"Practice turning this into a more concrete behavioral story with the action and result named clearly.","feedbackPlan":{"centralRead":"Emerging: the answer shows the right intent, but the client impact and the exact action path are still too general.","signal":{"valence":"growth","detectability":"clear"},"primaryAnchor":{"source":"content","signalType":"omission","dimension":"outcome_explicitness","candidateEvidence":"I would usually check what information was missing and then let the person know I was still working on it","interviewerValue":"The interviewer needs the specific action and outcome to trust the example."},"intervention":{"type":"repair_foundation","reason":"The answer needs a clearer situation, action, and outcome before polishing."}},"coachSignal":{"focus":"Make the client impact visible","rationale":"Your intent is helpful; the answer needs the specific step you took and what changed for the client or teammate.","trySayingThis":"I confirmed the missing information, gave the client a same-day update window, and followed up with the owner so the client knew the issue was moving."},"scores":{"focus_relevance":{"score":1.0,"label":"Relevant intent, but the example is underdeveloped."},"specificity_concreteness":{"score":1.0,"label":"Needs a concrete situation and action."},"outcome_explicitness":{"score":1.0,"label":"Client impact is not yet visible."},"decision_rationale":{"score":1.0,"label":"The reason for the chosen step is not clear yet."},"structural_clarity":{"score":3.0,"label":"Basic answer path is understandable."},"signposting":{"score":3.0,"label":"Follow-up sequence is generally followable."},"filler_words":{"score":3.0,"label":"Voice delivery is workable."},"conciseness":{"score":3.0,"label":"Concise enough for the question."},"resilience":{"score":3.0,"label":"Shows willingness to keep ownership."}},"meta":{"tier":1,"modality":"voice","confidence":"medium","readinessLevel":"RL2"},"transcript":"I would usually check what information was missing and then let the person know I was still working on it. I tried to be responsive and make sure they knew I had not forgotten them. Sometimes I would ask another teammate if they knew who owned the next step."}'::jsonb,
    '{"provider":"seed","surface":"preview_irma_representative_first_interview","expectedDimensionCounts":{"null":0,"emerging":4,"clear":5,"strong":0},"expectedQuestionRead":"emerging"}'::jsonb
  ),
  (
    '96000000-0000-4000-8000-000000000006',
    '93000000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000009',
    1,
    'COMPLETE',
    '{"ack":"You described a clear team environment that supports reliable client service.","recommendation":"Add one quick example of how documentation changed the outcome for a client or teammate.","feedbackPlan":{"centralRead":"Clear overall: the answer connects team habits to reliable client follow-up, with room to add a concrete example.","signal":{"valence":"mixed","detectability":"moderate"},"primaryAnchor":{"source":"content","signalType":"behavior","dimension":"structural_clarity","candidateEvidence":"people document decisions and share context early","interviewerValue":"The interviewer can see how you connect team process to service reliability."},"intervention":{"type":"sharpen_signal","reason":"A short example would turn a clear preference into stronger evidence."}},"coachSignal":{"focus":"Show one team habit in action","rationale":"Your framing is clear; one example would make the answer feel grounded.","trySayingThis":"When notes are current, I can tell the client what has already been checked and what happens next instead of making them repeat the story."},"scores":{"focus_relevance":{"score":3.0,"label":"Relevant to team environment and service reliability."},"specificity_concreteness":{"score":3.0,"label":"Specific habits are named."},"outcome_explicitness":{"score":4.0,"label":"Client follow-up impact is visible."},"decision_rationale":{"score":3.0,"label":"Rationale for documentation is clear."},"structural_clarity":{"score":3.0,"label":"Answer is organized."},"signposting":{"score":3.0,"label":"Progression is easy to follow."},"filler_words":{"score":4.0,"label":"Clean voice delivery."},"conciseness":{"score":3.0,"label":"Answer stays focused."},"resilience":{"applicability":"insufficient_data","label":"The culture-fit prompt did not elicit enough resilience evidence."}},"meta":{"tier":1,"modality":"voice","confidence":"medium","readinessLevel":"RL3"},"transcript":"I do best on a team where people document decisions and share context early. That helps me give clients reliable follow-up because I can see what happened before, who owns the next step, and when I should circle back."}'::jsonb,
    '{"provider":"seed","surface":"preview_irma_representative_first_interview","expectedDimensionCounts":{"null":1,"emerging":0,"clear":6,"strong":2},"expectedQuestionRead":"clear"}'::jsonb
  )
on conflict (question_id, attempt_number)
do update set
  session_id = excluded.session_id,
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
values (
  '97000000-0000-4000-8000-000000000003',
  '90000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000003',
  'completed',
  'Client Services Representative',
  'Represent the client services team in a first interview context: answer screening, behavioral, culture-fit, scenario, and role-specific questions about customer follow-up, documentation, account support, escalation handling, and service reliability.',
  '{"sourceAssets":[],"pastedText":"Client services candidate with customer support, documentation, billing follow-up, and account coordination experience.","extractedText":"Client services candidate with customer support, documentation, billing follow-up, and account coordination experience.","captureMode":"pasted_text","processedArtifact":{"text":"Client services candidate with customer support, documentation, billing follow-up, and account coordination experience.","source":"pasted_text","originalRetained":false}}'::jsonb,
  '[]'::jsonb,
  '{"confidenceLevel":"medium","interviewType":null,"interviewStage":"initial_interview","timeline":null,"concerns":null,"practiceFocus":["client service follow-up","first interview readiness"],"questionCount":3}'::jsonb,
  '98000000-0000-4000-8000-000000000003',
  '93000000-0000-4000-8000-000000000003',
  'dashboard',
  now() - interval '90 minutes',
  now() - interval '80 minutes',
  now() - interval '45 minutes'
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
