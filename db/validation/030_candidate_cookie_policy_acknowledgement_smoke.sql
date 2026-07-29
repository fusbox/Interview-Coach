begin;

select *
from public.register_candidate_app_account_v2(
  'candidate.cookie.smoke@example.com',
  'scrypt$smoke-only',
  'Cookie',
  'Smoke',
  '+13125550197',
  '60601',
  false,
  false,
  false,
  false,
  'terms-smoke-v1',
  'https://talentarbor.com/terms-of-use',
  'privacy-smoke-v1',
  'https://talentarbor.com/privacy-policy',
  'cookie-smoke-v1',
  'https://talentarbor.com/cookie-policy',
  'ai-smoke-v1',
  'https://talentarbor.com/ResponsibleAIStatement',
  'contact-smoke-v1',
  repeat('c', 64),
  now() + interval '24 hours',
  '127.0.0.1',
  'candidate-cookie-smoke'
);

do $$
declare
  v_receipt_count integer;
  v_cookie_receipt_count integer;
begin
  select count(*)
    into v_receipt_count
  from public.candidate_consent_receipts receipt
  join public.candidate_profiles profile
    on profile.candidate_profile_id = receipt.candidate_profile_id
  where profile.email = 'candidate.cookie.smoke@example.com';

  select count(*)
    into v_cookie_receipt_count
  from public.candidate_consent_receipts receipt
  join public.candidate_profiles profile
    on profile.candidate_profile_id = receipt.candidate_profile_id
  where profile.email = 'candidate.cookie.smoke@example.com'
    and receipt.receipt_type = 'cookie_policy_acknowledgement'
    and receipt.decision = 'accepted'
    and receipt.document_key = 'talentarbor_cookie_policy'
    and receipt.document_version = 'cookie-smoke-v1'
    and receipt.document_uri = 'https://talentarbor.com/cookie-policy';

  if v_receipt_count <> 5 or v_cookie_receipt_count <> 1 then
    raise exception 'Candidate Cookie Policy acknowledgement was not recorded exactly once.';
  end if;
end;
$$;

rollback;
