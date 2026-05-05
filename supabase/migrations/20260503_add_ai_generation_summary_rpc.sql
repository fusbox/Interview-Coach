create or replace function public.get_ai_generation_summary(
    p_surface text default null,
    p_status text default null,
    p_search text default null
)
returns table (
    total_count bigint,
    success_count bigint,
    partial_count bigint,
    failed_count bigint,
    average_latency_ms numeric
)
language sql
stable
as $$
    with normalized as (
        select nullif(btrim(p_search), '') as search_value
    ),
    filtered as (
        select ag.*
        from public.ai_generations ag
        cross join normalized n
        where (p_surface is null or ag.surface = p_surface)
          and (p_status is null or ag.status = p_status)
          and (
              n.search_value is null
              or ag.generation_id::text ilike '%' || n.search_value || '%'
              or ag.app_name ilike '%' || n.search_value || '%'
              or ag.surface ilike '%' || n.search_value || '%'
              or ag.status ilike '%' || n.search_value || '%'
              or ag.prompt_version ilike '%' || n.search_value || '%'
              or ag.model_provider ilike '%' || n.search_value || '%'
              or ag.model_name ilike '%' || n.search_value || '%'
              or coalesce(ag.trace_id, '') ilike '%' || n.search_value || '%'
              or coalesce(ag.correlation_id, '') ilike '%' || n.search_value || '%'
              or coalesce(ag.created_by::text, '') ilike '%' || n.search_value || '%'
              or coalesce(ag.session_id::text, '') ilike '%' || n.search_value || '%'
              or coalesce(ag.invite_batch_id::text, '') ilike '%' || n.search_value || '%'
              or coalesce(ag.candidate_id, '') ilike '%' || n.search_value || '%'
              or ag.redaction_status ilike '%' || n.search_value || '%'
              or ag.retention_class ilike '%' || n.search_value || '%'
          )
    )
    select
        count(*) as total_count,
        count(*) filter (where status = 'success') as success_count,
        count(*) filter (where status = 'partial') as partial_count,
        count(*) filter (where status = 'failed') as failed_count,
        avg(latency_ms)::numeric as average_latency_ms
    from filtered;
$$;

comment on function public.get_ai_generation_summary(text, text, text) is
    'Filtered aggregate summary for the AI Quality Center generation explorer.';
