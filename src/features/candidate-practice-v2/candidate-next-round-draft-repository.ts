import type {
    CandidateFollowUpPracticeIntentKind,
    CandidatePracticeIntentItemProvenance,
} from "./candidate-follow-up-practice-intent";
import {
    normalizeCandidateNextRoundDraftRecord,
    validateCandidateNextRoundDraftOrder,
    type CandidateNextRoundDraftMutationOutcome,
    type CandidateNextRoundDraftMutationResult,
} from "./candidate-next-round-draft";

export type CandidateNextRoundDraftQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export function createCandidateNextRoundDraftRepository(client: CandidateNextRoundDraftQueryClient) {
    return {
        async findOrCreateDraft(input: {
            candidateProfileId: string;
            roleProfileId: string;
        }) {
            const result = await client.query(`
                with owned_profile as materialized (
                  select candidate_profile_id, role_profile_id
                  from public.candidate_role_preparation_profiles
                  where candidate_profile_id = $1
                    and role_profile_id = $2
                    and status in ('active', 'paused')
                ),
                inserted as (
                  insert into public.candidate_next_round_drafts (
                    candidate_profile_id,
                    role_profile_id
                  )
                  select candidate_profile_id, role_profile_id
                  from owned_profile
                  on conflict (candidate_profile_id, role_profile_id) do nothing
                  returning *
                ),
                selected as materialized (
                  select * from inserted
                  union all
                  select draft.*
                  from public.candidate_next_round_drafts draft
                  join owned_profile using (candidate_profile_id, role_profile_id)
                  where not exists (select 1 from inserted)
                  limit 1
                )
                select selected.*,
                       coalesce((
                         select jsonb_agg(
                           jsonb_build_object(
                             'candidateNextRoundDraftItemId', item.candidate_next_round_draft_item_id,
                             'sourceCandidatePracticeSessionId', item.source_candidate_practice_session_id,
                             'sourceQuestionKey', item.source_question_key,
                             'practiceKind', item.practice_kind,
                             'provenance', item.provenance,
                             'displayPosition', item.display_position,
                             'createdAt', item.created_at,
                             'updatedAt', item.updated_at
                           ) order by item.display_position
                         )
                         from public.candidate_next_round_draft_items item
                         where item.candidate_next_round_draft_id = selected.candidate_next_round_draft_id
                       ), '[]'::jsonb) as items_json
                from selected
            `, [input.candidateProfileId, input.roleProfileId]);

            return normalizeCandidateNextRoundDraftRecord(result.rows[0]);
        },

        async findDraft(input: {
            candidateNextRoundDraftId: string;
            candidateProfileId: string;
            roleProfileId: string;
        }) {
            const result = await client.query(`
                select draft.*,
                       coalesce((
                         select jsonb_agg(
                           jsonb_build_object(
                             'candidateNextRoundDraftItemId', item.candidate_next_round_draft_item_id,
                             'sourceCandidatePracticeSessionId', item.source_candidate_practice_session_id,
                             'sourceQuestionKey', item.source_question_key,
                             'practiceKind', item.practice_kind,
                             'provenance', item.provenance,
                             'displayPosition', item.display_position,
                             'createdAt', item.created_at,
                             'updatedAt', item.updated_at
                           ) order by item.display_position
                         )
                         from public.candidate_next_round_draft_items item
                         where item.candidate_next_round_draft_id = draft.candidate_next_round_draft_id
                       ), '[]'::jsonb) as items_json
                from public.candidate_next_round_drafts draft
                where draft.candidate_next_round_draft_id = $1
                  and draft.candidate_profile_id = $2
                  and draft.role_profile_id = $3
                limit 1
            `, [
                input.candidateNextRoundDraftId,
                input.candidateProfileId,
                input.roleProfileId,
            ]);

            return normalizeCandidateNextRoundDraftRecord(result.rows[0]);
        },

        async addItem(input: {
            candidateNextRoundDraftId: string;
            candidateProfileId: string;
            roleProfileId: string;
            expectedVersion: number;
            sourceCandidatePracticeSessionId: string;
            sourceQuestionKey: string;
            practiceKind: CandidateFollowUpPracticeIntentKind;
            provenance: CandidatePracticeIntentItemProvenance;
        }) {
            const result = await client.query(`
                with owned_draft as materialized (
                  select *
                  from public.candidate_next_round_drafts
                  where candidate_next_round_draft_id = $1
                    and candidate_profile_id = $2
                    and role_profile_id = $3
                  for update
                ),
                existing_item as materialized (
                  select item.*
                  from public.candidate_next_round_draft_items item
                  join owned_draft draft
                    on draft.candidate_next_round_draft_id = item.candidate_next_round_draft_id
                  where item.source_candidate_practice_session_id = $5
                    and item.source_question_key = $6
                  limit 1
                ),
                valid_source as materialized (
                  select source_session.candidate_practice_session_id
                  from public.candidate_practice_sessions source_session
                  join owned_draft draft
                    on source_session.candidate_profile_id = draft.candidate_profile_id
                   and source_session.role_profile_id = draft.role_profile_id
                  where source_session.candidate_practice_session_id = $5
                    and exists (
                      select 1
                      from jsonb_array_elements(
                        case
                          when jsonb_typeof(source_session.question_wording_snapshot_json -> 'questions') = 'array'
                            then source_session.question_wording_snapshot_json -> 'questions'
                          else '[]'::jsonb
                        end
                      ) question
                      where question ->> 'slotId' = $6
                    )
                    and (
                      (
                        $7 = 'practice_from_feedback'
                        and source_session.answer_submissions_json ? $6
                        and source_session.answer_analysis_snapshots_json ? $6
                        and source_session.answer_analysis_snapshots_json #>> array[$6, 'answer', 'slotId'] = $6
                        and (
                          source_session.answer_analysis_snapshots_json #>> array[$6, 'answer', 'answerAttemptId']
                        ) is not distinct from (
                          source_session.answer_submissions_json #>> array[$6, 'answerAttemptId']
                        )
                      )
                      or
                      (
                        $7 = 'practice_missing_evidence'
                        and not source_session.answer_submissions_json ? $6
                      )
                    )
                  limit 1
                ),
                item_capacity as materialized (
                  select count(*)::integer as item_count
                  from public.candidate_next_round_draft_items item
                  join owned_draft draft
                    on draft.candidate_next_round_draft_id = item.candidate_next_round_draft_id
                ),
                inserted as (
                  insert into public.candidate_next_round_draft_items (
                    candidate_next_round_draft_id,
                    candidate_profile_id,
                    role_profile_id,
                    source_candidate_practice_session_id,
                    source_question_key,
                    practice_kind,
                    provenance,
                    display_position
                  )
                  select
                    draft.candidate_next_round_draft_id,
                    draft.candidate_profile_id,
                    draft.role_profile_id,
                    $5,
                    $6,
                    $7,
                    $8,
                    item_capacity.item_count
                  from owned_draft draft
                  cross join valid_source
                  cross join item_capacity
                  where draft.version = $4
                    and item_capacity.item_count < 20
                    and not exists (select 1 from existing_item)
                  returning candidate_next_round_draft_item_id
                ),
                updated as (
                  update public.candidate_next_round_drafts draft
                  set version = draft.version + 1
                  from inserted
                  where draft.candidate_next_round_draft_id = $1
                  returning
                    draft.version,
                    inserted.candidate_next_round_draft_item_id
                )
                select
                  'updated'::text as mutation_outcome,
                  updated.version,
                  updated.candidate_next_round_draft_item_id
                from updated
                union all
                select
                  'unchanged'::text,
                  draft.version,
                  existing_item.candidate_next_round_draft_item_id
                from owned_draft draft
                join existing_item on true
                where draft.version = $4
                  and existing_item.practice_kind = $7
                  and existing_item.provenance = $8
                  and not exists (select 1 from updated)
                union all
                select 'version_conflict'::text, draft.version, null::uuid
                from owned_draft draft
                where draft.version <> $4
                  and not exists (select 1 from updated)
                union all
                select 'item_conflict'::text, draft.version, existing_item.candidate_next_round_draft_item_id
                from owned_draft draft
                join existing_item on true
                where draft.version = $4
                  and (existing_item.practice_kind <> $7 or existing_item.provenance <> $8)
                  and not exists (select 1 from updated)
                union all
                select 'capacity_exceeded'::text, draft.version, null::uuid
                from owned_draft draft
                cross join item_capacity
                where draft.version = $4
                  and item_capacity.item_count >= 20
                  and not exists (select 1 from existing_item)
                  and not exists (select 1 from updated)
                union all
                select 'invalid_source'::text, draft.version, null::uuid
                from owned_draft draft
                where draft.version = $4
                  and not exists (select 1 from valid_source)
                  and not exists (select 1 from existing_item)
                  and not exists (select 1 from updated)
                limit 1
            `, [
                input.candidateNextRoundDraftId,
                input.candidateProfileId,
                input.roleProfileId,
                input.expectedVersion,
                input.sourceCandidatePracticeSessionId,
                input.sourceQuestionKey,
                input.practiceKind,
                input.provenance,
            ]);

            return normalizeMutationResult(result.rows[0]);
        },

        async removeItem(input: {
            candidateNextRoundDraftId: string;
            candidateProfileId: string;
            roleProfileId: string;
            expectedVersion: number;
            candidateNextRoundDraftItemId: string;
        }) {
            const result = await client.query(`
                with owned_draft as materialized (
                  select *
                  from public.candidate_next_round_drafts
                  where candidate_next_round_draft_id = $1
                    and candidate_profile_id = $2
                    and role_profile_id = $3
                  for update
                ),
                deleted as (
                  delete from public.candidate_next_round_draft_items item
                  using owned_draft draft
                  where item.candidate_next_round_draft_id = draft.candidate_next_round_draft_id
                    and item.candidate_next_round_draft_item_id = $5
                    and draft.version = $4
                  returning item.candidate_next_round_draft_item_id
                ),
                updated as (
                  update public.candidate_next_round_drafts draft
                  set version = draft.version + 1
                  from deleted
                  where draft.candidate_next_round_draft_id = $1
                  returning draft.version, deleted.candidate_next_round_draft_item_id
                )
                select 'updated'::text as mutation_outcome,
                       updated.version,
                       updated.candidate_next_round_draft_item_id
                from updated
                union all
                select 'version_conflict'::text, draft.version, null::uuid
                from owned_draft draft
                where draft.version <> $4
                  and not exists (select 1 from updated)
                union all
                select 'unchanged'::text, draft.version, null::uuid
                from owned_draft draft
                where draft.version = $4
                  and not exists (select 1 from updated)
                limit 1
            `, [
                input.candidateNextRoundDraftId,
                input.candidateProfileId,
                input.roleProfileId,
                input.expectedVersion,
                input.candidateNextRoundDraftItemId,
            ]);

            return normalizeMutationResult(result.rows[0]);
        },

        async clearDraft(input: {
            candidateNextRoundDraftId: string;
            candidateProfileId: string;
            roleProfileId: string;
            expectedVersion: number;
        }) {
            const result = await client.query(`
                with owned_draft as materialized (
                  select *
                  from public.candidate_next_round_drafts
                  where candidate_next_round_draft_id = $1
                    and candidate_profile_id = $2
                    and role_profile_id = $3
                  for update
                ),
                deleted as (
                  delete from public.candidate_next_round_draft_items item
                  using owned_draft draft
                  where item.candidate_next_round_draft_id = draft.candidate_next_round_draft_id
                    and draft.version = $4
                  returning item.candidate_next_round_draft_item_id
                ),
                deleted_count as materialized (
                  select count(*)::integer as item_count from deleted
                ),
                updated as (
                  update public.candidate_next_round_drafts draft
                  set version = draft.version + 1
                  from deleted_count
                  where draft.candidate_next_round_draft_id = $1
                    and deleted_count.item_count > 0
                  returning draft.version
                )
                select 'updated'::text as mutation_outcome, updated.version, null::uuid
                from updated
                union all
                select 'version_conflict'::text, draft.version, null::uuid
                from owned_draft draft
                where draft.version <> $4
                  and not exists (select 1 from updated)
                union all
                select 'unchanged'::text, draft.version, null::uuid
                from owned_draft draft
                cross join deleted_count
                where draft.version = $4
                  and deleted_count.item_count = 0
                  and not exists (select 1 from updated)
                limit 1
            `, [
                input.candidateNextRoundDraftId,
                input.candidateProfileId,
                input.roleProfileId,
                input.expectedVersion,
            ]);

            return normalizeMutationResult(result.rows[0]);
        },

        async reorderItems(input: {
            candidateNextRoundDraftId: string;
            candidateProfileId: string;
            roleProfileId: string;
            expectedVersion: number;
            orderedItemIds: string[];
            expectedItemCount: number;
        }) {
            const orderedItemIds = validateCandidateNextRoundDraftOrder(
                input.orderedItemIds,
                input.expectedItemCount,
            );
            if (!orderedItemIds) {
                return { outcome: "invalid_order" as const };
            }

            const orderPayload = orderedItemIds.map((candidateNextRoundDraftItemId, displayPosition) => ({
                candidateNextRoundDraftItemId,
                displayPosition,
            }));
            const result = await client.query(`
                with owned_draft as materialized (
                  select *
                  from public.candidate_next_round_drafts
                  where candidate_next_round_draft_id = $1
                    and candidate_profile_id = $2
                    and role_profile_id = $3
                  for update
                ),
                requested_order as materialized (
                  select
                    (entry ->> 'candidateNextRoundDraftItemId')::uuid as item_id,
                    (entry ->> 'displayPosition')::integer as display_position
                  from jsonb_array_elements($5::jsonb) entry
                ),
                valid_order as materialized (
                  select draft.candidate_next_round_draft_id
                  from owned_draft draft
                  where draft.version = $4
                    and (select count(*) from requested_order) = $6
                    and (select count(distinct item_id) from requested_order) = $6
                    and (select count(distinct display_position) from requested_order) = $6
                    and (select min(display_position) from requested_order) = 0
                    and (select max(display_position) from requested_order) = $6 - 1
                    and (
                      select count(*)
                      from public.candidate_next_round_draft_items item
                      where item.candidate_next_round_draft_id = draft.candidate_next_round_draft_id
                    ) = $6
                    and not exists (
                      select 1
                      from requested_order requested
                      where not exists (
                        select 1
                        from public.candidate_next_round_draft_items item
                        where item.candidate_next_round_draft_id = draft.candidate_next_round_draft_id
                          and item.candidate_next_round_draft_item_id = requested.item_id
                      )
                    )
                ),
                reordered as (
                  update public.candidate_next_round_draft_items item
                  set display_position = requested.display_position
                  from requested_order requested
                  cross join valid_order
                  where item.candidate_next_round_draft_id = valid_order.candidate_next_round_draft_id
                    and item.candidate_next_round_draft_item_id = requested.item_id
                  returning item.candidate_next_round_draft_item_id
                ),
                updated as (
                  update public.candidate_next_round_drafts draft
                  set version = draft.version + 1
                  from valid_order
                  where draft.candidate_next_round_draft_id = valid_order.candidate_next_round_draft_id
                    and (select count(*) from reordered) = $6
                  returning draft.version
                )
                select 'updated'::text as mutation_outcome, updated.version, null::uuid
                from updated
                union all
                select 'version_conflict'::text, draft.version, null::uuid
                from owned_draft draft
                where draft.version <> $4
                  and not exists (select 1 from updated)
                union all
                select 'invalid_order'::text, draft.version, null::uuid
                from owned_draft draft
                where draft.version = $4
                  and not exists (select 1 from valid_order)
                  and not exists (select 1 from updated)
                limit 1
            `, [
                input.candidateNextRoundDraftId,
                input.candidateProfileId,
                input.roleProfileId,
                input.expectedVersion,
                JSON.stringify(orderPayload),
                input.expectedItemCount,
            ]);

            return normalizeMutationResult(result.rows[0]);
        },
    };
}

function normalizeMutationResult(
    row: Record<string, unknown> | undefined,
): CandidateNextRoundDraftMutationResult {
    if (!row) {
        return { outcome: "not_found" };
    }

    const outcome = row.mutation_outcome;
    if (!isMutationOutcome(outcome)) {
        return { outcome: "not_found" };
    }

    const version = readPositiveInteger(row.version);
    const candidateNextRoundDraftItemId = readString(row.candidate_next_round_draft_item_id);
    return {
        outcome,
        ...(version ? { version } : {}),
        ...(candidateNextRoundDraftItemId ? { candidateNextRoundDraftItemId } : {}),
    };
}

function isMutationOutcome(value: unknown): value is CandidateNextRoundDraftMutationOutcome {
    return value === "updated"
        || value === "unchanged"
        || value === "version_conflict"
        || value === "invalid_source"
        || value === "item_conflict"
        || value === "capacity_exceeded"
        || value === "invalid_order"
        || value === "not_found";
}

function readPositiveInteger(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
