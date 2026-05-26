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

export async function withCandidateRouteMetrics<T>(_params: {
    route: string;
    operation: string;
    load: () => Promise<T | null>;
}): Promise<T | null> {
    const startedAt = Date.now();
    let outcome: CandidateMetricOutcome = "error";

    try {
        const result = await _params.load();
        outcome = result ? "success" : "error";
        return result;
    } catch (error) {
        outcome = "error";
        throw error;
    } finally {
        const durationMs = Date.now() - startedAt;
        recordCandidateRouteMetric({
            route: _params.route,
            operation: _params.operation,
            outcome,
        });
        recordCandidateRouteTiming({
            route: _params.route,
            operation: _params.operation,
            outcome,
            durationMs,
        });
    }
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
