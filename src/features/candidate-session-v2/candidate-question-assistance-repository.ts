import type {
    CandidateQuestionAssistanceKind,
    CandidateQuestionAssistanceOutput,
} from "./candidate-question-assistance";
import { parseCandidateQuestionAssistanceOutput } from "./candidate-question-assistance";

export type CandidateQuestionAssistanceQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
        rowCount?: number | null;
    }>;
};

export const CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS = 3;

export type CandidateQuestionAssistanceClaim =
    | {
        kind: "claimed";
        claimToken: string;
        attemptCount: number;
    }
    | {
        kind: "replay";
        output: CandidateQuestionAssistanceOutput;
    }
    | {
        kind: "pending";
    }
    | {
        kind: "conflict";
    }
    | {
        kind: "exhausted";
    };

export function createCandidateQuestionAssistanceRepository(
    client: CandidateQuestionAssistanceQueryClient,
) {
    return createQuestionAssistanceRepository(client, {
        tableName: "candidate_question_assistance_artifacts",
        idColumn: "candidate_practice_session_id",
        ownerColumn: "candidate_profile_id",
        artifactIdColumn: "candidate_question_assistance_artifact_id",
    });
}

export function createInvitedQuestionAssistanceRepository(
    client: CandidateQuestionAssistanceQueryClient,
) {
    return createQuestionAssistanceRepository(client, {
        tableName: "invited_question_assistance_artifacts",
        idColumn: "invited_practice_session_id",
        ownerColumn: "recruiter_invitation_recipient_id",
        artifactIdColumn: "invited_question_assistance_artifact_id",
    });
}

