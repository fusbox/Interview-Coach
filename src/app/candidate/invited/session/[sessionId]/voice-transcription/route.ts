import {
    handleVoiceTranscriptionRequest,
    type VoiceTranscriptionRouteDependencies,
} from "@/app/candidate/session/[sessionId]/voice-transcription/route-implementation";
import {
    createVoiceTranscriptionRuntimeFromEnvironment,
    type VoiceTranscriptionProviderRuntime,
} from "@/features/interview-session-v2/voice-transcription-runtime";
import { createInvitedPracticeLiveRouteRuntime } from "@/features/recruiter-invites-v2/invited-practice-live-route-runtime";
import { createInvitedPracticeVoiceTranscriptionRepository } from "@/features/recruiter-invites-v2/invited-practice-voice-transcription-repository";
import { createInvitedServiceRepository } from "./invited-service-repository";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await context.params;
    const invitedRuntime = createInvitedPracticeLiveRouteRuntime(sessionId);
    let runtime: VoiceTranscriptionProviderRuntime | null = null;
    try {
        runtime = createVoiceTranscriptionRuntimeFromEnvironment({ env: process.env });
    } catch {
        runtime = null;
    }
    const repository = createInvitedServiceRepository(
        createInvitedPracticeVoiceTranscriptionRepository(invitedRuntime.queryClient),
    );
    const dependencies: VoiceTranscriptionRouteDependencies = {
        audience: "invited",
        resolveSessionIdentity: async (candidateRequest) => {
            const identity = await invitedRuntime.resolveInvitedIdentity(candidateRequest);
            return identity ? { ownerId: identity.recruiterInvitationRecipientId } : null;
        },
        createRepository: () => repository,
        runtime,
    };
    return handleVoiceTranscriptionRequest({ request, sessionId, ...dependencies });
}
