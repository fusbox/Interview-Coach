import { beforeEach, describe, expect, it } from "vitest";

import { getMetricsSnapshot, resetMetrics } from "@/lib/server/metrics";
import {
    recordCandidateRouteMetric,
    recordCandidateRouteTiming,
    withCandidateRouteMetrics,
} from "./candidate-observability";

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

    it("records success metrics around candidate route loaders", async () => {
        await expect(withCandidateRouteMetrics({
            route: "/dashboard",
            operation: "load_dashboard",
            load: async () => ({ ok: true }),
        })).resolves.toEqual({ ok: true });

        const snapshot = getMetricsSnapshot();
        expect(snapshot.counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "candidate_route_total",
                value: 1,
                tags: expect.objectContaining({
                    operation: "load_dashboard",
                    outcome: "success",
                    route: "/dashboard",
                }),
            }),
        ]));
        expect(snapshot.timings).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "candidate_route_duration_ms",
                count: 1,
                tags: expect.objectContaining({
                    operation: "load_dashboard",
                    outcome: "success",
                    route: "/dashboard",
                }),
            }),
        ]));
    });

    it("records error metrics when candidate route loaders return null", async () => {
        await expect(withCandidateRouteMetrics({
            route: "/summary/[sessionId]",
            operation: "load_summary",
            load: async () => null,
        })).resolves.toBeNull();

        expect(getMetricsSnapshot().counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "candidate_route_total",
                value: 1,
                tags: expect.objectContaining({
                    operation: "load_summary",
                    outcome: "error",
                    route: "/summary/[sessionId]",
                }),
            }),
        ]));
    });

    it("records error metrics and rethrows when candidate route loaders throw", async () => {
        await expect(withCandidateRouteMetrics({
            route: "/practice",
            operation: "load_practice_setup",
            load: async () => {
                throw new Error("database unavailable");
            },
        })).rejects.toThrow("database unavailable");

        expect(getMetricsSnapshot().counters).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: "candidate_route_total",
                value: 1,
                tags: expect.objectContaining({
                    operation: "load_practice_setup",
                    outcome: "error",
                    route: "/practice",
                }),
            }),
        ]));
    });
});
