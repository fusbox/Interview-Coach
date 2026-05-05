alter table public.ai_generations enable row level security;

alter table public.ai_generations
    add column if not exists prompt_snapshot jsonb null,
    add column if not exists source_refs jsonb not null default '[]'::jsonb,
    add column if not exists retention_class text not null default 'eval_redacted',
    add column if not exists retention_until timestamptz null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'ai_generations_retention_class_check'
    ) then
        alter table public.ai_generations
            add constraint ai_generations_retention_class_check
            check (retention_class in ('eval_redacted', 'eval_raw_restricted', 'operational_debug'));
    end if;
end $$;

create index if not exists idx_ai_generations_retention_until
    on public.ai_generations(retention_until)
    where retention_until is not null;

create index if not exists idx_ai_generations_source_refs
    on public.ai_generations using gin(source_refs);

comment on table public.ai_generations is
    'AI quality and observability records. RLS is enabled with no public/authenticated policies; access should be mediated by service-role server APIs.';

comment on column public.ai_generations.prompt_snapshot is
    'Structured prompt snapshot for replay/eval. Prefer redacted content and source references over raw PII.';

comment on column public.ai_generations.source_refs is
    'Pointers to source operational records used to create this generation, such as session/question/answer/eval IDs.';

comment on column public.ai_generations.retention_class is
    'Retention posture for the captured generation: eval_redacted, eval_raw_restricted, or operational_debug.';
