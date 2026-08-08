import {
    resolveCandidateFollowUpQuestionRoot,
} from "@/features/candidate-practice-v2/candidate-follow-up-session-creation";
import type { CandidateAnswerAttemptRecord } from "@/features/candidate-session-v2/candidate-answer-history";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";

import type { CandidateCoachPlanReference } from "./candidate-coach-plan-reference";
import { createCandidateTranscriptCanvasProjection, type CandidateTranscriptCanvasProjection } from "./candidate-transcript-canvas";
import type { CandidateQuestionPreparednessAcceptedRun } from "./candidate-question-preparedness-progress";

export type CandidateAnswerReviewItem = {
    questionKey: string;
    sourceOccurrence: {
        candidatePracticeSessionId: string;
        questionKey: string;
    };
    canonicalQuestion: {
        candidatePracticeSessionId: string;
        questionKey: string;
    };
    questionNumber: number;
    category: string;
    questionText: string;
    answer: {
        mode: "text" | "voice" | "photo";
        text: string;
        submittedAt: string;
    };
    transcriptCanvas: CandidateTranscriptCanvasProjection | null;
    coachRead: {
        acknowledgement: string;
        observation: string;
        nextPracticeFocus: string;
    };
};

export function createCandidateAnswerReviewItems({
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
}): CandidateAnswerReviewItem[] {
    if (!coachPlan) return [];

    const ownedSessionIds = new Set(
        practiceSessions
            .filter((session) => session.candidateProfileId === candidateProfileId)
            .map((session) => session.candidatePracticeSessionId),
    );
    const questionByKey = new Map(coachPlan.questions.map((question) => [question.questionKey, question]));
    const acceptedRunByAttemptId = selectLatestAcceptedRuns(acceptedRuns);
    const latestByCanonicalQuestion = new Map<string, {
        attempt: CandidateAnswerAttemptRecord;
        run: CandidateQuestionPreparednessAcceptedRun;
    }>();

    for (const attempt of answerAttempts) {
        if (
            attempt.candidateProfileId !== candidateProfileId
            || !ownedSessionIds.has(attempt.candidatePracticeSessionId)
        ) {
            continue;
        }
        const run = acceptedRunByAttemptId.get(attempt.candidateAnswerAttemptId);
        if (!run?.acceptedRun) continue;

        const canonicalQuestion = resolveCandidateFollowUpQuestionRoot({
            candidatePracticeSessionId: attempt.candidatePracticeSessionId,
            questionKey: attempt.questionSlotId,
            existingPracticeSessions: practiceSessions,
        });
        if (
            canonicalQuestion?.candidatePracticeSessionId !== coachPlan.source.baselineCandidatePracticeSessionId
            || !questionByKey.has(canonicalQuestion.questionKey)
        ) {
            continue;
        }

        const current = latestByCanonicalQuestion.get(canonicalQuestion.questionKey);
        if (!current || compareAttempts(current.attempt, attempt) < 0) {
            latestByCanonicalQuestion.set(canonicalQuestion.questionKey, { attempt, run });
        }
    }

    return coachPlan.questions.flatMap((question) => {
        const selected = latestByCanonicalQuestion.get(question.questionKey);
        const accepted = selected?.run.acceptedRun;
        if (!selected || !accepted || !question.questionText) return [];

        const { attempt, run } = selected;
        if (
            accepted.evaluationRunId !== run.candidateAnswerEvaluationRunId
        ) {
            return [];
        }
        const candidateProjection = accepted.accepted.candidateProjection;
        const nextPracticeFocus = candidateProjection.biggestUpgrade
            ?? accepted.accepted.patternGap.upgrade;

        return [{
            questionKey: attempt.questionSlotId,
            sourceOccurrence: {
                candidatePracticeSessionId: attempt.candidatePracticeSessionId,
                questionKey: attempt.questionSlotId,
            },
            canonicalQuestion: {
                candidatePracticeSessionId: coachPlan.source.baselineCandidatePracticeSessionId,
                questionKey: question.questionKey,
            },
            questionNumber: question.questionNumber,
            category: question.categoryLabel,
            questionText: question.questionText,
            answer: {
                mode: attempt.mode,
                text: attempt.answerText,
                submittedAt: attempt.submittedAt,
            },
            transcriptCanvas: createCandidateTranscriptCanvasProjection({
                acceptedRun: accepted,
                evaluation: {
                    evaluationRunId: run.candidateAnswerEvaluationRunId,
                    answerAttemptId: attempt.candidateAnswerAttemptId,
                    inputFingerprint: accepted.inputFingerprint,
                },
                answerAttempt: attempt,
            }),
            coachRead: {
                acknowledgement: candidateProjection.acknowledgement,
                observation: candidateProjection.primaryStrength ?? candidateProjection.acknowledgement,
                nextPracticeFocus,
            },
        } satisfies CandidateAnswerReviewItem];
    });
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

function compareAttempts(left: CandidateAnswerAttemptRecord, right: CandidateAnswerAttemptRecord) {
    return left.submittedAt.localeCompare(right.submittedAt)
        || left.createdAt.localeCompare(right.createdAt)
        || left.candidateAnswerAttemptId.localeCompare(right.candidateAnswerAttemptId);
}
