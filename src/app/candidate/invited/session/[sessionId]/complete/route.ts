import { createInvitedPracticeLiveRouteRuntime } from "@/features/recruiter-invites-v2/invited-practice-live-route-runtime";

import { handleInvitedPracticeSessionCompleteRequest } from "./route-implementation";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await context.params;
    const runtime = createInvitedPracticeLiveRouteRuntime(sessionId);
    return handleInvitedPracticeSessionCompleteRequest({
        request,
        sessionId,
        now: new Date(),
        resolveInvitedIdentity: runtime.resolveInvitedIdentity,
        sessionRepository: runtime.sessionRepository,
    });
}
