import {
    createDefaultQuestionAssistanceDependencies,
    handleQuestionAssistanceRequest,
} from "./route-implementation";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await context.params;
    return handleQuestionAssistanceRequest({
        request,
        sessionId,
        ...createDefaultQuestionAssistanceDependencies(),
    });
}
