import type { CandidateSetupStageId } from "@/features/candidate-setup-v2/candidate-setup-contract";
import type { RecruiterInvitedTranscriptFact } from "./recruiter-invited-transcript-read-model";

export type RecruiterInvitedTranscriptQueryClient = {
    query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export function createRecruiterInvitedTranscriptRepository(client: RecruiterInvitedTranscriptQueryClient) {
    return {
        async findOwnedTranscriptFact(
            recruiterId: string,
            sessionId: string,
        ): Promise<RecruiterInvitedTranscriptFact | null> {
            const result = await client.query(`
                with owned_session as materialized (
                  select
                    session.invited_practice_session_id,
                    session.recruiter_invitation_recipient_id,
                    session.status as session_status,
                    session.attempt_number as session_attempt_number,
                    session.question_plan_snapshot_json,
                    session.question_wording_snapshot_json -> 'questions' as question_wording_questions_json,
                    recipient.lifecycle_state as recipient_lifecycle_state,
                    recipient.first_name,
                    recipient.last_name,
                    recipient.email,
                    recipient.requisition_reference,
                    batch.lifecycle_state as batch_lifecycle_state,
                    batch.target_role,
                    batch.interview_stage
                  from public.invited_practice_sessions session
                  join public.recruiter_invitation_recipients recipient
                    on recipient.recruiter_invitation_recipient_id = session.recruiter_invitation_recipient_id
                   and recipient.recruiter_id = $1
                  join public.recruiter_invitation_batches batch
                    on batch.recruiter_invitation_batch_id = recipient.recruiter_invitation_batch_id
                   and batch.recruiter_id = $1
                  where session.invited_practice_session_id = $2
                    and session.recruiter_id = $1
                ), latest_answers as materialized (
                  select distinct on (answer_attempt.question_slot_id)
                    answer_attempt.question_slot_id,
                    answer_attempt.question_index,
                    answer_attempt.answer_text
                  from public.invited_practice_answer_attempts answer_attempt
                  join owned_session
                    on owned_session.invited_practice_session_id = answer_attempt.invited_practice_session_id
                   and owned_session.recruiter_invitation_recipient_id = answer_attempt.recruiter_invitation_recipient_id
                  order by answer_attempt.question_slot_id, answer_attempt.attempt_number desc
                )
                select
                  owned_session.*,
                  coalesce(
                    jsonb_agg(
                      jsonb_build_object(
                        'questionSlotId', latest_answers.question_slot_id,
                        'questionIndex', latest_answers.question_index,
                        'answerText', latest_answers.answer_text
                      ) order by latest_answers.question_index
                    ) filter (where latest_answers.question_slot_id is not null),
                    '[]'::jsonb
                  ) as latest_answers_json
                from owned_session
                left join latest_answers on true
                group by
                  owned_session.invited_practice_session_id,
                  owned_session.recruiter_invitation_recipient_id,
                  owned_session.session_status,
                  owned_session.session_attempt_number,
                  owned_session.question_plan_snapshot_json,
                  owned_session.question_wording_questions_json,
                  owned_session.recipient_lifecycle_state,
                  owned_session.first_name,
                  owned_session.last_name,
                  owned_session.email,
                  owned_session.requisition_reference,
                  owned_session.batch_lifecycle_state,
                  owned_session.target_role,
                  owned_session.interview_stage
            `, [recruiterId, sessionId]);

            return result.rows[0] ? mapTranscriptFact(result.rows[0]) : null;
        },
    };
}

export type RecruiterInvitedTranscriptRepository = ReturnType<typeof createRecruiterInvitedTranscriptRepository>;

function mapTranscriptFact(row: Record<string, unknown>): RecruiterInvitedTranscriptFact {
    return {
        sessionId: requireString(row.invited_practice_session_id, "invited_practice_session_id"),
        recipientId: requireString(row.recruiter_invitation_recipient_id, "recruiter_invitation_recipient_id"),
        batchLifecycleState: readLifecycle(row.batch_lifecycle_state, "batch_lifecycle_state"),
        recipientLifecycleState: readLifecycle(row.recipient_lifecycle_state, "recipient_lifecycle_state"),
        firstName: requireString(row.first_name, "first_name"),
        lastName: requireString(row.last_name, "last_name"),
        email: requireString(row.email, "email"),
        requisitionReference: readNullableString(row.requisition_reference),
        targetRole: requireString(row.target_role, "target_role"),
        interviewStage: readInterviewStage(row.interview_stage),
        sessionStatus: readSessionStatus(row.session_status),
        sessionAttemptNumber: readInteger(row.session_attempt_number, "session_attempt_number", 1),
        questionPlanSnapshot: row.question_plan_snapshot_json,
        questionWordingQuestions: readJsonArray(row.question_wording_questions_json, "question_wording_questions_json"),
        latestAnswers: readJsonArray(row.latest_answers_json, "latest_answers_json"),
    };
}

function requireString(value: unknown, field: string) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Recruiter transcript query returned an invalid ${field}.`);
    }
    return value;
}

function readNullableString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readLifecycle(value: unknown, field: string): "ready" | "revoked" {
    if (value === "ready" || value === "revoked") return value;
    throw new Error(`Recruiter transcript query returned an invalid ${field}.`);
}

function readInterviewStage(value: unknown): CandidateSetupStageId {
    if (
        value === "practice_only"
        || value === "screening"
        || value === "first_interview"
        || value === "follow_up"
        || value === "final_interview"
    ) return value;
    throw new Error("Recruiter transcript query returned an invalid interview_stage.");
}

function readSessionStatus(value: unknown): RecruiterInvitedTranscriptFact["sessionStatus"] {
    if (value === "planned" || value === "in_progress" || value === "completed" || value === "abandoned") return value;
    throw new Error("Recruiter transcript query returned an invalid session_status.");
}

function readInteger(value: unknown, field: string, minimum: number) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum) {
        throw new Error(`Recruiter transcript query returned an invalid ${field}.`);
    }
    return parsed;
}

function readJsonArray(value: unknown, field: string) {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) {
        throw new Error(`Recruiter transcript query returned an invalid ${field}.`);
    }
    return parsed;
}
