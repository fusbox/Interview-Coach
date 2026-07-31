import {
    handleQuestionAssistanceRequest,
} from "@/app/candidate/session/[sessionId]/question-assistance/route-implementation";
import {
    createInvitedQuestionAssistanceRepository,
} from "@/features/candidate-session-v2/candidate-question-assistance-repository";
import {
    createCandidateQuestionAssistanceRuntimeFromEnvironment,
} from "@/features/candidate-session-v2/candidate-question-assistance-runtime";
import { createInvitedPracticeLiveRouteRuntime } from "@/features/recruiter-invites-v2/invited-practice-live-route-runtime";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await context.params;
    const invitedRuntime = createInvitedPracticeLiveRouteRuntime(sessionId);
    let assistanceRuntime = null;
    try {
        assistanceRuntime = createCandidateQuestionAssistanceRuntimeFromEnvironment({
            env: process.env,
        });
    } catch {
        assistanceRuntime = null;
    }
    return handleQuestionAssistanceRequest({
        request,
        sessionId,
        resolveSessionIdentity: async (candidateRequest) => {
            const identity = await invitedRuntime.resolveCandidateRouteIdentity(candidateRequest);
            return identity ? { ownerId: identity.candidateProfileId } : null;
        },
        sessionRepository: invitedRuntime.candidateRouteSessionRepository,
        assistanceRepository: createInvitedQuestionAssistanceRepository(
            invitedRuntime.queryClient,
        ),
        assistanceRuntime,
    });
}
