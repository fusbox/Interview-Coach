-- Make opaque candidate-owned prep-context identity available to follow-up practice intents.
-- Existing title-keyed intent metadata remains readable only as a bounded legacy fallback.

create unique index if not exists ux_candidate_role_profiles_owner_identity
  on public.candidate_role_preparation_profiles(candidate_profile_id, role_profile_id);

alter table public.candidate_practice_intents
  add column if not exists role_profile_id uuid;

update public.candidate_practice_intents intent
set role_profile_id = source_session.role_profile_id
from public.candidate_practice_sessions source_session
where intent.role_profile_id is null
  and source_session.candidate_profile_id = intent.candidate_profile_id
  and source_session.role_profile_id is not null
  and source_session.candidate_practice_session_id::text = intent.items_json #>> '{0,source,candidatePracticeSessionId}'
  and not exists (
    select 1
    from jsonb_array_elements(intent.items_json) intent_item
    where not exists (
      select 1
      from public.candidate_practice_sessions item_source_session
      where item_source_session.candidate_profile_id = intent.candidate_profile_id
        and item_source_session.role_profile_id = source_session.role_profile_id
        and item_source_session.candidate_practice_session_id::text = intent_item #>> '{source,candidatePracticeSessionId}'
    )
  );

do $$
begin
  alter table public.candidate_practice_intents
    add constraint fk_candidate_practice_intents_owned_role_profile
    foreign key (candidate_profile_id, role_profile_id)
    references public.candidate_role_preparation_profiles(candidate_profile_id, role_profile_id);
exception
  when duplicate_object then null;
end;
$$;

create index if not exists idx_candidate_practice_intents_profile_role_context
  on public.candidate_practice_intents(candidate_profile_id, role_profile_id, updated_at desc);
