import { handleCandidateAnswerDraftRequest } from "@/app/candidate/session/[sessionId]/answer-drafts/route-implementation";
import { createInvitedPracticeLiveRouteRuntime } from "@/features/recruiter-invites-v2/invited-practice-live-route-runtime";

export async function PUT(request: Request, context: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await context.params;
    const runtime = createInvitedPracticeLiveRouteRuntime(sessionId);
    return handleCandidateAnswerDraftRequest({
        request,
        sessionId,
        now: new Date(),
        resolveCandidateSessionIdentity: runtime.resolveCandidateRouteIdentity,
        practiceSessionRepository: runtime.candidateRouteSessionRepository,
    });
}
