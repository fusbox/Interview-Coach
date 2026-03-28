create table if not exists public.invite_batches (
    batch_id uuid primary key,
    parent_batch_id uuid references public.invite_batches(batch_id) on delete set null,
    last_retry_batch_id uuid references public.invite_batches(batch_id) on delete set null,
    created_by uuid not null,
    role text not null,
    job_description text null,
    questions_json jsonb not null default '[]'::jsonb,
    status text not null check (status in ('pending', 'completed', 'failed', 'retry_issued')),
    requested_count integer not null default 0,
    succeeded_count integer not null default 0,
    failed_count integer not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.invite_batch_candidates (
    batch_candidate_id uuid primary key default gen_random_uuid(),
    batch_id uuid not null references public.invite_batches(batch_id) on delete cascade,
    candidate_index integer not null,
    first_name text not null,
    last_name text not null,
    email text not null,
    req_id text not null,
    resume_text text null,
    status text not null check (status in ('pending', 'created', 'failed', 'retry_issued')),
    retryable boolean not null default true,
    retry_count integer not null default 0,
    session_id uuid null,
    error_code text null,
    error_message text null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (batch_id, candidate_index)
);

create index if not exists idx_invite_batches_created_by on public.invite_batches(created_by, created_at desc);
create index if not exists idx_invite_batches_parent_batch_id on public.invite_batches(parent_batch_id);
create index if not exists idx_invite_batch_candidates_batch_id on public.invite_batch_candidates(batch_id, candidate_index);
create index if not exists idx_invite_batch_candidates_status on public.invite_batch_candidates(batch_id, status);