function createQuestionAssistanceRepository(
    client: CandidateQuestionAssistanceQueryClient,
    scope: {
        tableName: string;
        idColumn: string;
        ownerColumn: string;
        artifactIdColumn: string;
    },
) {
    const table = `public.${scope.tableName}`;
    return {
        async claim(input: {
            practiceSessionId: string;
            ownerId: string;
            questionKey: string;
            assistanceKind: CandidateQuestionAssistanceKind;
            requestFingerprint: string;
            claimToken: string;
            claimLeaseMs: number;
        }): Promise<CandidateQuestionAssistanceClaim> {
            const result = await client.query(`
                insert into ${table} (
                  ${scope.idColumn},
                  ${scope.ownerColumn},
                  question_key,
                  assistance_kind,
                  request_fingerprint,
                  lifecycle_state,
                  claim_token,
                  claim_expires_at,
                  attempt_count
                )
                values (
                  $1::uuid,
                  $2::uuid,
                  $3,
                  $4,
                  $5,
                  'pending',
                  $6::uuid,
                  now() + ($7::integer * interval '1 millisecond'),
                  1
                )
                on conflict (
                  ${scope.idColumn},
                  ${scope.ownerColumn},
                  question_key,
                  assistance_kind
                )
                do update set
                  lifecycle_state = case
                    when ${scope.tableName}.request_fingerprint = excluded.request_fingerprint
                      and (
                        ${scope.tableName}.lifecycle_state = 'failed'
                        and ${scope.tableName}.attempt_count < ${CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS}
                        or (
                          ${scope.tableName}.lifecycle_state = 'pending'
                          and ${scope.tableName}.claim_expires_at <= now()
                          and ${scope.tableName}.attempt_count < ${CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS}
                        )
                      )
                      then 'pending'
                    else ${scope.tableName}.lifecycle_state
                  end,
                  claim_token = case
                    when ${scope.tableName}.request_fingerprint = excluded.request_fingerprint
                      and (
                        ${scope.tableName}.lifecycle_state = 'failed'
                        and ${scope.tableName}.attempt_count < ${CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS}
                        or (
                          ${scope.tableName}.lifecycle_state = 'pending'
                          and ${scope.tableName}.claim_expires_at <= now()
                          and ${scope.tableName}.attempt_count < ${CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS}
                        )
                      )
                      then excluded.claim_token
                    else ${scope.tableName}.claim_token
                  end,
                  claim_expires_at = case
                    when ${scope.tableName}.request_fingerprint = excluded.request_fingerprint
                      and (
                        ${scope.tableName}.lifecycle_state = 'failed'
                        and ${scope.tableName}.attempt_count < ${CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS}
                        or (
                          ${scope.tableName}.lifecycle_state = 'pending'
                          and ${scope.tableName}.claim_expires_at <= now()
                          and ${scope.tableName}.attempt_count < ${CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS}
                        )
                      )
                      then excluded.claim_expires_at
                    else ${scope.tableName}.claim_expires_at
                  end,
                  attempt_count = case
                    when ${scope.tableName}.request_fingerprint = excluded.request_fingerprint
                      and (
                        ${scope.tableName}.lifecycle_state = 'failed'
                        and ${scope.tableName}.attempt_count < ${CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS}
                        or (
                          ${scope.tableName}.lifecycle_state = 'pending'
                          and ${scope.tableName}.claim_expires_at <= now()
                          and ${scope.tableName}.attempt_count < ${CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS}
                        )
                      )
                      then ${scope.tableName}.attempt_count + 1
                    else ${scope.tableName}.attempt_count
                  end,
                  output_json = case
                    when ${scope.tableName}.request_fingerprint = excluded.request_fingerprint
                      and (
                        ${scope.tableName}.lifecycle_state = 'failed'
                        and ${scope.tableName}.attempt_count < ${CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS}
                        or (
                          ${scope.tableName}.lifecycle_state = 'pending'
                          and ${scope.tableName}.claim_expires_at <= now()
                          and ${scope.tableName}.attempt_count < ${CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS}
                        )
                      )
                      then null
                    else ${scope.tableName}.output_json
                  end,
                  error_code = case
                    when ${scope.tableName}.request_fingerprint = excluded.request_fingerprint
                      and (
                        ${scope.tableName}.lifecycle_state = 'failed'
                        and ${scope.tableName}.attempt_count < ${CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS}
                        or (
                          ${scope.tableName}.lifecycle_state = 'pending'
                          and ${scope.tableName}.claim_expires_at <= now()
                          and ${scope.tableName}.attempt_count < ${CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS}
                        )
                      )
                      then null
                    else ${scope.tableName}.error_code
                  end
                returning
                  request_fingerprint,
                  lifecycle_state,
                  claim_token,
                  claim_expires_at,
                  attempt_count,
                  output_json
            `, [
                input.practiceSessionId,
                input.ownerId,
                input.questionKey,
                input.assistanceKind,
                input.requestFingerprint,
                input.claimToken,
                input.claimLeaseMs,
            ]);
            const row = result.rows[0];
            if (!row || row.request_fingerprint !== input.requestFingerprint) {
                return { kind: "conflict" };
            }
            if (row.lifecycle_state === "succeeded") {
                const output = parseCandidateQuestionAssistanceOutput(row.output_json);
                if (!output) {
                    return { kind: "conflict" };
                }
                return {
                    kind: "replay",
                    output,
                };
            }
            if (row.lifecycle_state === "pending" && row.claim_token === input.claimToken) {
                return {
                    kind: "claimed",
                    claimToken: input.claimToken,
                    attemptCount: Number(row.attempt_count),
                };
            }
            if (
                (
                    row.lifecycle_state === "failed"
                    || (
                        row.lifecycle_state === "pending"
                        && isExpiredClaim(row.claim_expires_at)
                    )
                )
                && Number(row.attempt_count) >= CANDIDATE_QUESTION_ASSISTANCE_MAX_ATTEMPTS
            ) {
                return { kind: "exhausted" };
            }
            return { kind: "pending" };
        },

        async complete(input: {
            practiceSessionId: string;
            ownerId: string;
            questionKey: string;
            assistanceKind: CandidateQuestionAssistanceKind;
            claimToken: string;
            output: CandidateQuestionAssistanceOutput;
            provider: string;
            profileId: string;
            promptVersion: string;
            configurationFingerprint: string;
        }) {
            const result = await client.query(`
                update ${table}
                set lifecycle_state = 'succeeded',
                    claim_token = null,
                    claim_expires_at = null,
                    output_json = $6::jsonb,
                    provider = $7,
                    profile_id = $8,
                    prompt_version = $9,
                    configuration_fingerprint = $10,
                    error_code = null
                where ${scope.idColumn} = $1::uuid
                  and ${scope.ownerColumn} = $2::uuid
                  and question_key = $3
                  and assistance_kind = $4
                  and lifecycle_state = 'pending'
                  and claim_token = $5::uuid
                returning ${scope.artifactIdColumn}
            `, [
                input.practiceSessionId,
                input.ownerId,
                input.questionKey,
                input.assistanceKind,
                input.claimToken,
                JSON.stringify(input.output),
                input.provider,
                input.profileId,
                input.promptVersion,
                input.configurationFingerprint,
            ]);
            return result.rows.length === 1;
        },

        async fail(input: {
            practiceSessionId: string;
            ownerId: string;
            questionKey: string;
            assistanceKind: CandidateQuestionAssistanceKind;
            claimToken: string;
            errorCode: string;
        }) {
            await client.query(`
                update ${table}
                set lifecycle_state = 'failed',
                    claim_token = null,
                    claim_expires_at = null,
                    output_json = null,
                    error_code = $6
                where ${scope.idColumn} = $1::uuid
                  and ${scope.ownerColumn} = $2::uuid
                  and question_key = $3
                  and assistance_kind = $4
                  and lifecycle_state = 'pending'
                  and claim_token = $5::uuid
            `, [
                input.practiceSessionId,
                input.ownerId,
                input.questionKey,
                input.assistanceKind,
                input.claimToken,
                input.errorCode,
            ]);
        },
    };
}

function isExpiredClaim(value: unknown) {
    if (!(value instanceof Date) && typeof value !== "string") {
        return false;
    }
    const expiresAt = value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}
