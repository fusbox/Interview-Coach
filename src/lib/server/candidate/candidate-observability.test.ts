import { beforeEach, describe, expect, it } from "vitest";

import { getMetricsSnapshot, resetMetrics } from "@/lib/server/metrics";
import { recordCandidateRouteMetric, recordCandidateRouteTiming } from "./candidate-observability";

describe("candidate observability boundary", () => {
    beforeEach(() => {
        resetMetrics();
    });

    it("records candidate route counters with actor and app tags", () => {
        recordCandidateRouteMetric({
            route: "/dashboard",
            operation: "load_dashboard",
            outcome: "success",
        });

        expect(getMetricsSnapshot().counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "candidate_route_total",
                value: 1,
                tags: {
                    actorType: "candidate",
                    appName: "candidate_app",
                    operation: "load_dashboard",
                    outcome: "success",
                    route: "/dashboard",
                },
            }),
        ]));
    });

    it("records candidate route timings without sensitive payload fields", () => {
        recordCandidateRouteTiming({
            route: "/practice",
            operation: "load_practice_setup",
            outcome: "error",
            durationMs: 42,
        });

        expect(getMetricsSnapshot().timings).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "candidate_route_duration_ms",
                count: 1,
                avgMs: 42,
                tags: {
                    actorType: "candidate",
                    appName: "candidate_app",
                    operation: "load_practice_setup",
                    outcome: "error",
                    route: "/practice",
                },
            }),
        ]));
    });
});
