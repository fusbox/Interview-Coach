import {
    CANDIDATE_ANSWER_ANALYSIS_GENERATION_LIMIT,
    CANDIDATE_ANSWER_ANALYSIS_GENERATION_WINDOW_MS,
} from "@/features/candidate-session-v2/candidate-answer-analysis-recovery";
import {
    normalizeCandidateAnswerAttemptRecord,
    normalizeCandidateAnswerEvaluationRunRecord,
    type CandidateAnswerAttemptMode,
    type CandidateAnswerAttemptTrigger,
    type CandidateAnswerAttemptWriteResult,
    type CandidateAnswerEvaluationPurpose,
    type CandidateAnswerEvaluationRunRecord,
    type CandidateAnswerEvaluationRunWriteResult,
} from "@/features/candidate-session-v2/candidate-answer-history";
import {
    createEvaluatorFingerprint,
    type EvidenceFirstEvaluatorResolvedConfigurationManifest,
} from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import {
    normalizeVoiceTranscriptDraft,
    type VoiceTranscriptSubmissionPath,
} from "@/features/interview-session-v2/voice-answer-transcription";

export type InvitedPracticeAnswerHistoryQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export function createInvitedPracticeAnswerHistoryRepository(client: InvitedPracticeAnswerHistoryQueryClient) {
    return {
        async appendAnswerAttempt(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            questionSlotId: string;
            questionIndex: number;
            mode: CandidateAnswerAttemptMode;
            answerText: string;
            submittedAt: string;
            trigger: CandidateAnswerAttemptTrigger;
            supersedesInvitedPracticeAnswerAttemptId?: string | null;
            idempotencyKey: string;
            payloadFingerprint: string;
            sourceVoiceTranscriptionRunId?: string | null;
            voiceSubmissionPath?: VoiceTranscriptSubmissionPath | null;
            voiceTranscriptEdited?: boolean | null;
        }): Promise<CandidateAnswerAttemptWriteResult | null> {
            const result = await client.query(`
                with owned_session as materialized (
                  select invited_practice_session_id
                  from public.invited_practice_sessions
                  where invited_practice_session_id = $1
                    and recruiter_invitation_recipient_id = $2
                    and status in ('planned', 'in_progress')
                ), slot_lock as materialized (
                  select pg_advisory_xact_lock(hashtextextended($1::text || ':' || $3::text, 0))
                  from owned_session
                ), existing as materialized (
                  select attempt.*
                  from public.invited_practice_answer_attempts attempt
                  cross join slot_lock
                  where attempt.invited_practice_session_id = $1
                    and attempt.question_slot_id = $3
                    and attempt.idempotency_key = $9
                ), latest as materialized (
                  select attempt.*
                  from public.invited_practice_answer_attempts attempt
                  cross join slot_lock
                  where attempt.invited_practice_session_id = $1
                    and attempt.question_slot_id = $3
                  order by attempt.attempt_number desc
                  limit 1
                ), candidate as materialized (
                  select
                    case when $8 = 'initial_submit' then 1 else latest.attempt_number + 1 end as attempt_number,
                    case when $8 = 'feedback_retry' then latest.invited_practice_answer_attempt_id else null end
                      as supersedes_invited_practice_answer_attempt_id
                  from owned_session
                  cross join slot_lock
                  left join latest on true
                  where not exists (select 1 from existing)
                    and (
                      ($8 = 'initial_submit' and latest.invited_practice_answer_attempt_id is null)
                      or
                      ($8 = 'feedback_retry'
                        and latest.invited_practice_answer_attempt_id is not null
                        and latest.invited_practice_answer_attempt_id = $11
                        and latest.question_index = $4)
                    )
                ), inserted as (
                  insert into public.invited_practice_answer_attempts (
                    invited_practice_session_id,
                    recruiter_invitation_recipient_id,
                    question_slot_id,
                    question_index,
                    attempt_number,
                    trigger,
                    supersedes_invited_practice_answer_attempt_id,
                    mode,
                    answer_text,
                    submitted_at,
                    idempotency_key,
                    payload_fingerprint,
                    source_invited_voice_transcription_run_id,
                    voice_submission_path,
                    voice_transcript_edited
                  )
                  select $1, $2, $3, $4, candidate.attempt_number, $8,
                         candidate.supersedes_invited_practice_answer_attempt_id, $5, $6, $7, $9, $10, $12, $13, $14
                  from candidate
                  returning *
                )
                select 'created'::text as write_outcome, inserted.* from inserted
                union all
                select
                  case when existing.payload_fingerprint = $10
                              and existing.source_invited_voice_transcription_run_id is not distinct from $12::uuid
                              and existing.voice_submission_path is not distinct from $13::text
                              and existing.voice_transcript_edited is not distinct from $14::boolean
                       then 'replayed' else 'idempotency_conflict' end,
                  existing.*
                from existing
                limit 1
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                input.questionSlotId,
                input.questionIndex,
                input.mode,
                input.answerText,
                input.submittedAt,
                input.trigger,
                input.idempotencyKey,
                input.payloadFingerprint,
                input.supersedesInvitedPracticeAnswerAttemptId ?? null,
                input.sourceVoiceTranscriptionRunId ?? null,
                input.voiceSubmissionPath ?? null,
                input.voiceTranscriptEdited ?? null,
            ]);
            return normalizeAttemptWriteResult(result.rows[0]);
        },

        async authorizeVoiceAnswerTranscript(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            questionSlotId: string;
            questionIndex: number;
            sourceVoiceTranscriptionRunId: string;
            voiceSubmissionPath: VoiceTranscriptSubmissionPath;
            transcriptText: string;
            updatedAt: string;
        }) {
            const result = await client.query(`
                with authorized as (
                  update public.invited_practice_sessions session
                  set voice_transcript_drafts_json = jsonb_set(
                    session.voice_transcript_drafts_json,
                    array[$3]::text[],
                    (session.voice_transcript_drafts_json -> $3)
                      || jsonb_build_object('transcriptText', $7::text, 'updatedAt', $8::text),
                    true
                  )
                  from public.invited_practice_voice_transcription_runs run
                  where session.invited_practice_session_id = $1
                    and session.recruiter_invitation_recipient_id = $2
                    and run.invited_practice_voice_transcription_run_id = $5::uuid
                    and run.invited_practice_session_id = session.invited_practice_session_id
                    and run.recruiter_invitation_recipient_id = session.recruiter_invitation_recipient_id
                    and run.question_slot_id = $3
                    and run.question_index = $4
                    and run.lifecycle_state = 'completed'
                    and session.voice_transcript_drafts_json -> $3 ->> 'sourceTranscriptionRunId' = $5::text
                    and session.voice_transcript_drafts_json -> $3 ->> 'submissionPath' = $6
                    and session.voice_transcript_drafts_json -> $3 ->> 'questionIndex' = $4::text
                    and (
                      $6 <> 'quick_submit'
                      or run.output_fingerprint = encode(digest(trim($7), 'sha256'), 'hex')
                    )
                  returning session.voice_transcript_drafts_json -> $3 as transcript_draft,
                            run.output_fingerprint
                )
                select transcript_draft,
                       output_fingerprint <> encode(digest(trim($7), 'sha256'), 'hex')
                         as voice_transcript_edited
                from authorized
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                input.questionSlotId,
                input.questionIndex,
                input.sourceVoiceTranscriptionRunId,
                input.voiceSubmissionPath,
                input.transcriptText,
                input.updatedAt,
            ]);
            const row = result.rows[0];
            const draft = normalizeVoiceTranscriptDraft(row?.transcript_draft);
            return draft && typeof row?.voice_transcript_edited === "boolean"
                ? { draft, voiceTranscriptEdited: row.voice_transcript_edited }
                : null;
        },

        async listAnswerAttempts(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            questionSlotId?: string;
        }) {
            const result = await client.query(`
                select attempt.*
                from public.invited_practice_answer_attempts attempt
                where attempt.invited_practice_session_id = $1
                  and attempt.recruiter_invitation_recipient_id = $2
                  and ($3::text is null or attempt.question_slot_id = $3)
                order by attempt.question_index, attempt.attempt_number
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                input.questionSlotId ?? null,
            ]);
            return result.rows.flatMap((row) => {
                const attempt = normalizeInvitedAttempt(row);
                return attempt ? [attempt] : [];
            });
        },

        async claimEvaluationRun(input: {
            invitedPracticeAnswerAttemptId: string;
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            purpose: CandidateAnswerEvaluationPurpose;
            provider: string;
            modelName: string;
            promptVersion: string;
            evaluatorVersion: string;
            configurationManifest: EvidenceFirstEvaluatorResolvedConfigurationManifest;
            configurationFingerprint: string;
            inputFingerprint: string;
            idempotencyKey: string;
            requestedAt: string;
            claimExpiresAt: string;
        }): Promise<CandidateAnswerEvaluationRunWriteResult | null> {
            assertResolvedConfiguration(input);
            let uniqueConflictRetryCount = 0;
            for (;;) {
                try {
                    const result = await client.query(`
                with owned_attempt as materialized (
                  select attempt.invited_practice_answer_attempt_id
                  from public.invited_practice_answer_attempts attempt
                  where attempt.invited_practice_answer_attempt_id = $1
                    and attempt.invited_practice_session_id = $2
                    and attempt.recruiter_invitation_recipient_id = $3
                ), claim_lock as materialized (
                  select pg_advisory_xact_lock(hashtextextended($1::text || ':' || $4::text, 0))
                  from owned_attempt
                ), expired_requested as (
                  update public.invited_practice_answer_evaluation_runs run
                  set lifecycle_state = 'failed',
                      result_json = null,
                      validation_json = jsonb_build_object('disposition', 'failed', 'reason', 'stale_evaluation_claim'),
                      error_code = 'STALE_EVALUATION_CLAIM',
                      completed_at = $13
                  from claim_lock
                  where run.invited_practice_answer_attempt_id = $1
                    and run.purpose = $4
                    and run.lifecycle_state = 'requested'
                    and run.claim_expires_at <= $13
                  returning run.invited_practice_answer_evaluation_run_id
                ), recent_generation_count as materialized (
                  select count(*)::integer as generation_window_count
                  from public.invited_practice_answer_evaluation_runs run
                  cross join claim_lock
                  where run.invited_practice_answer_attempt_id = $1
                    and run.purpose = 'candidate_coaching'
                    and run.requested_at >= $13::timestamptz - ($15::integer * interval '1 millisecond')
                ), existing as materialized (
                  select
                    case when run.purpose = $4
                              and run.input_fingerprint = $11
                              and (
                                $4 = 'candidate_coaching'
                                or (
                                  run.provider = $5
                                  and run.model_name = $6
                                  and run.prompt_version = $7
                                  and run.evaluator_version = $8
                                  and run.configuration_fingerprint = $9
                                  and run.configuration_manifest_json = $10::jsonb
                                  and run.idempotency_key = $12
                                )
                              )
                         then 'replayed'
                         else 'idempotency_conflict'
                    end as write_outcome,
                    recent_generation_count.generation_window_count,
                    run.*
                  from public.invited_practice_answer_evaluation_runs run
                  cross join claim_lock
                  cross join recent_generation_count
                  where run.invited_practice_answer_attempt_id = $1
                    and run.purpose = $4
                    and run.lifecycle_state in ('requested', 'completed')
                    and (
                      ($4 = 'candidate_coaching' and run.input_fingerprint = $11)
                      or
                      ($4 = 'qa_comparison' and run.idempotency_key = $12)
                    )
                    and run.invited_practice_answer_evaluation_run_id not in (
                      select invited_practice_answer_evaluation_run_id from expired_requested
                    )
                  order by run.generation_attempt desc
                  limit 1
                ), latest_any as materialized (
                  select run.*
                  from public.invited_practice_answer_evaluation_runs run
                  cross join claim_lock
                  where run.invited_practice_answer_attempt_id = $1
                    and run.purpose = $4
                  order by run.generation_attempt desc
                  limit 1
                ), terminal_retry_block as materialized (
                  select run.*
                  from latest_any run
                  where run.lifecycle_state in ('failed', 'rejected')
                    and run.error_code is distinct from 'STALE_EVALUATION_CLAIM'
                    and not coalesce(run.validation_json @> '{"retryableByNewRun": true}'::jsonb, false)
                ), next_generation as materialized (
                  select coalesce(max(run.generation_attempt), 0) + 1 as generation_attempt
                  from public.invited_practice_answer_evaluation_runs run
                  cross join claim_lock
                  where run.invited_practice_answer_attempt_id = $1
                    and run.purpose = $4
                ), inserted as (
                  insert into public.invited_practice_answer_evaluation_runs (
                    invited_practice_answer_attempt_id,
                    purpose,
                    provider,
                    model_name,
                    prompt_version,
                    evaluator_version,
                    configuration_fingerprint,
                    configuration_manifest_json,
                    input_fingerprint,
                    idempotency_key,
                    generation_attempt,
                    lifecycle_state,
                    requested_at,
                    claim_expires_at
                  )
                  select $1, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12,
                         next_generation.generation_attempt, 'requested', $13, $14
                  from owned_attempt
                  cross join claim_lock
                  cross join next_generation
                  cross join recent_generation_count
                  where not exists (select 1 from existing)
                    and not exists (select 1 from terminal_retry_block)
                    and (
                      $4 <> 'candidate_coaching'
                      or recent_generation_count.generation_window_count < $16
                    )
                  returning *
                )
                select 'created'::text as write_outcome,
                       recent_generation_count.generation_window_count + 1 as generation_window_count,
                       inserted.*
                from inserted cross join recent_generation_count
                union all select existing.* from existing
                union all
                select 'generation_unavailable'::text, recent_generation_count.generation_window_count,
                       terminal_retry_block.*
                from terminal_retry_block cross join recent_generation_count
                where not exists (select 1 from existing)
                union all
                select 'generation_limit'::text, recent_generation_count.generation_window_count, latest_any.*
                from latest_any cross join recent_generation_count
                where not exists (select 1 from existing)
                  and not exists (select 1 from terminal_retry_block)
                  and $4 = 'candidate_coaching'
                  and recent_generation_count.generation_window_count >= $16
                limit 1
            `, [
                input.invitedPracticeAnswerAttemptId,
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                input.purpose,
                input.provider,
                input.modelName,
                input.promptVersion,
                input.evaluatorVersion,
                input.configurationFingerprint,
                JSON.stringify(input.configurationManifest),
                input.inputFingerprint,
                input.idempotencyKey,
                input.requestedAt,
                input.claimExpiresAt,
                CANDIDATE_ANSWER_ANALYSIS_GENERATION_WINDOW_MS,
                CANDIDATE_ANSWER_ANALYSIS_GENERATION_LIMIT,
            ]);
                    return normalizeEvaluationRunWriteResult(result.rows[0]);
                } catch (error) {
                    if (readPostgresCode(error) !== "23505" || uniqueConflictRetryCount >= 1) {
                        throw error;
                    }
                    uniqueConflictRetryCount += 1;
                }
            }
        },

        async listEvaluationRuns(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            purpose?: CandidateAnswerEvaluationPurpose;
        }) {
            const result = await client.query(`
                select run.*
                from public.invited_practice_answer_evaluation_runs run
                join public.invited_practice_answer_attempts attempt
                  on attempt.invited_practice_answer_attempt_id = run.invited_practice_answer_attempt_id
                where attempt.invited_practice_session_id = $1
                  and attempt.recruiter_invitation_recipient_id = $2
                  and ($3::text is null or run.purpose = $3)
                order by attempt.question_index, attempt.attempt_number, run.requested_at, run.created_at
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                input.purpose ?? null,
            ]);
            return result.rows.flatMap((row) => {
                const run = normalizeInvitedEvaluationRun(row);
                return run ? [run] : [];
            });
        },

        async completeEvaluationRun(input: {
            invitedPracticeAnswerEvaluationRunId: string;
            invitedPracticeAnswerAttemptId: string;
            completedAt: string;
            result: Record<string, unknown>;
            validation: Record<string, unknown>;
        }): Promise<CandidateAnswerEvaluationRunRecord | null> {
            const result = await client.query(`
                with completed as (
                  update public.invited_practice_answer_evaluation_runs
                  set lifecycle_state = 'completed', result_json = $3::jsonb,
                      validation_json = $4::jsonb, error_code = null, completed_at = $5
                  where invited_practice_answer_evaluation_run_id = $1
                    and invited_practice_answer_attempt_id = $2
                    and lifecycle_state = 'requested'
                    and claim_expires_at > $5
                    and claim_expires_at > clock_timestamp()
                  returning *
                ), replayed as (
                  select run.*
                  from public.invited_practice_answer_evaluation_runs run
                  where run.invited_practice_answer_evaluation_run_id = $1
                    and run.invited_practice_answer_attempt_id = $2
                    and run.lifecycle_state = 'completed'
                    and run.result_json = $3::jsonb
                    and run.validation_json = $4::jsonb
                    and not exists (select 1 from completed)
                )
                select * from completed union all select * from replayed limit 1
            `, [
                input.invitedPracticeAnswerEvaluationRunId,
                input.invitedPracticeAnswerAttemptId,
                JSON.stringify(input.result),
                JSON.stringify(input.validation),
                input.completedAt,
            ]);
            return normalizeInvitedEvaluationRun(result.rows[0]);
        },

        async failEvaluationRun(input: {
            invitedPracticeAnswerEvaluationRunId: string;
            invitedPracticeAnswerAttemptId: string;
            lifecycleState: "failed" | "rejected";
            completedAt: string;
            errorCode: string;
            validation?: Record<string, unknown> | null;
        }): Promise<CandidateAnswerEvaluationRunRecord | null> {
            const result = await client.query(`
                with failed as (
                  update public.invited_practice_answer_evaluation_runs
                  set lifecycle_state = $3, result_json = null, validation_json = $4::jsonb,
                      error_code = $5, completed_at = $6
                  where invited_practice_answer_evaluation_run_id = $1
                    and invited_practice_answer_attempt_id = $2
                    and lifecycle_state = 'requested'
                  returning *
                ), replayed as (
                  select run.*
                  from public.invited_practice_answer_evaluation_runs run
                  where run.invited_practice_answer_evaluation_run_id = $1
                    and run.invited_practice_answer_attempt_id = $2
                    and run.lifecycle_state = $3
                    and run.validation_json is not distinct from $4::jsonb
                    and run.error_code = $5
                    and not exists (select 1 from failed)
                )
                select * from failed union all select * from replayed limit 1
            `, [
                input.invitedPracticeAnswerEvaluationRunId,
                input.invitedPracticeAnswerAttemptId,
                input.lifecycleState,
                JSON.stringify(input.validation ?? null),
                input.errorCode,
                input.completedAt,
            ]);
            return normalizeInvitedEvaluationRun(result.rows[0]);
        },
    };
}

