import {
    CANDIDATE_ANSWER_ANALYSIS_GENERATION_LIMIT,
    CANDIDATE_ANSWER_ANALYSIS_GENERATION_WINDOW_MS,
} from "./candidate-answer-analysis-recovery";
import {
    normalizeCandidateAnswerAttemptRecord,
    normalizeCandidateAnswerEvaluationRunRecord,
    type CandidateAnswerAttemptMode,
    type CandidateAnswerAttemptTrigger,
    type CandidateAnswerAttemptWriteResult,
    type CandidateAnswerEvaluationPurpose,
    type CandidateAnswerEvaluationRunRecord,
    type CandidateAnswerEvaluationRunWriteResult,
} from "./candidate-answer-history";
import {
    createEvaluatorFingerprint,
    type EvidenceFirstEvaluatorResolvedConfigurationManifest,
} from "@/features/evaluation-v2/evidence-first-evaluator-contract";

export type CandidateAnswerHistoryQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export type AppendCandidateAnswerAttemptInput = {
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
};

export type ClaimCandidateAnswerEvaluationRunInput = {
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
};

export function createCandidateAnswerHistoryRepository(client: CandidateAnswerHistoryQueryClient) {
    return {
        async appendAnswerAttempt(input: AppendCandidateAnswerAttemptInput): Promise<CandidateAnswerAttemptWriteResult | null> {
            const result = await client.query(`
                with owned_session as materialized (
                  select candidate_practice_session_id
                  from public.candidate_practice_sessions
                  where candidate_practice_session_id = $1
                    and candidate_profile_id = $2
                ),
                slot_lock as materialized (
                  select pg_advisory_xact_lock(hashtextextended($1::text || ':' || $3::text, 0))
                  from owned_session
                ),
                existing as materialized (
                  select attempt.*
                  from public.candidate_answer_attempts attempt
                  cross join slot_lock
                  where attempt.candidate_practice_session_id = $1
                    and attempt.question_slot_id = $3
                    and attempt.idempotency_key = $9
                ),
                latest as materialized (
                  select attempt.*
                  from public.candidate_answer_attempts attempt
                  cross join slot_lock
                  where attempt.candidate_practice_session_id = $1
                    and attempt.question_slot_id = $3
                  order by attempt.attempt_number desc
                  limit 1
                ),
                candidate as materialized (
                  select
                    case when $8 = 'initial_submit' then 1 else latest.attempt_number + 1 end as attempt_number,
                    case when $8 = 'feedback_retry' then latest.candidate_answer_attempt_id else null end as supersedes_candidate_answer_attempt_id
                  from owned_session
                  cross join slot_lock
                  left join latest on true
                  where not exists (select 1 from existing)
                    and (
                      ($8 = 'initial_submit' and latest.candidate_answer_attempt_id is null)
                      or
                      ($8 = 'feedback_retry'
                        and latest.candidate_answer_attempt_id is not null
                        and latest.candidate_answer_attempt_id = $11
                        and latest.question_index = $4)
                    )
                ),
                inserted as (
                  insert into public.candidate_answer_attempts (
                    candidate_practice_session_id,
                    candidate_profile_id,
                    question_slot_id,
                    question_index,
                    attempt_number,
                    trigger,
                    supersedes_candidate_answer_attempt_id,
                    mode,
                    answer_text,
                    submitted_at,
                    idempotency_key,
                    payload_fingerprint
                  )
                  select $1, $2, $3, $4, candidate.attempt_number, $8,
                         candidate.supersedes_candidate_answer_attempt_id, $5, $6, $7, $9, $10
                  from candidate
                  returning *
                )
                select 'created'::text as write_outcome, inserted.*
                from inserted
                union all
                select
                  case when existing.payload_fingerprint = $10 then 'replayed' else 'idempotency_conflict' end as write_outcome,
                  existing.*
                from existing
                limit 1
            `, [
                input.candidatePracticeSessionId,
                input.candidateProfileId,
                input.questionSlotId,
                input.questionIndex,
                input.mode,
                input.answerText,
                input.submittedAt,
                input.trigger,
                input.idempotencyKey,
                input.payloadFingerprint,
                input.supersedesCandidateAnswerAttemptId ?? null,
            ]);

            return normalizeAttemptWriteResult(result.rows[0]);
        },

        async listAnswerAttempts(input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
            questionSlotId?: string;
        }) {
            const result = await client.query(`
                select attempt.*
                from public.candidate_answer_attempts attempt
                where attempt.candidate_practice_session_id = $1
                  and attempt.candidate_profile_id = $2
                  and ($3::text is null or attempt.question_slot_id = $3)
                order by attempt.question_index, attempt.attempt_number
            `, [
                input.candidatePracticeSessionId,
                input.candidateProfileId,
                input.questionSlotId ?? null,
            ]);

            return result.rows.flatMap((row) => {
                const attempt = normalizeCandidateAnswerAttemptRecord(row);
                return attempt ? [attempt] : [];
            });
        },

        async listAnswerAttemptsForCandidate(input: { candidateProfileId: string }) {
            const result = await client.query(`
                select attempt.*
                from public.candidate_answer_attempts attempt
                where attempt.candidate_profile_id = $1
                order by attempt.submitted_at, attempt.created_at
            `, [input.candidateProfileId]);

            return result.rows.flatMap((row) => {
                const attempt = normalizeCandidateAnswerAttemptRecord(row);
                return attempt ? [attempt] : [];
            });
        },

        async claimEvaluationRun(input: ClaimCandidateAnswerEvaluationRunInput): Promise<CandidateAnswerEvaluationRunWriteResult | null> {
            assertResolvedEvaluationConfiguration(input);
            const result = await client.query(`
                with owned_attempt as materialized (
                  select attempt.candidate_answer_attempt_id
                  from public.candidate_answer_attempts attempt
                  where attempt.candidate_answer_attempt_id = $1
                    and attempt.candidate_practice_session_id = $2
                    and attempt.candidate_profile_id = $3
                ),
                claim_lock as materialized (
                  select pg_advisory_xact_lock(hashtextextended($1::text || ':' || $4::text, 0))
                  from owned_attempt
                ),
                expired_requested as (
                  update public.candidate_answer_evaluation_runs run
                  set lifecycle_state = 'failed',
                      result_json = null,
                      validation_json = jsonb_build_object(
                        'disposition', 'failed',
                        'reason', 'stale_evaluation_claim'
                      ),
                      error_code = 'STALE_EVALUATION_CLAIM',
                      completed_at = $13
                  from claim_lock
                  where run.candidate_answer_attempt_id = $1
                    and run.purpose = $4
                    and run.lifecycle_state = 'requested'
                    and run.claim_expires_at <= $13
                  returning run.candidate_answer_evaluation_run_id
                ),
                recent_generation_count as materialized (
                  select count(*)::integer as generation_window_count
                  from public.candidate_answer_evaluation_runs run
                  cross join claim_lock
                  where run.candidate_answer_attempt_id = $1
                    and run.purpose = 'candidate_coaching'
                    and run.requested_at >= $13::timestamptz - ($15::integer * interval '1 millisecond')
                ),
                existing as materialized (
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
                  from public.candidate_answer_evaluation_runs run
                  cross join claim_lock
                  cross join recent_generation_count
                  where run.candidate_answer_attempt_id = $1
                    and run.purpose = $4
                    and run.lifecycle_state in ('requested', 'completed')
                    and (
                      ($4 = 'candidate_coaching' and run.input_fingerprint = $11)
                      or
                      ($4 = 'qa_comparison' and run.idempotency_key = $12)
                    )
                    and run.candidate_answer_evaluation_run_id not in (
                      select candidate_answer_evaluation_run_id from expired_requested
                    )
                  order by run.generation_attempt desc
                  limit 1
                ),
                latest_any as materialized (
                  select run.*
                  from public.candidate_answer_evaluation_runs run
                  cross join claim_lock
                  where run.candidate_answer_attempt_id = $1
                    and run.purpose = $4
                  order by run.generation_attempt desc
                  limit 1
                ),
                terminal_retry_block as materialized (
                  select run.*
                  from latest_any run
                  where run.lifecycle_state in ('failed', 'rejected')
                    and run.error_code is distinct from 'STALE_EVALUATION_CLAIM'
                    and not coalesce(
                      run.validation_json @> '{"retryableByNewRun": true}'::jsonb,
                      false
                    )
                ),
                next_generation as materialized (
                  select coalesce(max(run.generation_attempt), 0) + 1 as generation_attempt
                  from public.candidate_answer_evaluation_runs run
                  cross join claim_lock
                  where run.candidate_answer_attempt_id = $1
                    and run.purpose = $4
                ),
                inserted as (
                  insert into public.candidate_answer_evaluation_runs (
                    candidate_answer_attempt_id,
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
                from inserted
                cross join recent_generation_count
                union all
                select existing.*
                from existing
                union all
                select 'generation_unavailable'::text as write_outcome,
                       recent_generation_count.generation_window_count,
                       terminal_retry_block.*
                from terminal_retry_block
                cross join recent_generation_count
                where not exists (select 1 from existing)
                union all
                select 'generation_limit'::text as write_outcome,
                       recent_generation_count.generation_window_count,
                       latest_any.*
                from latest_any
                cross join recent_generation_count
                where not exists (select 1 from existing)
                  and not exists (select 1 from terminal_retry_block)
                  and $4 = 'candidate_coaching'
                  and recent_generation_count.generation_window_count >= $16
                limit 1
            `, [
                input.candidateAnswerAttemptId,
                input.candidatePracticeSessionId,
                input.candidateProfileId,
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
        },

        async listEvaluationRuns(input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
            purpose?: CandidateAnswerEvaluationPurpose;
        }) {
            const result = await client.query(`
                select run.*
                from public.candidate_answer_evaluation_runs run
                join public.candidate_answer_attempts attempt
                  on attempt.candidate_answer_attempt_id = run.candidate_answer_attempt_id
                where attempt.candidate_practice_session_id = $1
                  and attempt.candidate_profile_id = $2
                  and ($3::text is null or run.purpose = $3)
                order by attempt.question_index, attempt.attempt_number, run.requested_at, run.created_at
            `, [
                input.candidatePracticeSessionId,
                input.candidateProfileId,
                input.purpose ?? null,
            ]);

            return result.rows.flatMap((row) => {
                const run = normalizeCandidateAnswerEvaluationRunRecord(row);
                return run ? [run] : [];
            });
        },

        async listEvaluationRunsForCandidate(input: {
            candidateProfileId: string;
            purpose?: CandidateAnswerEvaluationPurpose;
        }) {
            const result = await client.query(`
                select run.*
                from public.candidate_answer_evaluation_runs run
                join public.candidate_answer_attempts attempt
                  on attempt.candidate_answer_attempt_id = run.candidate_answer_attempt_id
                where attempt.candidate_profile_id = $1
                  and ($2::text is null or run.purpose = $2)
                order by run.requested_at, run.created_at
            `, [input.candidateProfileId, input.purpose ?? null]);

            return result.rows.flatMap((row) => {
                const run = normalizeCandidateAnswerEvaluationRunRecord(row);
                return run ? [run] : [];
            });
        },

        async completeEvaluationRun(input: {
            candidateAnswerEvaluationRunId: string;
            candidateAnswerAttemptId: string;
            completedAt: string;
            result: Record<string, unknown>;
            validation: Record<string, unknown>;
        }): Promise<CandidateAnswerEvaluationRunRecord | null> {
            const result = await client.query(`
                with completed as (
                  update public.candidate_answer_evaluation_runs
                  set lifecycle_state = 'completed',
                      result_json = $3::jsonb,
                      validation_json = $4::jsonb,
                      error_code = null,
                      completed_at = $5
                  where candidate_answer_evaluation_run_id = $1
                    and candidate_answer_attempt_id = $2
                    and lifecycle_state = 'requested'
                    and claim_expires_at > $5
                    and claim_expires_at > clock_timestamp()
                  returning *
                ),
                replayed as (
                  select run.*
                  from public.candidate_answer_evaluation_runs run
                  where run.candidate_answer_evaluation_run_id = $1
                    and run.candidate_answer_attempt_id = $2
                    and run.lifecycle_state = 'completed'
                    and run.result_json = $3::jsonb
                    and run.validation_json = $4::jsonb
                    and not exists (select 1 from completed)
                )
                select * from completed
                union all
                select * from replayed
                limit 1
            `, [
                input.candidateAnswerEvaluationRunId,
                input.candidateAnswerAttemptId,
                JSON.stringify(input.result),
                JSON.stringify(input.validation),
                input.completedAt,
            ]);

            return normalizeCandidateAnswerEvaluationRunRecord(result.rows[0]);
        },

        async failEvaluationRun(input: {
            candidateAnswerEvaluationRunId: string;
            candidateAnswerAttemptId: string;
            lifecycleState: "failed" | "rejected";
            completedAt: string;
            errorCode: string;
            validation?: Record<string, unknown> | null;
        }): Promise<CandidateAnswerEvaluationRunRecord | null> {
            const result = await client.query(`
                with failed as (
                  update public.candidate_answer_evaluation_runs
                  set lifecycle_state = $3,
                      result_json = null,
                      validation_json = $4::jsonb,
                      error_code = $5,
                      completed_at = $6
                  where candidate_answer_evaluation_run_id = $1
                    and candidate_answer_attempt_id = $2
                    and lifecycle_state = 'requested'
                  returning *
                ),
                replayed as (
                  select run.*
                  from public.candidate_answer_evaluation_runs run
                  where run.candidate_answer_evaluation_run_id = $1
                    and run.candidate_answer_attempt_id = $2
                    and run.lifecycle_state = $3
                    and run.validation_json is not distinct from $4::jsonb
                    and run.error_code = $5
                    and not exists (select 1 from failed)
                )
                select * from failed
                union all
                select * from replayed
                limit 1
            `, [
                input.candidateAnswerEvaluationRunId,
                input.candidateAnswerAttemptId,
                input.lifecycleState,
                JSON.stringify(input.validation ?? null),
                input.errorCode,
                input.completedAt,
            ]);

            return normalizeCandidateAnswerEvaluationRunRecord(result.rows[0]);
        },
    };
}

