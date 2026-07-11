import type { SessionRuntimeProgress } from "./session-runtime-contract";
import type { SessionRuntimeFacts } from "./session-runtime-facts";

export type CandidateLedSessionCompletionSnapshot = {
    status: "candidate_session_completed";
    audience: "candidate_led";
    sessionId: string;
    completedAt: string;
    finalProgress: SessionRuntimeProgress & { status: "completed" };
    questionCount: number;
    answeredCount: number;
    coachedCount: number;
    answeredQuestionKeys: string[];
    coachedQuestionKeys: string[];
    skippedOrUnansweredQuestionKeys: string[];
    nextRoute: string;
};

export function createCandidateLedSessionCompletion(input: {
    facts: SessionRuntimeFacts;
    completedAt: string;
}): CandidateLedSessionCompletionSnapshot | null {
    const { facts } = input;
    if (
        facts.audience !== "candidate_led"
        || facts.completionBehavior.kind !== "candidate_dashboard"
    ) {
        return null;
    }

    const answeredQuestionKeys = facts.questions
        .filter((question) => Boolean(question.answer))
        .map((question) => question.questionKey);
    const coachedQuestionKeys = facts.questions
        .filter((question) => Boolean(question.coachingFacts))
        .map((question) => question.questionKey);
    const skippedOrUnansweredQuestionKeys = facts.questions
        .filter((question) => !question.answer)
        .map((question) => question.questionKey);

    return {
        status: "candidate_session_completed",
        audience: "candidate_led",
        sessionId: facts.sessionId,
        completedAt: input.completedAt,
        finalProgress: {
            status: "completed",
            currentQuestionIndex: facts.currentQuestionIndex,
        },
        questionCount: facts.questionCount,
        answeredCount: answeredQuestionKeys.length,
        coachedCount: coachedQuestionKeys.length,
        answeredQuestionKeys,
        coachedQuestionKeys,
        skippedOrUnansweredQuestionKeys,
        nextRoute: facts.completionBehavior.dashboardHref,
    };
}