export type InvitedPracticeAnswerHistoryRepository = ReturnType<
    typeof createInvitedPracticeAnswerHistoryRepository
>;

export function createInvitedPracticeCandidateAnswerHistoryAdapter(
    repository: InvitedPracticeAnswerHistoryRepository,
) {
    return {
        appendAnswerAttempt: (input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
            questionSlotId: string;
            questionIndex: number;
            mode: CandidateAnswerAttemptMode;
            answerText: string;
            submittedAt: string;
            trigger: CandidateAnswerAttemptTrigger;
            supersedesCandidateAnswerAttemptId?: string | null;
            idempotencyKey: string;
            payloadFingerprint: string;
            sourceVoiceTranscriptionRunId?: string | null;
            voiceSubmissionPath?: VoiceTranscriptSubmissionPath | null;
            voiceTranscriptEdited?: boolean | null;
        }) => repository.appendAnswerAttempt({
            invitedPracticeSessionId: input.candidatePracticeSessionId,
            recruiterInvitationRecipientId: input.candidateProfileId,
            questionSlotId: input.questionSlotId,
            questionIndex: input.questionIndex,
            mode: input.mode,
            answerText: input.answerText,
            submittedAt: input.submittedAt,
            trigger: input.trigger,
            supersedesInvitedPracticeAnswerAttemptId: input.supersedesCandidateAnswerAttemptId,
            idempotencyKey: input.idempotencyKey,
            payloadFingerprint: input.payloadFingerprint,
            sourceVoiceTranscriptionRunId: input.sourceVoiceTranscriptionRunId,
            voiceSubmissionPath: input.voiceSubmissionPath,
            voiceTranscriptEdited: input.voiceTranscriptEdited,
        }),
        authorizeVoiceAnswerTranscript: (input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
            questionSlotId: string;
            questionIndex: number;
            sourceVoiceTranscriptionRunId: string;
            voiceSubmissionPath: VoiceTranscriptSubmissionPath;
            transcriptText: string;
            updatedAt: string;
        }) => repository.authorizeVoiceAnswerTranscript({
            invitedPracticeSessionId: input.candidatePracticeSessionId,
            recruiterInvitationRecipientId: input.candidateProfileId,
            questionSlotId: input.questionSlotId,
            questionIndex: input.questionIndex,
            sourceVoiceTranscriptionRunId: input.sourceVoiceTranscriptionRunId,
            voiceSubmissionPath: input.voiceSubmissionPath,
            transcriptText: input.transcriptText,
            updatedAt: input.updatedAt,
        }),
        listEvaluationRuns: (input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
            purpose?: CandidateAnswerEvaluationPurpose;
        }) => repository.listEvaluationRuns({
            invitedPracticeSessionId: input.candidatePracticeSessionId,
            recruiterInvitationRecipientId: input.candidateProfileId,
            purpose: input.purpose,
        }),
        claimEvaluationRun: (input: {
            candidateAnswerAttemptId: string;
            candidatePracticeSessionId: string;
            candidateProfileId: string;
            purpose: CandidateAnswerEvaluationPurpose;
            provider: string;
            modelName: string;
            promptVersion: string;
            evaluatorVersion: string;
            configurationManifest: EvidenceFirstEvaluatorResolvedConfigurationManifest;
            configurationFingerprint: string;
            inputFingerprint: string;
            idempotencyKey: string;
            requestedAt: string;
            claimExpiresAt: string;
        }) => repository.claimEvaluationRun({
            invitedPracticeAnswerAttemptId: input.candidateAnswerAttemptId,
            invitedPracticeSessionId: input.candidatePracticeSessionId,
            recruiterInvitationRecipientId: input.candidateProfileId,
            purpose: input.purpose,
            provider: input.provider,
            modelName: input.modelName,
            promptVersion: input.promptVersion,
            evaluatorVersion: input.evaluatorVersion,
            configurationManifest: input.configurationManifest,
            configurationFingerprint: input.configurationFingerprint,
            inputFingerprint: input.inputFingerprint,
            idempotencyKey: input.idempotencyKey,
            requestedAt: input.requestedAt,
            claimExpiresAt: input.claimExpiresAt,
        }),
        completeEvaluationRun: (input: {
            candidateAnswerEvaluationRunId: string;
            candidateAnswerAttemptId: string;
            completedAt: string;
            result: Record<string, unknown>;
            validation: Record<string, unknown>;
        }) => repository.completeEvaluationRun({
            invitedPracticeAnswerEvaluationRunId: input.candidateAnswerEvaluationRunId,
            invitedPracticeAnswerAttemptId: input.candidateAnswerAttemptId,
            completedAt: input.completedAt,
            result: input.result,
            validation: input.validation,
        }),
        failEvaluationRun: (input: {
            candidateAnswerEvaluationRunId: string;
            candidateAnswerAttemptId: string;
            lifecycleState: "failed" | "rejected";
            completedAt: string;
            errorCode: string;
            validation?: Record<string, unknown> | null;
        }) => repository.failEvaluationRun({
            invitedPracticeAnswerEvaluationRunId: input.candidateAnswerEvaluationRunId,
            invitedPracticeAnswerAttemptId: input.candidateAnswerAttemptId,
            lifecycleState: input.lifecycleState,
            completedAt: input.completedAt,
            errorCode: input.errorCode,
            validation: input.validation,
        }),
    };
}

