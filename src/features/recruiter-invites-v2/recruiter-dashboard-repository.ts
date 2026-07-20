import type { CandidateSetupStageId } from "@/features/candidate-setup-v2/candidate-setup-contract";
import type { RecruiterDashboardRecipientFact } from "./recruiter-dashboard-read-model";

export type RecruiterDashboardQueryClient = {
    query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export function createRecruiterDashboardRepository(client: RecruiterDashboardQueryClient) {
    return {
        async listOwnedRecipientFacts(recruiterId: string): Promise<RecruiterDashboardRecipientFact[]> {
            const result = await client.query(`
                select
                  batch.recruiter_invitation_batch_id,
                  batch.lifecycle_state as batch_lifecycle_state,
                  batch.target_role,
                  batch.interview_stage,
                  batch.created_at as batch_created_at,
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
                  case
                    when jsonb_typeof(session.question_wording_snapshot_json -> 'questions') = 'array'
                    then jsonb_array_length(session.question_wording_snapshot_json -> 'questions')
                    else 0
                  end as question_count,
                  coalesce(answer_progress.answered_question_count, 0) as answered_question_count,
                  session.completion_snapshot_json ->> 'completedAt' as completed_at,
                  delivery.lifecycle_state as delivery_lifecycle_state,
                  delivery.attempt_number as delivery_attempt_number,
                  coalesce(delivery.retryable, false) as delivery_retryable,
                  entry_signal.match_state as entry_match_state,
                  browser_activity.first_opened_at,
                  greatest(
                    batch.updated_at,
                    recipient.updated_at,
                    session.updated_at,
                    delivery.updated_at,
                    entry_signal.created_at,
                    browser_activity.last_seen_at,
                    answer_progress.latest_answer_at
                  ) as last_activity_at
                from public.recruiter_invitation_batches batch
                join public.recruiter_invitation_recipients recipient
                  on recipient.recruiter_invitation_batch_id = batch.recruiter_invitation_batch_id
                 and recipient.recruiter_id = batch.recruiter_id
                join lateral (
                  select owned_session.*
                  from public.invited_practice_sessions owned_session
                  where owned_session.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
                    and owned_session.recruiter_id = $1
                  order by owned_session.attempt_number desc
                  limit 1
                ) session on true
                left join lateral (
                  select owned_delivery.lifecycle_state,
                         owned_delivery.attempt_number,
                         owned_delivery.retryable,
                         owned_delivery.updated_at
                  from public.recruiter_invitation_delivery_attempts owned_delivery
                  where owned_delivery.recruiter_invitation_batch_id = batch.recruiter_invitation_batch_id
                    and owned_delivery.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
                    and owned_delivery.recruiter_id = $1
                  order by owned_delivery.attempt_number desc
                  limit 1
                ) delivery on true
                left join public.invited_practice_entry_signals entry_signal
                  on entry_signal.invited_practice_session_id = session.invited_practice_session_id
                 and entry_signal.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
                left join lateral (
                  select min(browser.created_at) as first_opened_at,
                         max(browser.last_seen_at) as last_seen_at
                  from public.invited_practice_access_tokens access_token
                  join public.invited_practice_browser_sessions browser
                    on browser.invited_practice_access_token_id = access_token.invited_practice_access_token_id
                  where access_token.invited_practice_session_id = session.invited_practice_session_id
                    and access_token.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
                ) browser_activity on true
                left join lateral (
                  select count(distinct answer_attempt.question_slot_id)::integer as answered_question_count,
                         max(answer_attempt.submitted_at) as latest_answer_at
                  from public.invited_practice_answer_attempts answer_attempt
                  where answer_attempt.invited_practice_session_id = session.invited_practice_session_id
                    and answer_attempt.recruiter_invitation_recipient_id = recipient.recruiter_invitation_recipient_id
                ) answer_progress on true
                where batch.recruiter_id = $1
                  and recipient.recruiter_id = $1
                  and session.recruiter_id = $1
                order by last_activity_at desc, batch.created_at desc, recipient.candidate_index asc
            `, [recruiterId]);

            return result.rows.map(mapRecipientFact);
        },
    };
}

export type RecruiterDashboardRepository = ReturnType<typeof createRecruiterDashboardRepository>;

function mapRecipientFact(row: Record<string, unknown>): RecruiterDashboardRecipientFact {
    return {
        batchId: requireString(row.recruiter_invitation_batch_id, "recruiter_invitation_batch_id"),
        batchLifecycleState: readLifecycle(row.batch_lifecycle_state, "batch_lifecycle_state"),
        targetRole: requireString(row.target_role, "target_role"),
        interviewStage: readInterviewStage(row.interview_stage),
        batchCreatedAt: toIsoString(row.batch_created_at, "batch_created_at"),
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
        questionCount: readInteger(row.question_count, "question_count", 1),
        answeredQuestionCount: readInteger(row.answered_question_count, "answered_question_count", 0),
        completedAt: toNullableIsoString(row.completed_at, "completed_at"),
        deliveryLifecycleState: readDeliveryLifecycle(row.delivery_lifecycle_state),
        deliveryAttemptNumber: row.delivery_attempt_number == null
            ? null
            : readInteger(row.delivery_attempt_number, "delivery_attempt_number", 1),
        deliveryRetryable: row.delivery_retryable === true,
        entryMatchState: readEntryMatchState(row.entry_match_state),
        firstOpenedAt: toNullableIsoString(row.first_opened_at, "first_opened_at"),
        lastActivityAt: toIsoString(row.last_activity_at, "last_activity_at"),
    };
}

function requireString(value: unknown, field: string) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Recruiter dashboard query returned an invalid ${field}.`);
    }
    return value;
}

function readNullableString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readLifecycle(value: unknown, field: string): "ready" | "revoked" {
    if (value === "ready" || value === "revoked") return value;
    throw new Error(`Recruiter dashboard query returned an invalid ${field}.`);
}

function readInterviewStage(value: unknown): CandidateSetupStageId {
    if (
        value === "practice_only"
        || value === "screening"
        || value === "first_interview"
        || value === "follow_up"
        || value === "final_interview"
    ) return value;
    throw new Error("Recruiter dashboard query returned an invalid interview_stage.");
}

function readSessionStatus(value: unknown): RecruiterDashboardRecipientFact["sessionStatus"] {
    if (value === "planned" || value === "in_progress" || value === "completed" || value === "abandoned") return value;
    throw new Error("Recruiter dashboard query returned an invalid session_status.");
}

function readDeliveryLifecycle(value: unknown): RecruiterDashboardRecipientFact["deliveryLifecycleState"] {
    if (value == null) return null;
    if (value === "queued" || value === "sending" || value === "provider_accepted" || value === "failed" || value === "outcome_unknown") return value;
    throw new Error("Recruiter dashboard query returned an invalid delivery_lifecycle_state.");
}

function readEntryMatchState(value: unknown): RecruiterDashboardRecipientFact["entryMatchState"] {
    if (value == null) return null;
    if (value === "match" || value === "mismatch") return value;
    throw new Error("Recruiter dashboard query returned an invalid entry_match_state.");
}

function readInteger(value: unknown, field: string, minimum: number) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum) {
        throw new Error(`Recruiter dashboard query returned an invalid ${field}.`);
    }
    return parsed;
}

function toIsoString(value: unknown, field: string) {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.valueOf())) {
        throw new Error(`Recruiter dashboard query returned an invalid ${field}.`);
    }
    return date.toISOString();
}

function toNullableIsoString(value: unknown, field: string) {
    if (value == null || value === "") return null;
    return toIsoString(value, field);
}
