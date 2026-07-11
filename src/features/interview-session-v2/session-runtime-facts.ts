import type { CandidateAnswerCoachingFacts } from "@/features/candidate-session-v2/candidate-coaching-facts";
import type { CandidateQuestionPlanCategory } from "@/features/candidate-session-v2/candidate-question-plan";

import type { SessionCompletionBehavior, SessionRuntimeConsumer } from "./session-runtime-contract";

export type SessionRuntimeAudience = SessionRuntimeConsumer["kind"];

export type SessionRuntimeFactAnswer = {
    mode: "text" | "voice";
    text: string;
    submittedAt: string;
    lifecycleStatus: "pending_analysis" | "analysis_saved";
};

export type SessionRuntimeFactQuestion = {
    questionKey: string;
    questionIndex: number;
    category: CandidateQuestionPlanCategory;
    questionText: string;
    answer?: SessionRuntimeFactAnswer;
    coachingFacts?: CandidateAnswerCoachingFacts;
};

export type SessionRuntimeFacts = {
    status: "session_runtime_facts";
    audience: SessionRuntimeAudience;
    sessionId: string;
    targetRole: string;
    interviewStage: string;
    questionCount: number;
    currentQuestionIndex: number;
    questions: SessionRuntimeFactQuestion[];
    answeredCount: number;
    coachedCount: number;
    completionBehavior: SessionCompletionBehavior;
};

type CreateSessionRuntimeFactsInput = {
    audience: SessionRuntimeAudience;
    sessionId: string;
    targetRole: string;
    interviewStage: string;
    questionCount: number;
    currentQuestionIndex: number;
    questions: SessionRuntimeFactQuestion[];
    completionBehavior: SessionCompletionBehavior;
} & Record<string, unknown>;

export function createSessionRuntimeFacts(input: CreateSessionRuntimeFactsInput): SessionRuntimeFacts {
    const questions = input.questions.map(normalizeQuestionFact);

    return {
        status: "session_runtime_facts",
        audience: input.audience,
        sessionId: input.sessionId,
        targetRole: input.targetRole,
        interviewStage: input.interviewStage,
        questionCount: normalizeCount(input.questionCount),
        currentQuestionIndex: normalizeQuestionIndex(input.currentQuestionIndex, questions.length),
        questions,
        answeredCount: questions.filter((question) => Boolean(question.answer)).length,
        coachedCount: questions.filter((question) => Boolean(question.coachingFacts)).length,
        completionBehavior: input.completionBehavior,
    };
}

function normalizeQuestionFact(question: SessionRuntimeFactQuestion): SessionRuntimeFactQuestion {
    return {
        questionKey: question.questionKey,
        questionIndex: normalizeCount(question.questionIndex),
        category: question.category,
        questionText: question.questionText,
        ...(question.answer ? { answer: question.answer } : {}),
        ...(question.coachingFacts ? { coachingFacts: question.coachingFacts } : {}),
    };
}

function normalizeQuestionIndex(currentQuestionIndex: number, questionCount: number) {
    if (questionCount <= 0) {
        return 0;
    }

    if (!Number.isInteger(currentQuestionIndex) || currentQuestionIndex < 0) {
        return 0;
    }

    return Math.min(currentQuestionIndex, questionCount - 1);
}

function normalizeCount(value: number) {
    return Number.isInteger(value) && value >= 0 ? value : 0;
}
