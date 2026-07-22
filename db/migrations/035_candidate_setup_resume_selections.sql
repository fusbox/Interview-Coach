-- Candidate/setup-scoped recovery pointer for processed resume artifacts.
-- The row contains no resume text or source bytes; immutable session snapshots retain accepted lineage after consumption.

create unique index if not exists ux_candidate_resume_artifacts_owner_id
  on public.candidate_resume_processed_artifacts(candidate_profile_id, candidate_resume_artifact_id);

create table if not exists public.candidate_setup_resume_selections (
  candidate_profile_id uuid not null
    references public.candidate_profiles(candidate_profile_id) on delete cascade,
  setup_owner_key text not null,
  selection_revision integer not null default 1,
  pending_operation_id uuid,
  candidate_resume_artifact_id uuid,
  lifecycle_state text not null,
  consumed_role_profile_id uuid,
  consumed_candidate_practice_session_id uuid,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (candidate_profile_id, setup_owner_key),
  constraint fk_candidate_setup_resume_selection_artifact
    foreign key (candidate_profile_id, candidate_resume_artifact_id)
    references public.candidate_resume_processed_artifacts(candidate_profile_id, candidate_resume_artifact_id),
  constraint fk_candidate_setup_resume_selection_role
    foreign key (candidate_profile_id, consumed_role_profile_id)
    references public.candidate_role_preparation_profiles(candidate_profile_id, role_profile_id),
  constraint fk_candidate_setup_resume_selection_session
    foreign key (consumed_candidate_practice_session_id, candidate_profile_id)
    references public.candidate_practice_sessions(candidate_practice_session_id, candidate_profile_id),
  constraint chk_candidate_setup_resume_owner_key
    check (length(trim(setup_owner_key)) between 1 and 320),
  constraint chk_candidate_setup_resume_revision
    check (selection_revision > 0),
  constraint chk_candidate_setup_resume_lifecycle
    check (lifecycle_state in ('pending', 'active', 'cleared', 'consumed')),
  constraint chk_candidate_setup_resume_shape check (
    (
      lifecycle_state = 'pending'
      and pending_operation_id is not null
      and candidate_resume_artifact_id is null
      and consumed_role_profile_id is null
      and consumed_candidate_practice_session_id is null
      and consumed_at is null
    )
    or
    (
      lifecycle_state = 'active'
      and pending_operation_id is null
      and candidate_resume_artifact_id is not null
      and consumed_role_profile_id is null
      and consumed_candidate_practice_session_id is null
      and consumed_at is null
    )
    or
    (
      lifecycle_state = 'cleared'
      and pending_operation_id is null
      and candidate_resume_artifact_id is null
      and consumed_role_profile_id is null
      and consumed_candidate_practice_session_id is null
      and consumed_at is null
    )
    or
    (
      lifecycle_state = 'consumed'
      and pending_operation_id is null
      and consumed_role_profile_id is not null
      and consumed_candidate_practice_session_id is not null
      and consumed_at is not null
    )
  )
);

create index if not exists idx_candidate_setup_resume_selection_artifact
  on public.candidate_setup_resume_selections(candidate_profile_id, candidate_resume_artifact_id)
  where candidate_resume_artifact_id is not null;

create index if not exists idx_candidate_setup_resume_selection_session
  on public.candidate_setup_resume_selections(consumed_candidate_practice_session_id)
  where consumed_candidate_practice_session_id is not null;

drop trigger if exists trg_candidate_setup_resume_selections_updated_at
  on public.candidate_setup_resume_selections;

create trigger trg_candidate_setup_resume_selections_updated_at
before update on public.candidate_setup_resume_selections
for each row execute function public.set_updated_at();
