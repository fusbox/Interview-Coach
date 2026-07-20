-- Rollback-only smoke for recruiter-owned invited-practice identity and session creation.

begin;

insert into public.app_users (user_id, email, display_name, status) values
  ('f1000000-0000-4000-8000-000000000001', 'invite-owner-a@example.invalid', 'Invite Owner A', 'active'),
  ('f1000000-0000-4000-8000-000000000002', 'invite-owner-b@example.invalid', 'Invite Owner B', 'active'),
  ('f1000000-0000-4000-8000-000000000003', 'invite-roleless@example.invalid', 'Invite Roleless', 'active');

insert into public.app_user_roles (user_id, role) values
  ('f1000000-0000-4000-8000-000000000001', 'recruiter'),
  ('f1000000-0000-4000-8000-000000000002', 'recruiter');

do $$
declare
  v_plan jsonb := '{"interviewStage":"screening","questionCount":2,"categoryCounts":{"screening":1,"behavioral":1,"culture_fit":0,"case_scenario":0,"technical_role_specific":0},"slots":[{"id":"slot-1","index":0,"category":"screening","label":"Screening","purpose":"Basic fit."},{"id":"slot-2","index":1,"category":"behavioral","label":"Behavioral","purpose":"Past example."}]}'::jsonb;
  v_wording jsonb := '{"status":"questions_worded","questions":[{"slotId":"slot-1","index":0,"category":"screening","questionText":"Why does this role interest you?"},{"slotId":"slot-2","index":1,"category":"behavioral","questionText":"Tell me about similar work."}]}'::jsonb;
  v_recipients jsonb;
  v_created record;
  v_replayed record;
  v_conflict record;
  v_other_owner record;
  v_recovered record;
  v_count integer;
  v_candidate_profiles_before integer;
  v_candidate_sessions_before integer;
