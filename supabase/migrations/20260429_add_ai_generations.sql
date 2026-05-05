create table if not exists public.ai_generations (
    generation_id uuid primary key default gen_random_uuid(),
    app_name text not null,
    surface text not null check (surface in (
        'question_generation',
        'answer_feedback',
        'hint',
        'strong_response',
        'session_debrief'
    )),
    status text not null check (status in ('success', 'failed', 'partial')),
    input_snapshot jsonb not null default '{}'::jsonb,
    context_artifacts jsonb not null default '[]'::jsonb,
    prompt_version text not null,
    model_provider text not null,
    model_name text not null,
    model_params jsonb not null default '{}'::jsonb,
    raw_output jsonb null,
    parsed_output jsonb null,
    latency_ms integer not null default 0,
    token_usage jsonb null,
    cost_estimate numeric null,
    trace_id text null,
    correlation_id text null,
    created_by uuid null,
    session_id uuid null,
    invite_batch_id uuid null,
    candidate_id text null,
    error_json jsonb null,
    privacy_flags text[] not null default '{}',
    redaction_status text not null check (redaction_status in ('raw', 'redacted', 'not_applicable')),
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_ai_generations_surface_created_at
    on public.ai_generations(surface, created_at desc);

create index if not exists idx_ai_generations_status_created_at
    on public.ai_generations(status, created_at desc);

create index if not exists idx_ai_generations_created_by_created_at
    on public.ai_generations(created_by, created_at desc);

create index if not exists idx_ai_generations_correlation_id
    on public.ai_generations(correlation_id);
