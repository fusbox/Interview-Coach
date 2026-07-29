begin;

insert into public.password_reset_tokens (
  token_id,
  user_id,
  token_hash,
  expires_at
)
values (
  '23000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  now() + interval '30 minutes'
);

insert into public.app_sessions (
  session_id,
  user_id,
  session_token_hash,
  expires_at
)
values
  ('24000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', repeat('b', 64), now() + interval '1 day'),
  ('24000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', repeat('c', 64), now() + interval '1 day');

select *
from public.consume_candidate_password_reset_v1(
  repeat('a', 64),
  'scrypt$smoke-reset-hash',
  '127.0.0.1',
  'candidate-recovery-smoke'
);

do $$
begin
  if (
    select count(*)
    from public.app_sessions
    where user_id = '21000000-0000-4000-8000-000000000001'
      and revoked_at is null
  ) <> 0 then
    raise exception 'Candidate password reset left an app session active.';
  end if;

  if not exists (
    select 1
    from public.app_user_credentials
    where user_id = '21000000-0000-4000-8000-000000000001'
      and password_hash = 'scrypt$smoke-reset-hash'
      and failed_login_count = 0
      and locked_until is null
  ) then
    raise exception 'Candidate password reset did not replace the credential.';
  end if;

  if not exists (
    select 1
    from public.password_reset_tokens
    where token_id = '23000000-0000-4000-8000-000000000001'
      and used_at is not null
  ) then
    raise exception 'Candidate password reset token was not consumed.';
  end if;
end;
$$;

do $$
declare
  v_replay record;
begin
  select *
    into v_replay
  from public.consume_candidate_password_reset_v1(
    repeat('a', 64),
    'scrypt$replay-must-not-win',
    '127.0.0.1',
    'candidate-recovery-smoke'
  );

  if v_replay.reset_outcome <> 'invalid' then
    raise exception 'Candidate password reset replay was not rejected.';
  end if;
end;
$$;

rollback;
