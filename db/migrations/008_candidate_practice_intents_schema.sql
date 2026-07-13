-- Candidate-owned follow-up practice intent persistence boundary.
-- Target: durable ready-round staging for one-question fast paths, builders, queues, and coach bundles.

create table if not exists public.candidate_practice_intents (
  candidate_practice_intent_id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(candidate_profile_id) on delete cascade,
  source text not null,
  lifecycle_state text not null default 'ready',
  consumed_candidate_practice_session_id uuid references public.candidate_practice_sessions(candidate_practice_session_id) on delete set null,
  target_interview_id text not null,
  target_role text not null,
  setup_context_json jsonb not null,
  items_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_candidate_practice_intents_source check (source in ('coach_update_detail', 'practice_builder', 'plan_aware_queue', 'coach_bundle')),
  constraint chk_candidate_practice_intents_lifecycle_state check (lifecycle_state in ('ready', 'consumed', 'cancelled', 'expired')),
  constraint chk_candidate_practice_intents_target_interview_id_present check (length(trim(target_interview_id)) > 0),
  constraint chk_candidate_practice_intents_target_role_present check (length(trim(target_role)) > 0),
  constraint chk_candidate_practice_intents_setup_context_object check (jsonb_typeof(setup_context_json) = 'object'),
  constraint chk_candidate_practice_intents_items_array check (jsonb_typeof(items_json) = 'array'),
  constraint chk_candidate_practice_intents_items_count check (jsonb_array_length(items_json) between 1 and 20)
);

alter table public.candidate_practice_intents
  add column if not exists consumed_candidate_practice_session_id uuid references public.candidate_practice_sessions(candidate_practice_session_id) on delete set null;

create index if not exists idx_candidate_practice_intents_profile_state
  on public.candidate_practice_intents(candidate_profile_id, lifecycle_state, updated_at desc);

create index if not exists idx_candidate_practice_intents_profile_target
  on public.candidate_practice_intents(candidate_profile_id, target_interview_id, updated_at desc);

drop trigger if exists trg_candidate_practice_intents_updated_at on public.candidate_practice_intents;
create trigger trg_candidate_practice_intents_updated_at
before update on public.candidate_practice_intents
for each row execute function public.set_updated_at();