function assertResolvedConfiguration(input: {
    provider: string;
    modelName: string;
    promptVersion: string;
    evaluatorVersion: string;
    configurationManifest: EvidenceFirstEvaluatorResolvedConfigurationManifest;
    configurationFingerprint: string;
}) {
    const manifest = input.configurationManifest;
    if (
        manifest.configurationStatus !== "resolved"
        || manifest.pipelineProvider !== input.provider
        || manifest.profileId !== input.modelName
        || manifest.promptBundleVersion !== input.promptVersion
        || manifest.evaluatorVersion !== input.evaluatorVersion
        || createEvaluatorFingerprint(manifest) !== input.configurationFingerprint
    ) throw new Error("Evaluator-run configuration identity is inconsistent.");
}

function normalizeInvitedAttempt(row: Record<string, unknown> | undefined) {
    if (!row) return null;
    return normalizeCandidateAnswerAttemptRecord({
        ...row,
        candidate_answer_attempt_id: row.invited_practice_answer_attempt_id,
        candidate_practice_session_id: row.invited_practice_session_id,
        candidate_profile_id: row.recruiter_invitation_recipient_id,
        supersedes_candidate_answer_attempt_id: row.supersedes_invited_practice_answer_attempt_id,
        source_candidate_voice_transcription_run_id: row.source_invited_voice_transcription_run_id,
    });
}

