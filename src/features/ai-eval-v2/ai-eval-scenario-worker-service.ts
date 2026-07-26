import { createServer, type Server } from "node:http";

export const AI_EVAL_SCENARIO_WORKER_SERVICE_VERSION = "ai_eval_scenario_worker_service_v1" as const;

export type AiEvalScenarioWorkerExecutionMode = "contract_fixture" | "credentialed_live";

export type AiEvalScenarioWorkerServicePolicy = {
    pollIntervalMs: number;
    errorBackoffMs: number;
    maxConsecutiveErrors: number;
    healthHost: string;
    healthPort: number | null;
};

export type AiEvalScenarioWorkerServicePolicyResult =
    | { ready: true; policy: AiEvalScenarioWorkerServicePolicy; reasons: [] }
    | { ready: false; policy: null; reasons: string[] };

export type AiEvalScenarioWorkerJobResult = {
    status: "idle" | "completed" | "partial" | "failed" | "unsupported_mode";
    runId?: string;
    completedCaseCount?: number;
    failedCaseCount?: number;
};

export type AiEvalScenarioWorkerSnapshot = {
    version: typeof AI_EVAL_SCENARIO_WORKER_SERVICE_VERSION;
    workerId: string;
    executionMode: AiEvalScenarioWorkerExecutionMode;
    lifecycleState: "starting" | "ready" | "degraded" | "stopping" | "stopped";
    alive: boolean;
    ready: boolean;
    activeRunId: string | null;
    consecutiveErrorCount: number;
    processedRunCount: number;
    startedAt: string;
    lastPollAt: string | null;
    lastSuccessAt: string | null;
    stoppedAt: string | null;
};

export type AiEvalScenarioWorkerEvent = {
    event:
        | "ai_eval_worker_started"
        | "ai_eval_worker_idle"
        | "ai_eval_worker_job_finished"
        | "ai_eval_worker_poll_failed"
        | "ai_eval_worker_readiness_changed"
        | "ai_eval_worker_shutdown_requested"
        | "ai_eval_worker_stopped";
    version: typeof AI_EVAL_SCENARIO_WORKER_SERVICE_VERSION;
    occurredAt: string;
    workerId: string;
    executionMode: AiEvalScenarioWorkerExecutionMode;
    lifecycleState: AiEvalScenarioWorkerSnapshot["lifecycleState"];
    runId?: string;
    resultStatus?: AiEvalScenarioWorkerJobResult["status"];
    completedCaseCount?: number;
    failedCaseCount?: number;
    consecutiveErrorCount?: number;
    processedRunCount?: number;
    durationMs?: number;
    errorCode?: string;
};

export function readAiEvalScenarioWorkerServicePolicy(
    env: Record<string, string | undefined>,
): AiEvalScenarioWorkerServicePolicyResult {
    const reasons: string[] = [];
    const pollIntervalMs = readBoundedInteger(
        env.AI_EVAL_SCENARIO_WORKER_POLL_INTERVAL_MS,
        2_000,
        250,
        60_000,
        "AI_EVAL_SCENARIO_WORKER_POLL_INTERVAL_MS_INVALID",
        reasons,
    );
    const errorBackoffMs = readBoundedInteger(
        env.AI_EVAL_SCENARIO_WORKER_ERROR_BACKOFF_MS,
        5_000,
        1_000,
        300_000,
        "AI_EVAL_SCENARIO_WORKER_ERROR_BACKOFF_MS_INVALID",
        reasons,
    );
    const maxConsecutiveErrors = readBoundedInteger(
        env.AI_EVAL_SCENARIO_WORKER_MAX_CONSECUTIVE_ERRORS,
        5,
        1,
        100,
        "AI_EVAL_SCENARIO_WORKER_MAX_CONSECUTIVE_ERRORS_INVALID",
        reasons,
    );
    const healthPort = readOptionalBoundedInteger(
        env.AI_EVAL_SCENARIO_WORKER_HEALTH_PORT,
        1_024,
        65_535,
        "AI_EVAL_SCENARIO_WORKER_HEALTH_PORT_INVALID",
        reasons,
    );
    const healthHost = env.AI_EVAL_SCENARIO_WORKER_HEALTH_HOST?.trim() || "0.0.0.0";
    if (healthHost.length > 255 || /[\s/]/.test(healthHost)) {
        reasons.push("AI_EVAL_SCENARIO_WORKER_HEALTH_HOST_INVALID");
    }

    if (reasons.length > 0) return { ready: false, policy: null, reasons };
    return {
        ready: true,
        reasons: [],
        policy: {
            pollIntervalMs,
            errorBackoffMs,
            maxConsecutiveErrors,
            healthHost,
            healthPort,
        },
    };
}

