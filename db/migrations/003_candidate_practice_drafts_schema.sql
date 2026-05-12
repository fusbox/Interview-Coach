-- Candidate app practice draft foundation.
-- Target: candidate-owned setup state for /practice before question generation and session creation.

create table if not exists public.candidate_practice_drafts (
  practice_draft_id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade,
  status text not null default 'draft',
  target_role text not null,
  job_description text,
  resume_context_json jsonb not null default '{}'::jsonb,
  custom_questions_json jsonb not null default '[]'::jsonb,
  intake_responses_json jsonb not null default '[]'::jsonb,
  question_set_snapshot_id uuid,
  session_id uuid,
  resume_target_screen text not null default 'practice_setup',
  generation_started_at timestamptz,
  generation_finished_at timestamptz,
  generation_error text,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_candidate_practice_drafts_status check (status in ('draft', 'generating', 'ready', 'in_session', 'completed', 'generation_failed')),
  constraint chk_candidate_practice_drafts_resume_target check (resume_target_screen in ('practice_setup', 'practice_generating', 'session_entry', 'session_in_progress', 'session_summary', 'dashboard')),
  constraint chk_candidate_practice_drafts_target_role_nonempty check (length(trim(target_role)) > 0),
  constraint chk_candidate_practice_drafts_json_objects check (jsonb_typeof(resume_context_json) = 'object'),
  constraint chk_candidate_practice_drafts_custom_questions_array check (jsonb_typeof(custom_questions_json) = 'array'),
  constraint chk_candidate_practice_drafts_intake_responses_array check (jsonb_typeof(intake_responses_json) = 'array')
);

create index if not exists idx_candidate_practice_drafts_profile_status
  on public.candidate_practice_drafts(candidate_profile_id, status);

create index if not exists idx_candidate_practice_drafts_last_activity
  on public.candidate_practice_drafts(candidate_profile_id, last_activity_at desc);

create index if not exists idx_candidate_practice_drafts_session_id
  on public.candidate_practice_drafts(session_id)
  where session_id is not null;

drop trigger if exists trg_candidate_practice_drafts_updated_at on public.candidate_practice_drafts;
create trigger trg_candidate_practice_drafts_updated_at
before update on public.candidate_practice_drafts
for each row execute function public.set_updated_at();
