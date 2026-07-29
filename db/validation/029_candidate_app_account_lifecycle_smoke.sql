begin;

select *
from public.register_candidate_app_account_v1(
  ' Candidate.Account.Smoke@Example.com ',
  'scrypt$smoke-only',
  'Candidate',
  'Smoke',
  '+13125550199',
  '60601',
  true,
  false,
  false,
  true,
  'terms-smoke-v1',
  'https://talentarbor.com/terms-of-use',
  'privacy-smoke-v1',
  'https://talentarbor.com/privacy-policy',
  'ai-smoke-v1',
  'https://talentarbor.com/ResponsibleAIStatement',
  'contact-smoke-v1',
  repeat('a', 64),
  now() + interval '24 hours',
  '127.0.0.1',
  'candidate-account-smoke'
);

do $$
declare
  v_user_count integer;
  v_profile_count integer;
  v_receipt_count integer;
  v_preference_count integer;
begin
  select count(*) into v_user_count
  from public.app_users
  where lower(email) = 'candidate.account.smoke@example.com';

  select count(*) into v_profile_count
  from public.candidate_profiles profile
  join public.candidate_account_profiles account_profile
    on account_profile.candidate_profile_id = profile.candidate_profile_id
  where profile.email = 'candidate.account.smoke@example.com'
    and profile.workspace = 'interview_coach'
    and account_profile.phone_e164 = '+13125550199'
    and account_profile.postal_code = '60601';

  select count(*) into v_receipt_count
  from public.candidate_consent_receipts receipt
  join public.candidate_profiles profile
    on profile.candidate_profile_id = receipt.candidate_profile_id
  where profile.email = 'candidate.account.smoke@example.com';

  select count(*) into v_preference_count
  from public.candidate_contact_preferences preference
  join public.candidate_profiles profile
    on profile.candidate_profile_id = preference.candidate_profile_id
  where profile.email = 'candidate.account.smoke@example.com';

  if v_user_count <> 1 or v_profile_count <> 1 or v_receipt_count <> 4 or v_preference_count <> 3 then
    raise exception 'Candidate registration did not create one complete account graph.';
  end if;
end;
$$;

select *
from public.register_candidate_app_account_v1(
  'candidate.account.smoke@example.com',
  'scrypt$different',
  'Duplicate',
  'Candidate',
  '+13125550198',
  '60602',
  false,
  false,
  false,
  false,
  'terms-smoke-v1',
  'https://talentarbor.com/terms-of-use',
  'privacy-smoke-v1',
  'https://talentarbor.com/privacy-policy',
  'ai-smoke-v1',
  'https://talentarbor.com/ResponsibleAIStatement',
  'contact-smoke-v1',
  repeat('b', 64),
  now() + interval '24 hours',
  '127.0.0.1',
  'candidate-account-smoke'
);

do $$
begin
  if (
    select count(*)
    from public.app_users
    where lower(email) = 'candidate.account.smoke@example.com'
  ) <> 1 then
    raise exception 'Duplicate registration created another app user.';
  end if;

  begin
    update public.candidate_consent_receipts
    set decision = 'withdrawn'
    where candidate_profile_id = (
      select candidate_profile_id
      from public.candidate_profiles
      where email = 'candidate.account.smoke@example.com'
    );
    raise exception 'Expected consent receipt mutation to fail.';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end;
$$;

select *
from public.consume_candidate_email_verification_v1(repeat('a', 64));

do $$
begin
  if not exists (
    select 1
    from public.app_users
    where lower(email) = 'candidate.account.smoke@example.com'
      and email_verified_at is not null
  ) then
    raise exception 'Candidate email was not verified.';
  end if;
end;
$$;

select *
from public.consume_candidate_email_verification_v1(repeat('a', 64));

rollback;
