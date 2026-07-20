-- Invite bearer exchange, clean-route access sessions, and immutable initials evidence.

create table if not exists public.invited_practice_browser_sessions (
  invited_practice_browser_session_id uuid primary key,
  invited_practice_access_token_id uuid not null
    references public.invited_practice_access_tokens(invited_practice_access_token_id)
    on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint chk_invited_practice_browser_session_hash
    check (session_token_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_invited_practice_browser_session_expiry
    check (expires_at > created_at),
  constraint chk_invited_practice_browser_session_revocation
    check (revoked_at is null or revoked_at >= created_at),
  constraint chk_invited_practice_browser_session_last_seen
    check (last_seen_at >= created_at)
);

create index if not exists idx_invited_practice_browser_sessions_access_token
  on public.invited_practice_browser_sessions(invited_practice_access_token_id, created_at desc);

create index if not exists idx_invited_practice_browser_sessions_active_expiry
  on public.invited_practice_browser_sessions(expires_at)
  where revoked_at is null;

create table if not exists public.invited_practice_entry_signals (
  invited_practice_session_id uuid primary key,
  recruiter_invitation_recipient_id uuid not null,
  entered_initials text not null,
  expected_initials text not null,
  match_state text not null,
  created_at timestamptz not null default now(),
  constraint fk_invited_practice_entry_signal_session_recipient
    foreign key (invited_practice_session_id, recruiter_invitation_recipient_id)
    references public.invited_practice_sessions(invited_practice_session_id, recruiter_invitation_recipient_id)
    on delete cascade,
  constraint chk_invited_practice_entry_signal_entered
    check (
      char_length(entered_initials) between 1 and 2
      and entered_initials = upper(entered_initials)
    ),
  constraint chk_invited_practice_entry_signal_expected
    check (
      char_length(expected_initials) between 1 and 2
      and expected_initials = upper(expected_initials)
    ),
  constraint chk_invited_practice_entry_signal_match
    check (
      match_state in ('match', 'mismatch')
      and (match_state = 'match') = (entered_initials = expected_initials)
    )
);

create index if not exists idx_invited_practice_entry_signals_recipient
  on public.invited_practice_entry_signals(recruiter_invitation_recipient_id, created_at desc);

create or replace function public.prevent_invited_practice_browser_session_identity_update()
returns trigger
language plpgsql
as $$
begin
  if row(
    new.invited_practice_browser_session_id,
    new.invited_practice_access_token_id,
    new.session_token_hash,
    new.expires_at,
    new.created_at
  ) is distinct from row(
    old.invited_practice_browser_session_id,
    old.invited_practice_access_token_id,
    old.session_token_hash,
    old.expires_at,
    old.created_at
  ) then
    raise exception 'invited practice browser session identity is immutable' using errcode = '55000';
  end if;

  if old.revoked_at is not null and new.revoked_at is null then
    raise exception 'revoked invited practice browser session cannot be reactivated' using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invited_practice_browser_session_identity_immutable
  on public.invited_practice_browser_sessions;
create trigger trg_invited_practice_browser_session_identity_immutable
before update on public.invited_practice_browser_sessions
for each row execute function public.prevent_invited_practice_browser_session_identity_update();

create or replace function public.prevent_invited_practice_entry_signal_update()
returns trigger
language plpgsql
as $$
begin
  if new is distinct from old then
    raise exception 'invited practice entry signal is immutable' using errcode = '55000';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_invited_practice_entry_signal_immutable
  on public.invited_practice_entry_signals;
create trigger trg_invited_practice_entry_signal_immutable
before update on public.invited_practice_entry_signals
for each row execute function public.prevent_invited_practice_entry_signal_update();

comment on table public.invited_practice_browser_sessions is
  'Hashed invite-scoped browser sessions minted from active recruiter invitation bearer tokens.';

comment on table public.invited_practice_entry_signals is
  'First-write-wins invited-session initials match or mismatch evidence; never authentication.';
