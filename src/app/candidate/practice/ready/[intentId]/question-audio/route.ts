import {
    createDefaultCandidatePracticeIntentQuestionAudioDependencies,
    handleCandidatePracticeIntentQuestionAudioRequest,
} from "./route-implementation";

export async function POST(request: Request, context: { params: Promise<{ intentId: string }> }) {
    const { intentId } = await context.params;
    return handleCandidatePracticeIntentQuestionAudioRequest({
        request,
        intentId,
        ...createDefaultCandidatePracticeIntentQuestionAudioDependencies(),
    });
}
