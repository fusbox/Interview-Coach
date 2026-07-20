import {
    createDefaultCandidateAnswerAnalysisDependencies,
    handleCandidateAnswerAnalysisRequest,
} from "@/app/candidate/session/[sessionId]/answers/[slotId]/analysis/route-implementation";
import { createInvitedPracticeLiveRouteRuntime } from "@/features/recruiter-invites-v2/invited-practice-live-route-runtime";

export async function POST(
    request: Request,
    context: { params: Promise<{ sessionId: string; slotId: string }> },
) {
    const { sessionId, slotId } = await context.params;
    const sharedEvaluator = createDefaultCandidateAnswerAnalysisDependencies();
    const runtime = createInvitedPracticeLiveRouteRuntime(sessionId);
    return handleCandidateAnswerAnalysisRequest({
        request,
        sessionId,
        slotId,
        now: new Date(),
        requestAnswerAnalysis: sharedEvaluator.requestAnswerAnalysis,
        evaluationRunConfiguration: sharedEvaluator.evaluationRunConfiguration,
        resolveCandidateSessionIdentity: runtime.resolveCandidateRouteIdentity,
        practiceSessionRepository: runtime.candidateRouteSessionRepository,
        evaluationRunRepository: runtime.candidateRouteAnswerHistoryRepository,
    });
}
