-- Candidate-owned practice session persistence boundary.
-- Target: durable setup-created session snapshots before provider wiring and live answer runtime.

create table if not exists public.candidate_practice_sessions (
  candidate_practice_session_id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade,
  role_profile_id uuid references public.candidate_role_preparation_profiles(role_profile_id) on delete set null,
  candidate_launch_session_id uuid references public.candidate_launch_sessions(candidate_launch_session_id) on delete set null,
  status text not null default 'planned',
  setup_snapshot_json jsonb not null,
  question_plan_snapshot_json jsonb not null,
  question_wording_snapshot_json jsonb,
  question_wording_status text not null default 'not_requested',
  progress_state_json jsonb not null default '{"status":"planned","currentQuestionIndex":0}'::jsonb,
  answer_drafts_json jsonb not null default '{}'::jsonb,
  answer_submissions_json jsonb not null default '{}'::jsonb,
  answer_idempotency_json jsonb not null default '{}'::jsonb,
  answer_analysis_snapshots_json jsonb not null default '{}'::jsonb,
  feedback_actions_json jsonb not null default '{}'::jsonb,
  completion_snapshot_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_candidate_practice_sessions_status check (status in ('planned', 'in_progress', 'completed', 'abandoned')),
  constraint chk_candidate_practice_sessions_wording_status check (question_wording_status in ('not_requested', 'provider_not_configured', 'worded', 'failed')),
  constraint chk_candidate_practice_sessions_setup_snapshot_object check (jsonb_typeof(setup_snapshot_json) = 'object'),
  constraint chk_candidate_practice_sessions_question_plan_object check (jsonb_typeof(question_plan_snapshot_json) = 'object'),
  constraint chk_candidate_practice_sessions_wording_snapshot_object check (question_wording_snapshot_json is null or jsonb_typeof(question_wording_snapshot_json) = 'object'),
  constraint chk_candidate_practice_sessions_progress_object check (jsonb_typeof(progress_state_json) = 'object'),
  constraint chk_candidate_practice_sessions_answer_drafts_object check (jsonb_typeof(answer_drafts_json) = 'object'),
  constraint chk_candidate_practice_sessions_answer_submissions_object check (jsonb_typeof(answer_submissions_json) = 'object'),
  constraint chk_candidate_practice_sessions_answer_idempotency_object check (jsonb_typeof(answer_idempotency_json) = 'object'),
  constraint chk_candidate_practice_sessions_answer_analysis_snapshots_object check (jsonb_typeof(answer_analysis_snapshots_json) = 'object'),
  constraint chk_candidate_practice_sessions_feedback_actions_object check (jsonb_typeof(feedback_actions_json) = 'object'),
  constraint chk_candidate_practice_sessions_completion_snapshot_object check (completion_snapshot_json is null or jsonb_typeof(completion_snapshot_json) = 'object')
);

alter table public.candidate_practice_sessions
  add column if not exists answer_drafts_json jsonb not null default '{}'::jsonb;

alter table public.candidate_practice_sessions
  add column if not exists answer_submissions_json jsonb not null default '{}'::jsonb;

alter table public.candidate_practice_sessions
  add column if not exists answer_idempotency_json jsonb not null default '{}'::jsonb;

alter table public.candidate_practice_sessions
  add column if not exists answer_analysis_snapshots_json jsonb not null default '{}'::jsonb;

alter table public.candidate_practice_sessions
  add column if not exists feedback_actions_json jsonb not null default '{}'::jsonb;

alter table public.candidate_practice_sessions
  add column if not exists completion_snapshot_json jsonb;

do $$
begin
  alter table public.candidate_practice_sessions
    add constraint chk_candidate_practice_sessions_answer_drafts_object
    check (jsonb_typeof(answer_drafts_json) = 'object');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.candidate_practice_sessions
    add constraint chk_candidate_practice_sessions_answer_idempotency_object
    check (jsonb_typeof(answer_idempotency_json) = 'object');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.candidate_practice_sessions
    add constraint chk_candidate_practice_sessions_answer_submissions_object
    check (jsonb_typeof(answer_submissions_json) = 'object');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.candidate_practice_sessions
    add constraint chk_candidate_practice_sessions_answer_analysis_snapshots_object
    check (jsonb_typeof(answer_analysis_snapshots_json) = 'object');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.candidate_practice_sessions
    add constraint chk_candidate_practice_sessions_feedback_actions_object
    check (jsonb_typeof(feedback_actions_json) = 'object');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.candidate_practice_sessions
    add constraint chk_candidate_practice_sessions_completion_snapshot_object
    check (completion_snapshot_json is null or jsonb_typeof(completion_snapshot_json) = 'object');
exception
  when duplicate_object then null;
end;
$$;

create index if not exists idx_candidate_practice_sessions_profile_status
  on public.candidate_practice_sessions(candidate_profile_id, status, updated_at desc);

create index if not exists idx_candidate_practice_sessions_role_profile
  on public.candidate_practice_sessions(role_profile_id, updated_at desc);

create index if not exists idx_candidate_practice_sessions_launch_session
  on public.candidate_practice_sessions(candidate_launch_session_id);

drop trigger if exists trg_candidate_practice_sessions_updated_at on public.candidate_practice_sessions;
create trigger trg_candidate_practice_sessions_updated_at
before update on public.candidate_practice_sessions
for each row execute function public.set_updated_at();
