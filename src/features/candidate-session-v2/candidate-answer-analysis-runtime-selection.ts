import {
    CANDIDATE_HOST_LAUNCH_DEV_MODE_ENV,
    CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV,
} from "@/features/candidate-auth-v2/dev-host-launch";
import { EvidenceFirstAdapterError } from "@/features/evaluation-v2/evidence-first-evaluator-runtime";
import type { GoogleEvidenceFirstTransport } from "@/features/evaluation-v2/google-evidence-first-evaluator";

import { createCandidateAnswerAnalysisDevelopmentRuntime } from "./candidate-answer-analysis-fault-injection";
import { createCandidateAnswerAnalysisGoogleRuntime } from "./candidate-answer-analysis-google-runtime";

export function selectCandidateAnswerAnalysisRuntime(input: {
    env: Record<string, string | undefined>;
    googleTransportFactory?: (apiKey: string) => GoogleEvidenceFirstTransport;
}) {
    const developmentRuntime = createCandidateAnswerAnalysisDevelopmentRuntime({
        env: input.env,
        explicitLocalDev: isExplicitLocalDevLaunchMode(input.env),
    });
    if (developmentRuntime) return developmentRuntime;

    try {
        return createCandidateAnswerAnalysisGoogleRuntime({
            env: input.env,
            transportFactory: input.googleTransportFactory,
        });
    } catch (error) {
        if (error instanceof EvidenceFirstAdapterError && error.failureClass === "misconfigured") {
            return null;
        }
        throw error;
    }
}

export function isCandidateAnswerAnalysisRuntimeAvailable(
    env: Record<string, string | undefined>,
) {
    return Boolean(selectCandidateAnswerAnalysisRuntime({ env }));
}

function isExplicitLocalDevLaunchMode(env: Record<string, string | undefined>) {
    return env[CANDIDATE_HOST_LAUNCH_DEV_MODE_ENV] === "true"
        && Boolean(env[CANDIDATE_HOST_LAUNCH_DEV_SECRET_ENV]?.trim());
}
