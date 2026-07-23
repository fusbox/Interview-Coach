-- Target-specific AI-eval remediation, regression-case promotion, and sequential recheck lineage.
-- Workflow rows retain references and decisions only; serving content remains in its owned source tables.

alter table public.ai_eval_remediations
  add column if not exists creation_request_key uuid;

update public.ai_eval_remediations
set creation_request_key = gen_random_uuid()
where creation_request_key is null;

alter table public.ai_eval_remediations
  alter column creation_request_key set not null;

alter table public.ai_eval_remediations
  add column if not exists change_kind text;

create unique index if not exists uq_ai_eval_remediation_creation_request
  on public.ai_eval_remediations(created_by_operator_user_id, creation_request_key);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_ai_eval_remediation_change_kind'
      and conrelid = 'public.ai_eval_remediations'::regclass
  ) then
    alter table public.ai_eval_remediations
      add constraint chk_ai_eval_remediation_change_kind check (
        change_kind is null or change_kind in (
          'code',
          'prompt',
          'schema',
          'configuration',
          'reference',
          'product_specification',
          'test'
        )
      );
  end if;
end;
$$;

create table if not exists public.ai_eval_regression_cases (
  ai_eval_regression_case_id uuid primary key default gen_random_uuid(),
  source_finding_id uuid not null unique
    references public.ai_eval_findings(ai_eval_finding_id) on delete cascade,
  original_work_item_id uuid not null
    references public.ai_eval_work_items(ai_eval_work_item_id) on delete cascade,
  promoted_by_operator_user_id uuid not null
    references public.app_users(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_eval_regression_cases_original_work_item
  on public.ai_eval_regression_cases(original_work_item_id, created_at desc);

create or replace function public.validate_ai_eval_regression_case()
returns trigger
language plpgsql
as $$
declare
  v_work_item_id uuid;
  v_review_state text;
begin
  if tg_op = 'UPDATE' then
    raise exception 'AI-eval regression cases are immutable'
      using errcode = '55000';
  end if;

  if not public.is_active_ai_eval_operator(new.promoted_by_operator_user_id) then
    raise exception 'AI-eval regression promotion requires an active individual operator grant'
      using errcode = '42501';
  end if;

  select review.ai_eval_work_item_id, review.lifecycle_state
  into v_work_item_id, v_review_state
  from public.ai_eval_findings finding
  join public.ai_eval_reviews review
    on review.ai_eval_review_id = finding.ai_eval_review_id
  where finding.ai_eval_finding_id = new.source_finding_id;

  if v_review_state is distinct from 'submitted'
     or v_work_item_id is distinct from new.original_work_item_id then
    raise exception 'AI-eval regression cases require one exact submitted finding source'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ai_eval_regression_case_validation
  on public.ai_eval_regression_cases;
create trigger trg_ai_eval_regression_case_validation
before insert or update on public.ai_eval_regression_cases
for each row execute function public.validate_ai_eval_regression_case();

create table if not exists public.ai_eval_rechecks (
  ai_eval_recheck_id uuid primary key default gen_random_uuid(),
  ai_eval_remediation_id uuid not null
    references public.ai_eval_remediations(ai_eval_remediation_id) on delete cascade,
  ai_eval_regression_case_id uuid not null
    references public.ai_eval_regression_cases(ai_eval_regression_case_id) on delete cascade,
  verification_review_id uuid not null
    references public.ai_eval_reviews(ai_eval_review_id) on delete cascade,
  verified_by_operator_user_id uuid not null
    references public.app_users(user_id) on delete restrict,
  outcome text not null,
  verification_note text not null,
  created_at timestamptz not null default now(),
  constraint uq_ai_eval_recheck_exact_output unique (
    ai_eval_remediation_id,
    ai_eval_regression_case_id,
    verification_review_id
  ),
  constraint chk_ai_eval_recheck_outcome check (
    outcome in ('fixed', 'unchanged', 'regressed', 'unable_to_assess')
  ),
  constraint chk_ai_eval_recheck_note check (
    length(trim(verification_note)) between 1 and 4000
  )
);

create index if not exists idx_ai_eval_rechecks_remediation
  on public.ai_eval_rechecks(ai_eval_remediation_id, created_at desc);

create or replace function public.validate_ai_eval_recheck()
returns trigger
language plpgsql
as $$
declare
  v_remediation_state text;
  v_change_reference text;
  v_original_finding_id uuid;
  v_original_work_item_id uuid;
  v_original_surface text;
  v_original_occurred_at timestamptz;
  v_verification_work_item_id uuid;
  v_verification_surface text;
  v_verification_occurred_at timestamptz;
  v_verification_review_state text;
begin
  if tg_op = 'UPDATE' then
    raise exception 'AI-eval rechecks are immutable'
      using errcode = '55000';
  end if;

  if not public.is_active_ai_eval_operator(new.verified_by_operator_user_id) then
    raise exception 'AI-eval recheck requires an active individual operator grant'
      using errcode = '42501';
  end if;

  select remediation.lifecycle_state, remediation.changed_reference
  into v_remediation_state, v_change_reference
  from public.ai_eval_remediations remediation
  where remediation.ai_eval_remediation_id = new.ai_eval_remediation_id;

  if v_remediation_state is distinct from 'ready_for_recheck'
     or v_change_reference is null then
    raise exception 'AI-eval recheck requires a governed change ready for recheck'
      using errcode = '23514';
  end if;

  select
    regression.source_finding_id,
    regression.original_work_item_id,
    original_item.surface,
    original_item.source_occurred_at
  into
    v_original_finding_id,
    v_original_work_item_id,
    v_original_surface,
    v_original_occurred_at
  from public.ai_eval_regression_cases regression
  join public.ai_eval_work_items original_item
    on original_item.ai_eval_work_item_id = regression.original_work_item_id
  where regression.ai_eval_regression_case_id = new.ai_eval_regression_case_id;

  if not exists (
    select 1
    from public.ai_eval_remediation_findings link
    where link.ai_eval_remediation_id = new.ai_eval_remediation_id
      and link.ai_eval_finding_id = v_original_finding_id
  ) then
    raise exception 'AI-eval recheck regression case is not linked to this remediation'
      using errcode = '23514';
  end if;

  select
    review.lifecycle_state,
    work_item.ai_eval_work_item_id,
    work_item.surface,
    work_item.source_occurred_at
  into
    v_verification_review_state,
    v_verification_work_item_id,
    v_verification_surface,
    v_verification_occurred_at
  from public.ai_eval_reviews review
  join public.ai_eval_work_items work_item
    on work_item.ai_eval_work_item_id = review.ai_eval_work_item_id
  where review.ai_eval_review_id = new.verification_review_id;

  if v_verification_review_state is distinct from 'submitted'
     or v_verification_work_item_id = v_original_work_item_id
     or v_verification_surface is distinct from v_original_surface
     or v_verification_occurred_at <= v_original_occurred_at then
    raise exception 'AI-eval recheck requires a later submitted exact output from the same surface'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ai_eval_recheck_validation on public.ai_eval_rechecks;
create trigger trg_ai_eval_recheck_validation
before insert or update on public.ai_eval_rechecks
for each row execute function public.validate_ai_eval_recheck();

create or replace function public.validate_ai_eval_remediation()
returns trigger
language plpgsql
as $$
declare
  v_unfixed_count integer;
  v_regression_count integer;
begin
  if not public.is_active_ai_eval_operator(new.last_updated_by_operator_user_id) then
    raise exception 'AI-eval remediation mutation requires an active individual operator grant'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT'
     and new.created_by_operator_user_id <> new.last_updated_by_operator_user_id then
    raise exception 'AI-eval remediation creator must be its initial operator'
      using errcode = '23514';
  end if;

  if not public.is_active_ai_eval_operator(new.owner_operator_user_id) then
    raise exception 'AI-eval remediation owner requires an active individual operator grant'
      using errcode = '42501';
  end if;

  if new.lifecycle_state in ('changed', 'ready_for_recheck', 'verified')
     and (new.change_kind is null or new.changed_reference is null) then
    raise exception 'AI-eval changed remediation requires a governed change type and reference'
      using errcode = '23514';
  end if;

  if new.lifecycle_state = 'verified' and new.verification_note is null then
    raise exception 'AI-eval verified remediation requires a verification note'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if row(
      new.ai_eval_remediation_id,
      new.created_by_operator_user_id,
      new.creation_request_key,
      new.target_component,
      new.title,
      new.hypothesis,
      new.expected_change,
      new.regression_risks,
      new.created_at
    ) is distinct from row(
      old.ai_eval_remediation_id,
      old.created_by_operator_user_id,
      old.creation_request_key,
      old.target_component,
      old.title,
      old.hypothesis,
      old.expected_change,
      old.regression_risks,
      old.created_at
    ) then
      raise exception 'AI-eval remediation hypothesis identity is immutable'
        using errcode = '55000';
    end if;

    if new.revision <> old.revision + 1 then
      raise exception 'AI-eval remediation revision must advance by one'
        using errcode = '40001';
    end if;

    if new.lifecycle_state <> old.lifecycle_state and not (
      (old.lifecycle_state = 'observed' and new.lifecycle_state in ('triaged', 'planned', 'wont_fix', 'duplicate'))
      or (old.lifecycle_state = 'triaged' and new.lifecycle_state in ('planned', 'wont_fix', 'duplicate'))
      or (old.lifecycle_state = 'planned' and new.lifecycle_state in ('changed', 'wont_fix', 'duplicate'))
      or (old.lifecycle_state = 'changed' and new.lifecycle_state in ('planned', 'ready_for_recheck', 'wont_fix', 'duplicate'))
      or (old.lifecycle_state = 'ready_for_recheck' and new.lifecycle_state in ('changed', 'verified', 'wont_fix', 'duplicate'))
    ) then
      raise exception 'AI-eval remediation lifecycle transition is not allowed'
        using errcode = '23514';
    end if;
  end if;

  if new.lifecycle_state = 'verified' then
    select count(*)
    into v_regression_count
    from public.ai_eval_regression_cases regression
    join public.ai_eval_remediation_findings link
      on link.ai_eval_finding_id = regression.source_finding_id
    where link.ai_eval_remediation_id = new.ai_eval_remediation_id;

    select count(*)
    into v_unfixed_count
    from public.ai_eval_regression_cases regression
    join public.ai_eval_remediation_findings link
      on link.ai_eval_finding_id = regression.source_finding_id
    where link.ai_eval_remediation_id = new.ai_eval_remediation_id
      and not exists (
        select 1
        from public.ai_eval_rechecks latest
        where latest.ai_eval_recheck_id = (
          select candidate.ai_eval_recheck_id
          from public.ai_eval_rechecks candidate
          where candidate.ai_eval_remediation_id = new.ai_eval_remediation_id
            and candidate.ai_eval_regression_case_id = regression.ai_eval_regression_case_id
          order by candidate.created_at desc, candidate.ai_eval_recheck_id desc
          limit 1
        )
          and latest.outcome = 'fixed'
      );

    if v_regression_count = 0 or v_unfixed_count > 0 then
      raise exception 'AI-eval remediation cannot be verified until every regression case is fixed'
        using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.audit_ai_eval_regression_case_mutation()
returns trigger
language plpgsql
as $$
begin
  insert into public.auth_audit_events (user_id, event_type, outcome, metadata)
  values (
    coalesce(new.promoted_by_operator_user_id, old.promoted_by_operator_user_id),
    'ai_eval_regression_case_mutated',
    'success',
    jsonb_build_object(
      'action', lower(tg_op),
      'entity_id', coalesce(new.ai_eval_regression_case_id, old.ai_eval_regression_case_id)
    )
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_ai_eval_regression_case_audit
  on public.ai_eval_regression_cases;
create trigger trg_ai_eval_regression_case_audit
after insert or delete on public.ai_eval_regression_cases
for each row execute function public.audit_ai_eval_regression_case_mutation();

create or replace function public.audit_ai_eval_recheck_mutation()
returns trigger
language plpgsql
as $$
begin
  insert into public.auth_audit_events (user_id, event_type, outcome, metadata)
  values (
    coalesce(new.verified_by_operator_user_id, old.verified_by_operator_user_id),
    'ai_eval_recheck_mutated',
    'success',
    jsonb_build_object(
      'action', lower(tg_op),
      'entity_id', coalesce(new.ai_eval_recheck_id, old.ai_eval_recheck_id)
    )
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_ai_eval_recheck_audit on public.ai_eval_rechecks;
create trigger trg_ai_eval_recheck_audit
after insert or delete on public.ai_eval_rechecks
for each row execute function public.audit_ai_eval_recheck_mutation();

comment on table public.ai_eval_regression_cases is
  'Immutable promotion of one submitted finding and its exact original work item into sequential regression coverage.';

comment on table public.ai_eval_rechecks is
  'Immutable human verification of one later same-surface reviewed output against an original regression failure class.';
