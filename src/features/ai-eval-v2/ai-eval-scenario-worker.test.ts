import { describe, expect, it, vi } from "vitest";

import { aiEvalScenarioBaselineCases } from "./ai-eval-scenario-baseline";
import type { AiEvalScenarioRunDetail } from "./ai-eval-scenario-repository";
import {
    runAiEvalScenarioFixtureJobById,
    runNextAiEvalScenarioFixtureJob,
    runNextAiEvalScenarioLiveJob,
} from "./ai-eval-scenario-worker";

const run = {
    runId: "run-1",
    executionMode: "contract_fixture" as const,
    lifecycleState: "running" as const,
    profileId: "deterministic_local_fixture_v1",
    configurationFingerprint: "a".repeat(64),
    caseCount: 1,
    completedCaseCount: 0,
    failedCaseCount: 0,
    assertionResult: null,
    requestedAt: "2026-07-22T12:00:00.000Z",
    completedAt: null,
    retentionExpiresAt: "2026-08-21T12:00:00.000Z",
    costPreview: null,
};

describe("AI-eval scenario fixture worker", () => {
    it("claims, executes, and finalizes a durable run without a browser owner", async () => {
        const scenario = aiEvalScenarioBaselineCases.find((item) => item.scenarioKey === "strong_content_typed")!;
        const repository = repositoryFixture({
            ...run,
            cases: [{
                runCaseId: "case-1",
                scenarioVersionId: "version-1",
                scenario,
                inputFingerprint: "b".repeat(64),
                ordinal: 1,
                lifecycleState: "queued" as const,
                assertionResult: null,
                assertionReasons: [],
                errorCode: null,
                layers: scenario.intendedOutputLayers.map((outputLayer, index) => ({
                    runLayerId: `layer-${index}`,
                    outputLayer,
                    lifecycleState: "queued" as const,
                    assertionResult: null,
                    assertionReasons: [],
                    candidateVisible: outputLayer !== "evaluator_diagnostics",
                    output: null,
                    diagnostics: null,
                    errorCode: null,
                })),
            }],
        });

        const result = await runNextAiEvalScenarioFixtureJob({ repository, workerId: "worker-1" });

        expect(result).toMatchObject({ status: "completed", runId: "run-1" });
        expect(repository.markCaseRunning).toHaveBeenCalledWith("case-1");
        expect(repository.completeLayer).toHaveBeenCalledTimes(6);
        expect(repository.finalizeCase).toHaveBeenCalledWith("case-1");
        expect(repository.finalizeRun).toHaveBeenCalledWith("run-1");
    });

    it("does not overwrite a layer that already completed before recovery", async () => {
        const scenario = aiEvalScenarioBaselineCases.find((item) => item.scenarioKey === "thin_screening_answer")!;
        const repository = repositoryFixture({
            ...run,
            cases: [{
                runCaseId: "case-1",
                scenarioVersionId: "version-1",
                scenario,
                inputFingerprint: "b".repeat(64),
                ordinal: 1,
                lifecycleState: "failed" as const,
                assertionResult: "fail" as const,
                assertionReasons: ["interrupted"],
                errorCode: "INTERRUPTED",
                layers: scenario.intendedOutputLayers.map((outputLayer, index) => ({
                    runLayerId: `layer-${index}`,
                    outputLayer,
                    lifecycleState: index === 0 ? "completed" as const : "failed" as const,
                    assertionResult: index === 0 ? "pass" as const : "fail" as const,
                    assertionReasons: [],
                    candidateVisible: outputLayer !== "evaluator_diagnostics",
                    output: index === 0 ? { accepted: true } : null,
                    diagnostics: null,
                    errorCode: index === 0 ? null : "INTERRUPTED",
                })),
            }],
        });

        await runNextAiEvalScenarioFixtureJob({ repository, workerId: "worker-2" });

        expect(repository.completeLayer).toHaveBeenCalledTimes(5);
        expect(repository.completeLayer).not.toHaveBeenCalledWith(expect.objectContaining({ runLayerId: "layer-0" }));
    });

    it("claims the exact newly submitted run for synchronous operator execution", async () => {
        const scenario = aiEvalScenarioBaselineCases.find((item) => item.scenarioKey === "strong_content_typed")!;
        const repository = repositoryFixture({
            ...run,
            cases: [{
                runCaseId: "case-1",
                scenarioVersionId: "version-1",
                scenario,
                inputFingerprint: "b".repeat(64),
                ordinal: 1,
                lifecycleState: "queued" as const,
                assertionResult: null,
                assertionReasons: [],
                errorCode: null,
                layers: scenario.intendedOutputLayers.map((outputLayer, index) => ({
                    runLayerId: `layer-${index}`,
                    outputLayer,
                    lifecycleState: "queued" as const,
                    assertionResult: null,
                    assertionReasons: [],
                    candidateVisible: outputLayer !== "evaluator_diagnostics",
                    output: null,
                    diagnostics: null,
                    errorCode: null,
                })),
            }],
        });

        await runAiEvalScenarioFixtureJobById({ repository, runId: "run-1", workerId: "operator-worker" });

        expect(repository.claimRun).toHaveBeenCalledWith("run-1", "operator-worker");
        expect(repository.claimNextRun).not.toHaveBeenCalled();
    });
});

