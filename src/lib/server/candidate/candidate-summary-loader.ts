import type { Answer, InterviewSession, SessionStatus } from "@/lib/domain/types";
import { createSessionRepository } from "@/lib/server/infrastructure/session-repository";

import { resolveLocalCandidateAuthHandoff } from "./candidate-dev-auth-resolver";
import { withCandidateRouteMetrics } from "./candidate-observability";
import { findCandidatePracticeDraftBySessionId } from "./candidate-practice-draft-repository";
import { resolveCandidateProfileFromIdentity } from "./candidate-profile-repository";

export type CandidateSummaryAnswer = {
    questionId: string;
    questionText: string;
    category: string;
    transcript: string;
    recommendation: string | null;
};

export type CandidateSummaryModel = {
    practiceDraftId: string;
    sessionId: string;
    role: string;
    status: SessionStatus;
    summaryNarrative: string;
    answeredCount: number;
    questionCount: number;
    answers: CandidateSummaryAnswer[];
};

export async function loadCandidateSummaryForCurrentCandidate(sessionId: string): Promise<CandidateSummaryModel | null> {
    return withCandidateRouteMetrics({
        route: "/summary/[sessionId]",
        operation: "load_summary",
        load: async () => {
            const normalizedSessionId = sessionId.trim();
            if (!normalizedSessionId) {
                return null;
            }

            const handoff = await resolveLocalCandidateAuthHandoff();
            if (!handoff) {
                return null;
            }

            const profile = await resolveCandidateProfileFromIdentity(handoff);
            const draft = await findCandidatePracticeDraftBySessionId({
                candidateProfileId: profile.candidateProfileId,
                sessionId: normalizedSessionId,
            });

            if (!draft) {
                return null;
            }

            const repository = await createSessionRepository();
            const session = await repository.get(normalizedSessionId);
            if (!session) {
                return null;
            }

            return mapSummary(session, draft.practiceDraftId);
        },
    });
}

function mapSummary(session: InterviewSession, practiceDraftId: string): CandidateSummaryModel {
    const answers = session.questions
        .map((question) => {
            const answer = session.answers[question.id];
            if (!answer?.submittedAt) {
                return null;
            }

            return mapAnswer(answer, question.text, question.category);
        })
        .filter((answer): answer is CandidateSummaryAnswer => Boolean(answer));

    return {
        practiceDraftId,
        sessionId: session.id,
        role: session.role,
        status: session.status,
        summaryNarrative: session.summaryNarrative || buildFallbackSummary(answers.length, session.questions.length),
        answeredCount: answers.length,
        questionCount: session.questions.length,
        answers,
    };
}

function mapAnswer(answer: Answer, questionText: string, category: string): CandidateSummaryAnswer {
    return {
        questionId: answer.questionId,
        questionText,
        category,
        transcript: answer.transcript || "",
        recommendation: answer.analysis?.recommendation || null,
    };
}

function buildFallbackSummary(answeredCount: number, questionCount: number): string {
    if (answeredCount === 0) {
        return "No submitted answers are available for this summary yet.";
    }

    return `You answered ${answeredCount} of ${questionCount} questions. Review the answers below and choose one area to strengthen next.`;
}
