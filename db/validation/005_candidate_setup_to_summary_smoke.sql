-- Rollback-only smoke validation for the seeded candidate setup-to-summary path.

begin;

do $$
declare
  v_primary_profile_id uuid;
  v_count integer;
begin
  select candidate_profile_id
  into v_primary_profile_id
  from public.candidate_profiles
  where email = 'candidate-dev-primary@talentarbor.local';

  if v_primary_profile_id is null then
    raise exception 'expected primary seeded candidate profile';
  end if;

  select count(*)
  into v_count
  from public.candidate_practice_drafts
  where candidate_profile_id = v_primary_profile_id
    and status = 'draft'
    and session_id is null
    and resume_target_screen = 'practice_setup'
    and jsonb_typeof(resume_context_json) = 'object';

  if v_count <> 1 then
    raise exception 'expected setup draft fixture, found %', v_count;
  end if;

  select count(*)
  into v_count
  from public.candidate_practice_drafts d
  join public.sessions s on s.session_id = d.session_id
  join public.questions q on q.session_id = s.session_id
  where d.candidate_profile_id = v_primary_profile_id
    and d.status = 'in_session'
    and d.resume_target_screen = 'session_in_progress'
    and s.status = 'IN_SESSION'
    and s.current_question_index = 1;

  if v_count <> 2 then
    raise exception 'expected in-session fixture question coverage, found %', v_count;
  end if;

  select count(*)
  into v_count
  from public.candidate_practice_drafts d
  join public.sessions s on s.session_id = d.session_id
  where d.candidate_profile_id = v_primary_profile_id
    and d.status = 'completed'
    and d.resume_target_screen = 'session_summary'
    and s.status = 'COMPLETED'
    and s.summary_narrative is not null;

  if v_count <> 1 then
    raise exception 'expected completed summary fixture, found %', v_count;
  end if;

  select count(*)
  into v_count
  from public.candidate_practice_drafts d
  join public.answers a on a.session_id = d.session_id
  join public.eval_results er on er.question_id = a.question_id
  where d.candidate_profile_id = v_primary_profile_id
    and d.status = 'completed'
    and a.submitted_at is not null
    and er.status = 'COMPLETE'
    and er.feedback_json ? 'recommendation';

  if v_count <> 2 then
    raise exception 'expected completed answer feedback fixture, found %', v_count;
  end if;
end $$;

rollback;
