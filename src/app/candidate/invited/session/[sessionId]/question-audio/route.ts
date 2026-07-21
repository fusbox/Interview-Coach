import { handleSessionQuestionAudioRequest } from "@/app/candidate/session/[sessionId]/question-audio/route-implementation";
import { createSessionQuestionAudioRuntimeFromEnvironment } from "@/features/interview-session-v2/session-question-audio-runtime";
import { createInvitedPracticeLiveRouteRuntime } from "@/features/recruiter-invites-v2/invited-practice-live-route-runtime";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await context.params;
    const invitedRuntime = createInvitedPracticeLiveRouteRuntime(sessionId);
    let audioRuntime = null;
    try {
        audioRuntime = createSessionQuestionAudioRuntimeFromEnvironment({ env: process.env });
    } catch {
        audioRuntime = null;
    }
    return handleSessionQuestionAudioRequest({
        request,
        sessionId,
        resolveSessionIdentity: async (candidateRequest) => {
            const identity = await invitedRuntime.resolveCandidateRouteIdentity(candidateRequest);
            return identity ? { ownerId: identity.candidateProfileId } : null;
        },
        sessionRepository: invitedRuntime.candidateRouteSessionRepository,
        audioRuntime,
    });
}
