-- App-owned candidate registration, profile, consent, and email-verification lifecycle.

create table if not exists public.candidate_account_profiles (
  candidate_profile_id uuid primary key
    references public.candidate_profiles(candidate_profile_id) on delete cascade,
  phone_e164 text not null,
  phone_verified_at timestamptz,
  postal_country_code text not null default 'US',
  postal_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_candidate_account_profiles_phone_e164
    check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint chk_candidate_account_profiles_country
    check (postal_country_code ~ '^[A-Z]{2}$'),
  constraint chk_candidate_account_profiles_postal_code_nonempty
    check (length(trim(postal_code)) > 0)
);

drop trigger if exists trg_candidate_account_profiles_updated_at
  on public.candidate_account_profiles;
create trigger trg_candidate_account_profiles_updated_at
before update on public.candidate_account_profiles
for each row execute function public.set_updated_at();

create table if not exists public.candidate_contact_preferences (
  candidate_profile_id uuid not null
    references public.candidate_profiles(candidate_profile_id) on delete cascade,
  channel text not null
    check (channel in ('email', 'sms', 'phone')),
  purpose text not null default 'talentarbor_opportunities_and_updates'
    check (purpose = 'talentarbor_opportunities_and_updates'),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (candidate_profile_id, channel, purpose)
);

create table if not exists public.candidate_consent_receipts (
  consent_receipt_id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null
    references public.candidate_profiles(candidate_profile_id) on delete cascade,
  app_user_id uuid not null
    references public.app_users(user_id) on delete cascade,
  receipt_type text not null
    check (receipt_type in (
      'terms_acceptance',
      'privacy_acknowledgement',
      'responsible_ai_acknowledgement',
      'contact_authorization'
    )),
  decision text not null
    check (decision in ('accepted', 'declined', 'withdrawn')),
  document_key text not null,
  document_version text not null,
  document_uri text,
  collection_surface text not null
    check (collection_surface in ('candidate_registration', 'candidate_settings')),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint chk_candidate_consent_document_key_nonempty
    check (length(trim(document_key)) > 0),
  constraint chk_candidate_consent_document_version_nonempty
    check (length(trim(document_version)) > 0)
);

create index if not exists idx_candidate_consent_receipts_profile_time
  on public.candidate_consent_receipts(candidate_profile_id, created_at desc);

create or replace function public.prevent_candidate_consent_receipt_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'candidate consent receipts are immutable' using errcode = '55000';
end;
$$;

drop trigger if exists trg_candidate_consent_receipts_immutable
  on public.candidate_consent_receipts;
create trigger trg_candidate_consent_receipts_immutable
before update or delete on public.candidate_consent_receipts
for each row execute function public.prevent_candidate_consent_receipt_mutation();

