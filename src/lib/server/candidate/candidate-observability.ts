import { incrementMetric, observeMetric } from "@/lib/server/metrics";

type CandidateMetricOutcome = "success" | "error";

type CandidateMetricParams = {
    route: string;
    operation: string;
    outcome: CandidateMetricOutcome;
};

export function recordCandidateRouteMetric(_params: {
    route: string;
    operation: string;
    outcome: CandidateMetricOutcome;
}) {
    incrementMetric("candidate_route_total", candidateMetricTags(_params));
}

export function recordCandidateRouteTiming(_params: {
    route: string;
    operation: string;
    outcome: CandidateMetricOutcome;
    durationMs: number;
}) {
    observeMetric("candidate_route_duration_ms", _params.durationMs, candidateMetricTags(_params));
}

function candidateMetricTags(params: CandidateMetricParams) {
    return {
        actorType: "candidate",
        appName: "candidate_app",
        operation: params.operation,
        outcome: params.outcome,
        route: params.route,
    };
}
