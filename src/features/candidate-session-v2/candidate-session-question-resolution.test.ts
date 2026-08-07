import { describe, expect, it } from "vitest";

import type { CandidateAnswerSubmissions } from "./candidate-answer-lifecycle";
import {
    countCandidateUnansweredQuestions,
    resolveCandidateCurrentUnansweredQuestionIndex,
    resolveCandidateFocusedUnansweredQuestionIndex,
    resolveCandidateNextUnansweredQuestionIndex,
} from "./candidate-session-question-resolution";

const questions = Array.from({ length: 5 }, (_, index) => ({ slotId: `slot-${index + 1}`, index }));

describe("candidate canonical next-unanswered resolver", () => {
    it("keeps the persisted cursor when its question is unanswered", () => {
        expect(resolveCandidateCurrentUnansweredQuestionIndex({
            questions,
            answerSubmissions: submissionsFor(1, 2),
            preferredQuestionIndex: 3,
        })).toBe(3);
    });

    it("skips answered questions and wraps once in canonical order", () => {
        const answerSubmissions = submissionsFor(1, 2, 4, 5);
        expect(resolveCandidateNextUnansweredQuestionIndex({
            questions,
            answerSubmissions,
            afterQuestionIndex: 4,
        })).toBe(2);
        expect(countCandidateUnansweredQuestions({ questions, answerSubmissions })).toBe(1);
    });

    it("honors an unanswered focus without allowing an answered focus to reopen practice", () => {
        const answerSubmissions = submissionsFor(1, 2);
        expect(resolveCandidateFocusedUnansweredQuestionIndex({
            questions,
            answerSubmissions,
            focusQuestionKey: "slot-4",
            fallbackQuestionIndex: 0,
        })).toBe(3);
        expect(resolveCandidateFocusedUnansweredQuestionIndex({
            questions,
            answerSubmissions,
            focusQuestionKey: "slot-2",
            fallbackQuestionIndex: 0,
        })).toBe(2);
    });

    it("returns null only when every canonical question is answered", () => {
        expect(resolveCandidateCurrentUnansweredQuestionIndex({
            questions,
            answerSubmissions: submissionsFor(1, 2, 3, 4, 5),
            preferredQuestionIndex: 0,
        })).toBeNull();
    });
});

function submissionsFor(...questionNumbers: number[]): CandidateAnswerSubmissions {
    return Object.fromEntries(questionNumbers.map((questionNumber) => {
        const index = questionNumber - 1;
        return [`slot-${questionNumber}`, {
            slotId: `slot-${questionNumber}`,
            questionIndex: index,
            mode: "text" as const,
            text: `Answer ${questionNumber}`,
            submittedAt: "2026-08-06T12:00:00.000Z",
            status: "pending_analysis" as const,
        }];
    }));
}