create or replace function public.register_candidate_app_account_v1(
  p_email text,
  p_password_hash text,
  p_first_name text,
  p_last_name text,
  p_phone_e164 text,
  p_postal_code text,
  p_email_contact boolean,
  p_sms_contact boolean,
  p_phone_contact boolean,
  p_contact_authorized boolean,
  p_terms_version text,
  p_terms_uri text,
  p_privacy_version text,
  p_privacy_uri text,
  p_responsible_ai_version text,
  p_responsible_ai_uri text,
  p_contact_authorization_version text,
  p_verification_token_hash text,
  p_verification_expires_at timestamptz,
  p_ip_address text,
  p_user_agent text
)
returns table (
  registration_outcome text,
  registered_user_id uuid,
  registered_candidate_profile_id uuid,
  verification_token_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_first_name text := trim(coalesce(p_first_name, ''));
  v_last_name text := trim(coalesce(p_last_name, ''));
  v_display_name text;
  v_user_id uuid;
  v_candidate_profile_id uuid;
  v_token_id uuid;
begin
  if position('@' in v_email) <= 1
     or length(trim(coalesce(p_password_hash, ''))) = 0
     or length(v_first_name) = 0
     or length(v_last_name) = 0
     or coalesce(p_phone_e164, '') !~ '^\+[1-9][0-9]{7,14}$'
     or coalesce(p_postal_code, '') !~ '^[0-9]{5}(-[0-9]{4})?$'
     or coalesce(p_verification_token_hash, '') !~ '^[0-9a-f]{64}$'
     or p_verification_expires_at <= now()
     or length(trim(coalesce(p_terms_version, ''))) = 0
     or length(trim(coalesce(p_privacy_version, ''))) = 0
     or length(trim(coalesce(p_responsible_ai_version, ''))) = 0
     or length(trim(coalesce(p_contact_authorization_version, ''))) = 0 then
    raise exception 'candidate registration input is invalid' using errcode = '22023';
  end if;

  if coalesce(p_contact_authorized, false)
       is distinct from (
         coalesce(p_email_contact, false)
         or coalesce(p_sms_contact, false)
         or coalesce(p_phone_contact, false)
       ) then
    raise exception 'contact authorization must match selected channels' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('candidate-registration:' || v_email, 0));

  select app_user.user_id
    into v_user_id
  from public.app_users app_user
  where lower(app_user.email) = v_email
  limit 1;

  if v_user_id is not null then
    return query select 'exists'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  v_display_name := v_first_name || ' ' || v_last_name;

  insert into public.app_users (
    email,
    display_name,
    first_name,
    last_name,
    status,
    email_verified_at
  )
  values (
    v_email,
    v_display_name,
    v_first_name,
    v_last_name,
    'active',
    null
  )
  returning user_id into v_user_id;

  insert into public.app_user_credentials (user_id, password_hash)
  values (v_user_id, p_password_hash);

  insert into public.app_user_roles (user_id, role)
  values (v_user_id, 'candidate');

  insert into public.candidate_profiles (
    app_user_id,
    auth_subject,
    email,
    display_name,
    workspace,
    status
  )
  values (
    v_user_id,
    'interview_coach:' || v_user_id::text,
    v_email,
    v_display_name,
    'interview_coach',
    'active'
  )
  returning candidate_profile_id into v_candidate_profile_id;

  insert into public.candidate_account_profiles (
    candidate_profile_id,
    phone_e164,
    postal_country_code,
    postal_code
  )
  values (
    v_candidate_profile_id,
    p_phone_e164,
    'US',
    p_postal_code
  );

  insert into public.candidate_contact_preferences (
    candidate_profile_id,
    channel,
    enabled
  )
  values
    (v_candidate_profile_id, 'email', coalesce(p_email_contact, false)),
    (v_candidate_profile_id, 'sms', coalesce(p_sms_contact, false)),
    (v_candidate_profile_id, 'phone', coalesce(p_phone_contact, false));

  insert into public.candidate_consent_receipts (
    candidate_profile_id,
    app_user_id,
    receipt_type,
    decision,
    document_key,
    document_version,
    document_uri,
    collection_surface,
    ip_address,
    user_agent
  )
  values
    (
      v_candidate_profile_id,
      v_user_id,
      'terms_acceptance',
      'accepted',
      'talentarbor_terms_of_use',
      p_terms_version,
      nullif(trim(coalesce(p_terms_uri, '')), ''),
      'candidate_registration',
      nullif(p_ip_address, '')::inet,
      nullif(p_user_agent, '')
    ),
    (
      v_candidate_profile_id,
      v_user_id,
      'privacy_acknowledgement',
      'accepted',
      'talentarbor_privacy_policy',
      p_privacy_version,
      nullif(trim(coalesce(p_privacy_uri, '')), ''),
      'candidate_registration',
      nullif(p_ip_address, '')::inet,
      nullif(p_user_agent, '')
    ),
    (
      v_candidate_profile_id,
      v_user_id,
      'responsible_ai_acknowledgement',
      'accepted',
      'talentarbor_responsible_ai_statement',
      p_responsible_ai_version,
      nullif(trim(coalesce(p_responsible_ai_uri, '')), ''),
      'candidate_registration',
      nullif(p_ip_address, '')::inet,
      nullif(p_user_agent, '')
    ),
    (
      v_candidate_profile_id,
      v_user_id,
      'contact_authorization',
      case when p_contact_authorized then 'accepted' else 'declined' end,
      'talentarbor_contact_authorization',
      p_contact_authorization_version,
      nullif(trim(coalesce(p_privacy_uri, '')), ''),
      'candidate_registration',
      nullif(p_ip_address, '')::inet,
      nullif(p_user_agent, '')
    );

  insert into public.email_verification_tokens (
    user_id,
    token_hash,
    expires_at
  )
  values (
    v_user_id,
    p_verification_token_hash,
    p_verification_expires_at
  )
  returning token_id into v_token_id;

  insert into public.auth_audit_events (
    user_id,
    event_type,
    outcome,
    ip_address,
    user_agent,
    metadata
  )
  values (
    v_user_id,
    'candidate_registration',
    'success',
    nullif(p_ip_address, '')::inet,
    nullif(p_user_agent, ''),
    '{"reason":"candidate_account_created"}'::jsonb
  );

  return query select 'created'::text, v_user_id, v_candidate_profile_id, v_token_id;
