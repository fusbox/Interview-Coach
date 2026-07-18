-- Rollback-only smoke for candidate-owned direct practice-intent creation idempotency.

begin;

insert into public.candidate_profiles (
  candidate_profile_id, auth_subject, email, display_name, workspace
) values
  ('e1000000-0000-4000-8000-000000000001', 'local_dev:direct-owner-a', 'direct-a@example.invalid', 'Direct Owner A', 'local_dev'),
  ('e1000000-0000-4000-8000-000000000002', 'local_dev:direct-owner-b', 'direct-b@example.invalid', 'Direct Owner B', 'local_dev');

insert into public.candidate_role_preparation_profiles (
  role_profile_id, candidate_profile_id, target_role, normalized_target_role,
  job_description_snapshot, job_description_hash, source
) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Quality Inspector', 'quality inspector', 'Inspect goods.', 'direct-a-role', 'manual'),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', 'Quality Inspector', 'quality inspector', 'Inspect goods.', 'direct-b-role', 'manual');

do $$
declare
  v_created record;
  v_replayed record;
  v_conflict record;
  v_later record;
  v_other_candidate record;
  v_recovered record;
  v_count integer;
begin
  select * into v_created
  from public.create_candidate_direct_practice_intent(
    'e1000000-0000-4000-8000-000000000001', repeat('a', 64), repeat('b', 64),
    'coach_update_detail', 'e2000000-0000-4000-8000-000000000001',
    'quality inspector', 'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
    '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"source-session-a","questionKey":"slot-1","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one answer."}}]'::jsonb
  );

  select * into v_replayed
  from public.create_candidate_direct_practice_intent(
    'e1000000-0000-4000-8000-000000000001', repeat('a', 64), repeat('b', 64),
    'coach_update_detail', 'e2000000-0000-4000-8000-000000000001',
    'quality inspector', 'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
    '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"source-session-a","questionKey":"slot-1","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one answer."}}]'::jsonb
  );

  if v_created.creation_outcome <> 'created'
    or v_replayed.creation_outcome <> 'replayed'
    or v_replayed.candidate_practice_intent_id <> v_created.candidate_practice_intent_id then
    raise exception 'expected exact replay to recover one direct intent';
  end if;

  select count(*) into v_count
  from public.candidate_practice_intent_creation_requests request
  join public.candidate_practice_intents intent
    on intent.candidate_practice_intent_id = request.candidate_practice_intent_id
   and intent.candidate_profile_id = request.candidate_profile_id
  where request.candidate_profile_id = 'e1000000-0000-4000-8000-000000000001'
    and request.idempotency_key_hash = repeat('a', 64)
    and request.expires_at = intent.expires_at;
  if v_count <> 1 then
    raise exception 'expected request replay and ready intent to share one exact expiry';
  end if;

  select * into v_conflict
  from public.create_candidate_direct_practice_intent(
    'e1000000-0000-4000-8000-000000000001', repeat('a', 64), repeat('c', 64),
    'plan_aware_queue', 'e2000000-0000-4000-8000-000000000001',
    'quality inspector', 'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
    '[{"kind":"practice_missing_evidence","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"source-session-a","questionKey":"slot-2","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":2,"category":"Behavioral","questionText":"Tell me about a quality issue.","evidenceStatus":"missing_evidence"},"display":{"label":"Practice missing evidence","body":"Practice one answer."}}]'::jsonb
  );

  select count(*) into v_count
  from public.candidate_practice_intents
  where candidate_profile_id = 'e1000000-0000-4000-8000-000000000001';
  if v_conflict.creation_outcome <> 'conflict' or v_count <> 1 then
    raise exception 'expected changed content under one key to conflict before mutation';
  end if;

  select * into v_later
  from public.create_candidate_direct_practice_intent(
    'e1000000-0000-4000-8000-000000000001', repeat('d', 64), repeat('b', 64),
    'coach_update_detail', 'e2000000-0000-4000-8000-000000000001',
    'quality inspector', 'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
    '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"source-session-a","questionKey":"slot-1","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one answer."}}]'::jsonb
  );
  if v_later.creation_outcome <> 'created'
    or v_later.candidate_practice_intent_id = v_created.candidate_practice_intent_id then
    raise exception 'expected a new action key to create a later intentional repractice';
  end if;

  select * into v_other_candidate
  from public.create_candidate_direct_practice_intent(
    'e1000000-0000-4000-8000-000000000002', repeat('a', 64), repeat('b', 64),
    'coach_update_detail', 'e2000000-0000-4000-8000-000000000002',
    'quality inspector', 'Quality Inspector',
    '{"targetRole":"Quality Inspector","jobDescription":"Inspect goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
    '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"source-session-b","questionKey":"slot-1","targetInterviewId":"quality inspector","targetRole":"Quality Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one answer."}}]'::jsonb
  );
  if v_other_candidate.creation_outcome <> 'created'
    or v_other_candidate.candidate_practice_intent_id = v_created.candidate_practice_intent_id then
    raise exception 'expected candidate-scoped isolation for the same raw action key';
  end if;

  create or replace function pg_temp.fail_direct_intent_request_once()
  returns trigger language plpgsql as $trigger$
  begin
    if new.idempotency_key_hash = repeat('e', 64) then
      raise exception 'forced direct-intent request pointer failure';
    end if;
    return new;
  end;
  $trigger$;

  create trigger trg_fail_direct_intent_request_once
  before insert on public.candidate_practice_intent_creation_requests
  for each row execute function pg_temp.fail_direct_intent_request_once();

  begin
    perform * from public.create_candidate_direct_practice_intent(
      'e1000000-0000-4000-8000-000000000001', repeat('e', 64), repeat('f', 64),
      'coach_update_detail', 'e2000000-0000-4000-8000-000000000001',
      'failure inspector', 'Failure Inspector',
      '{"targetRole":"Failure Inspector","jobDescription":"Inspect goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
      '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"source-session-a","questionKey":"slot-1","targetInterviewId":"failure inspector","targetRole":"Failure Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one answer."}}]'::jsonb
    );
    raise exception 'expected forced request pointer failure';
  exception
    when others then
      if sqlerrm = 'expected forced request pointer failure' then
        raise;
      end if;
  end;

  select count(*) into v_count
  from public.candidate_practice_intents
  where candidate_profile_id = 'e1000000-0000-4000-8000-000000000001'
    and target_role = 'Failure Inspector';
  if v_count <> 0 then
    raise exception 'expected failed request pointer write to roll back its intent';
  end if;

  drop trigger trg_fail_direct_intent_request_once
    on public.candidate_practice_intent_creation_requests;

  select * into v_recovered
  from public.create_candidate_direct_practice_intent(
    'e1000000-0000-4000-8000-000000000001', repeat('e', 64), repeat('f', 64),
    'coach_update_detail', 'e2000000-0000-4000-8000-000000000001',
    'failure inspector', 'Failure Inspector',
    '{"targetRole":"Failure Inspector","jobDescription":"Inspect goods.","interviewStage":"screening","questionCount":1,"resumeIncluded":false}'::jsonb,
    '[{"kind":"practice_from_feedback","source":{"kind":"coach_update_detail","candidatePracticeSessionId":"source-session-a","questionKey":"slot-1","targetInterviewId":"failure inspector","targetRole":"Failure Inspector","questionNumber":1,"category":"Screening","questionText":"Why does this role interest you?","evidenceStatus":"practiced_with_coaching"},"display":{"label":"Practice from coach feedback","body":"Practice one answer."}}]'::jsonb
  );
  if v_recovered.creation_outcome <> 'created' then
    raise exception 'expected same action key to retry after an atomic failure';
  end if;
end;
$$;

select 'candidate direct practice intent creation idempotency smoke passed' as result;

rollback;
