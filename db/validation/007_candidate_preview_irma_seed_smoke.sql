-- Rollback-only smoke validation for db/seeds/002_candidate_preview_irma_seed.sql.

begin;

do $$
declare
  v_profile_id uuid;
  v_count integer;
begin
  select candidate_profile_id
  into v_profile_id
  from public.candidate_profiles
  where email = 'irma.castillo@talentarbor.local'
    and display_name = 'Irma Castillo';

  if v_profile_id is null then
    raise exception 'expected Irma Castillo preview candidate profile';
  end if;

  select count(*)
  into v_count
  from public.candidate_identities
  where candidate_profile_id = v_profile_id
    and provider = 'dev_mock'
    and issuer = 'interview-coach-preview'
    and subject = 'irma.castillo@talentarbor.local';

  if v_count <> 1 then
    raise exception 'expected one Irma preview identity, found %', v_count;
  end if;

  select count(*)
  into v_count
  from public.candidate_role_preparation_profiles
  where candidate_profile_id = v_profile_id
    and source = 'dev_seed';

  if v_count <> 2 then
    raise exception 'expected 2 Irma preview role profiles, found %', v_count;
  end if;

  select count(*)
  into v_count
  from public.candidate_practice_drafts
  where candidate_profile_id = v_profile_id
    and status in ('in_session', 'completed');

  if v_count <> 2 then
    raise exception 'expected Irma active and completed preview drafts, found %', v_count;
  end if;

  select count(*)
  into v_count
  from public.candidate_practice_drafts d
  join public.sessions s on s.session_id = d.session_id
  where d.candidate_profile_id = v_profile_id
    and s.intake_json ? 'questionPlanSnapshot';

  if v_count <> 2 then
    raise exception 'expected Irma sessions with question plan snapshots, found %', v_count;
  end if;

  select count(*)
  into v_count
  from public.candidate_practice_drafts d
  join public.answers a on a.session_id = d.session_id
  join public.eval_results er on er.question_id = a.question_id
  where d.candidate_profile_id = v_profile_id
    and d.status = 'completed'
    and er.feedback_json ? 'coachSignal';

  if v_count <> 3 then
    raise exception 'expected 3 Irma completed answers with coach signals, found %', v_count;
  end if;
end $$;

rollback;
