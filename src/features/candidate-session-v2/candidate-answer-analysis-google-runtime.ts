import {
    EvidenceFirstAdapterError,
    runEvidenceFirstEvaluator,
    type AcceptedEvidenceFirstEvaluatorRun,
} from "@/features/evaluation-v2/evidence-first-evaluator-runtime";
import {
    createGoogleEvidenceFirstEvaluatorFromEnvironment,
    type GoogleEvidenceFirstEnvironment,
    type GoogleEvidenceFirstTransport,
} from "@/features/evaluation-v2/google-evidence-first-evaluator";

import {
    createCandidateAnswerEvidenceFirstEvaluationCase,
    type CandidateAnswerAnalysisProviderRequest,
} from "./candidate-answer-analysis-adapter";

export type CandidateAnswerAnalysisGoogleRuntime = {
    runMetadata: NonNullable<ReturnType<typeof createGoogleEvidenceFirstEvaluatorFromEnvironment>>["runMetadata"];
    createInputFingerprint: (request: CandidateAnswerAnalysisProviderRequest) => string;
    requestAnswerAnalysis: (
        request: CandidateAnswerAnalysisProviderRequest,
        context?: { evaluationRunId: string },
    ) => Promise<AcceptedEvidenceFirstEvaluatorRun>;
};

export function createCandidateAnswerAnalysisGoogleRuntime(input: {
    env: GoogleEvidenceFirstEnvironment;
    transportFactory?: (apiKey: string) => GoogleEvidenceFirstTransport;
}): CandidateAnswerAnalysisGoogleRuntime | null {
    const evaluator = createGoogleEvidenceFirstEvaluatorFromEnvironment(input);
    if (!evaluator) return null;

    return {
        runMetadata: evaluator.runMetadata,
        createInputFingerprint: (request) => (
            createCandidateAnswerEvidenceFirstEvaluationCase(request).inputFingerprint
        ),
        async requestAnswerAnalysis(request, context) {
            const evaluationRunId = context?.evaluationRunId?.trim();
            if (!evaluationRunId) {
                throw new EvidenceFirstAdapterError({
                    failureClass: "misconfigured",
                    safeCode: "GOOGLE_EVALUATION_RUN_ID_REQUIRED",
                });
            }
            const evaluationCase = createCandidateAnswerEvidenceFirstEvaluationCase(request);
            return runEvidenceFirstEvaluator({
                evaluationRunId,
                evaluationCase,
                profile: evaluator.profile,
                adapters: evaluator.adapters,
                requestedAt: request.requestedAt,
            });
        },
    };
}
