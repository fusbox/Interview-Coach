-- Recent AI generation records for eval/debug capture.
-- Export this query when validating instrumentation or selecting sample cases.
-- It intentionally lists every current ai_generations column instead of using
-- select * so field additions are reviewed intentionally.

select
    generation_id,
    app_name,
    surface,
    status,
    input_snapshot,
    context_artifacts,
    prompt_version,
    prompt_snapshot,
    model_provider,
    model_name,
    model_params,
    raw_output,
    parsed_output,
    latency_ms,
    token_usage,
    cost_estimate,
    trace_id,
    correlation_id,
    created_by,
    session_id,
    invite_batch_id,
    candidate_id,
    source_refs,
    error_json,
    privacy_flags,
    redaction_status,
    retention_class,
    retention_until,
    created_at
from public.ai_generations
order by created_at desc
limit 100;