export function createAiEvalScenarioWorkerMonitor(input: {
    workerId: string;
    executionMode: AiEvalScenarioWorkerExecutionMode;
    maxConsecutiveErrors: number;
    now?: () => Date;
}) {
    const now = input.now ?? (() => new Date());
    const startedAt = now().toISOString();
    let snapshot: AiEvalScenarioWorkerSnapshot = {
        version: AI_EVAL_SCENARIO_WORKER_SERVICE_VERSION,
        workerId: input.workerId,
        executionMode: input.executionMode,
        lifecycleState: "starting",
        alive: true,
        ready: false,
        activeRunId: null,
        consecutiveErrorCount: 0,
        processedRunCount: 0,
        startedAt,
        lastPollAt: null,
        lastSuccessAt: null,
        stoppedAt: null,
    };

    return {
        snapshot: () => structuredClone(snapshot),
        markReady() {
            snapshot = { ...snapshot, lifecycleState: "ready", ready: true };
        },
        markPollStarted() {
            snapshot = { ...snapshot, lastPollAt: now().toISOString() };
        },
        markActiveRun(runId: string | null) {
            snapshot = { ...snapshot, activeRunId: runId };
        },
        markPollSucceeded(processedRun: boolean) {
            snapshot = {
                ...snapshot,
                lifecycleState: "ready",
                ready: true,
                activeRunId: null,
                consecutiveErrorCount: 0,
                processedRunCount: snapshot.processedRunCount + (processedRun ? 1 : 0),
                lastSuccessAt: now().toISOString(),
            };
        },
        markPollFailed() {
            const consecutiveErrorCount = snapshot.consecutiveErrorCount + 1;
            const ready = consecutiveErrorCount < input.maxConsecutiveErrors;
            snapshot = {
                ...snapshot,
                lifecycleState: ready ? "ready" : "degraded",
                ready,
                activeRunId: null,
                consecutiveErrorCount,
            };
        },
        markStopping() {
            snapshot = { ...snapshot, lifecycleState: "stopping", ready: false };
        },
        markStopped() {
            snapshot = {
                ...snapshot,
                lifecycleState: "stopped",
                alive: false,
                ready: false,
                activeRunId: null,
                stoppedAt: now().toISOString(),
            };
        },
    };
}

export async function runAiEvalScenarioWorkerService(input: {
    monitor: ReturnType<typeof createAiEvalScenarioWorkerMonitor>;
    policy: AiEvalScenarioWorkerServicePolicy;
    signal: AbortSignal;
    executeNext: () => Promise<AiEvalScenarioWorkerJobResult>;
    emit: (event: AiEvalScenarioWorkerEvent) => void;
    wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
    now?: () => Date;
}) {
    const now = input.now ?? (() => new Date());
    const wait = input.wait ?? waitForAbortableDelay;
    let idleEventEmitted = false;
    input.monitor.markReady();
    input.emit(createEvent(input.monitor.snapshot(), "ai_eval_worker_started", now));

    while (!input.signal.aborted) {
        const before = input.monitor.snapshot();
        input.monitor.markPollStarted();
        const startedAt = now().getTime();
        try {
            const result = await input.executeNext();
            const processedRun = result.status !== "idle";
            input.monitor.markActiveRun(result.runId ?? null);
            const wasReady = before.ready;
            input.monitor.markPollSucceeded(processedRun);
            const after = input.monitor.snapshot();
            if (!wasReady && after.ready) {
                input.emit(createEvent(after, "ai_eval_worker_readiness_changed", now));
            }
            if (result.status === "idle") {
                if (!idleEventEmitted) {
                    input.emit(createEvent(after, "ai_eval_worker_idle", now));
                    idleEventEmitted = true;
                }
            } else {
                idleEventEmitted = false;
                input.emit({
                    ...createEvent(after, "ai_eval_worker_job_finished", now),
                    runId: result.runId,
                    resultStatus: result.status,
                    completedCaseCount: result.completedCaseCount,
                    failedCaseCount: result.failedCaseCount,
                    durationMs: Math.max(0, now().getTime() - startedAt),
                    processedRunCount: after.processedRunCount,
                });
            }
            if (!input.signal.aborted) {
                await wait(input.policy.pollIntervalMs, input.signal);
            }
        } catch (error) {
            const wasReady = input.monitor.snapshot().ready;
            input.monitor.markPollFailed();
            const after = input.monitor.snapshot();
            input.emit({
                ...createEvent(after, "ai_eval_worker_poll_failed", now),
                errorCode: safeWorkerErrorCode(error),
                consecutiveErrorCount: after.consecutiveErrorCount,
                durationMs: Math.max(0, now().getTime() - startedAt),
            });
            if (wasReady && !after.ready) {
                input.emit(createEvent(after, "ai_eval_worker_readiness_changed", now));
            }
            if (!input.signal.aborted) {
                await wait(input.policy.errorBackoffMs, input.signal);
            }
        }
    }

    input.monitor.markStopping();
    input.emit(createEvent(input.monitor.snapshot(), "ai_eval_worker_shutdown_requested", now));
    input.monitor.markStopped();
    const stopped = input.monitor.snapshot();
    input.emit(createEvent(stopped, "ai_eval_worker_stopped", now));
    return stopped;
}

