import type { CandidateAnswerSubmissions } from "./candidate-answer-lifecycle";

export type CandidateResolvableQuestion = {
    slotId: string;
    index: number;
};

export function getCandidateAnsweredQuestionKeys(answerSubmissions: CandidateAnswerSubmissions) {
    return new Set(Object.keys(answerSubmissions));
}

export function resolveCandidateCurrentUnansweredQuestionIndex({
    questions,
    answerSubmissions,
    preferredQuestionIndex,
}: {
    questions: CandidateResolvableQuestion[];
    answerSubmissions: CandidateAnswerSubmissions;
    preferredQuestionIndex: number;
}) {
    if (questions.length === 0) return null;
    const normalizedPreferredIndex = normalizeQuestionIndex(preferredQuestionIndex, questions.length);
    if (!answerSubmissions[questions[normalizedPreferredIndex].slotId]) {
        return normalizedPreferredIndex;
    }
    return resolveCandidateNextUnansweredQuestionIndex({
        questions,
        answerSubmissions,
        afterQuestionIndex: normalizedPreferredIndex,
    });
}

export function resolveCandidateNextUnansweredQuestionIndex({
    questions,
    answerSubmissions,
    afterQuestionIndex,
}: {
    questions: CandidateResolvableQuestion[];
    answerSubmissions: CandidateAnswerSubmissions;
    afterQuestionIndex: number;
}) {
    if (questions.length === 0) return null;
    const start = normalizeQuestionIndex(afterQuestionIndex, questions.length);
    for (let offset = 1; offset <= questions.length; offset += 1) {
        const candidateIndex = (start + offset) % questions.length;
        if (!answerSubmissions[questions[candidateIndex].slotId]) {
            return candidateIndex;
        }
    }
    return null;
}

export function resolveCandidateFocusedUnansweredQuestionIndex({
    questions,
    answerSubmissions,
    focusQuestionKey,
    fallbackQuestionIndex,
}: {
    questions: CandidateResolvableQuestion[];
    answerSubmissions: CandidateAnswerSubmissions;
    focusQuestionKey?: string | null;
    fallbackQuestionIndex: number;
}) {
    const focusIndex = focusQuestionKey
        ? questions.findIndex((question) => question.slotId === focusQuestionKey)
        : -1;
    if (focusIndex >= 0 && !answerSubmissions[questions[focusIndex].slotId]) {
        return focusIndex;
    }
    return resolveCandidateCurrentUnansweredQuestionIndex({
        questions,
        answerSubmissions,
        preferredQuestionIndex: fallbackQuestionIndex,
    });
}

export function countCandidateUnansweredQuestions({
    questions,
    answerSubmissions,
}: {
    questions: CandidateResolvableQuestion[];
    answerSubmissions: CandidateAnswerSubmissions;
}) {
    return questions.reduce(
        (count, question) => count + (answerSubmissions[question.slotId] ? 0 : 1),
        0,
    );
}

function normalizeQuestionIndex(value: number, questionCount: number) {
    if (!Number.isInteger(value) || questionCount <= 0) return 0;
    return ((value % questionCount) + questionCount) % questionCount;
}
