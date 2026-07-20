-- Candidate-only invited debrief recovery and replay-safe whole-session repeat.

create unique index if not exists uq_invited_practice_session_direct_child
  on public.invited_practice_sessions(parent_invited_practice_session_id)
  where parent_invited_practice_session_id is not null;

create or replace function public.advance_invited_practice_attempt(
  p_current_browser_session_token_hash text,
  p_expected_parent_session_id uuid,
  p_new_session_id uuid,
  p_new_browser_session_id uuid,
  p_new_browser_session_token_hash text,
  p_requested_expires_at timestamptz
)
returns table (
  outcome text,
  invited_practice_session_id uuid,
  browser_session_expires_at timestamptz
)
language plpgsql
as $$
declare
  v_browser public.invited_practice_browser_sessions%rowtype;
  v_token public.invited_practice_access_tokens%rowtype;
  v_recipient public.recruiter_invitation_recipients%rowtype;
  v_latest public.invited_practice_sessions%rowtype;
  v_target public.invited_practice_sessions%rowtype;
  v_expires_at timestamptz;
  v_outcome text;
begin
  select browser.*
  into v_browser
  from public.invited_practice_browser_sessions browser
  where browser.session_token_hash = p_current_browser_session_token_hash
    and browser.revoked_at is null
    and browser.expires_at > now()
  for update;

  if not found then
    return;
  end if;

  select token.*
  into v_token
  from public.invited_practice_access_tokens token
  where token.invited_practice_access_token_id = v_browser.invited_practice_access_token_id
    and token.revoked_at is null
    and token.expires_at > now()
  for update;

  if not found then
    return;
  end if;

  select recipient.*
  into v_recipient
  from public.recruiter_invitation_recipients recipient
  join public.recruiter_invitation_batches batch
    on batch.recruiter_invitation_batch_id = recipient.recruiter_invitation_batch_id
   and batch.recruiter_id = recipient.recruiter_id
  where recipient.recruiter_invitation_recipient_id = v_token.recruiter_invitation_recipient_id
    and recipient.lifecycle_state = 'ready'
    and batch.lifecycle_state = 'ready'
  for update of recipient;

  if not found then
    return;
  end if;

  select session.*
  into v_latest
  from public.invited_practice_sessions session
  where session.recruiter_invitation_recipient_id = v_recipient.recruiter_invitation_recipient_id
    and session.recruiter_id = v_recipient.recruiter_id
  order by session.attempt_number desc
  limit 1
  for update;

  if not found then
    return;
  end if;

  if v_latest.invited_practice_session_id = p_expected_parent_session_id then
    if v_latest.status <> 'completed' then
      return query select 'invalid_state'::text, null::uuid, null::timestamptz;
      return;
    end if;

    insert into public.invited_practice_sessions (
      invited_practice_session_id,
      recruiter_invitation_recipient_id,
      recruiter_id,
      parent_invited_practice_session_id,
      attempt_number,
      status,
      setup_snapshot_json,
      question_plan_snapshot_json,
      question_wording_snapshot_json,
      progress_state_json,
      answer_drafts_json,
      answer_submissions_json,
      answer_idempotency_json,
      answer_analysis_snapshots_json,
      feedback_actions_json,
      completion_snapshot_json
    ) values (
      p_new_session_id,
      v_latest.recruiter_invitation_recipient_id,
      v_latest.recruiter_id,
      v_latest.invited_practice_session_id,
      v_latest.attempt_number + 1,
      'planned',
      v_latest.setup_snapshot_json,
      v_latest.question_plan_snapshot_json,
      v_latest.question_wording_snapshot_json,
      '{"status":"planned","currentQuestionIndex":0}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      null
    )
    returning * into v_target;
    v_outcome := 'created';
  elsif v_latest.parent_invited_practice_session_id = p_expected_parent_session_id then
    v_target := v_latest;
    v_outcome := 'replayed';
  else
    return query select 'stale_parent'::text, null::uuid, null::timestamptz;
    return;
  end if;

  v_expires_at := least(p_requested_expires_at, v_token.expires_at);
  if v_expires_at <= now() then
    return;
  end if;

  insert into public.invited_practice_browser_sessions (
    invited_practice_browser_session_id,
    invited_practice_access_token_id,
    session_token_hash,
    expires_at,
    created_at,
    last_seen_at
  ) values (
    p_new_browser_session_id,
    v_token.invited_practice_access_token_id,
    p_new_browser_session_token_hash,
    v_expires_at,
    now(),
    now()
  );

  return query
  select v_outcome, v_target.invited_practice_session_id, v_expires_at;
end;
$$;

comment on function public.advance_invited_practice_attempt(text, uuid, uuid, uuid, text, timestamptz) is
  'Creates or replays one immutable child attempt and atomically mints a fresh clean invite browser session.';
