CREATE OR REPLACE FUNCTION public.increment_session_engagement(
    p_session_id UUID,
    p_delta_seconds INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_intake JSONB;
    next_total INTEGER;
BEGIN
    IF p_delta_seconds IS NULL OR p_delta_seconds < 0 THEN
        RAISE EXCEPTION 'p_delta_seconds must be a non-negative integer';
    END IF;

    SELECT COALESCE(intake_json, '{}'::jsonb)
    INTO current_intake
    FROM public.sessions
    WHERE session_id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'session not found';
    END IF;

    next_total := COALESCE((current_intake ->> 'engaged_time_seconds')::INTEGER, 0) + p_delta_seconds;

    UPDATE public.sessions
    SET intake_json = jsonb_set(
        COALESCE(intake_json, '{}'::jsonb),
        '{engaged_time_seconds}',
        to_jsonb(next_total),
        true
    )
    WHERE session_id = p_session_id;

    RETURN next_total;
END;
$$;
