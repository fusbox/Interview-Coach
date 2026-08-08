import {
    resolveCandidateFollowUpQuestionRoot,
} from "@/features/candidate-practice-v2/candidate-follow-up-session-creation";
import type { CandidateAnswerAttemptRecord } from "@/features/candidate-session-v2/candidate-answer-history";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type {
    CriterionAppraisal,
    EvidenceExtractionOutput,
} from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import type { CompatiblePersistedAcceptedEvidenceFirstEvaluatorRun } from "@/features/evaluation-v2/evidence-first-evaluator-runtime";
import {
    compareQuestionPreparednessBands,
    deriveQuestionPreparedness,
    type QuestionPreparednessBand,
    type QuestionPreparednessResult,
} from "@/features/evaluation-v2/question-preparedness";

import type { CandidateCoachPlanReference } from "./candidate-coach-plan-reference";

export type CandidateQuestionPreparednessAcceptedRun = {
    candidateAnswerAttemptId: string;
    candidateAnswerEvaluationRunId: string;
    completedAt: string;
    extraction: Pick<EvidenceExtractionOutput, "answerUsability" | "technicalAccuracy">;
    criteria: CriterionAppraisal[];
    acceptedRun?: CompatiblePersistedAcceptedEvidenceFirstEvaluatorRun;
};

export type CandidateQuestionPreparednessProgress = {
    status: "candidate_question_preparedness_progress";
    source: {
        persistence: "read_time_projection";
        durableFacts: [
            "candidate_practice_plan_baselines",
            "candidate_practice_sessions",
            "candidate_answer_attempts",
            "candidate_answer_evaluation_runs",
        ];
        bandSelection: "highest_earned";
        regressionPolicy: "deferred_keep_highest";
    };
    coverage: {
        canonicalQuestionCount: number;
        unpracticedQuestionCount: number;
        attemptedQuestionCount: number;
        evaluatedQuestionCount: number;
        incompleteQuestionCount: number;
        evaluationUnavailableQuestionCount: number;
    };
    achievement: Record<QuestionPreparednessBand, number>;
    questions: CandidateQuestionPreparednessItem[];
};

export type CandidateQuestionPreparednessItem = {
    questionKey: string;
    questionNumber: number;
    category: CandidateCoachPlanReference["questions"][number]["category"];
    questionText: string | null;
    attemptCount: number;
    evaluatedAttemptCount: number;
    state: "not_practiced" | "evaluation_unavailable" | "incomplete" | "rated";
    band: QuestionPreparednessBand | null;
    highestEarnedAttemptId: string | null;
    latestAttempt: {
        candidateAnswerAttemptId: string;
        submittedAt: string;
        result: QuestionPreparednessResult | { status: "evaluation_unavailable" };
    } | null;
};

export function createCandidateQuestionPreparednessProgress({
    candidateProfileId,
    practiceSessions,
    coachPlan,
    answerAttempts,
    acceptedRuns,
}: {
    candidateProfileId: string;
    practiceSessions: CandidatePracticeSessionRecord[];
    coachPlan: CandidateCoachPlanReference | null;
    answerAttempts: CandidateAnswerAttemptRecord[];
    acceptedRuns: CandidateQuestionPreparednessAcceptedRun[];
}): CandidateQuestionPreparednessProgress | null {
    if (!coachPlan) return null;

    const ownedSessionIds = new Set(
        practiceSessions
            .filter((session) => session.candidateProfileId === candidateProfileId)
            .map((session) => session.candidatePracticeSessionId),
    );
    const acceptedRunByAttemptId = selectLatestAcceptedRuns(acceptedRuns);
    const attemptsByQuestionKey = new Map<string, Array<{
        attempt: CandidateAnswerAttemptRecord;
        result: QuestionPreparednessResult | null;
    }>>();

    for (const attempt of answerAttempts) {
        if (
            attempt.candidateProfileId !== candidateProfileId
            || !ownedSessionIds.has(attempt.candidatePracticeSessionId)
        ) {
            continue;
        }
        const root = resolveCandidateFollowUpQuestionRoot({
            candidatePracticeSessionId: attempt.candidatePracticeSessionId,
            questionKey: attempt.questionSlotId,
            existingPracticeSessions: practiceSessions,
        });
        if (root?.candidatePracticeSessionId !== coachPlan.source.baselineCandidatePracticeSessionId) {
            continue;
        }
        const run = acceptedRunByAttemptId.get(attempt.candidateAnswerAttemptId);
        const result = run
            ? deriveQuestionPreparedness({
                answerUsability: run.extraction.answerUsability,
                technicalAccuracy: run.extraction.technicalAccuracy,
                criteria: run.criteria,
            })
            : null;
        const existing = attemptsByQuestionKey.get(root.questionKey) ?? [];
        existing.push({ attempt, result });
        attemptsByQuestionKey.set(root.questionKey, existing);
    }

    const questions = coachPlan.questions.map((question) => createQuestionItem(
        question,
        attemptsByQuestionKey.get(question.questionKey) ?? [],
    ));
    const achievement = {
        emerging: questions.filter((question) => question.band === "emerging").length,
        clear: questions.filter((question) => question.band === "clear").length,
        strong: questions.filter((question) => question.band === "strong").length,
    };

    return {
        status: "candidate_question_preparedness_progress",
        source: {
            persistence: "read_time_projection",
            durableFacts: [
                "candidate_practice_plan_baselines",
                "candidate_practice_sessions",
                "candidate_answer_attempts",
                "candidate_answer_evaluation_runs",
            ],
            bandSelection: "highest_earned",
            regressionPolicy: "deferred_keep_highest",
        },
        coverage: {
            canonicalQuestionCount: questions.length,
            unpracticedQuestionCount: questions.filter((question) => question.state === "not_practiced").length,
            attemptedQuestionCount: questions.filter((question) => question.attemptCount > 0).length,
            evaluatedQuestionCount: questions.filter((question) => question.evaluatedAttemptCount > 0).length,
            incompleteQuestionCount: questions.filter((question) => question.state === "incomplete").length,
            evaluationUnavailableQuestionCount: questions.filter((
                question,
            ) => question.state === "evaluation_unavailable").length,
        },
        achievement,
        questions,
    };
}

