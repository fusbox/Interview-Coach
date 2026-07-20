import { handleCandidateFeedbackActionRequest } from "@/app/candidate/session/[sessionId]/feedback-actions/route-implementation";
import { createInvitedPracticeLiveRouteRuntime } from "@/features/recruiter-invites-v2/invited-practice-live-route-runtime";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await context.params;
    const runtime = createInvitedPracticeLiveRouteRuntime(sessionId);
    return handleCandidateFeedbackActionRequest({
        request,
        sessionId,
        resolveCandidateSessionIdentity: runtime.resolveCandidateRouteIdentity,
        practiceSessionRepository: runtime.candidateRouteSessionRepository,
    });
}
