-- Add explicit Cookie Policy evidence to app-owned candidate registration.

alter table public.candidate_consent_receipts
  drop constraint if exists candidate_consent_receipts_receipt_type_check;

alter table public.candidate_consent_receipts
  drop constraint if exists chk_candidate_consent_receipt_type;

alter table public.candidate_consent_receipts
  add constraint chk_candidate_consent_receipt_type
  check (receipt_type in (
    'terms_acceptance',
    'privacy_acknowledgement',
    'cookie_policy_acknowledgement',
    'responsible_ai_acknowledgement',
    'contact_authorization'
  ));

create or replace function public.register_candidate_app_account_v2(
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
  p_cookie_version text,
  p_cookie_uri text,
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
  v_registration record;
begin
  if length(trim(coalesce(p_cookie_version, ''))) = 0 then
    raise exception 'candidate registration input is invalid' using errcode = '22023';
  end if;

  select *
    into v_registration
  from public.register_candidate_app_account_v1(
    p_email,
    p_password_hash,
    p_first_name,
    p_last_name,
    p_phone_e164,
    p_postal_code,
    p_email_contact,
    p_sms_contact,
    p_phone_contact,
    p_contact_authorized,
    p_terms_version,
    p_terms_uri,
    p_privacy_version,
    p_privacy_uri,
    p_responsible_ai_version,
    p_responsible_ai_uri,
    p_contact_authorization_version,
    p_verification_token_hash,
    p_verification_expires_at,
    p_ip_address,
    p_user_agent
  );

  if v_registration.registration_outcome = 'created' then
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
    values (
      v_registration.registered_candidate_profile_id,
      v_registration.registered_user_id,
      'cookie_policy_acknowledgement',
      'accepted',
      'talentarbor_cookie_policy',
      p_cookie_version,
      nullif(trim(coalesce(p_cookie_uri, '')), ''),
      'candidate_registration',
      nullif(p_ip_address, '')::inet,
      nullif(p_user_agent, '')
    );
  end if;

  return query
  select
    v_registration.registration_outcome::text,
    v_registration.registered_user_id::uuid,
    v_registration.registered_candidate_profile_id::uuid,
    v_registration.verification_token_id::uuid;
end;
$$;
