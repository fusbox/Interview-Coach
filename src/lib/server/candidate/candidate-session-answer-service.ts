import type { SessionStatus } from "@/lib/domain/types";
import { transitionSessionStatus } from "@/lib/domain/session-state-machine";
import { createSessionRepository } from "@/lib/server/infrastructure/session-repository";
import { submitAnswer } from "@/lib/server/session/orchestrator";

import { withCandidateMutationBoundary } from "./candidate-mutation-boundary";
import { findCandidatePracticeDraftBySessionId } from "./candidate-practice-draft-repository";

type CandidateAnswerInput = {
    candidateProfileId: string;
    sessionId: string;
    questionId: string;
};

type SubmitCandidateAnswerInput = CandidateAnswerInput & {
    answerText: string;
};

type RetryCandidateQuestionInput = CandidateAnswerInput & {
    retryContext?: {
        trigger: "user" | "coach";
        focus?: string;
    };
};

type CandidateAnswerResult =
    | {
        ok: true;
        sessionId: string;
        status: SessionStatus;
        questionId: string;
    }
    | {
        ok: false;
        error: string;
    };

export async function submitCandidateOwnedAnswer(input: SubmitCandidateAnswerInput): Promise<CandidateAnswerResult> {
    const answerText = input.answerText.trim();
    if (!answerText) {
        return { ok: false, error: "Answer text is required." };
    }

    return withCandidateMutationBoundary({
        candidateProfileId: input.candidateProfileId,
        operation: "session_answer_submit",
        subjectId: `${input.sessionId}:${input.questionId}`,
        mutate: async () => {
            const ownedSession = await loadOwnedCandidateSession(input);
            if (!ownedSession.ok) {
                return ownedSession;
            }

            if (!ownedSession.session.questions.some((question) => question.id === input.questionId)) {
                return { ok: false, error: "Question was not found in this session." };
            }

            const existingAnswer = ownedSession.session.answers[input.questionId];
            if (existingAnswer?.submittedAt) {
                return {
                    ok: true,
                    sessionId: ownedSession.session.id,
                    status: ownedSession.session.status,
                    questionId: input.questionId,
                };
            }

            const updatedSession = submitAnswer(ownedSession.session, input.questionId, answerText);

            await ownedSession.repository.deleteAnalysis(input.sessionId, input.questionId);
            await ownedSession.repository.update(updatedSession);

            return {
                ok: true,
                sessionId: updatedSession.id,
                status: updatedSession.status,
                questionId: input.questionId,
            };
        },
    });
}

export async function retryCandidateOwnedQuestion(input: RetryCandidateQuestionInput): Promise<CandidateAnswerResult> {
    return withCandidateMutationBoundary({
        candidateProfileId: input.candidateProfileId,
        operation: "session_question_retry",
        subjectId: `${input.sessionId}:${input.questionId}`,
        mutate: async () => {
            const ownedSession = await loadOwnedCandidateSession(input);
            if (!ownedSession.ok) {
                return ownedSession;
            }

            if (!ownedSession.session.questions.some((question) => question.id === input.questionId)) {
                return { ok: false, error: "Question was not found in this session." };
            }

            const currentAnswer = ownedSession.session.answers[input.questionId];
            if (!currentAnswer) {
                return {
                    ok: true,
                    sessionId: ownedSession.session.id,
                    status: ownedSession.session.status,
                    questionId: input.questionId,
                };
            }

            const updatedSession = {
                ...transitionSessionStatus(ownedSession.session, "IN_SESSION"),
                answers: {
                    ...ownedSession.session.answers,
                    [input.questionId]: {
                        ...currentAnswer,
                        submittedAt: undefined,
                        analysis: undefined,
                        retryContext: input.retryContext,
                    },
                },
            };

            await ownedSession.repository.deleteAnalysis(input.sessionId, input.questionId);
            await ownedSession.repository.update(updatedSession);

            return {
                ok: true,
                sessionId: updatedSession.id,
                status: updatedSession.status,
                questionId: input.questionId,
            };
        },
    });
}

async function loadOwnedCandidateSession(input: CandidateAnswerInput) {
    const ownership = await findCandidatePracticeDraftBySessionId({
        candidateProfileId: input.candidateProfileId,
        sessionId: input.sessionId,
    });

    if (!ownership) {
        return { ok: false as const, error: "Candidate session was not found." };
    }

    const repository = await createSessionRepository();
    const session = await repository.get(input.sessionId);
    if (!session) {
        return { ok: false as const, error: "Candidate session was not found." };
    }

    return { ok: true as const, repository, session };
}
