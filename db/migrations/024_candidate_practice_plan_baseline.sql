-- Prep-context-owned stage baseline and stable wording for Coach Plan coverage.

alter table public.candidate_role_preparation_profiles
  add column if not exists rigor_baseline_snapshot_json jsonb,
  add column if not exists rigor_baseline_question_wording_snapshot_json jsonb;

alter table public.candidate_role_preparation_profiles
  drop constraint if exists chk_candidate_role_profiles_rigor_baseline_pair,
  add constraint chk_candidate_role_profiles_rigor_baseline_pair check (
    (
      rigor_baseline_snapshot_json is null
      and rigor_baseline_question_wording_snapshot_json is null
    )
    or (
      rigor_baseline_snapshot_json is not null
      and rigor_baseline_question_wording_snapshot_json is not null
      and jsonb_typeof(rigor_baseline_snapshot_json) = 'object'
      and jsonb_typeof(rigor_baseline_question_wording_snapshot_json) = 'object'
      and rigor_baseline_snapshot_json ->> 'status' = 'candidate_practice_plan_baseline_v1'
      and jsonb_typeof(rigor_baseline_snapshot_json -> 'questionCount') = 'number'
      and jsonb_typeof(rigor_baseline_snapshot_json -> 'slots') = 'array'
      and rigor_baseline_question_wording_snapshot_json ->> 'status' = 'questions_worded'
      and jsonb_typeof(rigor_baseline_question_wording_snapshot_json -> 'questions') = 'array'
      and jsonb_array_length(rigor_baseline_snapshot_json -> 'slots') =
        (rigor_baseline_snapshot_json ->> 'questionCount')::integer
      and jsonb_array_length(rigor_baseline_question_wording_snapshot_json -> 'questions') =
        (rigor_baseline_snapshot_json ->> 'questionCount')::integer
    )
  );

create or replace function public.prevent_candidate_rigor_baseline_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.rigor_baseline_snapshot_json is not null and (
    new.rigor_baseline_snapshot_json is distinct from old.rigor_baseline_snapshot_json
    or new.rigor_baseline_question_wording_snapshot_json is distinct from old.rigor_baseline_question_wording_snapshot_json
  ) then
    raise exception 'candidate practice-plan baseline is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_candidate_role_profiles_rigor_baseline_immutable
  on public.candidate_role_preparation_profiles;
create trigger trg_candidate_role_profiles_rigor_baseline_immutable
before update of rigor_baseline_snapshot_json, rigor_baseline_question_wording_snapshot_json
on public.candidate_role_preparation_profiles
for each row execute function public.prevent_candidate_rigor_baseline_mutation();
