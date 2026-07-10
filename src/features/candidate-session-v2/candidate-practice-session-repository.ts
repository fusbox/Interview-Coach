import type { CandidateSetupSessionCreationResult } from "@/features/candidate-setup-v2/candidate-setup-session-creation";
import {
    normalizeCandidateAnswerDrafts,
    normalizeCandidateAnswerSubmissions,
    type CandidateAnswerDraft,
    type CandidateAnswerDrafts,
    type CandidateAnswerSubmission,
    type CandidateAnswerSubmissions,
} from "./candidate-answer-lifecycle";
import type { CandidateProvisionalSessionProgress } from "./candidate-provisional-session-store";
import { normalizeSessionRuntimeProgress } from "@/features/interview-session-v2/session-runtime-contract";
import type { CandidateQuestionPlan } from "./candidate-question-plan";
import type {
    CandidateQuestionWordingResult,
    CandidateQuestionWordingUnavailableResult,
} from "./candidate-question-wording";
import type { CandidateAnswerAnalysisProviderResult } from "./candidate-answer-analysis-adapter";

export type CandidatePracticeSessionQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export type CandidatePracticeSessionWordingStatus =
    | "not_requested"
    | "provider_not_configured"
    | "worded"
    | "failed";

export type CandidatePracticeSessionRecord = {
    candidatePracticeSessionId: string;
    candidateProfileId: string;
    roleProfileId: string | null;
    candidateLaunchSessionId: string | null;
    status: "planned" | "in_progress" | "completed" | "abandoned";
    setupSnapshot: CandidateSetupSessionCreationResult["setupSnapshot"];
    questionPlanSnapshot: CandidateQuestionPlan;
    questionWordingSnapshot: CandidateQuestionWordingResult | null;
    questionWordingStatus: CandidatePracticeSessionWordingStatus;
    progress: CandidateProvisionalSessionProgress;
    answerDrafts: CandidateAnswerDrafts;
    answerSubmissions: CandidateAnswerSubmissions;
    answerAnalysisSnapshots: CandidateAnswerAnalysisSnapshots;
};

export type CandidateAnswerAnalysisSnapshots = Record<string, CandidateAnswerAnalysisProviderResult>;

export type CreateCandidatePracticeSessionInput = {
    candidateProfileId: string;
    roleProfileId?: string | null;
    candidateLaunchSessionId?: string | null;
    setupSnapshot: CandidateSetupSessionCreationResult["setupSnapshot"];
    questionPlanSnapshot: CandidateQuestionPlan;
    questionWordingSnapshot?: CandidateQuestionWordingResult | CandidateQuestionWordingUnavailableResult | null;
    progress?: CandidateProvisionalSessionProgress;
    answerDrafts?: CandidateAnswerDrafts;
    answerSubmissions?: CandidateAnswerSubmissions;
};

