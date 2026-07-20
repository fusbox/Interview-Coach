import type { CandidateSetupStageId } from "@/features/candidate-setup-v2/candidate-setup-contract";
import type { CandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import type { CandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";

import type { PreparedRecruiterInvitationAggregate } from "./recruiter-invitation-contract";

export type RecruiterInvitationQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export type RecruiterInvitationCreationOutcome = "created" | "replayed" | "conflict";

export type RecruiterInvitationAggregateRecord = {
    batchId: string;
    recruiterId: string;
    batchLifecycleState?: "ready" | "revoked";
    targetRole: string;
    jobDescription: string | null;
    interviewStage: CandidateSetupStageId;
    questionPlanSnapshot: CandidateQuestionPlan;
    questionWordingSnapshot: CandidateQuestionWordingResult;
    recipients: Array<{
        recipientId: string;
        recipientLifecycleState?: "ready" | "revoked";
        candidateIndex: number;
        firstName: string;
        lastName: string;
        email: string;
        requisitionReference: string | null;
        sessionId: string;
        sessionStatus: "planned" | "in_progress" | "completed" | "abandoned";
        attemptNumber: number;
        tokenHash: string;
        tokenCiphertext: string;
        encryptionKeyId: string;
        tokenExpiresAt: string;
    }>;
};

export type InvitedPracticeSessionRecord = {
    sessionId: string;
    recipientId: string;
    recruiterId: string;
    parentSessionId: string | null;
    attemptNumber: number;
    status: "planned" | "in_progress" | "completed" | "abandoned";
    setupSnapshot: Record<string, unknown>;
    questionPlanSnapshot: CandidateQuestionPlan;
    questionWordingSnapshot: CandidateQuestionWordingResult;
    progress: Record<string, unknown>;
};

export function createRecruiterInvitationRepository(client: RecruiterInvitationQueryClient) {
    return {
        async createOrReplay(input: PreparedRecruiterInvitationAggregate) {
            const result = await client.query(`
                select creation_outcome, recruiter_invitation_batch_id
                from public.create_recruiter_invitation_aggregate(
                  $1::uuid,
                  $2::text,
                  $3::text,
                  $4::uuid,
                  $5::text,
                  $6::text,
                  $7::text,
                  $8::jsonb,
                  $9::jsonb,
                  $10::jsonb
                )
            `, [
                input.recruiterId,
                input.idempotencyKeyHash,
                input.requestFingerprint,
                input.batchId,
                input.targetRole,
                input.jobDescription,
                input.interviewStage,
                JSON.stringify(input.questionPlanSnapshot),
                JSON.stringify(input.questionWordingSnapshot),
                JSON.stringify(input.recipients),
            ]);

            const row = result.rows[0];
            return {
                outcome: readCreationOutcome(row?.creation_outcome),
                batchId: requireString(row?.recruiter_invitation_batch_id, "recruiter_invitation_batch_id"),
            };
        },

        async createOrReplayFromQuestionSet(input: PreparedRecruiterInvitationAggregate & {
            sourceQuestionSetId: string;
        }) {
            const result = await client.query(`
                select creation_outcome, recruiter_invitation_batch_id
                from public.create_recruiter_invitation_aggregate_from_question_set(
                  $1::uuid,
                  $2::uuid,
                  $3::text,
                  $4::text,
                  $5::uuid,
                  $6::text,
                  $7::text,
                  $8::text,
                  $9::jsonb,
                  $10::jsonb,
                  $11::jsonb
                )
            `, [
                input.sourceQuestionSetId,
                input.recruiterId,
                input.idempotencyKeyHash,
                input.requestFingerprint,
                input.batchId,
                input.targetRole,
                input.jobDescription,
                input.interviewStage,
                JSON.stringify(input.questionPlanSnapshot),
                JSON.stringify(input.questionWordingSnapshot),
                JSON.stringify(input.recipients),
            ]);

            const row = result.rows[0];
            return {
                outcome: readCreationOutcome(row?.creation_outcome),
                batchId: requireString(row?.recruiter_invitation_batch_id, "recruiter_invitation_batch_id"),
            };
        },

        async findOwnedAggregate(input: {
            recruiterId: string;
            batchId: string;
        }): Promise<RecruiterInvitationAggregateRecord | null> {
            const result = await client.query(`
                select
                  batch.recruiter_invitation_batch_id,
                  batch.recruiter_id,
                  batch.lifecycle_state as batch_lifecycle_state,
                  batch.target_role,
                  batch.job_description,
                  batch.interview_stage,
                  batch.question_plan_snapshot_json,
                  batch.question_wording_snapshot_json,
                  recipient.recruiter_invitation_recipient_id,
                  recipient.lifecycle_state as recipient_lifecycle_state,
                  recipient.candidate_index,
                  recipient.first_name,
                  recipient.last_name,
                  recipient.email,
                  recipient.requisition_reference,
                  session.invited_practice_session_id,
                  session.status as session_status,
                  session.attempt_number,
                  token.token_hash,
                  token.token_ciphertext,
                  token.encryption_key_id,
                  token.expires_at
                from public.recruiter_invitation_batches batch
                join public.recruiter_invitation_recipients recipient
                  on recipient.recruiter_invitation_batch_id = batch.recruiter_invitation_batch_id
                 and recipient.recruiter_id = batch.recruiter_id
                join public.invited_practice_sessions session
                  on session.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
                 and session.recruiter_id = recipient.recruiter_id
                 and session.attempt_number = 1
                join public.invited_practice_access_tokens token
                  on token.invited_practice_session_id = session.invited_practice_session_id
                 and token.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
                 and token.revoked_at is null
                where batch.recruiter_invitation_batch_id = $1
                  and batch.recruiter_id = $2
                  and recipient.recruiter_id = $2
                  and session.recruiter_id = $2
                order by recipient.candidate_index asc
            `, [input.batchId, input.recruiterId]);

            return mapAggregateRows(result.rows);
        },

        async findSessionByTokenHash(tokenHash: string): Promise<InvitedPracticeSessionRecord | null> {
            const result = await client.query(`
                select
                  session.invited_practice_session_id,
                  session.recruiter_invitation_recipient_id,
                  session.recruiter_id,
                  session.parent_invited_practice_session_id,
                  session.attempt_number,
                  session.status,
                  session.setup_snapshot_json,
                  session.question_plan_snapshot_json,
                  session.question_wording_snapshot_json,
                  session.progress_state_json
                from public.invited_practice_access_tokens token
                join public.invited_practice_sessions session
                  on session.invited_practice_session_id = token.invited_practice_session_id
                 and session.recruiter_invitation_recipient_id = token.recruiter_invitation_recipient_id
                join public.recruiter_invitation_recipients recipient
                  on recipient.recruiter_invitation_recipient_id = session.recruiter_invitation_recipient_id
                 and recipient.recruiter_id = session.recruiter_id
                join public.recruiter_invitation_batches batch
                  on batch.recruiter_invitation_batch_id = recipient.recruiter_invitation_batch_id
                 and batch.recruiter_id = recipient.recruiter_id
                where token.token_hash = $1
                  and token.revoked_at is null
                  and token.expires_at > now()
                  and batch.lifecycle_state = 'ready'
                  and recipient.lifecycle_state = 'ready'
                limit 1
            `, [tokenHash]);

            return mapSessionRow(result.rows[0]);
        },
    };
}

export type RecruiterInvitationRepository = ReturnType<typeof createRecruiterInvitationRepository>;

function mapAggregateRows(rows: Array<Record<string, unknown>>): RecruiterInvitationAggregateRecord | null {
    const first = rows[0];
    if (!first) return null;

    return {
        batchId: requireString(first.recruiter_invitation_batch_id, "recruiter_invitation_batch_id"),
        recruiterId: requireString(first.recruiter_id, "recruiter_id"),
        batchLifecycleState: readLifecycle(first.batch_lifecycle_state, "batch_lifecycle_state"),
        targetRole: requireString(first.target_role, "target_role"),
        jobDescription: readNullableString(first.job_description),
        interviewStage: readInterviewStage(first.interview_stage),
        questionPlanSnapshot: first.question_plan_snapshot_json as CandidateQuestionPlan,
        questionWordingSnapshot: first.question_wording_snapshot_json as CandidateQuestionWordingResult,
        recipients: rows.map((row) => ({
            recipientId: requireString(row.recruiter_invitation_recipient_id, "recruiter_invitation_recipient_id"),
            recipientLifecycleState: readLifecycle(row.recipient_lifecycle_state, "recipient_lifecycle_state"),
            candidateIndex: readPositiveInteger(row.candidate_index, true),
            firstName: requireString(row.first_name, "first_name"),
            lastName: requireString(row.last_name, "last_name"),
            email: requireString(row.email, "email"),
            requisitionReference: readNullableString(row.requisition_reference),
            sessionId: requireString(row.invited_practice_session_id, "invited_practice_session_id"),
            sessionStatus: readSessionStatus(row.session_status),
            attemptNumber: readPositiveInteger(row.attempt_number),
            tokenHash: requireString(row.token_hash, "token_hash"),
            tokenCiphertext: requireString(row.token_ciphertext, "token_ciphertext"),
            encryptionKeyId: requireString(row.encryption_key_id, "encryption_key_id"),
            tokenExpiresAt: toIsoString(row.expires_at, "expires_at"),
        })),
    };
}

function mapSessionRow(row: Record<string, unknown> | undefined): InvitedPracticeSessionRecord | null {
    if (!row) return null;
    return {
        sessionId: requireString(row.invited_practice_session_id, "invited_practice_session_id"),
        recipientId: requireString(row.recruiter_invitation_recipient_id, "recruiter_invitation_recipient_id"),
        recruiterId: requireString(row.recruiter_id, "recruiter_id"),
        parentSessionId: readNullableString(row.parent_invited_practice_session_id),
        attemptNumber: readPositiveInteger(row.attempt_number),
        status: readSessionStatus(row.status),
        setupSnapshot: readObject(row.setup_snapshot_json, "setup_snapshot_json"),
        questionPlanSnapshot: row.question_plan_snapshot_json as CandidateQuestionPlan,
        questionWordingSnapshot: row.question_wording_snapshot_json as CandidateQuestionWordingResult,
        progress: readObject(row.progress_state_json, "progress_state_json"),
    };
}

function readCreationOutcome(value: unknown): RecruiterInvitationCreationOutcome {
    if (value === "created" || value === "replayed" || value === "conflict") return value;
    throw new Error("Invitation repository returned an unsupported creation outcome.");
}

function readSessionStatus(value: unknown): InvitedPracticeSessionRecord["status"] {
    if (value === "planned" || value === "in_progress" || value === "completed" || value === "abandoned") {
        return value;
    }
    throw new Error("Invitation repository returned an unsupported session status.");
}

function readLifecycle(value: unknown, field: string): "ready" | "revoked" {
    if (value === "ready" || value === "revoked") return value;
    throw new Error(`Invitation repository returned an unsupported ${field}.`);
}

function readInterviewStage(value: unknown): CandidateSetupStageId {
    if (
        value === "practice_only"
        || value === "screening"
        || value === "first_interview"
        || value === "follow_up"
        || value === "final_interview"
    ) return value;
    throw new Error("Invitation repository returned an unsupported interview stage.");
}

function requireString(value: unknown, field: string) {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Invitation repository returned an invalid ${field}.`);
    }
    return value;
}

function readNullableString(value: unknown) {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function readPositiveInteger(value: unknown, allowZero = false) {
    const number = Number(value);
    if (!Number.isInteger(number) || (allowZero ? number < 0 : number < 1)) {
        throw new Error("Invitation repository returned an invalid integer.");
    }
    return number;
}

function readObject(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`Invitation repository returned an invalid ${field}.`);
    }
    return value as Record<string, unknown>;
}

function toIsoString(value: unknown, field: string) {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.valueOf())) {
        throw new Error(`Invitation repository returned an invalid ${field}.`);
    }
    return date.toISOString();
}
