-- Rollback-only proof that unexposed prep-baseline questions remain launchable.

begin;

insert into public.candidate_profiles (
  candidate_profile_id,
  auth_subject,
  email,
  display_name,
  workspace
)
values (
  'e1000000-0000-4000-8000-000000000001',
  'local_dev:baseline-queue-owner@example.invalid',
  'baseline-queue-owner@example.invalid',
  'Baseline Queue Owner',
  'local_dev'
);

insert into public.candidate_role_preparation_profiles (
  role_profile_id,
  candidate_profile_id,
  target_role,
  normalized_target_role,
  job_description_snapshot,
  job_description_hash,
  source,
  rigor_baseline_snapshot_json,
  rigor_baseline_question_wording_snapshot_json
)
values (
  'e2000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'Quality Inspector',
  'quality inspector',
  'Inspect finished goods.',
  repeat('e', 64),
  'manual',
  '{
    "status":"candidate_practice_plan_baseline_v1",
    "interviewStage":"screening",
    "questionCount":5,
    "categoryCounts":{"screening":2,"behavioral":1,"culture_fit":1,"case_scenario":0,"technical_role_specific":1},
    "slots":[
      {"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."},
      {"id":"slot-2","index":1,"category":"behavioral","label":"Behavioral","purpose":"Past evidence."},
      {"id":"slot-3","index":2,"category":"culture_fit","label":"Culture / Fit","purpose":"Work style."},
      {"id":"slot-4","index":3,"category":"screening","label":"Screening","purpose":"Availability."},
      {"id":"slot-5","index":4,"category":"technical_role_specific","label":"Technical / Role-Specific","purpose":"Role capability."}
    ]
  }'::jsonb,
  '{
    "status":"questions_worded",
    "questions":[
      {"slotId":"slot-1","index":0,"category":"screening","questionText":"Why this role?"},
      {"slotId":"slot-2","index":1,"category":"behavioral","questionText":"Tell me about finding a defect."},
      {"slotId":"slot-3","index":2,"category":"culture_fit","questionText":"What environment helps you work well?"},
      {"slotId":"slot-4","index":3,"category":"screening","questionText":"What schedule can you work?"},
      {"slotId":"slot-5","index":4,"category":"technical_role_specific","questionText":"How do you verify product quality?"}
    ]
  }'::jsonb
);

insert into public.candidate_practice_sessions (
  candidate_practice_session_id,
  candidate_profile_id,
  role_profile_id,
  status,
  setup_snapshot_json,
  question_plan_snapshot_json,
  question_wording_snapshot_json,
  question_wording_status,
  progress_state_json,
  answer_submissions_json,
  answer_analysis_snapshots_json
)
values (
  'e3000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001',
  'completed',
  '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":3,"resumeCaptureMode":"none","createdAt":"2026-07-30T12:00:00.000Z"}'::jsonb,
  '{
    "interviewStage":"screening",
    "questionCount":3,
    "categoryCounts":{"screening":1,"behavioral":1,"culture_fit":1,"case_scenario":0,"technical_role_specific":0},
    "slots":[
      {"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."},
      {"id":"slot-2","index":1,"category":"behavioral","label":"Behavioral","purpose":"Past evidence."},
      {"id":"slot-3","index":2,"category":"culture_fit","label":"Culture / Fit","purpose":"Work style."}
    ]
  }'::jsonb,
  '{
    "status":"questions_worded",
    "questions":[
      {"slotId":"slot-1","index":0,"category":"screening","questionText":"Why this role?"},
      {"slotId":"slot-2","index":1,"category":"behavioral","questionText":"Tell me about finding a defect."},
      {"slotId":"slot-3","index":2,"category":"culture_fit","questionText":"What environment helps you work well?"}
    ]
  }'::jsonb,
  'worded',
  '{"status":"completed","currentQuestionIndex":2}'::jsonb,
  '{
    "slot-1":{"slotId":"slot-1","questionIndex":0,"mode":"text","text":"Answer one.","submittedAt":"2026-07-30T12:01:00.000Z","status":"analyzed","answerAttemptId":"attempt-1","attemptNumber":1,"trigger":"initial_submit","supersedesAnswerAttemptId":null},
    "slot-2":{"slotId":"slot-2","questionIndex":1,"mode":"text","text":"Answer two.","submittedAt":"2026-07-30T12:02:00.000Z","status":"analyzed","answerAttemptId":"attempt-2","attemptNumber":1,"trigger":"initial_submit","supersedesAnswerAttemptId":null},
    "slot-3":{"slotId":"slot-3","questionIndex":2,"mode":"text","text":"Answer three.","submittedAt":"2026-07-30T12:03:00.000Z","status":"analyzed","answerAttemptId":"attempt-3","attemptNumber":1,"trigger":"initial_submit","supersedesAnswerAttemptId":null}
  }'::jsonb,
  '{}'::jsonb
);