function createQuestionItem(
    question: CandidateCoachPlanReference["questions"][number],
    attemptFacts: Array<{
        attempt: CandidateAnswerAttemptRecord;
        result: QuestionPreparednessResult | null;
    }>,
): CandidateQuestionPreparednessItem {
    const ordered = [...attemptFacts].sort((left, right) => (
        left.attempt.submittedAt.localeCompare(right.attempt.submittedAt)
        || left.attempt.createdAt.localeCompare(right.attempt.createdAt)
        || left.attempt.candidateAnswerAttemptId.localeCompare(right.attempt.candidateAnswerAttemptId)
    ));
    const latest = ordered.at(-1) ?? null;
    const rated = ordered.filter((fact): fact is typeof fact & {
        result: Extract<QuestionPreparednessResult, { status: "rated" }>;
    } => fact.result?.status === "rated");
    const highest = rated.reduce<(typeof rated)[number] | null>((current, candidate) => {
        if (!current) return candidate;
        return compareQuestionPreparednessBands(candidate.result.band, current.result.band) > 0
            ? candidate
            : current;
    }, null);
    const hasIncomplete = ordered.some((fact) => fact.result?.status === "incomplete");
    const evaluatedAttemptCount = ordered.filter((fact) => fact.result !== null).length;
    const state = highest
        ? "rated" as const
        : ordered.length === 0
            ? "not_practiced" as const
            : hasIncomplete
                ? "incomplete" as const
                : "evaluation_unavailable" as const;

    return {
        questionKey: question.questionKey,
        questionNumber: question.questionNumber,
        category: question.category,
        questionText: question.questionText,
        attemptCount: ordered.length,
        evaluatedAttemptCount,
        state,
        band: highest?.result.band ?? null,
        highestEarnedAttemptId: highest?.attempt.candidateAnswerAttemptId ?? null,
        latestAttempt: latest
            ? {
                candidateAnswerAttemptId: latest.attempt.candidateAnswerAttemptId,
                submittedAt: latest.attempt.submittedAt,
                result: latest.result ?? { status: "evaluation_unavailable" },
            }
            : null,
    };
}

function selectLatestAcceptedRuns(acceptedRuns: CandidateQuestionPreparednessAcceptedRun[]) {
    const byAttemptId = new Map<string, CandidateQuestionPreparednessAcceptedRun>();
    for (const run of acceptedRuns) {
        const current = byAttemptId.get(run.candidateAnswerAttemptId);
        if (
            !current
            || run.completedAt.localeCompare(current.completedAt) > 0
            || (
                run.completedAt === current.completedAt
                && run.candidateAnswerEvaluationRunId.localeCompare(current.candidateAnswerEvaluationRunId) > 0
            )
        ) {
            byAttemptId.set(run.candidateAnswerAttemptId, run);
        }
    }
    return byAttemptId;
}
