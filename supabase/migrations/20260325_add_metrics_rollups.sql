create table if not exists public.metric_counter_rollups (
    bucket_start timestamptz not null,
    metric_name text not null,
    tags_key text not null,
    tags jsonb not null default '{}'::jsonb,
    value bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (bucket_start, metric_name, tags_key)
);

create table if not exists public.metric_timing_rollups (
    bucket_start timestamptz not null,
    metric_name text not null,
    tags_key text not null,
    tags jsonb not null default '{}'::jsonb,
    count bigint not null default 0,
    total_ms bigint not null default 0,
    min_ms integer not null default 0,
    max_ms integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (bucket_start, metric_name, tags_key)
);

create or replace function public.record_metric_counter_rollup(
    p_bucket_start timestamptz,
    p_metric_name text,
    p_tags jsonb,
    p_tags_key text,
    p_value bigint
)
returns void
language plpgsql
security definer
as $$
begin
    insert into public.metric_counter_rollups (
        bucket_start,
        metric_name,
        tags_key,
        tags,
        value
    )
    values (
        p_bucket_start,
        p_metric_name,
        p_tags_key,
        coalesce(p_tags, '{}'::jsonb),
        p_value
    )
    on conflict (bucket_start, metric_name, tags_key)
    do update set
        value = public.metric_counter_rollups.value + excluded.value,
        tags = excluded.tags,
        updated_at = now();
end;
$$;

create or replace function public.record_metric_timing_rollup(
    p_bucket_start timestamptz,
    p_metric_name text,
    p_tags jsonb,
    p_tags_key text,
    p_duration_ms integer
)
returns void
language plpgsql
security definer
as $$
begin
    insert into public.metric_timing_rollups (
        bucket_start,
        metric_name,
        tags_key,
        tags,
        count,
        total_ms,
        min_ms,
        max_ms
    )
    values (
        p_bucket_start,
        p_metric_name,
        p_tags_key,
        coalesce(p_tags, '{}'::jsonb),
        1,
        p_duration_ms,
        p_duration_ms,
        p_duration_ms
    )
    on conflict (bucket_start, metric_name, tags_key)
    do update set
        count = public.metric_timing_rollups.count + 1,
        total_ms = public.metric_timing_rollups.total_ms + excluded.total_ms,
        min_ms = least(public.metric_timing_rollups.min_ms, excluded.min_ms),
        max_ms = greatest(public.metric_timing_rollups.max_ms, excluded.max_ms),
        tags = excluded.tags,
        updated_at = now();
end;
$$;

create or replace function public.get_metric_counter_rollups(
    p_since timestamptz
)
returns table (
    metric_name text,
    tags_key text,
    tags jsonb,
    value bigint
)
language sql
security definer
as $$
    select
        metric_name,
        tags_key,
        (array_agg(tags order by bucket_start desc))[1] as tags,
        sum(value) as value
    from public.metric_counter_rollups
    where bucket_start >= p_since
    group by metric_name, tags_key
    order by metric_name, tags_key;
$$;

create or replace function public.get_metric_timing_rollups(
    p_since timestamptz
)
returns table (
    metric_name text,
    tags_key text,
    tags jsonb,
    count bigint,
    total_ms bigint,
    min_ms integer,
    max_ms integer
)
language sql
security definer
as $$
    select
        metric_name,
        tags_key,
        (array_agg(tags order by bucket_start desc))[1] as tags,
        sum(count) as count,
        sum(total_ms) as total_ms,
        min(min_ms) as min_ms,
        max(max_ms) as max_ms
    from public.metric_timing_rollups
    where bucket_start >= p_since
    group by metric_name, tags_key
    order by metric_name, tags_key;
$$;

create or replace function public.get_slo_session_start(
    p_since timestamptz
)
returns table (
    success_count bigint,
    failure_count bigint,
    total_count bigint,
    success_rate numeric
)
language sql
security definer
as $$
    with rollup as (
        select
            coalesce(sum(case when tags ->> 'outcome' = 'success' then value else 0 end), 0) as success_count,
            coalesce(sum(case when tags ->> 'outcome' in ('error', 'rate_limited') then value else 0 end), 0) as failure_count
        from public.metric_counter_rollups
        where bucket_start >= p_since
          and metric_name = 'session_start_total'
    )
    select
        success_count,
        failure_count,
        success_count + failure_count as total_count,
        case
            when success_count + failure_count = 0 then 0
            else round((success_count::numeric / (success_count + failure_count)::numeric) * 100, 2)
        end as success_rate
    from rollup;
