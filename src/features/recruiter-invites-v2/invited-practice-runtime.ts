import { createSessionRuntimeFacts } from "@/features/interview-session-v2/session-runtime-facts";
import { normalizeSessionRuntimeProgress } from "@/features/interview-session-v2/session-runtime-contract";
import { parseCandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";

import type { InvitedPracticeSessionRecord } from "./recruiter-invitation-repository";

export function createInvitedPracticeRuntimeSeed(session: InvitedPracticeSessionRecord) {
    const wording = parseCandidateQuestionWordingResult(
        session.questionWordingSnapshot,
        session.questionPlanSnapshot,
    );
    const progress = normalizeSessionRuntimeProgress(session.progress);
    const targetRole = readSetupString(session.setupSnapshot, "targetRole");
    const interviewStage = readSetupString(session.setupSnapshot, "interviewStage");

    return createSessionRuntimeFacts({
        audience: "invited_candidate",
        sessionId: session.sessionId,
        targetRole,
        interviewStage,
        questionCount: session.questionPlanSnapshot.questionCount,
        currentQuestionIndex: progress.currentQuestionIndex,
        questions: wording.questions.map((question) => ({
            questionKey: question.slotId,
            questionIndex: question.index,
            category: question.category,
            questionText: question.questionText,
        })),
        completionBehavior: {
            kind: "invited_debrief",
            practiceAgainEnabled: true,
        },
    });
}

function readSetupString(setup: Record<string, unknown>, field: string) {
    const value = setup[field];
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Invited practice setup snapshot is missing ${field}.`);
    }
    return value;
}
