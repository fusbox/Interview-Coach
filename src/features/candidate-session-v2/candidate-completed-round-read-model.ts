import { createCandidateAnswerCoachingFacts } from "./candidate-coaching-facts";
import type { CandidateQuestionPlanCategory } from "./candidate-question-plan";
import type { CandidatePracticeSessionRecord } from "./candidate-practice-session-repository";
import type { CandidateAnswerSubmission } from "./candidate-answer-lifecycle";

export type CandidateCompletedRoundReadModels = {
    status: "candidate_completed_round_read_models";
    round: CandidateCompletedRoundSummary;
    dashboardUpdate: CandidateDashboardCoachUpdate;
    postRoundReview: CandidatePostRoundReview;
    practiceNext: CandidatePracticeNext;
};

export type CandidateCompletedRoundSummary = {
    candidatePracticeSessionId: string;
    targetRole: string;
    interviewStage: string;
    completedAt: string;
    questionCount: number;
    answeredCount: number;
    coachedCount: number;
    skippedOrUnansweredCount: number;
    attemptContext?: CandidateSessionAttemptContext;
};

export type CandidateSessionAttemptContext = {
    isFollowUpPractice: true;
    sessionAttemptNumber: number;
    sourceIntentId: string;
    itemCount: number;
};

export type CandidateDashboardCoachUpdate = {
    status: "candidate_dashboard_coach_update_ready";
    candidatePracticeSessionId: string;
    title: string;
    body: string;
    href: string;
    completedAt: string;
    answeredCount: number;
    questionCount: number;
    coachingPreview?: {
        questionKey: string;
        questionNumber: number;
        category: string;
        observation: string;
        nextPracticeFocus: string;
    };
};

export type CandidatePostRoundReview = {
    status: "candidate_post_round_review_ready";
    candidatePracticeSessionId: string;
    targetRole: string;
    completedAt: string;
    answeredCount: number;
    questionCount: number;
    questions: CandidatePostRoundReviewQuestion[];
};

export type CandidatePostRoundReviewQuestion = {
    questionKey: string;
    questionNumber: number;
    category: string;
    questionText: string;
    status: "practiced" | "skipped_or_unanswered";
    answer?: {
        mode: CandidateAnswerSubmission["mode"];
        text: string;
        submittedAt: string;
    };
    coaching?: {
        acknowledgement: string;
        observation: string;
        nextPracticeFocus: string;
        recommendedMove: string;
    };
    attemptContext?: CandidateQuestionAttemptContext;
};

export type CandidateQuestionAttemptContext = {
    isFollowUpPractice: true;
    sessionAttemptNumber: number;
    questionAttemptNumber: number;
    sourceCandidatePracticeSessionId: string;
    sourceQuestionKey: string;
    rootSourceCandidatePracticeSessionId?: string;
    rootSourceQuestionKey?: string;
    sourceQuestionNumber: number;
    practiceKind: "practice_from_feedback" | "practice_missing_evidence";
};

export type CandidatePracticeNext = {
    status: "candidate_practice_next_ready";
    source: "unanswered_question" | "coaching_focus" | "new_round";
    label: string;
    reason: string;
    href: string;
    questionKeys: string[];
};