export function createAiEvalScenarioWorkerHealthResponse(
    path: string,
    snapshot: AiEvalScenarioWorkerSnapshot,
) {
    if (path === "/healthz") {
        return {
            statusCode: snapshot.alive ? 200 : 503,
            body: {
                status: snapshot.alive ? "alive" : "stopped",
                version: snapshot.version,
                lifecycleState: snapshot.lifecycleState,
            },
        };
    }
    if (path === "/readyz") {
        return {
            statusCode: snapshot.ready ? 200 : 503,
            body: {
                status: snapshot.ready ? "ready" : "not_ready",
                version: snapshot.version,
                lifecycleState: snapshot.lifecycleState,
                consecutiveErrorCount: snapshot.consecutiveErrorCount,
            },
        };
    }
    return { statusCode: 404, body: { status: "not_found" } };
}

export async function startAiEvalScenarioWorkerHealthServer(input: {
    host: string;
    port: number;
    getSnapshot: () => AiEvalScenarioWorkerSnapshot;
}) {
    const server = createServer((request, response) => {
        const result = createAiEvalScenarioWorkerHealthResponse(
            new URL(request.url ?? "/", "http://worker.local").pathname,
            input.getSnapshot(),
        );
        response.writeHead(result.statusCode, {
            "cache-control": "no-store",
            "content-type": "application/json; charset=utf-8",
        });
        response.end(JSON.stringify(result.body));
    });

    await listen(server, input.port, input.host);
    return {
        close: () => close(server),
    };
}

function createEvent(
    snapshot: AiEvalScenarioWorkerSnapshot,
    event: AiEvalScenarioWorkerEvent["event"],
    now: () => Date,
): AiEvalScenarioWorkerEvent {
    return {
        event,
        version: snapshot.version,
        occurredAt: now().toISOString(),
        workerId: snapshot.workerId,
        executionMode: snapshot.executionMode,
        lifecycleState: snapshot.lifecycleState,
    };
}

function readBoundedInteger(
    value: string | undefined,
    fallback: number,
    minimum: number,
    maximum: number,
    reason: string,
    reasons: string[],
) {
    if (typeof value === "undefined" || value.trim() === "") return fallback;
    if (!/^\d+$/.test(value.trim())) {
        reasons.push(reason);
        return fallback;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
        reasons.push(reason);
        return fallback;
    }
    return parsed;
}

function readOptionalBoundedInteger(
    value: string | undefined,
    minimum: number,
    maximum: number,
    reason: string,
    reasons: string[],
) {
    if (typeof value === "undefined" || value.trim() === "") return null;
    return readBoundedInteger(value, minimum, minimum, maximum, reason, reasons);
}

function safeWorkerErrorCode(error: unknown) {
    const message = error instanceof Error ? error.message : "AI_EVAL_WORKER_POLL_FAILED";
    const candidate = message.split(":", 1)[0]?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_") ?? "";
    return /^[A-Z][A-Z0-9_]{0,119}$/.test(candidate) ? candidate : "AI_EVAL_WORKER_POLL_FAILED";
}

function waitForAbortableDelay(milliseconds: number, signal: AbortSignal) {
    if (signal.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
        const timeout = setTimeout(done, milliseconds);
        timeout.unref?.();
        signal.addEventListener("abort", done, { once: true });

        function done() {
            clearTimeout(timeout);
            signal.removeEventListener("abort", done);
            resolve();
        }
    });
}

function listen(server: Server, port: number, host: string) {
    return new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
            server.removeListener("error", reject);
            resolve();
        });
    });
}

function close(server: Server) {
    return new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}
