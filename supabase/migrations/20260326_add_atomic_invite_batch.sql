create or replace function public.create_invite_batch(
    p_invites jsonb
)
returns void
language plpgsql
security definer
as $$
begin
    if p_invites is null or jsonb_typeof(p_invites) <> 'array' then
        raise exception 'create_invite_batch expects a JSON array payload';
    end if;

    insert into public.sessions (
        session_id,
        recruiter_id,
        target_role,
        job_description,
        status,
        intake_json
    )
    select
        (invite ->> 'session_id')::uuid,
        (invite ->> 'created_by')::uuid,
        invite ->> 'role',
        nullif(invite ->> 'job_description', ''),
        'NOT_STARTED',
        jsonb_build_object(
            'candidate', coalesce(invite -> 'candidate', '{}'::jsonb),
            'invite_token', invite ->> 'encrypted_token'
        )
    from jsonb_array_elements(p_invites) as invite;

    insert into public.questions (
        session_id,
        question_index,
        question_text,
        category
    )
    select
        (invite ->> 'session_id')::uuid,
        (question ->> 'index')::integer,
        question ->> 'text',
        coalesce(question ->> 'category', 'General')
    from jsonb_array_elements(p_invites) as invite
    cross join lateral jsonb_array_elements(coalesce(invite -> 'questions', '[]'::jsonb)) as question;

    insert into public.candidate_tokens (
        token_hash,
        session_id
    )
    select
        invite ->> 'token_hash',
        (invite ->> 'session_id')::uuid
    from jsonb_array_elements(p_invites) as invite;
end;
$$;
