-- Rollback-only smoke validation for db/seeds/001_candidate_dev_seed.sql.

begin;

do $$
declare
  v_primary_profile_id uuid;
  v_alt_profile_id uuid;
  v_count integer;
begin
  select candidate_profile_id
  into v_primary_profile_id
  from public.candidate_profiles
  where email = 'candidate-dev-primary@talentarbor.local';

  if v_primary_profile_id is null then
    raise exception 'expected primary seeded candidate profile';
  end if;

  select candidate_profile_id
  into v_alt_profile_id
  from public.candidate_profiles
  where email = 'candidate-dev-alt@talentarbor.local';

  if v_alt_profile_id is null then
    raise exception 'expected alternate seeded candidate profile';
  end if;

  select count(*)
  into v_count
  from public.candidate_identities
  where candidate_profile_id = v_primary_profile_id
    and provider in ('password', 'dev_mock')
    and issuer = 'interview-coach-local';

  if v_count <> 2 then
    raise exception 'expected 2 primary candidate dev identities, found %', v_count;
  end if;

  select count(*)
  into v_count
  from public.candidate_practice_drafts
  where candidate_profile_id = v_primary_profile_id;

  if v_count <> 3 then
    raise exception 'expected primary candidate dev drafts, found %', v_count;
  end if;

  select count(*)
  into v_count
  from public.candidate_practice_drafts
  where candidate_profile_id = v_primary_profile_id
    and status in ('draft', 'in_session', 'completed');

  if v_count <> 3 then
    raise exception 'expected primary candidate draft status coverage, found %', v_count;
  end if;

  select count(*)
  into v_count
  from public.candidate_practice_drafts d
  join public.sessions s on s.session_id = d.session_id
  where d.candidate_profile_id = v_primary_profile_id
    and d.status = 'completed'
    and s.status = 'COMPLETED'
    and s.summary_narrative is not null;

  if v_count <> 1 then
    raise exception 'expected completed primary candidate summary fixture, found %', v_count;
  end if;

  select count(*)
  into v_count
  from public.candidate_practice_drafts d
  join public.answers a on a.session_id = d.session_id
  where d.candidate_profile_id = v_primary_profile_id
    and d.status = 'completed'
    and a.submitted_at is not null;

  if v_count <> 2 then
    raise exception 'expected completed primary candidate submitted answers, found %', v_count;
  end if;

  select count(*)
  into v_count
  from public.candidate_practice_drafts
  where candidate_profile_id = v_alt_profile_id
    and session_id = '20000000-0000-4000-8000-000000000003';

  if v_count <> 1 then
    raise exception 'expected alternate candidate ownership fixture, found %', v_count;
  end if;
end $$;

rollback;
