import {
    normalizeCandidateCoachUpdateArtifactRecord,
    type CandidateCoachUpdateArtifactRecord,
    type CandidateCoachUpdateContent,
} from "./candidate-coach-update-artifact";

export type CandidateCoachUpdateArtifactQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export type ClaimCandidateCoachUpdateArtifactInput = {
    candidateProfileId: string;
    roleProfileId: string;
    sourceCandidatePracticeSessionId: string;
    sourceCompletionFingerprint: string;
    sourceAnswerAttemptIds: string[];
    acceptedEvaluationRunIds: string[];
    synthesisInputFingerprint: string;
    provider: string;
    modelName: string;
    promptVersion: string;
    evaluatorVersion: string;
    requestedAt: string;
    staleRequestedBefore: string;
};

export type CandidateCoachUpdateArtifactWriteResult = {
    outcome: "created" | "replayed";
    artifact: CandidateCoachUpdateArtifactRecord;
};

export function createCandidateCoachUpdateArtifactRepository(
    client: CandidateCoachUpdateArtifactQueryClient,
) {
    return {
        async claimArtifact(
            input: ClaimCandidateCoachUpdateArtifactInput,
        ): Promise<CandidateCoachUpdateArtifactWriteResult | null> {
            const result = await client.query(`
                with owned_source as materialized (
                  select candidate_practice_session_id
                  from public.candidate_practice_sessions
                  where candidate_practice_session_id = $1
                    and candidate_profile_id = $2
                    and role_profile_id = $3
                    and status = 'completed'
                    and completion_snapshot_json is not null
                ),
                source_lock as materialized (
                  select pg_advisory_xact_lock(hashtextextended($1::text, 0))
                  from owned_source
                ),
                expired_requested as (
                  update public.candidate_coach_update_artifacts artifact
                  set lifecycle_state = 'failed',
                      validation_json = jsonb_build_object('disposition', 'failed', 'reason', 'stale_generation_claim'),
                      error_code = 'STALE_COACH_UPDATE_CLAIM',
                      completed_at = $12
                  from source_lock
                  where artifact.source_candidate_practice_session_id = $1
                    and artifact.lifecycle_state = 'requested'
                    and artifact.requested_at < $13
                  returning artifact.candidate_coach_update_artifact_id
                ),
                existing as materialized (
                  select artifact.*
                  from public.candidate_coach_update_artifacts artifact
                  cross join source_lock
                  where artifact.source_candidate_practice_session_id = $1
                    and artifact.candidate_profile_id = $2
                    and artifact.role_profile_id = $3
                    and artifact.source_completion_fingerprint = $4
                    and artifact.synthesis_input_fingerprint = $7
                    and artifact.provider = $8
                    and artifact.model_name = $9
                    and artifact.prompt_version = $10
                    and artifact.evaluator_version = $11
                    and artifact.lifecycle_state in ('requested', 'completed')
                    and artifact.candidate_coach_update_artifact_id not in (
                      select candidate_coach_update_artifact_id from expired_requested
                    )
                  order by artifact.generation_attempt desc
                  limit 1
                ),
                next_attempt as materialized (
                  select coalesce(max(artifact.generation_attempt), 0) + 1 as generation_attempt
                  from public.candidate_coach_update_artifacts artifact
                  cross join source_lock
                  where artifact.source_candidate_practice_session_id = $1
                ),
                inserted as (
                  insert into public.candidate_coach_update_artifacts (
                    candidate_profile_id,
                    role_profile_id,
                    source_candidate_practice_session_id,
                    source_completion_fingerprint,
                    source_answer_attempt_ids_json,
                    accepted_evaluation_run_ids_json,
                    synthesis_input_fingerprint,
                    provider,
                    model_name,
                    prompt_version,
                    evaluator_version,
                    generation_attempt,
                    lifecycle_state,
                    requested_at
                  )
                  select $2, $3, $1, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11,
                         next_attempt.generation_attempt, 'requested', $12
                  from owned_source
                  cross join source_lock
                  cross join next_attempt
                  where not exists (select 1 from existing)
                  returning *
                )
                select 'created'::text as write_outcome, inserted.* from inserted
                union all
                select 'replayed'::text as write_outcome, existing.* from existing
                limit 1
            `, [
                input.sourceCandidatePracticeSessionId,
                input.candidateProfileId,
                input.roleProfileId,
                input.sourceCompletionFingerprint,
                JSON.stringify(input.sourceAnswerAttemptIds),
                JSON.stringify(input.acceptedEvaluationRunIds),
                input.synthesisInputFingerprint,
                input.provider,
                input.modelName,
                input.promptVersion,
                input.evaluatorVersion,
                input.requestedAt,
                input.staleRequestedBefore,
            ]);

            const artifact = normalizeCandidateCoachUpdateArtifactRecord(result.rows[0]);
            const outcome = result.rows[0]?.write_outcome;
            return artifact && (outcome === "created" || outcome === "replayed")
                ? { outcome, artifact }
                : null;
        },

        async completeArtifact(input: {
            candidateCoachUpdateArtifactId: string;
            candidateProfileId: string;
            sourceCandidatePracticeSessionId: string;
            sourceCompletionFingerprint: string;
            synthesisInputFingerprint: string;
            candidateSafeContent: CandidateCoachUpdateContent;
            validation: Record<string, unknown>;
            completedAt: string;
        }) {
            const result = await client.query(`
                with completed as (
                  update public.candidate_coach_update_artifacts
                  set lifecycle_state = 'completed',
                      candidate_safe_content_json = $6::jsonb,
                      validation_json = $7::jsonb,
                      error_code = null,
                      completed_at = $8
                  where candidate_coach_update_artifact_id = $1
                    and candidate_profile_id = $2
                    and source_candidate_practice_session_id = $3
                    and source_completion_fingerprint = $4
                    and synthesis_input_fingerprint = $5
                    and lifecycle_state = 'requested'
                  returning *
                ),
                replayed as (
                  select artifact.*
                  from public.candidate_coach_update_artifacts artifact
                  where artifact.candidate_coach_update_artifact_id = $1
                    and artifact.candidate_profile_id = $2
                    and artifact.source_candidate_practice_session_id = $3
                    and artifact.source_completion_fingerprint = $4
                    and artifact.synthesis_input_fingerprint = $5
                    and artifact.lifecycle_state = 'completed'
                    and artifact.candidate_safe_content_json = $6::jsonb
                    and artifact.validation_json = $7::jsonb
                    and not exists (select 1 from completed)
                )
                select * from completed
                union all
                select * from replayed
                limit 1
            `, [
                input.candidateCoachUpdateArtifactId,
                input.candidateProfileId,
                input.sourceCandidatePracticeSessionId,
                input.sourceCompletionFingerprint,
                input.synthesisInputFingerprint,
                JSON.stringify(input.candidateSafeContent),
                JSON.stringify(input.validation),
                input.completedAt,
            ]);
            return normalizeCandidateCoachUpdateArtifactRecord(result.rows[0]);
        },

        async failArtifact(input: {
            candidateCoachUpdateArtifactId: string;
            candidateProfileId: string;
            lifecycleState: "failed" | "rejected";
            errorCode: string;
            validation?: Record<string, unknown> | null;
            completedAt: string;
        }) {
            const result = await client.query(`
                with failed as (
                  update public.candidate_coach_update_artifacts
                  set lifecycle_state = $3,
                      candidate_safe_content_json = null,
                      validation_json = $5::jsonb,
                      error_code = $4,
                      completed_at = $6
                  where candidate_coach_update_artifact_id = $1
                    and candidate_profile_id = $2
                    and lifecycle_state = 'requested'
                  returning *
                ),
                replayed as (
                  select artifact.*
                  from public.candidate_coach_update_artifacts artifact
                  where artifact.candidate_coach_update_artifact_id = $1
                    and artifact.candidate_profile_id = $2
                    and artifact.lifecycle_state = $3
                    and artifact.error_code = $4
                    and artifact.validation_json is not distinct from $5::jsonb
                    and not exists (select 1 from failed)
                )
                select * from failed
                union all
                select * from replayed
                limit 1
            `, [
                input.candidateCoachUpdateArtifactId,
                input.candidateProfileId,
                input.lifecycleState,
                input.errorCode,
                JSON.stringify(input.validation ?? null),
                input.completedAt,
            ]);
            return normalizeCandidateCoachUpdateArtifactRecord(result.rows[0]);
        },

        async listCompletedArtifacts(input: { candidateProfileId: string }) {
            const result = await client.query(`
                select artifact.*
                from public.candidate_coach_update_artifacts artifact
                where artifact.candidate_profile_id = $1
                  and artifact.lifecycle_state = 'completed'
                order by artifact.completed_at desc, artifact.generation_attempt desc
            `, [input.candidateProfileId]);
            return result.rows.flatMap((row) => {
                const artifact = normalizeCandidateCoachUpdateArtifactRecord(row);
                return artifact ? [artifact] : [];
            });
        },
    };
}