$$;

create or replace function public.get_slo_session_progress(
    p_since timestamptz
)
returns table (
    success_count bigint,
    replay_success_count bigint,
    error_count bigint,
    request_in_progress_count bigint,
    idempotency_mismatch_count bigint,
    invalid_request_count bigint,
    sli_numerator bigint,
    sli_denominator bigint,
    success_rate numeric
)
language sql
security definer
as $$
    with rollup as (
        select
            coalesce(sum(case when tags ->> 'outcome' = 'success' then value else 0 end), 0) as success_count,
            coalesce(sum(case when tags ->> 'outcome' = 'replay_success' then value else 0 end), 0) as replay_success_count,
            coalesce(sum(case when tags ->> 'outcome' = 'error' then value else 0 end), 0) as error_count,
            coalesce(sum(case when tags ->> 'outcome' = 'request_in_progress' then value else 0 end), 0) as request_in_progress_count,
            coalesce(sum(case when tags ->> 'outcome' = 'idempotency_mismatch' then value else 0 end), 0) as idempotency_mismatch_count,
            coalesce(sum(case when tags ->> 'outcome' = 'invalid_request' then value else 0 end), 0) as invalid_request_count
        from public.metric_counter_rollups
        where bucket_start >= p_since
          and metric_name = 'session_submit_total'
    )
    select
        success_count,
        replay_success_count,
        error_count,
        request_in_progress_count,
        idempotency_mismatch_count,
        invalid_request_count,
        success_count + replay_success_count as sli_numerator,
        success_count + replay_success_count + error_count + request_in_progress_count as sli_denominator,
        case
            when success_count + replay_success_count + error_count + request_in_progress_count = 0 then 0
            else round(((success_count + replay_success_count)::numeric / (success_count + replay_success_count + error_count + request_in_progress_count)::numeric) * 100, 2)
        end as success_rate
    from rollup;
$$;

create or replace function public.get_slo_ai_reliability(
    p_since timestamptz
)
returns table (
    operation text,
    success_count bigint,
    error_count bigint,
    malformed_response_count bigint,
    mock_fallback_count bigint,
    total_count bigint,
    success_rate numeric
)
language sql
security definer
as $$
    with rollup as (
        select
            coalesce(tags ->> 'operation', 'unknown') as operation,
            coalesce(sum(case when tags ->> 'outcome' = 'success' then value else 0 end), 0) as success_count,
            coalesce(sum(case when tags ->> 'outcome' = 'error' then value else 0 end), 0) as error_count,
            coalesce(sum(case when tags ->> 'outcome' = 'malformed_response' then value else 0 end), 0) as malformed_response_count,
            coalesce(sum(case when tags ->> 'outcome' = 'mock_fallback' then value else 0 end), 0) as mock_fallback_count
        from public.metric_counter_rollups
        where bucket_start >= p_since
          and metric_name = 'ai_requests_total'
        group by coalesce(tags ->> 'operation', 'unknown')
    )
    select
        operation,
        success_count,
        error_count,
        malformed_response_count,
        mock_fallback_count,
        success_count + error_count + malformed_response_count + mock_fallback_count as total_count,
        case
            when success_count + error_count + malformed_response_count + mock_fallback_count = 0 then 0
            else round((success_count::numeric / (success_count + error_count + malformed_response_count + mock_fallback_count)::numeric) * 100, 2)
        end as success_rate
    from rollup
    order by operation;
$$;

create or replace function public.get_slo_ai_latency(
    p_since timestamptz
)
returns table (
    operation text,
    count bigint,
    total_ms bigint,
    min_ms integer,
    max_ms integer,
    avg_ms numeric
)
language sql
security definer
as $$
    select
        coalesce(tags ->> 'operation', 'unknown') as operation,
        sum(count) as count,
        sum(total_ms) as total_ms,
        min(min_ms) as min_ms,
        max(max_ms) as max_ms,
        case
            when sum(count) = 0 then 0
            else round(sum(total_ms)::numeric / sum(count)::numeric, 2)
        end as avg_ms
    from public.metric_timing_rollups
    where bucket_start >= p_since
      and metric_name = 'ai_request_duration_ms'
    group by coalesce(tags ->> 'operation', 'unknown')
    order by operation;
$$;
