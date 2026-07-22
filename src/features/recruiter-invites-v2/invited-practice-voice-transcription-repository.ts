import {
    createVoiceTranscriptDraft,
    normalizeVoiceTranscriptDrafts,
    normalizeVoiceTranscriptionRunRecord,
    type VoiceTranscriptSubmissionPath,
    type VoiceTranscriptionClaimResult,
    type VoiceTranscriptionCompletionResult,
} from "@/features/interview-session-v2/voice-answer-transcription";
import { createVoiceTranscriptFingerprint } from "@/features/interview-session-v2/voice-answer-transcription-server";

const VOICE_TRANSCRIPTION_GENERATION_LIMIT = 3;

export type InvitedVoiceTranscriptionQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export function createInvitedPracticeVoiceTranscriptionRepository(client: InvitedVoiceTranscriptionQueryClient) {
    return {
        async recoverRun(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            questionSlotId: string;
            questionIndex: number;
            idempotencyKeyHash: string;
            audioInputFingerprint: string;
            submissionPath: VoiceTranscriptSubmissionPath;
        }): Promise<VoiceTranscriptionClaimResult | null> {
            const result = await client.query(`
                select case
                         when run.audio_input_fingerprint <> $6 or run.submission_path <> $7
                           then 'idempotency_conflict'
                         when run.lifecycle_state = 'requested' and run.claim_expires_at > clock_timestamp()
                           then 'in_progress'
                         when run.lifecycle_state = 'completed'
                              and session.voice_transcript_drafts_json -> $3 ->> 'sourceTranscriptionRunId'
                                  = run.invited_practice_voice_transcription_run_id::text
                           then 'replayed'
                         when run.lifecycle_state = 'completed' then 'superseded'
                         else 'provider_unavailable'
                       end as claim_outcome,
                       run.*,
                       session.voice_transcript_drafts_json
                from public.invited_practice_sessions session
                join lateral (
                  select invited_run.*
                  from public.invited_practice_voice_transcription_runs invited_run
                  where invited_run.invited_practice_session_id = session.invited_practice_session_id
                    and invited_run.recruiter_invitation_recipient_id = session.recruiter_invitation_recipient_id
                    and invited_run.question_slot_id = $3
                    and invited_run.question_index = $4::integer
                    and invited_run.idempotency_key_hash = $5
                  order by invited_run.generation_attempt desc
                  limit 1
                ) run on true
                where session.invited_practice_session_id = $1
                  and session.recruiter_invitation_recipient_id = $2
                  and session.status in ('planned', 'in_progress')
                  and exists (
                    select 1
                    from jsonb_array_elements(session.question_wording_snapshot_json -> 'questions') question
                    where question ->> 'slotId' = $3
                      and question ->> 'index' = $4::text
                  )
                limit 1
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                input.questionSlotId,
                input.questionIndex,
                input.idempotencyKeyHash,
                input.audioInputFingerprint,
                input.submissionPath,
            ]);
            return normalizeClaim(result.rows[0]);
        },

        async createRequestedRun(input: {
            invitedPracticeVoiceTranscriptionRunId: string;
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            questionSlotId: string;
            questionIndex: number;
            idempotencyKeyHash: string;
            audioInputFingerprint: string;
            acceptedMimeType: string;
            audioByteCount: number;
            audioDurationMs?: number | null;
            submissionPath: VoiceTranscriptSubmissionPath;
            provider: string;
            profileId: string;
            modelName: string;
            configurationFingerprint: string;
            generationAttempt: number;
            requestedAt: string;
            claimExpiresAt: string;
        }) {
            const result = await client.query(`
                with owned_slot as materialized (
                  select session.invited_practice_session_id
                  from public.invited_practice_sessions session
                  where session.invited_practice_session_id = $2
                    and session.recruiter_invitation_recipient_id = $3
                    and session.status in ('planned', 'in_progress')
                    and exists (
                      select 1
                      from jsonb_array_elements(session.question_wording_snapshot_json -> 'questions') question
                      where question ->> 'slotId' = $4
                        and question ->> 'index' = $5::text
                    )
                ), inserted as (
                  insert into public.invited_practice_voice_transcription_runs (
                    invited_practice_voice_transcription_run_id,
                    invited_practice_session_id,
                    recruiter_invitation_recipient_id,
                    question_slot_id,
                    question_index,
                    idempotency_key_hash,
                    audio_input_fingerprint,
                    accepted_mime_type,
                    audio_byte_count,
                    audio_duration_ms,
                    submission_path,
                    provider,
                    profile_id,
                    model_name,
                    configuration_fingerprint,
                    generation_attempt,
                    lifecycle_state,
                    requested_at,
                    claim_expires_at
                  )
                  select $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                         'requested', $17, $18
                  from owned_slot
                  returning *
                )
                select * from inserted
            `, [
                input.invitedPracticeVoiceTranscriptionRunId,
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                input.questionSlotId,
                input.questionIndex,
                input.idempotencyKeyHash,
                input.audioInputFingerprint,
                input.acceptedMimeType,
                input.audioByteCount,
                input.audioDurationMs ?? null,
                input.submissionPath,
                input.provider,
                input.profileId,
                input.modelName,
                input.configurationFingerprint,
                input.generationAttempt,
                input.requestedAt,
                input.claimExpiresAt,
            ]);
            return normalizeInvitedRun(result.rows[0]);
        },

        async claimRun(input: {
            invitedPracticeVoiceTranscriptionRunId: string;
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            questionSlotId: string;
            questionIndex: number;
            idempotencyKeyHash: string;
            audioInputFingerprint: string;
            acceptedMimeType: string;
            audioByteCount: number;
            audioDurationMs: number;
            submissionPath: VoiceTranscriptSubmissionPath;
            provider: string;
            profileId: string;
            modelName: string;
            configurationFingerprint: string;
            requestedAt: string;
            claimExpiresAt: string;
        }): Promise<VoiceTranscriptionClaimResult | null> {
            let uniqueConflictRetries = 0;
            for (;;) {
                try {
                    const result = await client.query(`
                        with owned_slot as materialized (
                          select session.voice_transcript_drafts_json
                          from public.invited_practice_sessions session
                          where session.invited_practice_session_id = $2
                            and session.recruiter_invitation_recipient_id = $3
                            and session.status in ('planned', 'in_progress')
                            and exists (
                              select 1
                              from jsonb_array_elements(session.question_wording_snapshot_json -> 'questions') question
                              where question ->> 'slotId' = $4
                                and question ->> 'index' = $5::text
                            )
                        ), claim_lock as materialized (
                          select pg_advisory_xact_lock(
                            hashtextextended($2::text || ':' || $4::text || ':' || $6::text, 0)
                          )
                          from owned_slot
                        ), expired_requested as (
                          update public.invited_practice_voice_transcription_runs run
                          set lifecycle_state = 'failed',
                              error_code = 'STALE_TRANSCRIPTION_CLAIM',
                              completed_at = $16
                          from claim_lock
                          where run.invited_practice_session_id = $2
                            and run.recruiter_invitation_recipient_id = $3
                            and run.question_slot_id = $4
                            and run.question_index = $5::integer
                            and run.idempotency_key_hash = $6
                            and run.audio_input_fingerprint = $7
                            and run.submission_path = $11
                            and run.lifecycle_state = 'requested'
                            and run.claim_expires_at <= $16
                          returning run.invited_practice_voice_transcription_run_id
                        ), latest_any as materialized (
                          select run.*
                          from public.invited_practice_voice_transcription_runs run
                          cross join claim_lock
                          where run.invited_practice_session_id = $2
                            and run.recruiter_invitation_recipient_id = $3
                            and run.question_slot_id = $4
                            and run.question_index = $5::integer
                            and run.idempotency_key_hash = $6
                            and run.invited_practice_voice_transcription_run_id not in (
                              select invited_practice_voice_transcription_run_id from expired_requested
                            )
                          order by run.generation_attempt desc
                          limit 1
                        ), active as materialized (
                          select run.* from latest_any run
                          where run.lifecycle_state in ('requested', 'completed')
                        ), generation_count as materialized (
                          select count(*)::integer as value
                          from public.invited_practice_voice_transcription_runs run
                          cross join claim_lock
                          where run.invited_practice_session_id = $2
                            and run.recruiter_invitation_recipient_id = $3
                            and run.question_slot_id = $4
                            and run.question_index = $5::integer
                            and run.idempotency_key_hash = $6
                        ), next_generation as materialized (
                          select coalesce(max(run.generation_attempt), 0) + 1 as value
                          from public.invited_practice_voice_transcription_runs run
                          cross join claim_lock
                          where run.invited_practice_session_id = $2
                            and run.recruiter_invitation_recipient_id = $3
                            and run.question_slot_id = $4
                            and run.question_index = $5::integer
                            and run.idempotency_key_hash = $6
                        ), inserted as (
                          insert into public.invited_practice_voice_transcription_runs (
                            invited_practice_voice_transcription_run_id,
                            invited_practice_session_id,
                            recruiter_invitation_recipient_id,
                            question_slot_id,
                            question_index,
                            idempotency_key_hash,
                            audio_input_fingerprint,
                            accepted_mime_type,
                            audio_byte_count,
                            audio_duration_ms,
                            submission_path,
                            provider,
                            profile_id,
                            model_name,
                            configuration_fingerprint,
                            generation_attempt,
                            lifecycle_state,
                            requested_at,
                            claim_expires_at
                          )
                          select $1, $2, $3, $4, $5::integer, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                                 next_generation.value, 'requested', $16, $17
                          from owned_slot
                          cross join claim_lock
                          cross join generation_count
                          cross join next_generation
                          where not exists (select 1 from active)
                            and not exists (
                              select 1 from latest_any
                              where audio_input_fingerprint <> $7 or submission_path <> $11
                            )
                            and generation_count.value < $18
                          returning *
                        )
                        select 'acquired'::text as claim_outcome, inserted.*, null::jsonb as voice_transcript_drafts_json
                        from inserted
                        union all
                        select case
                                 when active.audio_input_fingerprint <> $7 or active.submission_path <> $11
                                   then 'idempotency_conflict'
                                 when active.lifecycle_state = 'requested' then 'in_progress'
                                 when owned_slot.voice_transcript_drafts_json -> $4 ->> 'sourceTranscriptionRunId'
                                      = active.invited_practice_voice_transcription_run_id::text then 'replayed'
                                 else 'superseded'
                               end,
                               active.*,
                               owned_slot.voice_transcript_drafts_json
                        from active cross join owned_slot
                        union all
                        select 'idempotency_conflict'::text, latest_any.*, owned_slot.voice_transcript_drafts_json
                        from latest_any cross join owned_slot
                        where not exists (select 1 from active)
                          and (latest_any.audio_input_fingerprint <> $7 or latest_any.submission_path <> $11)
                        union all
                        select 'generation_limit'::text, latest_any.*, owned_slot.voice_transcript_drafts_json
                        from latest_any cross join owned_slot cross join generation_count
                        where not exists (select 1 from active)
                          and latest_any.audio_input_fingerprint = $7
                          and latest_any.submission_path = $11
                          and generation_count.value >= $18
                        limit 1
                    `, [
                        input.invitedPracticeVoiceTranscriptionRunId,
                        input.invitedPracticeSessionId,
                        input.recruiterInvitationRecipientId,
                        input.questionSlotId,
                        input.questionIndex,
                        input.idempotencyKeyHash,
                        input.audioInputFingerprint,
                        input.acceptedMimeType,
                        input.audioByteCount,
                        input.audioDurationMs,
                        input.submissionPath,
                        input.provider,
                        input.profileId,
                        input.modelName,
                        input.configurationFingerprint,
                        input.requestedAt,
                        input.claimExpiresAt,
                        VOICE_TRANSCRIPTION_GENERATION_LIMIT,
                    ]);
                    return normalizeClaim(result.rows[0]);
                } catch (error) {
                    if (readPostgresCode(error) !== "23505" || uniqueConflictRetries >= 1) throw error;
                    uniqueConflictRetries += 1;
                }
            }
        },

        async findOwnedRun(input: {
            invitedPracticeVoiceTranscriptionRunId: string;
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
        }) {
            const result = await client.query(`
                select *
                from public.invited_practice_voice_transcription_runs
                where invited_practice_voice_transcription_run_id = $1
                  and invited_practice_session_id = $2
                  and recruiter_invitation_recipient_id = $3
                limit 1
            `, [
                input.invitedPracticeVoiceTranscriptionRunId,
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
            ]);
            return normalizeInvitedRun(result.rows[0]);
        },

        async completeRunAndSaveDraft(input: {
            invitedPracticeVoiceTranscriptionRunId: string;
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            questionSlotId: string;
            questionIndex: number;
            transcriptText: string;
            submissionPath: VoiceTranscriptSubmissionPath;
            completedAt: string;
        }): Promise<VoiceTranscriptionCompletionResult | null> {
            const outputFingerprint = createVoiceTranscriptFingerprint(input.transcriptText);
            const draft = createVoiceTranscriptDraft({
                slotId: input.questionSlotId,
                questionIndex: input.questionIndex,
                transcriptText: input.transcriptText,
                sourceTranscriptionRunId: input.invitedPracticeVoiceTranscriptionRunId,
                submissionPath: input.submissionPath,
                updatedAt: input.completedAt,
            });
            const result = await client.query(`
                with owned_session as materialized (
                  select invited_practice_session_id
                  from public.invited_practice_sessions
                  where invited_practice_session_id = $2
                    and recruiter_invitation_recipient_id = $3
                    and status in ('planned', 'in_progress')
                  for update
                ), completed as (
                  update public.invited_practice_voice_transcription_runs run
                  set lifecycle_state = 'completed',
                      output_fingerprint = $6,
                      error_code = null,
                      completed_at = $7
                  from owned_session
                  where run.invited_practice_voice_transcription_run_id = $1
                    and run.invited_practice_session_id = $2
                    and run.recruiter_invitation_recipient_id = $3
                    and run.question_slot_id = $4
                    and run.question_index = $5
                    and run.submission_path = $8
                    and run.lifecycle_state = 'requested'
                    and run.claim_expires_at > $7::timestamptz
                    and run.claim_expires_at > clock_timestamp()
                  returning run.*
                ), saved as (
                  update public.invited_practice_sessions session
                  set voice_transcript_drafts_json = jsonb_set(
                        coalesce(session.voice_transcript_drafts_json, '{}'::jsonb),
                        array[$4]::text[],
                        $9::jsonb,
                        true
                      ),
                      updated_at = $7
                  from completed
                  where session.invited_practice_session_id = $2
                    and session.recruiter_invitation_recipient_id = $3
                  returning session.voice_transcript_drafts_json
                )
                select completed.*, saved.voice_transcript_drafts_json
                from completed cross join saved
            `, [
                input.invitedPracticeVoiceTranscriptionRunId,
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                input.questionSlotId,
                input.questionIndex,
                outputFingerprint,
                input.completedAt,
                input.submissionPath,
                JSON.stringify(draft),
            ]);
            return normalizeCompletion(result.rows[0]);
        },

        async failRun(input: {
            invitedPracticeVoiceTranscriptionRunId: string;
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            errorCode: string;
            completedAt: string;
        }) {
            const result = await client.query(`
                update public.invited_practice_voice_transcription_runs
                set lifecycle_state = 'failed',
                    output_fingerprint = null,
                    error_code = $4,
                    completed_at = $5
                where invited_practice_voice_transcription_run_id = $1
                  and invited_practice_session_id = $2
                  and recruiter_invitation_recipient_id = $3
                  and lifecycle_state = 'requested'
                returning *
            `, [
                input.invitedPracticeVoiceTranscriptionRunId,
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                input.errorCode,
                input.completedAt,
            ]);
            return normalizeInvitedRun(result.rows[0]);
        },

        async findCurrentDraft(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            questionSlotId: string;
        }) {
            const result = await client.query(`
                select voice_transcript_drafts_json
                from public.invited_practice_sessions
                where invited_practice_session_id = $1
                  and recruiter_invitation_recipient_id = $2
                limit 1
            `, [input.invitedPracticeSessionId, input.recruiterInvitationRecipientId]);
            return normalizeVoiceTranscriptDrafts(result.rows[0]?.voice_transcript_drafts_json)[input.questionSlotId] ?? null;
        },
    };
}

function normalizeClaim(row: Record<string, unknown> | undefined): VoiceTranscriptionClaimResult | null {
    if (!row) return null;
    const run = normalizeInvitedRun(row);
    const outcome = readClaimOutcome(row.claim_outcome);
    if (!run || !outcome) return null;
    const draft = normalizeVoiceTranscriptDrafts(row.voice_transcript_drafts_json)[run.questionSlotId] ?? null;
    return { outcome, run, draft };
}

function normalizeInvitedRun(row: Record<string, unknown> | undefined) {
    if (!row) return null;
    return normalizeVoiceTranscriptionRunRecord({
        ...row,
        voice_transcription_run_id: row.invited_practice_voice_transcription_run_id,
        practice_session_id: row.invited_practice_session_id,
        audience_owner_id: row.recruiter_invitation_recipient_id,
    });
}

function normalizeCompletion(row: Record<string, unknown> | undefined): VoiceTranscriptionCompletionResult | null {
    const run = normalizeInvitedRun(row);
    if (!run) return null;
    const draft = normalizeVoiceTranscriptDrafts(row?.voice_transcript_drafts_json)[run.questionSlotId];
    return draft && draft.sourceTranscriptionRunId === run.voiceTranscriptionRunId
        ? { run, draft }
        : null;
}

function readClaimOutcome(value: unknown): VoiceTranscriptionClaimResult["outcome"] | null {
    return value === "acquired"
        || value === "replayed"
        || value === "in_progress"
        || value === "idempotency_conflict"
        || value === "superseded"
        || value === "generation_limit"
        || value === "provider_unavailable"
        ? value
        : null;
}

function readPostgresCode(error: unknown) {
    return error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
}
