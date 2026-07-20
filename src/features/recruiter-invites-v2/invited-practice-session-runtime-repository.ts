import type { CandidateSetupSessionCreationResult } from "@/features/candidate-setup-v2/candidate-setup-session-creation";
import type { CandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import type { CandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";
import {
    normalizeCandidateAnswerDrafts,
    normalizeCandidateAnswerIdempotencyRecords,
    normalizeCandidateAnswerSubmissions,
    type CandidateAnswerDraft,
    type CandidateAnswerDrafts,
    type CandidateAnswerIdempotencyRecord,
    type CandidateAnswerIdempotencyRecords,
    type CandidateAnswerSubmission,
    type CandidateAnswerSubmissions,
} from "@/features/candidate-session-v2/candidate-answer-lifecycle";
import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import type { CandidateFeedbackActionEvent } from "@/features/candidate-session-v2/candidate-feedback-interaction";
import type { CandidateProvisionalSessionProgress } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import {
    normalizeSessionRuntimeProgress,
} from "@/features/interview-session-v2/session-runtime-contract";
import type { InvitedSessionCompletionSnapshot } from "@/features/interview-session-v2/session-completion-contract";

export type InvitedPracticeRuntimeQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export type InvitedPracticeSessionRuntimeRecord = {
    invitedPracticeSessionId: string;
    recruiterInvitationRecipientId: string;
    recruiterId: string;
    status: "planned" | "in_progress" | "completed" | "abandoned";
    setupSnapshot: CandidateSetupSessionCreationResult["setupSnapshot"];
    questionPlanSnapshot: CandidateQuestionPlan;
    questionWordingSnapshot: CandidateQuestionWordingResult;
    progress: CandidateProvisionalSessionProgress;
    answerDrafts: CandidateAnswerDrafts;
    answerSubmissions: CandidateAnswerSubmissions;
    answerIdempotencyRecords: CandidateAnswerIdempotencyRecords;
    answerAnalysisSnapshots: Record<string, CandidateAnswerAnalysisProviderResult>;
    feedbackActionEvents: Record<string, CandidateFeedbackActionEvent>;
    completionSnapshot: InvitedSessionCompletionSnapshot | null;
};

export function createInvitedPracticeSessionRuntimeRepository(client: InvitedPracticeRuntimeQueryClient) {
    return {
        async findSession(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
        }) {
            const result = await client.query(`
                select
                  invited_practice_session_id,
                  recruiter_invitation_recipient_id,
                  recruiter_id,
                  status,
                  setup_snapshot_json,
                  question_plan_snapshot_json,
                  question_wording_snapshot_json,
                  progress_state_json,
                  answer_drafts_json,
                  answer_submissions_json,
                  answer_idempotency_json,
                  answer_analysis_snapshots_json,
                  feedback_actions_json,
                  completion_snapshot_json
                from public.invited_practice_sessions
                where invited_practice_session_id = $1
                  and recruiter_invitation_recipient_id = $2
                limit 1
            `, [input.invitedPracticeSessionId, input.recruiterInvitationRecipientId]);

            return toRuntimeRecord(result.rows[0]);
        },

        async saveAnswerDraft(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            draft: CandidateAnswerDraft;
        }) {
            const result = await client.query(`
                update public.invited_practice_sessions
                set answer_drafts_json = jsonb_set(
                  coalesce(answer_drafts_json, '{}'::jsonb),
                  $3::text[],
                  $4::jsonb,
                  true
                )
                where invited_practice_session_id = $1
                  and recruiter_invitation_recipient_id = $2
                  and status in ('planned', 'in_progress')
                returning answer_drafts_json
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                [input.draft.slotId],
                input.draft,
            ]);
            return result.rows[0]
                ? normalizeCandidateAnswerDrafts(result.rows[0].answer_drafts_json)
                : null;
        },

        async saveAnswerSubmission(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            answerSubmission: CandidateAnswerSubmission;
        }) {
            const result = await client.query(`
                update public.invited_practice_sessions
                set status = 'in_progress',
                    answer_submissions_json = jsonb_set(
                      coalesce(answer_submissions_json, '{}'::jsonb),
                      $3::text[],
                      $4::jsonb,
                      true
                    )
                where invited_practice_session_id = $1
                  and recruiter_invitation_recipient_id = $2
                  and status in ('planned', 'in_progress')
                returning answer_submissions_json
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                [input.answerSubmission.slotId],
                input.answerSubmission,
            ]);
            return result.rows[0]
                ? normalizeCandidateAnswerSubmissions(result.rows[0].answer_submissions_json)
                : null;
        },

        async saveAnswerIdempotencyRecord(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            record: CandidateAnswerIdempotencyRecord;
        }) {
            const result = await client.query(`
                update public.invited_practice_sessions
                set answer_idempotency_json = jsonb_set(
                  coalesce(answer_idempotency_json, '{}'::jsonb),
                  $3::text[],
                  $4::jsonb,
                  true
                )
                where invited_practice_session_id = $1
                  and recruiter_invitation_recipient_id = $2
                  and status in ('planned', 'in_progress')
                returning answer_idempotency_json
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                [input.record.recordKey],
                input.record,
            ]);
            return result.rows[0]
                ? normalizeCandidateAnswerIdempotencyRecords(result.rows[0].answer_idempotency_json)
                : null;
        },

        async clearAnswerIdempotencyRecord(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            recordKey: string;
        }) {
            const result = await client.query(`
                update public.invited_practice_sessions
                set answer_idempotency_json = coalesce(answer_idempotency_json, '{}'::jsonb) - $3
                where invited_practice_session_id = $1
                  and recruiter_invitation_recipient_id = $2
                  and status in ('planned', 'in_progress')
                returning answer_idempotency_json
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                input.recordKey,
            ]);
            return result.rows[0]
                ? normalizeCandidateAnswerIdempotencyRecords(result.rows[0].answer_idempotency_json)
                : null;
        },

        async saveAnswerAnalysisSnapshot(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            analysisSnapshot: CandidateAnswerAnalysisProviderResult;
        }) {
            const result = await client.query(`
                update public.invited_practice_sessions
                set answer_analysis_snapshots_json = jsonb_set(
                  coalesce(answer_analysis_snapshots_json, '{}'::jsonb),
                  $3::text[],
                  $4::jsonb,
                  true
                )
                where invited_practice_session_id = $1
                  and recruiter_invitation_recipient_id = $2
                  and status in ('planned', 'in_progress')
                returning answer_analysis_snapshots_json
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                [input.analysisSnapshot.answer.slotId],
                input.analysisSnapshot,
            ]);
            return result.rows[0]
                ? readRecord<CandidateAnswerAnalysisProviderResult>(result.rows[0].answer_analysis_snapshots_json)
                : null;
        },

        async saveFeedbackActionEvent(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            feedbackActionEvent: CandidateFeedbackActionEvent;
        }) {
            const result = await client.query(`
                update public.invited_practice_sessions
                set feedback_actions_json = jsonb_set(
                  coalesce(feedback_actions_json, '{}'::jsonb),
                  $3::text[],
                  $4::jsonb,
                  true
                )
                where invited_practice_session_id = $1
                  and recruiter_invitation_recipient_id = $2
                  and status in ('planned', 'in_progress')
                returning feedback_actions_json
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                [input.feedbackActionEvent.answer.slotId],
                input.feedbackActionEvent,
            ]);
            return result.rows[0]
                ? readRecord<CandidateFeedbackActionEvent>(result.rows[0].feedback_actions_json)
                : null;
        },

        async saveProgress(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            progress: CandidateProvisionalSessionProgress;
        }) {
            const progress = normalizeSessionRuntimeProgress(input.progress);
            const result = await client.query(`
                update public.invited_practice_sessions
                set status = case when $3::jsonb ->> 'status' = 'live_question' then 'in_progress' else status end,
                    progress_state_json = $3::jsonb
                where invited_practice_session_id = $1
                  and recruiter_invitation_recipient_id = $2
                  and status in ('planned', 'in_progress')
                returning progress_state_json
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                progress,
            ]);
            return result.rows[0]
                ? normalizeSessionRuntimeProgress(result.rows[0].progress_state_json)
                : null;
        },

        async completeSession(input: {
            invitedPracticeSessionId: string;
            recruiterInvitationRecipientId: string;
            completionSnapshot: InvitedSessionCompletionSnapshot;
        }) {
            const result = await client.query(`
                with completed as (
                  update public.invited_practice_sessions
                  set status = 'completed',
                      completion_snapshot_json = $3::jsonb,
                      progress_state_json = $4::jsonb
                  where invited_practice_session_id = $1
                    and recruiter_invitation_recipient_id = $2
                    and status in ('planned', 'in_progress')
                    and completion_snapshot_json is null
                  returning completion_snapshot_json, progress_state_json
                ), replayed as (
                  select completion_snapshot_json, progress_state_json
                  from public.invited_practice_sessions
                  where invited_practice_session_id = $1
                    and recruiter_invitation_recipient_id = $2
                    and status = 'completed'
                    and completion_snapshot_json = $3::jsonb
                    and not exists (select 1 from completed)
                )
                select * from completed
                union all
                select * from replayed
                limit 1
            `, [
                input.invitedPracticeSessionId,
                input.recruiterInvitationRecipientId,
                input.completionSnapshot,
                input.completionSnapshot.finalProgress,
            ]);
            const row = result.rows[0];
            return row ? {
                completionSnapshot: normalizeCompletionSnapshot(row.completion_snapshot_json),
                progress: normalizeSessionRuntimeProgress(row.progress_state_json),
            } : null;
        },
    };
}

export type InvitedPracticeSessionRuntimeRepository = ReturnType<
    typeof createInvitedPracticeSessionRuntimeRepository
>;

// Candidate-prefixed route handlers contain the shared V2 orchestration. This
// adapter maps their historical owner field names to invite-owned persistence.
export function createInvitedPracticeCandidateRouteRepositoryAdapter(
    repository: InvitedPracticeSessionRuntimeRepository,
) {
    const owner = (input: { candidatePracticeSessionId: string; candidateProfileId: string }) => ({
        invitedPracticeSessionId: input.candidatePracticeSessionId,
        recruiterInvitationRecipientId: input.candidateProfileId,
    });

    return {
        findSetupSession: (input: { candidatePracticeSessionId: string; candidateProfileId: string }) => (
            repository.findSession(owner(input))
        ),
        saveAnswerDraft: (input: { candidatePracticeSessionId: string; candidateProfileId: string; draft: CandidateAnswerDraft }) => (
            repository.saveAnswerDraft({ ...owner(input), draft: input.draft })
        ),
        saveAnswerSubmission: (input: { candidatePracticeSessionId: string; candidateProfileId: string; answerSubmission: CandidateAnswerSubmission }) => (
            repository.saveAnswerSubmission({ ...owner(input), answerSubmission: input.answerSubmission })
        ),
        saveAnswerIdempotencyRecord: (input: { candidatePracticeSessionId: string; candidateProfileId: string; record: CandidateAnswerIdempotencyRecord }) => (
            repository.saveAnswerIdempotencyRecord({ ...owner(input), record: input.record })
        ),
        clearAnswerIdempotencyRecord: (input: { candidatePracticeSessionId: string; candidateProfileId: string; recordKey: string }) => (
            repository.clearAnswerIdempotencyRecord({ ...owner(input), recordKey: input.recordKey })
        ),
        saveAnswerAnalysisSnapshot: (input: { candidatePracticeSessionId: string; candidateProfileId: string; analysisSnapshot: CandidateAnswerAnalysisProviderResult }) => (
            repository.saveAnswerAnalysisSnapshot({ ...owner(input), analysisSnapshot: input.analysisSnapshot })
        ),
        saveFeedbackActionEvent: (input: { candidatePracticeSessionId: string; candidateProfileId: string; feedbackActionEvent: CandidateFeedbackActionEvent }) => (
            repository.saveFeedbackActionEvent({ ...owner(input), feedbackActionEvent: input.feedbackActionEvent })
        ),
        saveProgress: (input: { candidatePracticeSessionId: string; candidateProfileId: string; progress: CandidateProvisionalSessionProgress }) => (
            repository.saveProgress({ ...owner(input), progress: input.progress })
        ),
    };
}

function toRuntimeRecord(row: Record<string, unknown> | undefined): InvitedPracticeSessionRuntimeRecord | null {
    if (!row) return null;
    const invitedPracticeSessionId = readString(row.invited_practice_session_id);
    const recruiterInvitationRecipientId = readString(row.recruiter_invitation_recipient_id);
    const recruiterId = readString(row.recruiter_id);
    if (!invitedPracticeSessionId || !recruiterInvitationRecipientId || !recruiterId) return null;

    return {
        invitedPracticeSessionId,
        recruiterInvitationRecipientId,
        recruiterId,
        status: readStatus(row.status),
        setupSnapshot: normalizeSetupSnapshot(row.setup_snapshot_json),
        questionPlanSnapshot: row.question_plan_snapshot_json as CandidateQuestionPlan,
        questionWordingSnapshot: row.question_wording_snapshot_json as CandidateQuestionWordingResult,
        progress: normalizeSessionRuntimeProgress(row.progress_state_json),
        answerDrafts: normalizeCandidateAnswerDrafts(row.answer_drafts_json),
        answerSubmissions: normalizeCandidateAnswerSubmissions(row.answer_submissions_json),
        answerIdempotencyRecords: normalizeCandidateAnswerIdempotencyRecords(row.answer_idempotency_json),
        answerAnalysisSnapshots: readRecord<CandidateAnswerAnalysisProviderResult>(row.answer_analysis_snapshots_json),
        feedbackActionEvents: readRecord<CandidateFeedbackActionEvent>(row.feedback_actions_json),
        completionSnapshot: normalizeCompletionSnapshot(row.completion_snapshot_json),
    };
}

function normalizeSetupSnapshot(value: unknown): CandidateSetupSessionCreationResult["setupSnapshot"] {
    const snapshot = isRecord(value) ? value : {};
    const resumeText = typeof snapshot.resumeText === "string" && snapshot.resumeText.trim()
        ? snapshot.resumeText
        : null;
    return {
        targetRole: readString(snapshot.targetRole) ?? "Practice session",
        jobDescription: readString(snapshot.jobDescription) ?? "",
        resumeText,
        interviewStage: readStage(snapshot.interviewStage),
        questionCount: readPositiveInteger(snapshot.questionCount) ?? 1,
        resumeCaptureMode: resumeText ? "pasted_text" : "none",
        createdAt: readDate(snapshot.createdAt).toISOString(),
    };
}

function normalizeCompletionSnapshot(value: unknown): InvitedSessionCompletionSnapshot | null {
    return isRecord(value) && value.status === "invited_session_completed"
        ? value as InvitedSessionCompletionSnapshot
        : null;
}

function readRecord<T>(value: unknown): Record<string, T> {
    return isRecord(value) ? value as Record<string, T> : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}

function readPositiveInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function readDate(value: unknown) {
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.valueOf()) ? new Date(0) : date;
}

function readStatus(value: unknown): InvitedPracticeSessionRuntimeRecord["status"] {
    return value === "in_progress" || value === "completed" || value === "abandoned" ? value : "planned";
}

function readStage(value: unknown): CandidateSetupSessionCreationResult["setupSnapshot"]["interviewStage"] {
    return value === "screening"
        || value === "first_interview"
        || value === "follow_up"
        || value === "final_interview"
        ? value
        : "practice_only";
}
