-- App-owned candidate password recovery and all-session revocation.

create or replace function public.issue_candidate_password_reset_v1(
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns table (
  issue_outcome text,
  issued_user_id uuid,
  issued_token_id uuid,
  issued_first_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid;
  v_first_name text;
  v_token_id uuid;
begin
  if position('@' in v_email) <= 1
     or coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$'
     or p_expires_at <= now() then
    raise exception 'candidate password reset input is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('candidate-password-reset:' || v_email, 0));

  select app_user.user_id, app_user.first_name
    into v_user_id, v_first_name
  from public.app_users app_user
  join public.app_user_roles app_role
    on app_role.user_id = app_user.user_id
   and app_role.role = 'candidate'
  join public.candidate_profiles profile
    on profile.app_user_id = app_user.user_id
   and profile.workspace = 'interview_coach'
   and profile.status = 'active'
  where lower(app_user.email) = v_email
    and app_user.status = 'active'
    and app_user.email_verified_at is not null
  limit 1;

  if v_user_id is null then
    return query select 'ignored'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  if exists (
    select 1
    from public.password_reset_tokens token
    where token.user_id = v_user_id
      and token.used_at is null
      and token.expires_at > now()
      and token.created_at > now() - interval '60 seconds'
  ) then
    return query select 'cooldown'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  update public.password_reset_tokens
  set used_at = now()
  where user_id = v_user_id
    and used_at is null;

  insert into public.password_reset_tokens (
    user_id,
    token_hash,
    expires_at
  )
  values (v_user_id, p_token_hash, p_expires_at)
  returning token_id into v_token_id;

  insert into public.auth_audit_events (
    user_id,
    event_type,
    outcome,
    metadata
  )
  values (
    v_user_id,
    'candidate_password_reset_request',
    'success',
    '{"reason":"reset_token_issued"}'::jsonb
  );

  return query select 'issued'::text, v_user_id, v_token_id, v_first_name;
end;
$$;

create or replace function public.invalidate_candidate_password_reset_v1(
  p_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed integer;
begin
  update public.password_reset_tokens token
  set used_at = now()
  from public.app_user_roles app_role
  where token.token_hash = p_token_hash
    and token.used_at is null
    and app_role.user_id = token.user_id
    and app_role.role = 'candidate';

  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;

create or replace function public.consume_candidate_password_reset_v1(
  p_token_hash text,
  p_password_hash text,
  p_ip_address text,
  p_user_agent text
)
returns table (
  reset_outcome text,
  reset_user_id uuid,
  revoked_session_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.password_reset_tokens%rowtype;
  v_revoked integer := 0;
begin
  if coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$'
     or length(trim(coalesce(p_password_hash, ''))) = 0 then
    return query select 'invalid'::text, null::uuid, 0;
    return;
  end if;

  select token.*
    into v_token
  from public.password_reset_tokens token
  join public.app_user_roles app_role
    on app_role.user_id = token.user_id
   and app_role.role = 'candidate'
  join public.candidate_profiles profile
    on profile.app_user_id = token.user_id
   and profile.workspace = 'interview_coach'
   and profile.status = 'active'
  join public.app_users app_user
    on app_user.user_id = token.user_id
   and app_user.status = 'active'
   and app_user.email_verified_at is not null
  where token.token_hash = p_token_hash
  for update of token;

  if not found or v_token.used_at is not null then
    return query select 'invalid'::text, null::uuid, 0;
    return;
  end if;

  if v_token.expires_at <= now() then
    update public.password_reset_tokens
    set used_at = now()
    where token_id = v_token.token_id;

    insert into public.auth_audit_events (
      user_id,
      event_type,
      outcome,
      ip_address,
      user_agent,
      metadata
    )
    values (
      v_token.user_id,
      'candidate_password_reset',
      'failed',
      nullif(p_ip_address, '')::inet,
      nullif(p_user_agent, ''),
      '{"reason":"reset_token_expired"}'::jsonb
    );

    return query select 'expired'::text, null::uuid, 0;
    return;
  end if;

  update public.app_user_credentials
  set
    password_hash = p_password_hash,
    password_updated_at = now(),
    failed_login_count = 0,
    locked_until = null
  where user_id = v_token.user_id;

  if not found then
    return query select 'invalid'::text, null::uuid, 0;
    return;
  end if;

  update public.password_reset_tokens
  set used_at = now()
  where user_id = v_token.user_id
    and used_at is null;

  update public.app_sessions
  set revoked_at = now()
  where user_id = v_token.user_id
    and revoked_at is null;
  get diagnostics v_revoked = row_count;

  insert into public.auth_audit_events (
    user_id,
    event_type,
    outcome,
    ip_address,
    user_agent,
    metadata
  )
  values (
    v_token.user_id,
    'candidate_password_reset',
    'success',
    nullif(p_ip_address, '')::inet,
    nullif(p_user_agent, ''),
    jsonb_build_object(
      'reason', 'password_reset',
      'revokedSessionCount', v_revoked
    )
  );

  return query select 'reset'::text, v_token.user_id, v_revoked;
end;
$$;

comment on function public.consume_candidate_password_reset_v1(text, text, text, text) is
  'Consumes one app-owned candidate reset token, updates the password, and revokes every app session atomically.';