export function createCandidatePracticeSessionRepository(client: CandidatePracticeSessionQueryClient) {
    return {
        async createSetupSession(input: CreateCandidatePracticeSessionInput) {
            const questionWordingStatus = toQuestionWordingStatus(input.questionWordingSnapshot);
            const questionWordingSnapshot = input.questionWordingSnapshot?.status === "questions_worded"
                ? input.questionWordingSnapshot
                : null;
            const progress = normalizeProgress(input.progress);

            const result = await client.query(`
                insert into public.candidate_practice_sessions (
                  candidate_profile_id,
                  role_profile_id,
                  candidate_launch_session_id,
                  status,
                  setup_snapshot_json,
                  question_plan_snapshot_json,
                  question_wording_snapshot_json,
                  question_wording_status,
                  progress_state_json,
                  answer_drafts_json
                )
                values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10::jsonb)
                returning candidate_practice_session_id
            `, [
                input.candidateProfileId,
                input.roleProfileId ?? null,
                input.candidateLaunchSessionId ?? null,
                "planned",
                input.setupSnapshot,
                input.questionPlanSnapshot,
                questionWordingSnapshot,
                questionWordingStatus,
                progress,
                input.answerDrafts ?? {},
            ]);

            const candidatePracticeSessionId = readString(result.rows[0]?.candidate_practice_session_id);
            return candidatePracticeSessionId ? { candidatePracticeSessionId } : null;
        },

        async findSetupSession(input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
        }) {
            const result = await client.query(`
                select
                  candidate_practice_session_id,
                  candidate_profile_id,
                  role_profile_id,
                  candidate_launch_session_id,
                  status,
                  setup_snapshot_json,
                  question_plan_snapshot_json,
                  question_wording_snapshot_json,
                  question_wording_status,
                  progress_state_json,
                  answer_drafts_json,
                  answer_submissions_json,
                  answer_analysis_snapshots_json
                from public.candidate_practice_sessions
                where candidate_practice_session_id = $1
                  and candidate_profile_id = $2
                limit 1
            `, [
                input.candidatePracticeSessionId,
                input.candidateProfileId,
            ]);

            return toCandidatePracticeSessionRecord(result.rows[0]);
        },

        async saveAnswerDraft(input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
            draft: CandidateAnswerDraft;
        }) {
            const result = await client.query(`
                update public.candidate_practice_sessions
                set answer_drafts_json = jsonb_set(
                  coalesce(answer_drafts_json, '{}'::jsonb),
                  $3::text[],
                  $4::jsonb,
                  true
                )
                where candidate_practice_session_id = $1
                  and candidate_profile_id = $2
                returning answer_drafts_json
            `, [
                input.candidatePracticeSessionId,
                input.candidateProfileId,
                [input.draft.slotId],
                input.draft,
            ]);

            return result.rows[0]
                ? normalizeCandidateAnswerDrafts(result.rows[0].answer_drafts_json)
                : null;
        },

        async saveAnswerSubmission(input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
            answerSubmission: CandidateAnswerSubmission;
        }) {
            const result = await client.query(`
                update public.candidate_practice_sessions
                set answer_submissions_json = jsonb_set(
                  coalesce(answer_submissions_json, '{}'::jsonb),
                  $3::text[],
                  $4::jsonb,
                  true
                )
                where candidate_practice_session_id = $1
                  and candidate_profile_id = $2
                returning answer_submissions_json
            `, [
                input.candidatePracticeSessionId,
                input.candidateProfileId,
                [input.answerSubmission.slotId],
                input.answerSubmission,
            ]);

            return result.rows[0]
                ? normalizeCandidateAnswerSubmissions(result.rows[0].answer_submissions_json)
                : null;
        },

        async saveAnswerAnalysisSnapshot(input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
            analysisSnapshot: CandidateAnswerAnalysisProviderResult;
        }) {
            const result = await client.query(`
                update public.candidate_practice_sessions
                set answer_analysis_snapshots_json = jsonb_set(
                  coalesce(answer_analysis_snapshots_json, '{}'::jsonb),
                  $3::text[],
                  $4::jsonb,
                  true
                )
                where candidate_practice_session_id = $1
                  and candidate_profile_id = $2
                returning answer_analysis_snapshots_json
            `, [
                input.candidatePracticeSessionId,
                input.candidateProfileId,
                [input.analysisSnapshot.answer.slotId],
                input.analysisSnapshot,
            ]);

            return result.rows[0]
                ? normalizeCandidateAnswerAnalysisSnapshots(result.rows[0].answer_analysis_snapshots_json)
                : null;
        },

        async saveProgress(input: {
            candidatePracticeSessionId: string;
            candidateProfileId: string;
            progress: CandidateProvisionalSessionProgress;
        }) {
            const progress = normalizeProgress(input.progress);
            const result = await client.query(`
                update public.candidate_practice_sessions
                set progress_state_json = $3::jsonb
                where candidate_practice_session_id = $1
                  and candidate_profile_id = $2
                returning progress_state_json
            `, [
                input.candidatePracticeSessionId,
                input.candidateProfileId,
                progress,
            ]);

            return result.rows[0]
                ? normalizeProgress(result.rows[0].progress_state_json)
                : null;
        },
    };
}

function toCandidatePracticeSessionRecord(row: Record<string, unknown> | undefined): CandidatePracticeSessionRecord | null {
    if (!row) {
        return null;
    }

    const candidatePracticeSessionId = readString(row.candidate_practice_session_id);
    const candidateProfileId = readString(row.candidate_profile_id);
    if (!candidatePracticeSessionId || !candidateProfileId) {
        return null;
    }

    return {
        candidatePracticeSessionId,
        candidateProfileId,
        roleProfileId: readNullableString(row.role_profile_id),
        candidateLaunchSessionId: readNullableString(row.candidate_launch_session_id),
        status: readStatus(row.status),
        setupSnapshot: row.setup_snapshot_json as CandidateSetupSessionCreationResult["setupSnapshot"],
        questionPlanSnapshot: row.question_plan_snapshot_json as CandidateQuestionPlan,
        questionWordingSnapshot: row.question_wording_snapshot_json
            ? row.question_wording_snapshot_json as CandidateQuestionWordingResult
            : null,
        questionWordingStatus: readQuestionWordingStatus(row.question_wording_status),
        progress: normalizeProgress(row.progress_state_json),
        answerDrafts: normalizeCandidateAnswerDrafts(row.answer_drafts_json),
        answerSubmissions: normalizeCandidateAnswerSubmissions(row.answer_submissions_json),
        answerAnalysisSnapshots: normalizeCandidateAnswerAnalysisSnapshots(row.answer_analysis_snapshots_json),
    };
}

function normalizeCandidateAnswerAnalysisSnapshots(value: unknown): CandidateAnswerAnalysisSnapshots {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as CandidateAnswerAnalysisSnapshots;
}

function toQuestionWordingStatus(
    snapshot?: CandidateQuestionWordingResult | CandidateQuestionWordingUnavailableResult | null,
): CandidatePracticeSessionWordingStatus {
    if (!snapshot) {
        return "not_requested";
    }

    if (snapshot.status === "questions_worded") {
        return "worded";
    }

    return snapshot.reason;
}

function normalizeProgress(value: unknown): CandidateProvisionalSessionProgress {
    return normalizeSessionRuntimeProgress(value);
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}

function readNullableString(value: unknown) {
    return value === null || value === undefined ? null : readString(value);
}

function readStatus(value: unknown): CandidatePracticeSessionRecord["status"] {
    return value === "in_progress" || value === "completed" || value === "abandoned" ? value : "planned";
}

function readQuestionWordingStatus(value: unknown): CandidatePracticeSessionWordingStatus {
    return value === "provider_not_configured" || value === "worded" || value === "failed" ? value : "not_requested";
}
