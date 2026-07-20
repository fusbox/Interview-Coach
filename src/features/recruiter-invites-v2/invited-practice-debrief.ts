import { candidateQuestionPlanCategoryDetails } from "@/features/candidate-session-v2/candidate-question-plan";

import type { InvitedPracticeSessionRuntimeRecord } from "./invited-practice-session-runtime-repository";

export type InvitedPracticeDebriefQuestion = {
    slotId: string;
    questionNumber: number;
    categoryLabel: string;
    questionText: string;
    answerText: string | null;
    coaching: {
        acknowledgement: string;
        observation: string;
        nextPracticeFocus: string;
    } | null;
};

export type InvitedPracticeDebrief = {
    sessionId: string;
    sessionAttemptNumber: number;
    targetRole: string;
    questionCount: number;
    answeredCount: number;
    coachedCount: number;
    questions: InvitedPracticeDebriefQuestion[];
};

export function createInvitedPracticeDebrief(
    session: InvitedPracticeSessionRuntimeRecord,
    sessionAttemptNumber: number,
): InvitedPracticeDebrief | null {
    if (session.status !== "completed" || !session.completionSnapshot) return null;

    return {
        sessionId: session.invitedPracticeSessionId,
        sessionAttemptNumber,
        targetRole: session.setupSnapshot.targetRole,
        questionCount: session.completionSnapshot.questionCount,
        answeredCount: session.completionSnapshot.answeredCount,
        coachedCount: session.completionSnapshot.coachedCount,
        questions: session.questionWordingSnapshot.questions
            .slice()
            .sort((left, right) => left.index - right.index)
            .map((question) => {
                const answer = session.answerSubmissions[question.slotId];
                const analysis = session.answerAnalysisSnapshots[question.slotId];
                return {
                    slotId: question.slotId,
                    questionNumber: question.index + 1,
                    categoryLabel: candidateQuestionPlanCategoryDetails[question.category].label,
                    questionText: question.questionText,
                    answerText: answer?.text ?? null,
                    coaching: analysis ? {
                        acknowledgement: analysis.coachFeedback.acknowledgement,
                        observation: analysis.coachFeedback.observation,
                        nextPracticeFocus: analysis.coachFeedback.nextPracticeFocus,
                    } : null,
                };
            }),
    };
}
