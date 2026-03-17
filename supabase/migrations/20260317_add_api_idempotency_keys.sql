CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
    scope TEXT NOT NULL,
    actor_id UUID NOT NULL,
    key_hash TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    status_code INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (scope, actor_id, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_keys_expires_at
    ON public.api_idempotency_keys (expires_at);

ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_idempotency_keys" ON public.api_idempotency_keys;
CREATE POLICY "users_select_own_idempotency_keys"
    ON public.api_idempotency_keys
    FOR SELECT
    TO authenticated
    USING (actor_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_idempotency_keys" ON public.api_idempotency_keys;
CREATE POLICY "users_insert_own_idempotency_keys"
    ON public.api_idempotency_keys
    FOR INSERT
    TO authenticated
    WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_idempotency_keys" ON public.api_idempotency_keys;
CREATE POLICY "users_update_own_idempotency_keys"
    ON public.api_idempotency_keys
    FOR UPDATE
    TO authenticated
    USING (actor_id = auth.uid())
    WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_own_pending_idempotency_keys" ON public.api_idempotency_keys;
CREATE POLICY "users_delete_own_pending_idempotency_keys"
    ON public.api_idempotency_keys
    FOR DELETE
    TO authenticated
    USING (actor_id = auth.uid() AND status = 'pending');
