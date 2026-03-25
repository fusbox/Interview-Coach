CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    bucket_key TEXT PRIMARY KEY,
    count INTEGER NOT NULL CHECK (count >= 0),
    reset_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_reset_at
    ON public.rate_limit_buckets (reset_at);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_rate_limit_bucket(
    p_bucket_key TEXT,
    p_max_requests INTEGER,
    p_window_ms INTEGER,
    p_now_ms BIGINT DEFAULT NULL
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining INTEGER,
    reset_at_ms BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_now TIMESTAMPTZ := to_timestamp(COALESCE(p_now_ms, FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)) / 1000.0);
    v_window INTERVAL := (p_window_ms::TEXT || ' milliseconds')::INTERVAL;
    v_count INTEGER;
BEGIN
    IF p_max_requests <= 0 THEN
        RAISE EXCEPTION 'p_max_requests must be positive';
    END IF;

    IF p_window_ms <= 0 THEN
        RAISE EXCEPTION 'p_window_ms must be positive';
    END IF;

    LOOP
        UPDATE public.rate_limit_buckets
        SET
            count = CASE WHEN reset_at <= v_now THEN 1 ELSE count + 1 END,
            reset_at = CASE WHEN reset_at <= v_now THEN v_now + v_window ELSE reset_at END,
            updated_at = NOW()
        WHERE bucket_key = p_bucket_key
            AND (reset_at <= v_now OR count < p_max_requests)
        RETURNING count, FLOOR(EXTRACT(EPOCH FROM reset_at) * 1000)::BIGINT
            INTO v_count, reset_at_ms;

        IF FOUND THEN
            allowed := TRUE;
            remaining := GREATEST(0, p_max_requests - v_count);
            RETURN NEXT;
            RETURN;
        END IF;

        SELECT count, FLOOR(EXTRACT(EPOCH FROM reset_at) * 1000)::BIGINT
        INTO v_count, reset_at_ms
        FROM public.rate_limit_buckets
        WHERE bucket_key = p_bucket_key;

        IF FOUND THEN
            IF reset_at_ms > FLOOR(EXTRACT(EPOCH FROM v_now) * 1000)::BIGINT THEN
                allowed := FALSE;
                remaining := 0;
                RETURN NEXT;
                RETURN;
            END IF;

            CONTINUE;
        END IF;

        BEGIN
            INSERT INTO public.rate_limit_buckets (
                bucket_key,
                count,
                reset_at
            )
            VALUES (
                p_bucket_key,
                1,
                v_now + v_window
            )
            RETURNING FLOOR(EXTRACT(EPOCH FROM reset_at) * 1000)::BIGINT INTO reset_at_ms;

            allowed := TRUE;
            remaining := GREATEST(0, p_max_requests - 1);
            RETURN NEXT;
            RETURN;
        EXCEPTION
            WHEN unique_violation THEN
                CONTINUE;
        END;
    END LOOP;
END;
$$;
