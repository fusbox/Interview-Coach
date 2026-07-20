import { handleCandidateAnswerSubmitRequest } from "@/app/candidate/session/[sessionId]/answers/route-implementation";
import { createInvitedPracticeLiveRouteRuntime } from "@/features/recruiter-invites-v2/invited-practice-live-route-runtime";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await context.params;
    const runtime = createInvitedPracticeLiveRouteRuntime(sessionId);
    return handleCandidateAnswerSubmitRequest({
        request,
        sessionId,
        now: new Date(),
        resolveCandidateSessionIdentity: runtime.resolveCandidateRouteIdentity,
        practiceSessionRepository: runtime.candidateRouteSessionRepository,
        answerAttemptRepository: runtime.candidateRouteAnswerHistoryRepository,
    });
}