describe("AI-eval credentialed live worker gate", () => {
    it("does not claim work when the live policy is incomplete", async () => {
        const repository = liveRepositoryFixture();

        await expect(runNextAiEvalScenarioLiveJob({
            repository,
            workerId: "live-worker",
            env: {},
        })).rejects.toThrow("AI_EVAL_LIVE_WORKER_NOT_READY");

        expect(repository.claimNextLiveRun).not.toHaveBeenCalled();
    });

    it("terminalizes a claimed run when its frozen preview cannot be validated", async () => {
        const repository = liveRepositoryFixture();

        const result = await runNextAiEvalScenarioLiveJob({
            repository,
            workerId: "live-worker",
            env: readyLiveEnv(),
        });

        expect(result).toMatchObject({ status: "failed", runId: "live-run" });
        expect(repository.failLiveRunConfiguration).toHaveBeenCalledWith(expect.objectContaining({
            runId: "live-run",
            workerId: "live-worker",
        }));
        expect(repository.claimLiveOperation).not.toHaveBeenCalled();
    });
});

function repositoryFixture(detail: AiEvalScenarioRunDetail) {
    return repositoryFixtureFactory()(detail);
}

function repositoryFixtureFactory() {
    return (detail: AiEvalScenarioRunDetail) => ({
        claimNextRun: vi.fn(async () => run),
        claimRun: vi.fn(async () => run),
        loadClaimedRun: vi.fn(async () => detail),
        markCaseRunning: vi.fn(async () => undefined),
        completeLayer: vi.fn(async () => undefined),
        failLayer: vi.fn(async () => undefined),
        finalizeCase: vi.fn(async () => ({})),
        finalizeRun: vi.fn(async () => ({ ...run, lifecycleState: "completed" as const, completedCaseCount: 1 })),
    });
}

function liveRepositoryFixture() {
    const liveRun = {
        ...run,
        runId: "live-run",
        executionMode: "credentialed_live" as const,
        profileId: "google_gemini_2_5_flash_v1+google_gemini_2_5_flash_coach_update_v1",
    };
    return {
        claimNextLiveRun: vi.fn(async () => liveRun),
        loadClaimedRun: vi.fn(async () => ({ ...liveRun, cases: [] } as AiEvalScenarioRunDetail)),
        markCaseRunning: vi.fn(async () => undefined),
        completeLayer: vi.fn(async () => undefined),
        failLayer: vi.fn(async () => undefined),
        finalizeCase: vi.fn(async () => ({})),
        finalizeLiveRun: vi.fn(async () => liveRun),
        claimLiveOperation: vi.fn(async () => null),
        completeLiveOperation: vi.fn(async () => null),
        failLiveOperation: vi.fn(async () => null),
        renewLiveRunClaim: vi.fn(async () => true),
        failLiveRunConfiguration: vi.fn(async () => ({ ...liveRun, lifecycleState: "failed" as const })),
    };
}

function readyLiveEnv() {
    return {
        AI_EVAL_SCENARIO_LIVE_ENABLED: "true",
        AI_EVAL_SCENARIO_INPUT_USD_PER_MILLION_TOKENS: "0.1",
        AI_EVAL_SCENARIO_OUTPUT_USD_PER_MILLION_TOKENS: "0.4",
        AI_EVAL_SCENARIO_MAX_ESTIMATED_COST_USD: "5",
        AI_EVAL_SCENARIO_MAX_CALLS: "100",
        CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "google_genai",
        CANDIDATE_ANSWER_ANALYSIS_PROFILE: "google_gemini_2_5_flash_v1",
        CANDIDATE_COACH_UPDATE_PROVIDER: "google_genai",
        CANDIDATE_COACH_UPDATE_PROFILE: "google_gemini_2_5_flash_coach_update_v1",
        GEMINI_API_KEY: "test-only-not-used",
    };
}
