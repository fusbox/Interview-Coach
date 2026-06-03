import type { AnalysisResult } from "./types";

export function isFeedbackFlowAnalysisReady(analysis?: AnalysisResult | null): analysis is AnalysisResult {
    return Boolean(
        analysis?.contentPulse?.headline?.trim()
        && analysis.contentPulse.body?.trim()
    );
}