insert into public.candidate_next_round_drafts (
  candidate_next_round_draft_id,
  candidate_profile_id,
  role_profile_id
)
values (
  'e4000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001'
);

insert into public.candidate_next_round_draft_items (
  candidate_next_round_draft_item_id,
  candidate_next_round_draft_id,
  candidate_profile_id,
  role_profile_id,
  source_candidate_practice_session_id,
  source_question_key,
  practice_kind,
  provenance,
  display_position
)
values
  (
    'e5000000-0000-4000-8000-000000000001',
    'e4000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'slot-4',
    'practice_missing_evidence',
    'coach_plan',
    0
  ),
  (
    'e5000000-0000-4000-8000-000000000002',
    'e4000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'slot-5',
    'practice_missing_evidence',
    'coach_plan',
    1
  );

do $$
declare
  v_created record;
  v_session_created record;
  v_invalid record;
  v_item_count integer;
  v_intent_item_count integer;
  v_draft_version bigint;
  v_setup_snapshot jsonb;
  v_plan_snapshot jsonb;
  v_wording_snapshot jsonb;
begin
  select * into v_created
  from public.snapshot_candidate_next_round_draft_to_intent(
    'e4000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001',
    1,
    'quality inspector',
    'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":3,"resumeIncluded":false}'::jsonb,
    '[
      {
        "kind":"practice_missing_evidence",
        "source":{"kind":"coach_update_detail","candidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001","questionKey":"slot-4","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":4,"category":"Screening","questionText":"What schedule can you work?","evidenceStatus":"missing_practice_evidence"},
        "display":{"label":"Practice missing evidence","body":"Include this planned question in the next round."},
        "assembly":{"source":"next_round_draft","candidateNextRoundDraftItemId":"e5000000-0000-4000-8000-000000000001","provenance":"coach_plan","displayPosition":0}
      },
      {
        "kind":"practice_missing_evidence",
        "source":{"kind":"coach_update_detail","candidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001","questionKey":"slot-5","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":5,"category":"Technical / Role-Specific","questionText":"How do you verify product quality?","evidenceStatus":"missing_practice_evidence"},
        "display":{"label":"Practice missing evidence","body":"Include this planned question in the next round."},
        "assembly":{"source":"next_round_draft","candidateNextRoundDraftItemId":"e5000000-0000-4000-8000-000000000002","provenance":"coach_plan","displayPosition":1}
      }
    ]'::jsonb
  );

  if v_created.launch_outcome <> 'created' or v_created.candidate_practice_intent_id is null then
    raise exception 'expected two never-exposed baseline questions to launch';
  end if;

  select jsonb_array_length(items_json)
  into v_intent_item_count
  from public.candidate_practice_intents
  where candidate_practice_intent_id = v_created.candidate_practice_intent_id;

  select count(*) into v_item_count
  from public.candidate_next_round_draft_items
  where candidate_next_round_draft_id = 'e4000000-0000-4000-8000-000000000001';

  select version into v_draft_version
  from public.candidate_next_round_drafts
  where candidate_next_round_draft_id = 'e4000000-0000-4000-8000-000000000001';

  if v_intent_item_count <> 2 or v_item_count <> 0 or v_draft_version <> 2 then
    raise exception 'expected exact immutable intent, cleared items, and advanced draft';
  end if;

  v_setup_snapshot := format($json$
    {
      "targetRole":"Quality Inspector",
      "jobDescription":"Inspect finished goods.",
      "resumeText":null,
      "interviewStage":"screening",
      "questionCount":2,
      "resumeCaptureMode":"none",
      "createdAt":"2026-07-30T12:30:00.000Z",
      "followUpPractice":{
        "status":"candidate_follow_up_practice_session",
        "sourceIntentId":"%s",
        "source":"practice_builder",
        "sourceNextRoundDraftId":"e4000000-0000-4000-8000-000000000001",
        "sourceNextRoundDraftVersion":1,
        "sessionAttemptNumber":2,
        "itemCount":2,
        "items":[
          {
            "localSlotId":"slot-1",
            "localQuestionNumber":1,
            "candidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001",
            "questionKey":"slot-4",
            "sourceCandidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001",
            "sourceQuestionKey":"slot-4",
            "rootSourceCandidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001",
            "rootSourceQuestionKey":"slot-4",
            "sourceQuestionNumber":4,
            "sourceQuestionText":"What schedule can you work?",
            "sourceCategory":"Screening",
            "questionAttemptNumber":1,
            "practiceKind":"practice_missing_evidence"
          },
          {
            "localSlotId":"slot-2",
            "localQuestionNumber":2,
            "candidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001",
            "questionKey":"slot-5",
            "sourceCandidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001",
            "sourceQuestionKey":"slot-5",
            "rootSourceCandidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001",
            "rootSourceQuestionKey":"slot-5",
            "sourceQuestionNumber":5,
            "sourceQuestionText":"How do you verify product quality?",
            "sourceCategory":"Technical / Role-Specific",
            "questionAttemptNumber":1,
            "practiceKind":"practice_missing_evidence"
          }
        ]
      }
    }
  $json$, v_created.candidate_practice_intent_id)::jsonb;
  v_plan_snapshot := format($json$
    {
      "interviewStage":"screening",
      "questionCount":2,
      "categoryCounts":{"screening":1,"behavioral":0,"culture_fit":0,"case_scenario":0,"technical_role_specific":1},
      "followUpPractice":{
        "sourceIntentId":"%s",
        "source":"practice_builder",
        "sourceNextRoundDraftId":"e4000000-0000-4000-8000-000000000001",
        "sourceNextRoundDraftVersion":1,
        "sessionAttemptNumber":2,
        "itemCount":2
      },
      "slots":[
        {
          "id":"slot-1",
          "index":0,
          "category":"screening",
          "label":"Screening",
          "purpose":"Include this planned question in the next round.",
          "sourceQuestion":{
            "sourceCandidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001",
            "sourceQuestionKey":"slot-4"
          }
        },
        {
          "id":"slot-2",
          "index":1,
          "category":"technical_role_specific",
          "label":"Technical / Role-Specific",
          "purpose":"Include this planned question in the next round.",
          "sourceQuestion":{
            "sourceCandidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001",
            "sourceQuestionKey":"slot-5"
          }
        }
      ]
    }
  $json$, v_created.candidate_practice_intent_id)::jsonb;
  v_wording_snapshot := format($json$
    {
      "status":"questions_worded",
      "followUpPractice":{
        "sourceIntentId":"%s",
        "source":"practice_builder",
        "sourceNextRoundDraftId":"e4000000-0000-4000-8000-000000000001",
        "sourceNextRoundDraftVersion":1,
        "sessionAttemptNumber":2,
        "itemCount":2
      },
      "questions":[
        {
          "slotId":"slot-1",
          "index":0,
          "category":"screening",
          "questionText":"What schedule can you work?",
          "sourceQuestion":{
            "sourceCandidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001",
            "sourceQuestionKey":"slot-4"
          }
        },
        {
          "slotId":"slot-2",
          "index":1,
          "category":"technical_role_specific",
          "questionText":"How do you verify product quality?",
          "sourceQuestion":{
            "sourceCandidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001",
            "sourceQuestionKey":"slot-5"
          }
        }
      ]
    }
  $json$, v_created.candidate_practice_intent_id)::jsonb;

  select * into v_session_created
  from public.start_candidate_practice_intent_session(
    v_created.candidate_practice_intent_id,
    'e1000000-0000-4000-8000-000000000001',
    1,
    1,
    'e2000000-0000-4000-8000-000000000001',
    null,
    v_setup_snapshot,
    v_plan_snapshot,
    v_wording_snapshot,
    'worded',
    '{"status":"live_question","currentQuestionIndex":0}'::jsonb,
    '{}'::jsonb
  );

  if v_session_created.launch_outcome <> 'created'
    or v_session_created.candidate_practice_session_id is null then
    raise exception 'expected baseline-only intent to create a follow-up session';
  end if;

  insert into public.candidate_next_round_draft_items (
    candidate_next_round_draft_item_id,
    candidate_next_round_draft_id,
    candidate_profile_id,
    role_profile_id,
    source_candidate_practice_session_id,
    source_question_key,
    practice_kind,
    provenance,
    display_position
  )
  values (
    'e5000000-0000-4000-8000-000000000003',
    'e4000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'slot-6',
    'practice_missing_evidence',
    'coach_plan',
    0
  );

  select * into v_invalid
  from public.snapshot_candidate_next_round_draft_to_intent(
    'e4000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001',
    2,
    'quality inspector',
    'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect finished goods.","interviewStage":"screening","questionCount":3,"resumeIncluded":false}'::jsonb,
    '[
      {
        "kind":"practice_missing_evidence",
        "source":{"kind":"coach_update_detail","candidatePracticeSessionId":"e3000000-0000-4000-8000-000000000001","questionKey":"slot-6","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":6,"category":"Screening","questionText":"Invented question","evidenceStatus":"missing_practice_evidence"},
        "display":{"label":"Practice missing evidence","body":"Include this planned question in the next round."},
        "assembly":{"source":"next_round_draft","candidateNextRoundDraftItemId":"e5000000-0000-4000-8000-000000000003","provenance":"coach_plan","displayPosition":0}
      }
    ]'::jsonb
  );

  if v_invalid.launch_outcome <> 'invalid_items' then
    raise exception 'expected a non-baseline source key to fail closed';
  end if;

  select count(*) into v_item_count
  from public.candidate_next_round_draft_items
  where candidate_next_round_draft_id = 'e4000000-0000-4000-8000-000000000001';

  if v_item_count <> 1 then
    raise exception 'invalid launch must preserve the editable draft';
  end if;
end;
$$;

rollback;