function normalizeInvitedEvaluationRun(row: Record<string, unknown> | undefined) {
    if (!row) return null;
    return normalizeCandidateAnswerEvaluationRunRecord({
        ...row,
        candidate_answer_evaluation_run_id: row.invited_practice_answer_evaluation_run_id,
        candidate_answer_attempt_id: row.invited_practice_answer_attempt_id,
    });
}

function normalizeAttemptWriteResult(row: Record<string, unknown> | undefined): CandidateAnswerAttemptWriteResult | null {
    const attempt = normalizeInvitedAttempt(row);
    const outcome = row?.write_outcome;
    return attempt && (outcome === "created" || outcome === "replayed" || outcome === "idempotency_conflict")
        ? { outcome, attempt }
        : null;
}

function normalizeEvaluationRunWriteResult(
    row: Record<string, unknown> | undefined,
): CandidateAnswerEvaluationRunWriteResult | null {
    const run = normalizeInvitedEvaluationRun(row);
    const outcome = row?.write_outcome;
    const recentGenerationCount = readNonNegativeInteger(row?.generation_window_count);
    if (
        !run
        || (
            outcome !== "created"
            && outcome !== "replayed"
            && outcome !== "idempotency_conflict"
            && outcome !== "generation_limit"
            && outcome !== "generation_unavailable"
        )
    ) return null;
    if ((outcome === "generation_limit" || outcome === "generation_unavailable") && recentGenerationCount === null) {
        return null;
    }
    return {
        outcome,
        run,
        ...(recentGenerationCount === null ? {} : { recentGenerationCount }),
    } as CandidateAnswerEvaluationRunWriteResult;
}

function readNonNegativeInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readPostgresCode(error: unknown) {
    if (!error || typeof error !== "object" || !("code" in error)) return null;
    return typeof error.code === "string" ? error.code : null;
}
