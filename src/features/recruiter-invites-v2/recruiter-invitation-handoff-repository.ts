import type { CandidateSetupStageId } from "@/features/candidate-setup-v2/candidate-setup-contract";
import type {
    RecruiterInvitationHandoffFact,
    RecruiterInvitationHandoffRecipientFact,
} from "./recruiter-invitation-handoff-read-model";

export type RecruiterInvitationHandoffQueryClient = {
    query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export function createRecruiterInvitationHandoffRepository(client: RecruiterInvitationHandoffQueryClient) {
    return {
        async findOwnedHandoffFact(
            recruiterId: string,
            batchId: string,
        ): Promise<RecruiterInvitationHandoffFact | null> {
            const result = await client.query(`
                select
                  batch.recruiter_invitation_batch_id,
                  batch.lifecycle_state as batch_lifecycle_state,
                  batch.target_role,
                  batch.interview_stage,
                  batch.recipient_count,
                  batch.created_at as batch_created_at,
                  batch.updated_at as batch_updated_at,
                  recipient.recruiter_invitation_recipient_id,
                  recipient.lifecycle_state as recipient_lifecycle_state,
                  recipient.candidate_index,
                  recipient.first_name,
                  recipient.last_name,
                  recipient.email,
                  recipient.requisition_reference,
                  session.invited_practice_session_id,
                  session.status as session_status,
                  session.attempt_number as session_attempt_number,
                  token.token_ciphertext,
                  token.encryption_key_id,
                  token.expires_at as token_expires_at,
                  token.revoked_at as token_revoked_at,
                  delivery.recruiter_invitation_delivery_attempt_id,
                  delivery.attempt_number as delivery_attempt_number,
                  delivery.lifecycle_state as delivery_lifecycle_state,
                  delivery.retryable as delivery_retryable,
                  delivery.failure_code as delivery_failure_code,
                  delivery.queued_at as delivery_queued_at,
                  delivery.started_at as delivery_started_at,
                  delivery.completed_at as delivery_completed_at,
                  delivery.updated_at as delivery_updated_at
                from public.recruiter_invitation_batches batch
                join public.recruiter_invitation_recipients recipient
                  on recipient.recruiter_invitation_batch_id = batch.recruiter_invitation_batch_id
                 and recipient.recruiter_id = batch.recruiter_id
                 and recipient.recruiter_id = $1
                join lateral (
                  select owned_session.*
                  from public.invited_practice_sessions owned_session
                  where owned_session.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
                    and owned_session.recruiter_id = $1
                  order by owned_session.attempt_number desc
                  limit 1
                ) session on true
                left join lateral (
                  select owned_token.token_ciphertext,
                         owned_token.encryption_key_id,
                         owned_token.expires_at,
                         owned_token.revoked_at
                  from public.invited_practice_access_tokens owned_token
                  where owned_token.invited_practice_session_id = session.invited_practice_session_id
                    and owned_token.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
                  order by (owned_token.revoked_at is null) desc, owned_token.created_at desc
                  limit 1
                ) token on true
                left join lateral (
                  select owned_delivery.recruiter_invitation_delivery_attempt_id,
                         owned_delivery.attempt_number,
                         owned_delivery.lifecycle_state,
                         owned_delivery.retryable,
                         owned_delivery.failure_code,
                         owned_delivery.queued_at,
                         owned_delivery.started_at,
                         owned_delivery.completed_at,
                         owned_delivery.updated_at
                  from public.recruiter_invitation_delivery_attempts owned_delivery
                  where owned_delivery.recruiter_invitation_batch_id = batch.recruiter_invitation_batch_id
                    and owned_delivery.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
                    and owned_delivery.recruiter_id = $1
                  order by owned_delivery.attempt_number desc
                  limit 1
                ) delivery on true
                where batch.recruiter_invitation_batch_id = $2
                  and batch.recruiter_id = $1
                order by recipient.candidate_index asc
            `, [recruiterId, batchId]);

            return mapHandoffRows(result.rows);
        },
    };
}

export type RecruiterInvitationHandoffRepository = ReturnType<typeof createRecruiterInvitationHandoffRepository>;

function mapHandoffRows(rows: Array<Record<string, unknown>>): RecruiterInvitationHandoffFact | null {
    const first = rows[0];
    if (!first) return null;

    const recipientCount = readInteger(first.recipient_count, "recipient_count", 1);
    if (rows.length !== recipientCount) {
        throw new Error("Recruiter invitation handoff query returned an incomplete recipient set.");
    }

    return {
        batchId: requireString(first.recruiter_invitation_batch_id, "recruiter_invitation_batch_id"),
        batchLifecycleState: readLifecycle(first.batch_lifecycle_state, "batch_lifecycle_state"),
        targetRole: requireString(first.target_role, "target_role"),
        interviewStage: readInterviewStage(first.interview_stage),
        recipientCount,
        batchCreatedAt: toIsoString(first.batch_created_at, "batch_created_at"),
        batchUpdatedAt: toIsoString(first.batch_updated_at, "batch_updated_at"),
        recipients: rows.map(mapRecipient),
    };
}

function mapRecipient(row: Record<string, unknown>): RecruiterInvitationHandoffRecipientFact {
    const deliveryAttemptId = readNullableString(row.recruiter_invitation_delivery_attempt_id);
    return {
        recipientId: requireString(row.recruiter_invitation_recipient_id, "recruiter_invitation_recipient_id"),
        recipientLifecycleState: readLifecycle(row.recipient_lifecycle_state, "recipient_lifecycle_state"),
        candidateIndex: readInteger(row.candidate_index, "candidate_index", 0),
        firstName: requireString(row.first_name, "first_name"),
        lastName: requireString(row.last_name, "last_name"),
        email: requireString(row.email, "email"),
        requisitionReference: readNullableString(row.requisition_reference),
        sessionId: requireString(row.invited_practice_session_id, "invited_practice_session_id"),
        sessionStatus: readSessionStatus(row.session_status),
        sessionAttemptNumber: readInteger(row.session_attempt_number, "session_attempt_number", 1),
        tokenCiphertext: readNullableString(row.token_ciphertext),
        encryptionKeyId: readNullableString(row.encryption_key_id),
        tokenExpiresAt: toNullableIsoString(row.token_expires_at, "token_expires_at"),
        tokenRevokedAt: toNullableIsoString(row.token_revoked_at, "token_revoked_at"),
        delivery: deliveryAttemptId ? {
            attemptId: deliveryAttemptId,
            attemptNumber: readInteger(row.delivery_attempt_number, "delivery_attempt_number", 1),
            lifecycleState: readDeliveryLifecycle(row.delivery_lifecycle_state),
            retryable: row.delivery_retryable === true,
            failureCode: readNullableString(row.delivery_failure_code),
            queuedAt: toIsoString(row.delivery_queued_at, "delivery_queued_at"),
            startedAt: toNullableIsoString(row.delivery_started_at, "delivery_started_at"),
            completedAt: toNullableIsoString(row.delivery_completed_at, "delivery_completed_at"),
            updatedAt: toIsoString(row.delivery_updated_at, "delivery_updated_at"),
        } : null,
    };
}

function requireString(value: unknown, field: string) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Recruiter invitation handoff query returned an invalid ${field}.`);
    }
    return value;
}

function readNullableString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readLifecycle(value: unknown, field: string): "ready" | "revoked" {
    if (value === "ready" || value === "revoked") return value;
    throw new Error(`Recruiter invitation handoff query returned an invalid ${field}.`);
}

function readInterviewStage(value: unknown): CandidateSetupStageId {
    if (
        value === "practice_only"
        || value === "screening"
        || value === "first_interview"
        || value === "follow_up"
        || value === "final_interview"
    ) return value;
    throw new Error("Recruiter invitation handoff query returned an invalid interview_stage.");
}

function readSessionStatus(value: unknown): RecruiterInvitationHandoffRecipientFact["sessionStatus"] {
    if (value === "planned" || value === "in_progress" || value === "completed" || value === "abandoned") return value;
    throw new Error("Recruiter invitation handoff query returned an invalid session_status.");
}

function readDeliveryLifecycle(value: unknown): NonNullable<RecruiterInvitationHandoffRecipientFact["delivery"]>["lifecycleState"] {
    if (value === "queued" || value === "sending" || value === "provider_accepted" || value === "failed" || value === "outcome_unknown") return value;
    throw new Error("Recruiter invitation handoff query returned an invalid delivery lifecycle.");
}

function readInteger(value: unknown, field: string, minimum: number) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum) {
        throw new Error(`Recruiter invitation handoff query returned an invalid ${field}.`);
    }
    return parsed;
}

function toIsoString(value: unknown, field: string) {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.valueOf())) {
        throw new Error(`Recruiter invitation handoff query returned an invalid ${field}.`);
    }
    return date.toISOString();
}

function toNullableIsoString(value: unknown, field: string) {
    if (value == null || value === "") return null;
    return toIsoString(value, field);
}