export function createCandidateCompletedRoundReadModels(
    session: CandidatePracticeSessionRecord,
): CandidateCompletedRoundReadModels | null {
    if (session.status !== "completed" || !session.completionSnapshot || !session.questionWordingSnapshot) {
        return null;
    }

    const completion = session.completionSnapshot;
    const followUpPractice = readFollowUpPractice(session.setupSnapshot);
    const questions = session.questionWordingSnapshot.questions.map((question) => {
        const answerSubmission = session.answerSubmissions[question.slotId];
        const analysisSnapshot = session.answerAnalysisSnapshots[question.slotId];
        const coachingFacts = analysisSnapshot ? createCandidateAnswerCoachingFacts(analysisSnapshot) : null;
        const followUpItem = followUpPractice?.items.find((item) => item.localSlotId === question.slotId);

        return {
            questionKey: question.slotId,
            questionNumber: question.index + 1,
            category: labelForCategory(question.category),
            questionText: question.questionText,
            status: answerSubmission ? "practiced" as const : "skipped_or_unanswered" as const,
            ...(answerSubmission
                ? {
                    answer: {
                        mode: answerSubmission.mode,
                        text: answerSubmission.text,
                        submittedAt: answerSubmission.submittedAt,
                    },
                }
                : {}),
            ...(coachingFacts
                ? {
                    coaching: {
                        acknowledgement: coachingFacts.coachFeedback.acknowledgement,
                        observation: coachingFacts.coachFeedback.observation,
                        nextPracticeFocus: coachingFacts.coachFeedback.nextPracticeFocus,
                        recommendedMove: analysisSnapshot.evidenceFirst.candidateFeedback.biggestUpgrade
                            ?? coachingFacts.appraisal.patternGap.upgrade
                            ?? coachingFacts.coachFeedback.observation,
                    },
                }
                : {}),
            ...(followUpPractice && followUpItem
                ? {
                    attemptContext: {
                        isFollowUpPractice: true as const,
                        sessionAttemptNumber: followUpPractice.sessionAttemptNumber,
                        questionAttemptNumber: followUpItem.questionAttemptNumber,
                        sourceCandidatePracticeSessionId: followUpItem.sourceCandidatePracticeSessionId,
                        sourceQuestionKey: followUpItem.sourceQuestionKey,
                        ...(followUpItem.rootSourceCandidatePracticeSessionId
                            ? { rootSourceCandidatePracticeSessionId: followUpItem.rootSourceCandidatePracticeSessionId }
                            : {}),
                        ...(followUpItem.rootSourceQuestionKey
                            ? { rootSourceQuestionKey: followUpItem.rootSourceQuestionKey }
                            : {}),
                        sourceQuestionNumber: followUpItem.sourceQuestionNumber,
                        practiceKind: followUpItem.practiceKind,
                    },
                }
                : {}),
        };
    });
    const firstCoachedQuestion = questions.find((question) => question.coaching);

    return {
        status: "candidate_completed_round_read_models",
        round: {
            candidatePracticeSessionId: session.candidatePracticeSessionId,
            targetRole: session.setupSnapshot.targetRole,
            interviewStage: session.setupSnapshot.interviewStage,
            completedAt: completion.completedAt,
            questionCount: completion.questionCount,
            answeredCount: completion.answeredCount,
            coachedCount: completion.coachedCount,
            skippedOrUnansweredCount: completion.skippedOrUnansweredQuestionKeys.length,
            ...(followUpPractice
                ? {
                    attemptContext: {
                        isFollowUpPractice: true,
                        sessionAttemptNumber: followUpPractice.sessionAttemptNumber,
                        sourceIntentId: followUpPractice.sourceIntentId,
                        itemCount: followUpPractice.itemCount,
                    },
                }
                : {}),
        },
        dashboardUpdate: {
            status: "candidate_dashboard_coach_update_ready",
            candidatePracticeSessionId: session.candidatePracticeSessionId,
            title: `${session.setupSnapshot.targetRole} practice complete`,
            body: buildDashboardUpdateBody(completion.answeredCount, completion.questionCount, completion.coachedCount),
            href: completion.nextRoute,
            completedAt: completion.completedAt,
            answeredCount: completion.answeredCount,
            questionCount: completion.questionCount,
            ...(firstCoachedQuestion?.coaching
                ? {
                    coachingPreview: {
                        questionKey: firstCoachedQuestion.questionKey,
                        questionNumber: firstCoachedQuestion.questionNumber,
                        category: firstCoachedQuestion.category,
                        observation: firstCoachedQuestion.coaching.observation,
                        nextPracticeFocus: firstCoachedQuestion.coaching.nextPracticeFocus,
                    },
                }
                : {}),
        },
        postRoundReview: {
            status: "candidate_post_round_review_ready",
            candidatePracticeSessionId: session.candidatePracticeSessionId,
            targetRole: session.setupSnapshot.targetRole,
            completedAt: completion.completedAt,
            answeredCount: completion.answeredCount,
            questionCount: completion.questionCount,
            questions,
        },
        practiceNext: buildPracticeNext(session, completion.skippedOrUnansweredQuestionKeys, firstCoachedQuestion),
    };
}

type FollowUpPracticeSnapshot = {
    status: "candidate_follow_up_practice_session";
    sourceIntentId: string;
    sessionAttemptNumber: number;
    itemCount: number;
    items: Array<{
        localSlotId: string;
        sourceCandidatePracticeSessionId: string;
        sourceQuestionKey: string;
        rootSourceCandidatePracticeSessionId?: string;
        rootSourceQuestionKey?: string;
        sourceQuestionNumber: number;
        questionAttemptNumber: number;
        practiceKind: "practice_from_feedback" | "practice_missing_evidence";
    }>;
};

