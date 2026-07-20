import { createCandidateAnswerCoachingFacts } from "@/features/candidate-session-v2/candidate-coaching-facts";
import {
    createInvitedSessionCompletion,
} from "@/features/interview-session-v2/session-completion-contract";
import { createSessionRuntimeFacts } from "@/features/interview-session-v2/session-runtime-facts";
import type { InvitedPracticeSessionRuntimeRepository } from "@/features/recruiter-invites-v2/invited-practice-session-runtime-repository";

type InvitedPracticeIdentity = {
    recruiterInvitationRecipientId: string;
};

export async function handleInvitedPracticeSessionCompleteRequest(input: {
    request: Request;
    sessionId: string;
    now: Date;
    resolveInvitedIdentity: (request: Request) => Promise<InvitedPracticeIdentity | null>;
    sessionRepository: InvitedPracticeSessionRuntimeRepository;
}) {
    const identity = await input.resolveInvitedIdentity(input.request);
    if (!identity) {
        return Response.json({ error: "Invited practice identity is required." }, { status: 401 });
    }

    const owner = {
        invitedPracticeSessionId: input.sessionId,
        recruiterInvitationRecipientId: identity.recruiterInvitationRecipientId,
    };
    const session = await input.sessionRepository.findSession(owner);
    if (!session) {
        return Response.json({ error: "Invited practice session was not found." }, { status: 404 });
    }
    if (!session.questionWordingSnapshot.questions.length) {
        return Response.json({ error: "Question wording is required before completion." }, { status: 409 });
    }

    const completionSnapshot = session.status === "completed"
        ? session.completionSnapshot
        : createInvitedSessionCompletion({
            facts: createSessionRuntimeFacts({
                audience: "invited_candidate",
                sessionId: session.invitedPracticeSessionId,
                targetRole: session.setupSnapshot.targetRole,
                interviewStage: session.setupSnapshot.interviewStage,
                questionCount: session.questionWordingSnapshot.questions.length,
                currentQuestionIndex: session.progress.currentQuestionIndex,
                questions: session.questionWordingSnapshot.questions.map((question) => {
                    const answer = session.answerSubmissions[question.slotId];
                    const analysis = session.answerAnalysisSnapshots[question.slotId];
                    return {
                        questionKey: question.slotId,
                        questionIndex: question.index,
                        category: question.category,
                        questionText: question.questionText,
                        ...(answer ? {
                            answer: {
                                mode: answer.mode,
                                text: answer.text,
                                submittedAt: answer.submittedAt,
                                lifecycleStatus: analysis ? "analysis_saved" as const : "pending_analysis" as const,
                            },
                        } : {}),
                        ...(analysis ? { coachingFacts: createCandidateAnswerCoachingFacts(analysis) } : {}),
                    };
                }),
                completionBehavior: { kind: "invited_debrief" },
            }),
            completedAt: input.now.toISOString(),
        });
    if (!completionSnapshot) {
        return Response.json({ error: "Invited practice completion could not be created." }, { status: 409 });
    }

    const completed = session.status === "completed"
        ? { completionSnapshot }
        : await input.sessionRepository.completeSession({
            ...owner,
            completionSnapshot,
        });
    if (!completed?.completionSnapshot) {
        return Response.json({ error: "Invited practice completion could not be saved." }, { status: 409 });
    }

    return Response.json({
        status: "invited_session_completed",
        completionSnapshot: completed.completionSnapshot,
        nextRoute: completed.completionSnapshot.nextRoute,
    }, {
        headers: { "Cache-Control": "no-store" },
    });
}
