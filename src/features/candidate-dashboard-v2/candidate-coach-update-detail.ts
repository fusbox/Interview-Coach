import type {
    CandidatePostRoundReview,
    CandidatePostRoundReviewQuestion,
} from "@/features/candidate-session-v2/candidate-completed-round-read-model";

export type CandidateCoachUpdateDetail = {
    status: "candidate_coach_update_detail_ready";
    candidatePracticeSessionId: string;
    targetRole: string;
    completedAt: string;
    answeredCount: number;
    questionCount: number;
    reviewPosture: "fully_reviewable" | "partially_reviewable" | "missing_practice_evidence_only";
    items: CandidateCoachUpdateQuestionDetail[];
};

export type CandidateCoachUpdateQuestionDetail = {
    status: "candidate_coach_update_question_detail";
    questionKey: string;
    questionNumber: number;
    category: string;
    questionText: string;
    evidenceStatus: "practiced" | "missing_practice_evidence";
    answer?: CandidatePostRoundReviewQuestion["answer"];
    coachRead?: CandidatePostRoundReviewQuestion["coaching"];
    actionPosture: CandidateCoachUpdateActionPosture;
};

export type CandidateCoachUpdateActionPosture =
    | {
        kind: "review_coaching";
        label: "Review coach feedback";
        reason: "This answer has coaching ready.";
    }
    | {
        kind: "await_coaching";
        label: "Coach feedback pending";
        reason: "This answer does not have coaching ready yet.";
    }
    | {
        kind: "practice_missing_evidence";
        label: "Practice this question";
        reason: "This planned question has not been answered yet.";
    };

export function createCandidateCoachUpdateDetail(
    postRoundReview: CandidatePostRoundReview | null,
): CandidateCoachUpdateDetail | null {
    if (!postRoundReview) {
        return null;
    }

    const items = postRoundReview.questions.map(toQuestionDetail);

    return {
        status: "candidate_coach_update_detail_ready",
        candidatePracticeSessionId: postRoundReview.candidatePracticeSessionId,
        targetRole: postRoundReview.targetRole,
        completedAt: postRoundReview.completedAt,
        answeredCount: postRoundReview.answeredCount,
        questionCount: postRoundReview.questionCount,
        reviewPosture: getReviewPosture(items),
        items,
    };
}

function toQuestionDetail(question: CandidatePostRoundReviewQuestion): CandidateCoachUpdateQuestionDetail {
    const isPracticed = question.status === "practiced";

    return {
        status: "candidate_coach_update_question_detail",
        questionKey: question.questionKey,
        questionNumber: question.questionNumber,
        category: question.category,
        questionText: question.questionText,
        evidenceStatus: isPracticed ? "practiced" : "missing_practice_evidence",
        ...(question.answer ? { answer: question.answer } : {}),
        ...(question.coaching ? { coachRead: question.coaching } : {}),
        actionPosture: getActionPosture(question),
    };
}

function getActionPosture(question: CandidatePostRoundReviewQuestion): CandidateCoachUpdateActionPosture {
    if (question.status !== "practiced") {
        return {
            kind: "practice_missing_evidence",
            label: "Practice this question",
            reason: "This planned question has not been answered yet.",
        };
    }

    if (!question.coaching) {
        return {
            kind: "await_coaching",
            label: "Coach feedback pending",
            reason: "This answer does not have coaching ready yet.",
        };
    }

    return {
        kind: "review_coaching",
        label: "Review coach feedback",
        reason: "This answer has coaching ready.",
    };
}

function getReviewPosture(items: CandidateCoachUpdateQuestionDetail[]): CandidateCoachUpdateDetail["reviewPosture"] {
    const practicedCount = items.filter((item) => item.evidenceStatus === "practiced").length;
    const missingCount = items.length - practicedCount;

    if (practicedCount === 0) {
        return "missing_practice_evidence_only";
    }

    return missingCount > 0 ? "partially_reviewable" : "fully_reviewable";
}
