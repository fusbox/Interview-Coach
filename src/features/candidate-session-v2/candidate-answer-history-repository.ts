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

export type StartCandidateAnswerEvaluationRunInput = {
    candidateAnswerAttemptId: string;
    candidatePracticeSessionId: string;
    candidateProfileId: string;
    purpose: CandidateAnswerEvaluationPurpose;
    provider: string;
    modelName: string;
    promptVersion: string;
    evaluatorVersion: string;
    inputFingerprint: string;
    idempotencyKey: string;
    requestedAt: string;
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

        async startEvaluationRun(input: StartCandidateAnswerEvaluationRunInput): Promise<CandidateAnswerEvaluationRunWriteResult | null> {
            const result = await client.query(`
                with owned_attempt as materialized (
                  select attempt.candidate_answer_attempt_id
                  from public.candidate_answer_attempts attempt
                  where attempt.candidate_answer_attempt_id = $1
                    and attempt.candidate_practice_session_id = $2
                    and attempt.candidate_profile_id = $3
                ),
                inserted as (
                  insert into public.candidate_answer_evaluation_runs (
                    candidate_answer_attempt_id,
                    purpose,
                    provider,
                    model_name,
                    prompt_version,
                    evaluator_version,
                    input_fingerprint,
                    idempotency_key,
                    lifecycle_state,
                    requested_at
                  )
                  select $1, $4, $5, $6, $7, $8, $9, $10, 'requested', $11
                  from owned_attempt
                  on conflict (candidate_answer_attempt_id, idempotency_key) do nothing
                  returning *
                ),
                existing as (
                  select run.*
                  from public.candidate_answer_evaluation_runs run
                  where run.candidate_answer_attempt_id = $1
                    and run.idempotency_key = $10
                )
                select 'created'::text as write_outcome, inserted.*
                from inserted
                union all
                select
                  case when existing.purpose = $4
                         and existing.provider = $5
                         and existing.model_name = $6
                         and existing.prompt_version = $7
                         and existing.evaluator_version = $8
                         and existing.input_fingerprint = $9
                    then 'replayed'
                    else 'idempotency_conflict'
                  end as write_outcome,
                  existing.*
                from existing
                where not exists (select 1 from inserted)
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
                input.inputFingerprint,
                input.idempotencyKey,
                input.requestedAt,
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
    if (
        (outcome !== "created" && outcome !== "replayed" && outcome !== "idempotency_conflict")
        || !run
    ) {
        return null;
    }
    return { outcome, run };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
