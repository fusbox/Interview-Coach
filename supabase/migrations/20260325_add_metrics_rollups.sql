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
