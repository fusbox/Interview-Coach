begin;

do $$
declare
    v_role record;
    v_missing_count integer;
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
        'is_active_ai_eval_operator',
        'issue_candidate_email_verification_v1',
        'issue_candidate_password_reset_v1',
        'register_candidate_app_account_v2',
        'snapshot_candidate_next_round_draft_to_intent',
        'start_candidate_practice_intent_session'
    ];
begin
    select count(*)
    into v_missing_count
    from pg_roles
    where rolname = 'interview_coach_runtime'
      and (
          rolsuper
          or rolcreatedb
          or rolcreaterole
          or rolreplication
          or rolbypassrls
      );

    if not exists (
        select 1
        from pg_roles
        where rolname = 'interview_coach_runtime'
    ) or v_missing_count <> 0 then
        raise exception 'interview_coach_runtime is missing or privileged';
    end if;

    select count(*)
    into v_missing_count
    from pg_class as relation
    join pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity;

    if v_missing_count <> 0 then
        raise exception '% public application tables do not have RLS enabled', v_missing_count;
    end if;

    select count(*)
    into v_missing_count
    from pg_class as relation
    join pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not exists (
          select 1
          from pg_policy as policy
          join pg_roles as policy_role
            on policy_role.oid = any(policy.polroles)
          where policy.polrelid = relation.oid
            and policy.polname = 'interview_coach_runtime_access'
            and policy_role.rolname = 'interview_coach_runtime'
      );

    if v_missing_count <> 0 then
        raise exception '% public application tables lack the runtime RLS policy', v_missing_count;
    end if;

    select count(*)
    into v_missing_count
    from pg_proc as procedure
    join pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and has_function_privilege('public', procedure.oid, 'execute');

    if v_missing_count <> 0 then
        raise exception '% public-schema functions remain executable by PUBLIC', v_missing_count;
    end if;

    select count(*)
    into v_missing_count
    from pg_proc as procedure
    join pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and not (
          coalesce(procedure.proconfig, array[]::text[])
          @> array['search_path=pg_catalog, public, pg_temp']
      );

    if v_missing_count <> 0 then
        raise exception '% SECURITY DEFINER functions lack the hardened search_path', v_missing_count;
    end if;

    select count(*)
    into v_missing_count
    from pg_proc as procedure
    join pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(v_allowed_names)
      and not has_function_privilege(
          'interview_coach_runtime',
          procedure.oid,
          'execute'
      );

    if v_missing_count <> 0 then
        raise exception '% allowlisted runtime functions lack EXECUTE', v_missing_count;
    end if;

    if has_schema_privilege('interview_coach_runtime', 'public', 'create') then
        raise exception 'interview_coach_runtime can create objects in public';
    end if;

    select count(*)
    into v_missing_count
    from pg_class as relation
    join pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not (
          has_table_privilege('interview_coach_runtime', relation.oid, 'select')
          and has_table_privilege('interview_coach_runtime', relation.oid, 'insert')
          and has_table_privilege('interview_coach_runtime', relation.oid, 'update')
          and has_table_privilege('interview_coach_runtime', relation.oid, 'delete')
      );

    if v_missing_count <> 0 then
        raise exception '% public application tables lack runtime DML grants', v_missing_count;
    end if;

    for v_role in
        select rolname
        from pg_roles
        where rolname = any(array['anon', 'authenticated', 'service_role', 'authenticator'])
    loop
        if has_schema_privilege(v_role.rolname, 'public', 'usage') then
            raise exception '% retains public schema usage', v_role.rolname;
        end if;

        if exists (
            select 1
            from pg_class as relation
            join pg_namespace as namespace
              on namespace.oid = relation.relnamespace
            where namespace.nspname = 'public'
              and relation.relkind in ('r', 'p')
              and (
                  has_table_privilege(v_role.rolname, relation.oid, 'select')
                  or has_table_privilege(v_role.rolname, relation.oid, 'insert')
                  or has_table_privilege(v_role.rolname, relation.oid, 'update')
                  or has_table_privilege(v_role.rolname, relation.oid, 'delete')
              )
        ) then
            raise exception '% retains public table privileges', v_role.rolname;
        end if;

        if exists (
            select 1
            from pg_proc as procedure
            join pg_namespace as namespace
              on namespace.oid = procedure.pronamespace
            where namespace.nspname = 'public'
              and has_function_privilege(v_role.rolname, procedure.oid, 'execute')
        ) then
            raise exception '% retains public function execution', v_role.rolname;
        end if;
    end loop;
end;
$$;

set local role interview_coach_runtime;
select count(*) >= 0 as runtime_can_read
from public.app_users;
reset role;

rollback;
