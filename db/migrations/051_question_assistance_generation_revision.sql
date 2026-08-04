begin;

alter table public.candidate_question_assistance_artifacts
  add column if not exists generation_revision integer not null default 1;

alter table public.invited_question_assistance_artifacts
  add column if not exists generation_revision integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'chk_candidate_question_assistance_generation_revision'
      and conrelid = 'public.candidate_question_assistance_artifacts'::regclass
  ) then
    alter table public.candidate_question_assistance_artifacts
      add constraint chk_candidate_question_assistance_generation_revision
      check (generation_revision >= 1);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'chk_invited_question_assistance_generation_revision'
      and conrelid = 'public.invited_question_assistance_artifacts'::regclass
  ) then
    alter table public.invited_question_assistance_artifacts
      add constraint chk_invited_question_assistance_generation_revision
      check (generation_revision >= 1);
  end if;
end;
$$;

commit;
