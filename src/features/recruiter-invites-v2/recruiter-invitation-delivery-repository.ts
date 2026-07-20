import type { RecruiterInvitationQueryClient } from "./recruiter-invitation-repository";

export type RecruiterInvitationDeliveryLifecycleState =
    | "queued"
    | "sending"
    | "provider_accepted"
    | "failed"
    | "outcome_unknown";

export type RecruiterInvitationDeliveryClaimOutcome =
    | "claimed"
    | "replayed"
    | "already_accepted"
    | "in_progress"
    | "outcome_unknown"
    | "not_retryable"
    | "not_found";

export type RecruiterInvitationDeliveryAttempt = {
    attemptId: string;
    attemptNumber: number;
    lifecycleState: RecruiterInvitationDeliveryLifecycleState;
    retryable: boolean;
    failureCode: string | null;
};

export function createRecruiterInvitationDeliveryRepository(client: RecruiterInvitationQueryClient) {
    return {
        async claim(input: {
            recruiterId: string;
            batchId: string;
            recipientId: string;
            attemptId: string;
            actionKeyHash: string;
            provider: string;
        }): Promise<{ outcome: RecruiterInvitationDeliveryClaimOutcome; attempt: RecruiterInvitationDeliveryAttempt | null }> {
            const result = await client.query(`
                select
                  claim_outcome,
                  delivery_attempt_id,
                  delivery_attempt_number,
                  delivery_lifecycle_state,
                  delivery_retryable,
                  delivery_failure_code
                from public.claim_recruiter_invitation_delivery_attempt(
                  $1::uuid,
                  $2::uuid,
                  $3::uuid,
                  $4::uuid,
                  $5::text,
                  $6::text
                )
            `, [
                input.recruiterId,
                input.batchId,
                input.recipientId,
                input.attemptId,
                input.actionKeyHash,
                input.provider,
            ]);
            const row = result.rows[0];
            const outcome = readClaimOutcome(row?.claim_outcome);
            return {
                outcome,
                attempt: row?.delivery_attempt_id ? mapAttempt(row) : null,
            };
        },

        async start(input: { recruiterId: string; attemptId: string }) {
            const result = await client.query(`
                update public.recruiter_invitation_delivery_attempts
                set
                  lifecycle_state = 'sending',
                  started_at = now(),
                  updated_at = now()
                where recruiter_invitation_delivery_attempt_id = $1
                  and recruiter_id = $2
                  and lifecycle_state = 'queued'
                returning
                  recruiter_invitation_delivery_attempt_id as delivery_attempt_id,
                  attempt_number as delivery_attempt_number,
                  lifecycle_state as delivery_lifecycle_state,
                  retryable as delivery_retryable,
                  failure_code as delivery_failure_code
            `, [input.attemptId, input.recruiterId]);
            return result.rows[0] ? mapAttempt(result.rows[0]) : null;
        },

        async accept(input: {
            recruiterId: string;
            attemptId: string;
            providerReferenceId: string;
        }) {
            const result = await client.query(`
                update public.recruiter_invitation_delivery_attempts
                set
                  lifecycle_state = 'provider_accepted',
                  provider_reference_id = $3,
                  retryable = false,
                  completed_at = now(),
                  updated_at = now()
                where recruiter_invitation_delivery_attempt_id = $1
                  and recruiter_id = $2
                  and lifecycle_state = 'sending'
                returning recruiter_invitation_delivery_attempt_id
            `, [input.attemptId, input.recruiterId, input.providerReferenceId]);
            return result.rows.length === 1;
        },

        async fail(input: {
            recruiterId: string;
            attemptId: string;
            failureCode: string;
            retryable: boolean;
            outcomeUnknown: boolean;
        }) {
            const lifecycleState = input.outcomeUnknown ? "outcome_unknown" : "failed";
            const result = await client.query(`
                update public.recruiter_invitation_delivery_attempts
                set
                  lifecycle_state = $3,
                  failure_code = $4,
                  retryable = $5,
                  completed_at = now(),
                  updated_at = now()
                where recruiter_invitation_delivery_attempt_id = $1
                  and recruiter_id = $2
                  and lifecycle_state = any($6::text[])
                returning recruiter_invitation_delivery_attempt_id
            `, [
                input.attemptId,
                input.recruiterId,
                lifecycleState,
                input.failureCode,
                input.outcomeUnknown ? false : input.retryable,
                input.outcomeUnknown ? ["sending"] : ["queued", "sending"],
            ]);
            return result.rows.length === 1;
        },
    };
}

export type RecruiterInvitationDeliveryRepository = ReturnType<typeof createRecruiterInvitationDeliveryRepository>;

function mapAttempt(row: Record<string, unknown>): RecruiterInvitationDeliveryAttempt {
    return {
        attemptId: requireString(row.delivery_attempt_id, "delivery_attempt_id"),
        attemptNumber: readPositiveInteger(row.delivery_attempt_number),
        lifecycleState: readLifecycleState(row.delivery_lifecycle_state),
        retryable: row.delivery_retryable === true,
        failureCode: typeof row.delivery_failure_code === "string" ? row.delivery_failure_code : null,
    };
}

function readClaimOutcome(value: unknown): RecruiterInvitationDeliveryClaimOutcome {
    if (
        value === "claimed"
        || value === "replayed"
        || value === "already_accepted"
        || value === "in_progress"
        || value === "outcome_unknown"
        || value === "not_retryable"
        || value === "not_found"
    ) return value;
    throw new Error("Delivery repository returned an unsupported claim outcome.");
}

function readLifecycleState(value: unknown): RecruiterInvitationDeliveryLifecycleState {
    if (
        value === "queued"
        || value === "sending"
        || value === "provider_accepted"
        || value === "failed"
        || value === "outcome_unknown"
    ) return value;
    throw new Error("Delivery repository returned an unsupported lifecycle state.");
}

function requireString(value: unknown, field: string) {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Delivery repository returned an invalid ${field}.`);
    }
    return value;
}

function readPositiveInteger(value: unknown) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) {
        throw new Error("Delivery repository returned an invalid attempt number.");
    }
    return number;
}
