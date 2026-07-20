import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    parseCandidateQuestionWordingResult,
    type CandidateQuestionWordingResult,
} from "@/features/candidate-session-v2/candidate-question-wording";
import {
    parseCandidatePracticePlanBaselineSnapshot,
    type CandidatePracticePlanBaselineSnapshot,
} from "./candidate-practice-plan-baseline";

export type CandidatePracticePlanBaselineQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

export type CandidatePracticePlanBaselineRecord = {
    candidateProfileId: string;
    roleProfileId: string;
    snapshot: CandidatePracticePlanBaselineSnapshot;
    questionWordingSnapshot: CandidateQuestionWordingResult;
};

export function createCandidatePracticePlanBaselineRepository(
    client: CandidatePracticePlanBaselineQueryClient,
) {
    return {
        async listForCandidate(input: { candidateProfileId: string }) {
            const result = await client.query(`
                select
                  candidate_profile_id,
                  role_profile_id,
                  rigor_baseline_snapshot_json,
                  rigor_baseline_question_wording_snapshot_json
                from public.candidate_role_preparation_profiles
                where candidate_profile_id = $1
                  and status in ('active', 'paused')
                  and rigor_baseline_snapshot_json is not null
                  and rigor_baseline_question_wording_snapshot_json is not null
            `, [input.candidateProfileId]);
            return result.rows
                .map(toCandidatePracticePlanBaselineRecord)
                .filter((record): record is CandidatePracticePlanBaselineRecord => Boolean(record));
        },
        async findForCandidateRoleProfile(input: { candidateProfileId: string; roleProfileId: string }) {
            const result = await client.query(`
                select
                  candidate_profile_id,
                  role_profile_id,
                  rigor_baseline_snapshot_json,
                  rigor_baseline_question_wording_snapshot_json
                from public.candidate_role_preparation_profiles
                where candidate_profile_id = $1
                  and role_profile_id = $2
                  and status in ('active', 'paused')
                  and rigor_baseline_snapshot_json is not null
                  and rigor_baseline_question_wording_snapshot_json is not null
                limit 1
            `, [input.candidateProfileId, input.roleProfileId]);
            return toCandidatePracticePlanBaselineRecord(result.rows[0]);
        },
    };
}

export function createCandidateBaselineAwarePracticeSessions({
    practiceSessions,
    baseline,
}: {
    practiceSessions: CandidatePracticeSessionRecord[];
    baseline: CandidatePracticePlanBaselineRecord | null;
}) {
    if (!baseline) {
        return practiceSessions;
    }
    const anchor = [...practiceSessions]
        .filter((session) => (
            session.candidateProfileId === baseline.candidateProfileId
            && session.roleProfileId === baseline.roleProfileId
            && !hasFollowUpPractice(session.setupSnapshot)
        ))
        .sort((left, right) => (
            left.setupSnapshot.createdAt.localeCompare(right.setupSnapshot.createdAt)
            || left.candidatePracticeSessionId.localeCompare(right.candidatePracticeSessionId)
        ))[0];
    if (!anchor) {
        return practiceSessions;
    }
    return practiceSessions.map((session) => session.candidatePracticeSessionId === anchor.candidatePracticeSessionId
        ? {
            ...session,
            questionPlanSnapshot: baseline.snapshot,
            questionWordingSnapshot: {
                ...baseline.questionWordingSnapshot,
                questions: [
                    ...baseline.questionWordingSnapshot.questions,
                    ...(anchor.questionWordingSnapshot?.questions.filter((question) => (
                        !baseline.questionWordingSnapshot.questions.some((baselineQuestion) => (
                            baselineQuestion.slotId === question.slotId
                        ))
                    )) ?? []),
                ],
            },
        }
        : session);
}

function toCandidatePracticePlanBaselineRecord(row: Record<string, unknown> | undefined) {
    const candidateProfileId = readString(row?.candidate_profile_id);
    const roleProfileId = readString(row?.role_profile_id);
    const snapshot = parseCandidatePracticePlanBaselineSnapshot(row?.rigor_baseline_snapshot_json);
    if (!candidateProfileId || !roleProfileId || !snapshot) {
        return null;
    }
    try {
        return {
            candidateProfileId,
            roleProfileId,
            snapshot,
            questionWordingSnapshot: parseCandidateQuestionWordingResult(
                row?.rigor_baseline_question_wording_snapshot_json,
                snapshot,
            ),
        } satisfies CandidatePracticePlanBaselineRecord;
    } catch {
        return null;
    }
}

function hasFollowUpPractice(value: unknown) {
    return Boolean(
        value
        && typeof value === "object"
        && !Array.isArray(value)
        && "followUpPractice" in value
        && (value as { followUpPractice?: unknown }).followUpPractice,
    );
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