end;
$$;

create or replace function public.issue_candidate_email_verification_v1(
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
    raise exception 'candidate verification issue input is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('candidate-verification:' || v_email, 0));

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
    and app_user.email_verified_at is null
  limit 1;

  if v_user_id is null then
    return query select 'ignored'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  if exists (
    select 1
    from public.email_verification_tokens token
    where token.user_id = v_user_id
      and token.used_at is null
      and token.expires_at > now()
      and token.created_at > now() - interval '60 seconds'
  ) then
    return query select 'cooldown'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  update public.email_verification_tokens
  set used_at = now()
  where user_id = v_user_id
    and used_at is null;

  insert into public.email_verification_tokens (
    user_id,
    token_hash,
    expires_at
  )
  values (v_user_id, p_token_hash, p_expires_at)
  returning token_id into v_token_id;

  return query select 'issued'::text, v_user_id, v_token_id, v_first_name;
end;
$$;

create or replace function public.invalidate_candidate_email_verification_v1(
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
  update public.email_verification_tokens token
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

create or replace function public.consume_candidate_email_verification_v1(
  p_token_hash text
)
returns table (
  verification_outcome text,
  verified_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.email_verification_tokens%rowtype;
  v_email_verified_at timestamptz;
begin
  if coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  select token.*
    into v_token
  from public.email_verification_tokens token
  join public.app_user_roles app_role
    on app_role.user_id = token.user_id
   and app_role.role = 'candidate'
  join public.candidate_profiles profile
    on profile.app_user_id = token.user_id
   and profile.workspace = 'interview_coach'
   and profile.status = 'active'
  where token.token_hash = p_token_hash
  for update of token;

  if not found then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  select app_user.email_verified_at
    into v_email_verified_at
  from public.app_users app_user
  where app_user.user_id = v_token.user_id
    and app_user.status = 'active'
  for update;

  if not found then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  if v_email_verified_at is not null and v_token.used_at is not null then
    return query select 'already_verified'::text, v_token.user_id;
    return;
  end if;

  if v_token.used_at is not null then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  if v_token.expires_at <= now() then
    update public.email_verification_tokens
    set used_at = now()
    where token_id = v_token.token_id;
    return query select 'expired'::text, null::uuid;
    return;
  end if;

  update public.app_users
  set email_verified_at = now()
  where user_id = v_token.user_id
    and email_verified_at is null;

  update public.email_verification_tokens
  set used_at = now()
  where user_id = v_token.user_id
    and used_at is null;

  insert into public.auth_audit_events (
    user_id,
    event_type,
    outcome,
    metadata
  )
  values (
    v_token.user_id,
    'candidate_email_verification',
    'success',
    '{"reason":"email_verified"}'::jsonb
  );

  return query select 'verified'::text, v_token.user_id;
end;
$$;

comment on table public.candidate_account_profiles is
  'TA-aligned app-owned candidate profile extension. Phone is not an authenticator until separately verified.';

comment on table public.candidate_consent_receipts is
  'Append-only candidate policy and contact-authorization evidence. Current contact preferences remain separate mutable state.';