function assertResolvedEvaluationConfiguration(input: ClaimCandidateAnswerEvaluationRunInput) {
    const manifest = input.configurationManifest;
    if (
        manifest.configurationStatus !== "resolved"
        || manifest.pipelineProvider !== input.provider
        || manifest.profileId !== input.modelName
        || manifest.promptBundleVersion !== input.promptVersion
        || manifest.evaluatorVersion !== input.evaluatorVersion
        || createEvaluatorFingerprint(manifest) !== input.configurationFingerprint
    ) {
        throw new Error("Evaluator-run configuration identity is inconsistent.");
    }
}

function normalizeAttemptWriteResult(value: unknown): CandidateAnswerAttemptWriteResult | null {
    if (!isRecord(value)) return null;
    const outcome = value.write_outcome;
    const attempt = normalizeCandidateAnswerAttemptRecord(value);
    if (
        (outcome !== "created" && outcome !== "replayed" && outcome !== "idempotency_conflict")
        || !attempt
    ) {
        return null;
    }
    return { outcome, attempt };
}

function normalizeEvaluationRunWriteResult(value: unknown): CandidateAnswerEvaluationRunWriteResult | null {
    if (!isRecord(value)) return null;
    const outcome = value.write_outcome;
    const run = normalizeCandidateAnswerEvaluationRunRecord(value);
    const recentGenerationCount = readNonNegativeInteger(value.generation_window_count);
    if (
        (
            outcome !== "created"
            && outcome !== "replayed"
            && outcome !== "idempotency_conflict"
            && outcome !== "generation_limit"
            && outcome !== "generation_unavailable"
        )
        || !run
        || (
            (outcome === "generation_limit" || outcome === "generation_unavailable")
            && recentGenerationCount === null
        )
    ) {
        return null;
    }
    return {
        outcome,
        run,
        ...(recentGenerationCount === null ? {} : { recentGenerationCount }),
    } as CandidateAnswerEvaluationRunWriteResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readNonNegativeInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}
