-- Deterministic app-owned candidate accounts for local browser validation.
-- Password for both accounts: local-only-candidate

begin;

insert into public.app_users (
  user_id,
  email,
  display_name,
  first_name,
  last_name,
  status,
  email_verified_at
)
values
  (
    '21000000-0000-4000-8000-000000000001',
    'candidate-account-primary@talentarbor.local',
    'App Candidate Primary',
    'App',
    'Primary',
    'active',
    now()
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    'candidate-account-alt@talentarbor.local',
    'App Candidate Alternate',
    'App',
    'Alternate',
    'active',
    now()
  )
on conflict (user_id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  status = excluded.status,
  email_verified_at = coalesce(public.app_users.email_verified_at, excluded.email_verified_at);

insert into public.app_user_credentials (
  user_id,
  password_hash,
  password_updated_at,
  failed_login_count,
  locked_until
)
select
  user_id,
  'scrypt$16384$8$1$candidate-app-dev-seed-v1$0OpcGy0Z4LK6LyU2Fu4RnuEjlZ3xvecAEYt1CCQ1M8fN2P9JXRHtgEkVriWUwn9uOkVXpNzblsaqnwxckRcdnA',
  now(),
  0,
  null
from public.app_users
where user_id in (
  '21000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000002'
)
on conflict (user_id) do update set
  password_hash = excluded.password_hash,
  password_updated_at = excluded.password_updated_at,
  failed_login_count = 0,
  locked_until = null;

delete from public.app_user_roles
where user_id in (
  '21000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000002'
)
  and role <> 'candidate';

insert into public.app_user_roles (user_id, role)
values
  ('21000000-0000-4000-8000-000000000001', 'candidate'),
  ('21000000-0000-4000-8000-000000000002', 'candidate')
on conflict (user_id, role) do nothing;

insert into public.candidate_profiles (
  candidate_profile_id,
  app_user_id,
  auth_subject,
  email,
  display_name,
  workspace,
  status
)
values
  (
    '12000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000001',
    'interview_coach:21000000-0000-4000-8000-000000000001',
    'candidate-account-primary@talentarbor.local',
    'App Candidate Primary',
    'interview_coach',
    'active'
  ),
  (
    '12000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000002',
    'interview_coach:21000000-0000-4000-8000-000000000002',
    'candidate-account-alt@talentarbor.local',
    'App Candidate Alternate',
    'interview_coach',
    'active'
  )
on conflict (candidate_profile_id) do update set
  app_user_id = excluded.app_user_id,
  auth_subject = excluded.auth_subject,
  email = excluded.email,
  display_name = excluded.display_name,
  workspace = excluded.workspace,
  status = excluded.status;

insert into public.candidate_account_profiles (
  candidate_profile_id,
  phone_e164,
  postal_country_code,
  postal_code
)
values
  ('12000000-0000-4000-8000-000000000001', '+13125550101', 'US', '60601'),
  ('12000000-0000-4000-8000-000000000002', '+13125550102', 'US', '60602')
on conflict (candidate_profile_id) do update set
  phone_e164 = excluded.phone_e164,
  postal_country_code = excluded.postal_country_code,
  postal_code = excluded.postal_code;

insert into public.candidate_contact_preferences (
  candidate_profile_id,
  channel,
  purpose,
  enabled
)
select
  profile_id,
  channel,
  'talentarbor_opportunities_and_updates',
  false
from unnest(array[
  '12000000-0000-4000-8000-000000000001'::uuid,
  '12000000-0000-4000-8000-000000000002'::uuid
]) profile_id
cross join unnest(array['email'::text, 'sms'::text, 'phone'::text]) channel
on conflict (candidate_profile_id, channel, purpose) do update set
  enabled = excluded.enabled,
  updated_at = now();

insert into public.candidate_consent_receipts (
  consent_receipt_id,
  candidate_profile_id,
  app_user_id,
  receipt_type,
  decision,
  document_key,
  document_version,
  document_uri,
  collection_surface
)
values
  ('22000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'terms_acceptance', 'accepted', 'talentarbor_terms_of_use', 'local-dev-seed-v1', 'https://talentarbor.com/terms-of-use', 'candidate_registration'),
  ('22000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'privacy_acknowledgement', 'accepted', 'talentarbor_privacy_policy', 'local-dev-seed-v1', 'https://talentarbor.com/privacy-policy', 'candidate_registration'),
  ('22000000-0000-4000-8000-000000000003', '12000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'cookie_policy_acknowledgement', 'accepted', 'talentarbor_cookie_policy', 'local-dev-seed-v1', 'https://talentarbor.com/cookie-policy', 'candidate_registration'),
  ('22000000-0000-4000-8000-000000000004', '12000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'responsible_ai_acknowledgement', 'accepted', 'talentarbor_responsible_ai_statement', 'local-dev-seed-v1', 'https://talentarbor.com/ResponsibleAIStatement', 'candidate_registration'),
  ('22000000-0000-4000-8000-000000000005', '12000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'contact_authorization', 'declined', 'talentarbor_contact_authorization', 'local-dev-seed-v1', 'https://talentarbor.com/privacy-policy', 'candidate_registration'),
  ('22000000-0000-4000-8000-000000000006', '12000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'terms_acceptance', 'accepted', 'talentarbor_terms_of_use', 'local-dev-seed-v1', 'https://talentarbor.com/terms-of-use', 'candidate_registration'),
  ('22000000-0000-4000-8000-000000000007', '12000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'privacy_acknowledgement', 'accepted', 'talentarbor_privacy_policy', 'local-dev-seed-v1', 'https://talentarbor.com/privacy-policy', 'candidate_registration'),
  ('22000000-0000-4000-8000-000000000008', '12000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'cookie_policy_acknowledgement', 'accepted', 'talentarbor_cookie_policy', 'local-dev-seed-v1', 'https://talentarbor.com/cookie-policy', 'candidate_registration'),
  ('22000000-0000-4000-8000-000000000009', '12000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'responsible_ai_acknowledgement', 'accepted', 'talentarbor_responsible_ai_statement', 'local-dev-seed-v1', 'https://talentarbor.com/ResponsibleAIStatement', 'candidate_registration'),
  ('22000000-0000-4000-8000-000000000010', '12000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'contact_authorization', 'declined', 'talentarbor_contact_authorization', 'local-dev-seed-v1', 'https://talentarbor.com/privacy-policy', 'candidate_registration')
on conflict (consent_receipt_id) do nothing;

commit;
