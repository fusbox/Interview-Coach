-- Interview Coach owns authentication and authorization in the Next.js server.
-- Supabase is a managed PostgreSQL host for the staging deployment, not the
-- browser data-access or authentication boundary.

do $$
begin
    if not exists (
        select 1
        from pg_roles
        where rolname = 'interview_coach_runtime'
    ) then
        create role interview_coach_runtime
            nologin
            nosuperuser
            nocreatedb
            nocreaterole
            inherit
            noreplication
            nobypassrls
            connection limit 40;
    else
        -- PostgreSQL intentionally reserves SUPERUSER, REPLICATION, and
        -- BYPASSRLS changes for superusers, even when the requested value is
        -- false. Supabase's postgres role is a non-superuser CREATEROLE
        -- operator, so fail closed if those immutable attributes are ever
        -- unsafe and enforce only the attributes this operator may change.
        if exists (
            select 1
            from pg_roles
            where rolname = 'interview_coach_runtime'
              and (rolsuper or rolreplication or rolbypassrls)
        ) then
            raise exception 'interview_coach_runtime has superuser-only privileges';
        end if;

        alter role interview_coach_runtime
            nocreatedb
            nocreaterole
            inherit
            connection limit 40;

        alter role interview_coach_runtime set statement_timeout = '15s';
        alter role interview_coach_runtime set lock_timeout = '5s';
        alter role interview_coach_runtime set idle_in_transaction_session_timeout = '15s';
        alter role interview_coach_runtime set search_path = 'pg_catalog', 'public';
    end if;
end;
$$;

revoke all privileges on schema public from public;
revoke all privileges on all tables in schema public from public;
revoke all privileges on all sequences in schema public from public;
revoke all privileges on all functions in schema public from public;

-- Supabase grants these Data API roles access to new public-schema objects on
-- older projects. Keep this migration portable to ordinary PostgreSQL by
-- revoking only roles that exist.
do $$
declare
    v_role text;
begin
    foreach v_role in array array['anon', 'authenticated', 'service_role', 'authenticator']
    loop
        if exists (
            select 1
            from pg_roles
            where rolname = v_role
        ) then
            execute format('revoke all privileges on schema public from %I', v_role);
            execute format('revoke all privileges on all tables in schema public from %I', v_role);
            execute format('revoke all privileges on all sequences in schema public from %I', v_role);
            execute format('revoke all privileges on all functions in schema public from %I', v_role);
        end if;
    end loop;
end;
$$;

grant usage on schema public to interview_coach_runtime;
grant select, insert, update, delete on all tables in schema public to interview_coach_runtime;
grant usage, select, update on all sequences in schema public to interview_coach_runtime;

-- Trigger and constraint functions do not need direct runtime execution. This
-- is the reviewed allowlist of functions invoked directly by current server,
-- worker, or maintenance code.
do $$
declare
    v_function record;
    v_allowed_names constant text[] := array[
        'advance_invited_practice_attempt',
        'claim_ai_eval_scenario_live_operation',
        'claim_ai_eval_scenario_run',
        'claim_ai_eval_live_scenario_run',
        'claim_candidate_resume_ingestion_operation',
        'claim_next_ai_eval_live_scenario_run',
        'claim_next_ai_eval_scenario_run',
        'claim_recruiter_invitation_delivery_attempt',
        'cleanup_expired_ai_eval_scenario_runs',
        'complete_candidate_resume_ingestion_operation',
        'consume_candidate_email_verification_v1',
        'consume_candidate_password_reset_v1',
        'consume_rate_limit_bucket',
        'create_ai_eval_scenario_run_request',
        'create_candidate_direct_practice_intent',
        'create_recruiter_invitation_aggregate',
        'create_recruiter_invitation_aggregate_from_question_set',
        'fail_candidate_resume_ingestion_operation',
        'invalidate_candidate_email_verification_v1',
        'invalidate_candidate_password_reset_v1',
        'interview_coach_sha256_text',
        'is_active_ai_eval_operator',
        'issue_candidate_email_verification_v1',
        'issue_candidate_password_reset_v1',
        'register_candidate_app_account_v2',
        'snapshot_candidate_next_round_draft_to_intent',
        'start_candidate_practice_intent_session'
    ];
begin
    for v_function in
        select procedure.oid::regprocedure as signature
        from pg_proc as procedure
        join pg_namespace as namespace
          on namespace.oid = procedure.pronamespace
        where namespace.nspname = 'public'
          and procedure.proname = any(v_allowed_names)
    loop
        execute format(
            'grant execute on function %s to interview_coach_runtime',
            v_function.signature
        );
    end loop;
end;
$$;

-- SECURITY DEFINER functions must resolve trusted system/application objects
-- before any temporary schema. PUBLIC execution remains revoked above.
do $$
declare
    v_function record;
begin
    for v_function in
        select procedure.oid::regprocedure as signature
        from pg_proc as procedure
        join pg_namespace as namespace
          on namespace.oid = procedure.pronamespace
        where namespace.nspname = 'public'
          and procedure.prosecdef
    loop
        execute format(
            'alter function %s set search_path = pg_catalog, public, pg_temp',
            v_function.signature
        );
    end loop;
end;
$$;

-- RLS is a database-service boundary here. Candidate/recruiter ownership is
-- still proved by server-side session resolution and ownership-scoped queries;
-- this policy intentionally does not pretend a Supabase request identity exists.
do $$
declare
    v_table record;
begin
    for v_table in
        select namespace.nspname as schema_name, relation.relname as table_name
        from pg_class as relation
        join pg_namespace as namespace
          on namespace.oid = relation.relnamespace
        where namespace.nspname = 'public'
          and relation.relkind in ('r', 'p')
    loop
        execute format(
            'alter table %I.%I enable row level security',
            v_table.schema_name,
            v_table.table_name
        );
        execute format(
            'drop policy if exists interview_coach_runtime_access on %I.%I',
            v_table.schema_name,
            v_table.table_name
        );
        execute format(
            'create policy interview_coach_runtime_access on %I.%I '
            'for all to interview_coach_runtime using (true) with check (true)',
            v_table.schema_name,
            v_table.table_name
        );
    end loop;
end;
$$;

-- Future objects are private by default. Future migrations must explicitly
-- enable RLS and grant direct function execution when a new runtime call is
-- introduced; the hardening smoke enforces both requirements.
alter default privileges in schema public
    revoke all privileges on tables from public;
alter default privileges in schema public
    revoke all privileges on sequences from public;
alter default privileges in schema public
    revoke execute on functions from public;

alter default privileges in schema public
    grant select, insert, update, delete on tables to interview_coach_runtime;
alter default privileges in schema public
    grant usage, select, update on sequences to interview_coach_runtime;

do $$
declare
    v_role text;
begin
    foreach v_role in array array['anon', 'authenticated', 'service_role', 'authenticator']
    loop
        if exists (
            select 1
            from pg_roles
            where rolname = v_role
        ) then
            execute format(
                'alter default privileges in schema public revoke all privileges on tables from %I',
                v_role
            );
            execute format(
                'alter default privileges in schema public revoke all privileges on sequences from %I',
                v_role
            );
            execute format(
                'alter default privileges in schema public revoke execute on functions from %I',
                v_role
            );
        end if;
    end loop;
end;
$$;
