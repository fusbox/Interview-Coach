begin;

create unique index if not exists uq_candidate_practice_session_owner
  on public.candidate_practice_sessions (
    candidate_practice_session_id,
    candidate_profile_id
  );

create table if not exists public.candidate_engagement_slices (
  candidate_engagement_slice_id uuid primary key,
  candidate_practice_session_id uuid not null,
  candidate_profile_id uuid not null,
  tracker_instance_id uuid not null,
  sequence_number integer not null,
  active_milliseconds integer not null,
  client_started_at timestamptz not null,
  client_ended_at timestamptz not null,
  opened_by text not null,
  last_activity text not null,
  flush_reason text not null,
  received_at timestamptz not null default now(),
  constraint uq_candidate_engagement_tracker_sequence
    unique (
      candidate_practice_session_id,
      candidate_profile_id,
      tracker_instance_id,
      sequence_number
    ),
  constraint fk_candidate_engagement_session_owner
    foreign key (candidate_practice_session_id, candidate_profile_id)
    references public.candidate_practice_sessions (
      candidate_practice_session_id,
      candidate_profile_id
    )
    on delete cascade,
  constraint chk_candidate_engagement_sequence
    check (sequence_number >= 1),
  constraint chk_candidate_engagement_duration
    check (active_milliseconds between 1 and 60000),
  constraint chk_candidate_engagement_client_interval
    check (
      client_ended_at >= client_started_at
      and client_ended_at - client_started_at <= interval '10 minutes'
    ),
  constraint chk_candidate_engagement_opened_by
    check (opened_by in (
      'session_view',
      'interaction',
      'task_progress',
      'continuous_activity'
    )),
  constraint chk_candidate_engagement_last_activity
    check (last_activity in (
      'session_view',
      'answer_input',
      'question_audio',
      'question_assistance',
      'answer_mode',
      'voice_control',
      'interface_control',
      'page_navigation',
      'feedback_action',
      'answer_submit',
      'practice_start',
      'question_advance',
      'session_finish',
      'recording'
    )),
  constraint chk_candidate_engagement_flush_reason
    check (flush_reason in (
      'periodic',
      'window_expired',
      'page_hidden',
      'page_exit',
      'session_transition',
      'tracker_unmount'
    ))
);

create index if not exists idx_candidate_engagement_candidate_received
  on public.candidate_engagement_slices (
    candidate_profile_id,
    received_at desc
  );

create index if not exists idx_candidate_engagement_session_received
  on public.candidate_engagement_slices (
    candidate_practice_session_id,
    received_at asc
  );

alter table public.candidate_engagement_slices enable row level security;

drop policy if exists interview_coach_runtime_access
  on public.candidate_engagement_slices;

do $$
begin
  if exists (
    select 1
    from pg_roles
    where rolname = 'interview_coach_runtime'
  ) then
    execute $revoke$
      revoke all privileges
        on public.candidate_engagement_slices
        from interview_coach_runtime
    $revoke$;

    execute $policy$
      create policy interview_coach_runtime_access
        on public.candidate_engagement_slices
        for all
        to interview_coach_runtime
        using (true)
        with check (true)
    $policy$;

    execute $grant$
      grant select, insert
        on public.candidate_engagement_slices
        to interview_coach_runtime
    $grant$;
  end if;
end;
$$;

commit;