begin
  select count(*) into v_candidate_profiles_before from public.candidate_profiles;
  select count(*) into v_candidate_sessions_before from public.candidate_practice_sessions;

  begin
    perform * from public.create_recruiter_invitation_aggregate(
      'f1000000-0000-4000-8000-000000000003',
      repeat('9', 64),
      repeat('0', 64),
      'f4000000-0000-4000-8000-000000000090',
      'Unauthorized Role',
      null,
      'screening',
      v_plan,
      v_wording,
      jsonb_build_array(jsonb_build_object(
        'candidateIndex', 0,
        'recipientId', 'f2000000-0000-4000-8000-000000000090',
        'sessionId', 'f3000000-0000-4000-8000-000000000090',
        'firstName', 'Denied',
        'lastName', 'User',
        'email', 'denied@example.invalid',
        'requisitionReference', null,
        'resumeText', null,
        'tokenHash', repeat('9', 64),
        'tokenCiphertext', 'v1.key.iv.tag.denied',
        'encryptionKeyId', 'smoke-key',
        'tokenExpiresAt', now() + interval '14 days'
      ))
    );
    raise exception 'expected roleless invitation creation denial';
  exception
    when insufficient_privilege then null;
  end;

  v_recipients := jsonb_build_array(
    jsonb_build_object(
      'candidateIndex', 0,
      'recipientId', 'f2000000-0000-4000-8000-000000000001',
      'sessionId', 'f3000000-0000-4000-8000-000000000001',
      'firstName', 'Irma',
      'lastName', 'Castillo',
      'email', 'irma.invited@example.invalid',
      'requisitionReference', 'REQ-100',
      'resumeText', 'Inspected outbound packages.',
      'tokenHash', repeat('a', 64),
      'tokenCiphertext', 'v1.key.iv.tag.ciphertext-a',
      'encryptionKeyId', 'smoke-key',
      'tokenExpiresAt', now() + interval '14 days'
    ),
    jsonb_build_object(
      'candidateIndex', 1,
      'recipientId', 'f2000000-0000-4000-8000-000000000002',
      'sessionId', 'f3000000-0000-4000-8000-000000000002',
      'firstName', 'Jordan',
      'lastName', 'Lee',
      'email', 'jordan.invited@example.invalid',
      'requisitionReference', 'REQ-101',
      'resumeText', null,
      'tokenHash', repeat('b', 64),
      'tokenCiphertext', 'v1.key.iv.tag.ciphertext-b',
      'encryptionKeyId', 'smoke-key',
      'tokenExpiresAt', now() + interval '14 days'
    )
  );

  select * into v_created
  from public.create_recruiter_invitation_aggregate(
    'f1000000-0000-4000-8000-000000000001',
    repeat('1', 64),
    repeat('2', 64),
    'f4000000-0000-4000-8000-000000000001',
    'Quality Inspector',
    'Inspect packaged goods.',
    'screening',
    v_plan,
    v_wording,
    v_recipients
  );

  select * into v_replayed
  from public.create_recruiter_invitation_aggregate(
    'f1000000-0000-4000-8000-000000000001',
    repeat('1', 64),
    repeat('2', 64),
    'f4000000-0000-4000-8000-000000000099',
    'Quality Inspector',
    'Inspect packaged goods.',
    'screening',
    v_plan,
    v_wording,
    jsonb_set(v_recipients, '{0,tokenHash}', to_jsonb(repeat('c', 64)))
  );

  if v_created.creation_outcome <> 'created'
     or v_replayed.creation_outcome <> 'replayed'
     or v_replayed.recruiter_invitation_batch_id <> v_created.recruiter_invitation_batch_id then
    raise exception 'expected exact invitation replay to return one aggregate';
  end if;

  select * into v_conflict
  from public.create_recruiter_invitation_aggregate(
    'f1000000-0000-4000-8000-000000000001',
    repeat('1', 64),
    repeat('3', 64),
    'f4000000-0000-4000-8000-000000000098',
    'Changed Role',
    'Changed description.',
    'screening',
    v_plan,
    v_wording,
    v_recipients
  );

  if v_conflict.creation_outcome <> 'conflict' then
    raise exception 'expected changed content under a live key to conflict';
  end if;

  select count(*) into v_count
  from public.recruiter_invitation_batches batch
  where batch.recruiter_id = 'f1000000-0000-4000-8000-000000000001';
  if v_count <> 1 then
    raise exception 'expected one aggregate for create, replay, and conflict';
  end if;

  select count(*) into v_count
  from public.recruiter_invitation_recipients recipient
  join public.invited_practice_sessions session
    on session.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
   and session.recruiter_id = recipient.recruiter_id
  join public.invited_practice_access_tokens token
    on token.invited_practice_session_id = session.invited_practice_session_id
   and token.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
  where recipient.recruiter_invitation_batch_id = v_created.recruiter_invitation_batch_id;
  if v_count <> 2 then
    raise exception 'expected two complete recipient/session/token identities';
  end if;

  select * into v_other_owner
  from public.create_recruiter_invitation_aggregate(
    'f1000000-0000-4000-8000-000000000002',
    repeat('1', 64),
    repeat('2', 64),
    'f4000000-0000-4000-8000-000000000002',
    'Quality Inspector',
    'Inspect packaged goods.',
    'screening',
    v_plan,
    v_wording,
    jsonb_build_array(jsonb_build_object(
      'candidateIndex', 0,
      'recipientId', 'f2000000-0000-4000-8000-000000000003',
      'sessionId', 'f3000000-0000-4000-8000-000000000003',
      'firstName', 'Alex',
      'lastName', 'Morgan',
      'email', 'alex.invited@example.invalid',
      'requisitionReference', null,
      'resumeText', null,
      'tokenHash', repeat('d', 64),
      'tokenCiphertext', 'v1.key.iv.tag.ciphertext-d',
      'encryptionKeyId', 'smoke-key',
      'tokenExpiresAt', now() + interval '14 days'
    ))
  );
  if v_other_owner.creation_outcome <> 'created'
     or v_other_owner.recruiter_invitation_batch_id = v_created.recruiter_invitation_batch_id then
    raise exception 'expected the same raw request key to remain recruiter-scoped';
  end if;

  select count(*) into v_count
  from public.recruiter_invitation_batches batch
  where batch.recruiter_invitation_batch_id = v_created.recruiter_invitation_batch_id
    and batch.recruiter_id = 'f1000000-0000-4000-8000-000000000002';
  if v_count <> 0 then
    raise exception 'expected cross-recruiter ownership lookup denial';
  end if;

  begin
    update public.recruiter_invitation_batches
    set recruiter_id = 'f1000000-0000-4000-8000-000000000002'
    where recruiter_invitation_batch_id = v_created.recruiter_invitation_batch_id;
    raise exception 'expected immutable recruiter ownership rejection';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  insert into public.invited_practice_sessions (
    invited_practice_session_id,
    recruiter_invitation_recipient_id,
    recruiter_id,
    parent_invited_practice_session_id,
    attempt_number,
    status,
    setup_snapshot_json,
    question_plan_snapshot_json,
    question_wording_snapshot_json
  )
  select
    'f3000000-0000-4000-8000-000000000011',
    session.recruiter_invitation_recipient_id,
    session.recruiter_id,
    session.invited_practice_session_id,
    2,
    'planned',
    session.setup_snapshot_json,
    session.question_plan_snapshot_json,
    session.question_wording_snapshot_json
  from public.invited_practice_sessions session
  where session.invited_practice_session_id = 'f3000000-0000-4000-8000-000000000001';

  begin
    insert into public.invited_practice_sessions (
      invited_practice_session_id,
      recruiter_invitation_recipient_id,
      recruiter_id,
      parent_invited_practice_session_id,
      attempt_number,
      status,
      setup_snapshot_json,
      question_plan_snapshot_json,
      question_wording_snapshot_json
    )
    select
      'f3000000-0000-4000-8000-000000000012',
      'f2000000-0000-4000-8000-000000000002',
      session.recruiter_id,
      session.invited_practice_session_id,
      2,
      'planned',
      session.setup_snapshot_json,
      session.question_plan_snapshot_json,
      session.question_wording_snapshot_json
    from public.invited_practice_sessions session
    where session.invited_practice_session_id = 'f3000000-0000-4000-8000-000000000001';
    raise exception 'expected cross-recipient attempt lineage rejection';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.invited_practice_access_tokens (
      invited_practice_session_id,
      recruiter_invitation_recipient_id,
      token_hash,
      token_ciphertext,
      encryption_key_id,
      expires_at
    ) values (
      'f3000000-0000-4000-8000-000000000011',
      'f2000000-0000-4000-8000-000000000002',
      repeat('e', 64),
      'v1.key.iv.tag.mismatch',
      'smoke-key',
      now() + interval '14 days'
    );
    raise exception 'expected token recipient/session mismatch rejection';
  exception
    when foreign_key_violation then null;
  end;

  create or replace function pg_temp.fail_invited_token_once()
  returns trigger language plpgsql as $trigger$
  begin
    if new.token_hash = repeat('f', 64) then
      raise exception 'forced invited token persistence failure';
    end if;
    return new;
  end;
  $trigger$;

  create trigger trg_fail_invited_token_once
  before insert on public.invited_practice_access_tokens
  for each row execute function pg_temp.fail_invited_token_once();

  begin
    perform * from public.create_recruiter_invitation_aggregate(
      'f1000000-0000-4000-8000-000000000001',
      repeat('4', 64),
      repeat('5', 64),
      'f4000000-0000-4000-8000-000000000003',
      'Failure Inspector',
      'Force one atomic failure.',
      'screening',
      v_plan,
      v_wording,
      jsonb_build_array(jsonb_build_object(
        'candidateIndex', 0,
        'recipientId', 'f2000000-0000-4000-8000-000000000004',
        'sessionId', 'f3000000-0000-4000-8000-000000000004',
        'firstName', 'Failure',
        'lastName', 'Case',
        'email', 'failure.invited@example.invalid',
        'requisitionReference', null,
        'resumeText', null,
        'tokenHash', repeat('f', 64),
        'tokenCiphertext', 'v1.key.iv.tag.failure',
        'encryptionKeyId', 'smoke-key',
        'tokenExpiresAt', now() + interval '14 days'
      ))
    );
    raise exception 'expected forced aggregate persistence failure';
  exception
    when others then
      if sqlerrm = 'expected forced aggregate persistence failure' then
        raise;
      end if;
  end;

  select count(*) into v_count
  from public.recruiter_invitation_batches
  where recruiter_invitation_batch_id = 'f4000000-0000-4000-8000-000000000003';
  if v_count <> 0 then
    raise exception 'expected failed aggregate to roll back its batch';
  end if;

  select count(*) into v_count
  from public.recruiter_invitation_creation_requests
  where recruiter_id = 'f1000000-0000-4000-8000-000000000001'
    and idempotency_key_hash = repeat('4', 64);
  if v_count <> 0 then
    raise exception 'expected failed aggregate to leave no idempotency pointer';
  end if;

  drop trigger trg_fail_invited_token_once on public.invited_practice_access_tokens;

  select * into v_recovered
  from public.create_recruiter_invitation_aggregate(
    'f1000000-0000-4000-8000-000000000001',
    repeat('4', 64),
    repeat('5', 64),
    'f4000000-0000-4000-8000-000000000003',
    'Failure Inspector',
    'Force one atomic failure.',
    'screening',
    v_plan,
    v_wording,
    jsonb_build_array(jsonb_build_object(
      'candidateIndex', 0,
      'recipientId', 'f2000000-0000-4000-8000-000000000004',
      'sessionId', 'f3000000-0000-4000-8000-000000000004',
      'firstName', 'Failure',
      'lastName', 'Case',
      'email', 'failure.invited@example.invalid',
      'requisitionReference', null,
      'resumeText', null,
      'tokenHash', repeat('f', 64),
      'tokenCiphertext', 'v1.key.iv.tag.failure',
      'encryptionKeyId', 'smoke-key',
      'tokenExpiresAt', now() + interval '14 days'
    ))
  );
  if v_recovered.creation_outcome <> 'created' then
    raise exception 'expected same request to recover after atomic rollback';
  end if;

  select count(*) into v_count from public.candidate_profiles;
  if v_count <> v_candidate_profiles_before then
    raise exception 'invited creation must not create candidate profiles';
  end if;
  select count(*) into v_count from public.candidate_practice_sessions;
  if v_count <> v_candidate_sessions_before then
    raise exception 'invited creation must not create candidate-led sessions';
  end if;
end;
$$;

select 'recruiter invited-practice foundation smoke passed' as result;

rollback;