function readFollowUpPractice(setupSnapshot: unknown): FollowUpPracticeSnapshot | null {
    if (!setupSnapshot || typeof setupSnapshot !== "object" || Array.isArray(setupSnapshot)) {
        return null;
    }

    const followUpPractice = (setupSnapshot as { followUpPractice?: unknown }).followUpPractice;
    if (!followUpPractice || typeof followUpPractice !== "object" || Array.isArray(followUpPractice)) {
        return null;
    }

    const record = followUpPractice as {
        status?: unknown;
        sourceIntentId?: unknown;
        sessionAttemptNumber?: unknown;
        itemCount?: unknown;
        items?: unknown;
    };
    if (
        record.status !== "candidate_follow_up_practice_session"
        || typeof record.sourceIntentId !== "string"
        || typeof record.sessionAttemptNumber !== "number"
        || typeof record.itemCount !== "number"
        || !Array.isArray(record.items)
    ) {
        return null;
    }

    const items = record.items.filter((item): item is FollowUpPracticeSnapshot["items"][number] => (
        Boolean(item)
        && typeof item === "object"
        && !Array.isArray(item)
        && typeof (item as { localSlotId?: unknown }).localSlotId === "string"
        && typeof (item as { sourceCandidatePracticeSessionId?: unknown }).sourceCandidatePracticeSessionId === "string"
        && typeof (item as { sourceQuestionKey?: unknown }).sourceQuestionKey === "string"
        && (
            (item as { rootSourceCandidatePracticeSessionId?: unknown }).rootSourceCandidatePracticeSessionId === undefined
            || typeof (item as { rootSourceCandidatePracticeSessionId?: unknown }).rootSourceCandidatePracticeSessionId === "string"
        )
        && (
            (item as { rootSourceQuestionKey?: unknown }).rootSourceQuestionKey === undefined
            || typeof (item as { rootSourceQuestionKey?: unknown }).rootSourceQuestionKey === "string"
        )
        && typeof (item as { sourceQuestionNumber?: unknown }).sourceQuestionNumber === "number"
        && typeof (item as { questionAttemptNumber?: unknown }).questionAttemptNumber === "number"
        && (
            (item as { practiceKind?: unknown }).practiceKind === "practice_from_feedback"
            || (item as { practiceKind?: unknown }).practiceKind === "practice_missing_evidence"
        )
    ));

    return {
        status: "candidate_follow_up_practice_session",
        sourceIntentId: record.sourceIntentId,
        sessionAttemptNumber: record.sessionAttemptNumber,
        itemCount: record.itemCount,
        items,
    };
}

function buildDashboardUpdateBody(answeredCount: number, questionCount: number, coachedCount: number) {
    const answerNoun = answeredCount === 1 ? "question" : "questions";
    const coachingNoun = coachedCount === 1 ? "answer" : "answers";

    return `You answered ${answeredCount} of ${questionCount} ${answerNoun}. I have coaching ready for ${coachedCount} ${coachingNoun}.`;
}

function buildPracticeNext(
    session: CandidatePracticeSessionRecord,
    skippedOrUnansweredQuestionKeys: string[],
    firstCoachedQuestion?: CandidatePostRoundReviewQuestion,
): CandidatePracticeNext {
    if (skippedOrUnansweredQuestionKeys.length > 0) {
        return {
            status: "candidate_practice_next_ready",
            source: "unanswered_question",
            label: "Practice the questions you did not answer",
            reason: skippedOrUnansweredQuestionKeys.length === 1
                ? "One planned question still needs practice evidence."
                : `${skippedOrUnansweredQuestionKeys.length} planned questions still need practice evidence.`,
            href: "/candidate/setup",
            questionKeys: skippedOrUnansweredQuestionKeys,
        };
    }

    if (firstCoachedQuestion?.coaching) {
        return {
            status: "candidate_practice_next_ready",
            source: "coaching_focus",
            label: firstCoachedQuestion.coaching.nextPracticeFocus,
            reason: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
            href: "/candidate/setup",
            questionKeys: [firstCoachedQuestion.questionKey],
        };
    }

    return {
        status: "candidate_practice_next_ready",
        source: "new_round",
        label: `Practice ${session.setupSnapshot.targetRole} again`,
        reason: "Start another round when you are ready to build more practice evidence.",
        href: "/candidate/setup",
        questionKeys: [],
    };
}

function labelForCategory(category: CandidateQuestionPlanCategory) {
    switch (category) {
        case "screening":
            return "Screening";
        case "behavioral":
            return "Behavioral";
        case "culture_fit":
            return "Culture / Fit";
        case "case_scenario":
            return "Scenario";
        case "technical_role_specific":
            return "Technical / Role-Specific";
        default:
            return "Practice";
    }
}
