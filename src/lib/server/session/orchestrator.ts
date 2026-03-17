import { InterviewSession, Question, AnalysisResult } from "@/lib/domain/types";
import { uuidv7 } from "uuidv7";
import { InitSessionSchema } from "@/lib/domain/schemas";
import { z } from "zod";
import { transitionSessionStatus } from "@/lib/domain/session-state-machine";

// --- Pure Domain Functions ---

export function createSession(
    input: z.infer<typeof InitSessionSchema>
): InterviewSession {
    // Validate input (runtime check)
    const data = InitSessionSchema.parse(input);

    const newSession: InterviewSession = {
        id: uuidv7(),
        status: "NOT_STARTED",
        role: data.role,
        jobDescription: data.jobDescription,
        questions: [],
        currentQuestionIndex: 0,
        answers: {},
        initialsRequired: true, // Default policy: always require initials if not authenticated
    };

    return newSession;
}

export function addQuestions(session: InterviewSession, questions: Question[]): InterviewSession {
    return {
        ...session,
        questions: questions
    };
}

export function startSession(session: InterviewSession): InterviewSession {
    return transitionSessionStatus(session, "IN_SESSION");
}

export function nextQuestion(session: InterviewSession): InterviewSession {
    const nextIndex = session.currentQuestionIndex + 1;
    const isComplete = nextIndex >= session.questions.length;

    if (isComplete) {
        return transitionSessionStatus(session, "COMPLETED");
    }

    return {
        ...transitionSessionStatus(session, "IN_SESSION"),
        currentQuestionIndex: nextIndex,
    };
}

export function submitAnswer(
    session: InterviewSession,
    questionId: string,
    answerText: string,
    analysis?: AnalysisResult
): InterviewSession {
    // Basic state update - in a real app, this might trigger eval
    const updatedAnswers = {
        ...session.answers,
        [questionId]: {
            questionId,
            transcript: answerText,
            submittedAt: Date.now(),
            analysis: analysis // Persist analysis if provided
        }
    };

    return {
        ...session,
        answers: updatedAnswers,
        status: transitionSessionStatus(session, analysis ? "REVIEWING" : "AWAITING_EVALUATION").status
    };
}

export function getAnalysisContext(session: InterviewSession, questionId: string) {
    const question = session.questions.find(q => q.id === questionId);
    if (!question) return null;

    // Construct minimal blueprint from session role
    const blueprint = {
        title: session.role,
        competencies: []
    };

    return {
        question,
        blueprint,
        intakeData: session.intakeData
    };
}

export function submitInitials(session: InterviewSession, initials: string): InterviewSession {
    return {
        ...session,
        enteredInitials: initials,
        initialsRequired: false // Gate passed
    };
}

export function cloneSession(parent: InterviewSession): InterviewSession {
    const newSession: InterviewSession = {
        id: uuidv7(),
        status: "NOT_STARTED",
        role: parent.role,
        jobDescription: parent.jobDescription,
        recruiterId: parent.recruiterId, // Propagate ownership
        clientName: parent.clientName, // Propagate client
        // Deep clone questions with fresh UUIDs to avoid primary key collision/moving
        questions: parent.questions.map(q => ({
            ...q,
            id: uuidv7()
        })),
        currentQuestionIndex: 0,
        answers: {},
        initialsRequired: !parent.candidateName,
        // Identity Propagation
        candidateName: parent.candidateName,
        candidate: parent.candidate,
        enteredInitials: parent.enteredInitials,
        // Lineage
        parentSessionId: parent.id,
        attemptNumber: (parent.attemptNumber || 1) + 1,
        intakeData: parent.intakeData // Keep original context
    };

    // If we have identity, we don't need the gate
    if (newSession.candidateName || newSession.enteredInitials) {
        newSession.initialsRequired = false;
    }

    return newSession;
}
