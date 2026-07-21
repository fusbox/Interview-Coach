import {
    createDefaultCandidateQuestionAudioDependencies,
    handleSessionQuestionAudioRequest,
} from "./route-implementation";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await context.params;
    return handleSessionQuestionAudioRequest({
        request,
        sessionId,
        ...createDefaultCandidateQuestionAudioDependencies(),
    });
}
