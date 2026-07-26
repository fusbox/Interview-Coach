import { describe, expect, it, vi } from "vitest";

import {
    createAiEvalScenarioWorkerHealthResponse,
    createAiEvalScenarioWorkerMonitor,
    readAiEvalScenarioWorkerServicePolicy,
    runAiEvalScenarioWorkerService,
    type AiEvalScenarioWorkerEvent,
} from "./ai-eval-scenario-worker-service";

describe("AI-eval scenario worker service", () => {
    it("reads bounded service controls and fails closed on malformed overrides", () => {
        expect(readAiEvalScenarioWorkerServicePolicy({})).toEqual({
            ready: true,
            reasons: [],
            policy: {
                pollIntervalMs: 2_000,
                errorBackoffMs: 5_000,
                maxConsecutiveErrors: 5,
                healthHost: "0.0.0.0",
                healthPort: null,
            },
        });

        expect(readAiEvalScenarioWorkerServicePolicy({
            AI_EVAL_SCENARIO_WORKER_POLL_INTERVAL_MS: "20",
            AI_EVAL_SCENARIO_WORKER_ERROR_BACKOFF_MS: "0",
            AI_EVAL_SCENARIO_WORKER_MAX_CONSECUTIVE_ERRORS: "101",
            AI_EVAL_SCENARIO_WORKER_HEALTH_PORT: "80",
            AI_EVAL_SCENARIO_WORKER_HEALTH_HOST: "bad host",
        })).toEqual({
            ready: false,
            policy: null,
            reasons: [
                "AI_EVAL_SCENARIO_WORKER_POLL_INTERVAL_MS_INVALID",
                "AI_EVAL_SCENARIO_WORKER_ERROR_BACKOFF_MS_INVALID",
                "AI_EVAL_SCENARIO_WORKER_MAX_CONSECUTIVE_ERRORS_INVALID",
                "AI_EVAL_SCENARIO_WORKER_HEALTH_PORT_INVALID",
                "AI_EVAL_SCENARIO_WORKER_HEALTH_HOST_INVALID",
            ],
        });
    });

    it("keeps polling across an idle queue and emits idle only on transition", async () => {
        const abortController = new AbortController();
        let pollCount = 0;
        const executeNext = vi.fn(async () => {
            pollCount += 1;
            if (pollCount === 2) abortController.abort();
            return { status: "idle" as const };
        });
        const events: AiEvalScenarioWorkerEvent[] = [];
        const monitor = createMonitor();

        const stopped = await runAiEvalScenarioWorkerService({
            monitor,
            policy: servicePolicy(),
            signal: abortController.signal,
            executeNext,
            emit: (event) => events.push(event),
            wait: async () => undefined,
            now: fixedNow,
        });

        expect(executeNext).toHaveBeenCalledTimes(2);
        expect(events.filter((event) => event.event === "ai_eval_worker_idle")).toHaveLength(1);
        expect(events.at(-1)?.event).toBe("ai_eval_worker_stopped");
        expect(stopped).toMatchObject({ lifecycleState: "stopped", alive: false, ready: false });
    });

    it("degrades after bounded failures and recovers readiness after a successful poll", async () => {
        const abortController = new AbortController();
        let attempt = 0;
        const executeNext = vi.fn(async () => {
            attempt += 1;
            if (attempt <= 2) throw new Error("DATABASE_UNAVAILABLE:sensitive detail is not logged");
            abortController.abort();
            return {
                status: "completed" as const,
                runId: "run-1",
                completedCaseCount: 1,
                failedCaseCount: 0,
            };
        });
        const events: AiEvalScenarioWorkerEvent[] = [];
        const monitor = createAiEvalScenarioWorkerMonitor({
            workerId: "worker-1",
            executionMode: "credentialed_live",
            maxConsecutiveErrors: 2,
            now: fixedNow,
        });

        await runAiEvalScenarioWorkerService({
            monitor,
            policy: { ...servicePolicy(), maxConsecutiveErrors: 2 },
            signal: abortController.signal,
            executeNext,
            emit: (event) => events.push(event),
            wait: async () => undefined,
            now: fixedNow,
        });

        expect(events.filter((event) => event.event === "ai_eval_worker_readiness_changed"))
            .toHaveLength(2);
        expect(events.filter((event) => event.event === "ai_eval_worker_poll_failed").map((event) => (
            event.errorCode
        ))).toEqual(["DATABASE_UNAVAILABLE", "DATABASE_UNAVAILABLE"]);
        expect(events.find((event) => event.event === "ai_eval_worker_poll_failed"))
            .not.toHaveProperty("message");
        expect(events.find((event) => event.event === "ai_eval_worker_job_finished"))
            .toMatchObject({ runId: "run-1", resultStatus: "completed", completedCaseCount: 1 });
    });

    it("finishes an accepted job after shutdown is requested without claiming another", async () => {
        const abortController = new AbortController();
        type CompletedJob = {
            status: "completed";
            runId: string;
            completedCaseCount: number;
            failedCaseCount: number;
        };
        let completeJob!: (result: CompletedJob) => void;
        const acceptedJob = new Promise<CompletedJob>((resolve) => {
            completeJob = resolve;
        });
        const executeNext = vi.fn(() => acceptedJob);
        const events: AiEvalScenarioWorkerEvent[] = [];
        const monitor = createMonitor();
        const service = runAiEvalScenarioWorkerService({
            monitor,
            policy: servicePolicy(),
            signal: abortController.signal,
            executeNext,
            emit: (event) => events.push(event),
            wait: async () => undefined,
            now: fixedNow,
        });

        await vi.waitFor(() => expect(executeNext).toHaveBeenCalledTimes(1));
        abortController.abort();
        expect(monitor.snapshot()).toMatchObject({ alive: true, lifecycleState: "ready" });
        completeJob({
            status: "completed",
            runId: "accepted-run",
            completedCaseCount: 2,
            failedCaseCount: 0,
        });
        const stopped = await service;

        expect(executeNext).toHaveBeenCalledTimes(1);
        expect(events.find((event) => event.event === "ai_eval_worker_job_finished"))
            .toMatchObject({ runId: "accepted-run", resultStatus: "completed" });
        expect(stopped).toMatchObject({ alive: false, ready: false, lifecycleState: "stopped" });
    });

    it("exposes content-free liveness and readiness responses", () => {
        const monitor = createMonitor();
        monitor.markReady();

        expect(createAiEvalScenarioWorkerHealthResponse("/healthz", monitor.snapshot()))
            .toMatchObject({ statusCode: 200, body: { status: "alive" } });
        expect(createAiEvalScenarioWorkerHealthResponse("/readyz", monitor.snapshot()))
            .toMatchObject({ statusCode: 200, body: { status: "ready" } });
        expect(createAiEvalScenarioWorkerHealthResponse("/missing", monitor.snapshot()))
            .toEqual({ statusCode: 404, body: { status: "not_found" } });

        monitor.markStopping();
        expect(createAiEvalScenarioWorkerHealthResponse("/readyz", monitor.snapshot()))
            .toMatchObject({ statusCode: 503, body: { status: "not_ready" } });
    });
});

function createMonitor() {
    return createAiEvalScenarioWorkerMonitor({
        workerId: "worker-1",
        executionMode: "contract_fixture",
        maxConsecutiveErrors: 5,
        now: fixedNow,
    });
}

function servicePolicy() {
    return {
        pollIntervalMs: 250,
        errorBackoffMs: 1_000,
        maxConsecutiveErrors: 5,
        healthHost: "127.0.0.1",
        healthPort: null,
    };
}

function fixedNow() {
    return new Date("2026-07-24T14:00:00.000Z");
}
