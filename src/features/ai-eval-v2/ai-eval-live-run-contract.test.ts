import { describe, expect, it } from "vitest";

import { aiEvalScenarioBaselineCases } from "./ai-eval-scenario-baseline";
import {
    AI_EVAL_LIVE_CONFIGURATION_FINGERPRINT,
    AI_EVAL_LIVE_PROFILE_ID,
    createAiEvalLiveCostPreview,
    readAiEvalLiveExecutionPolicy,
    resolveAiEvalScenarioSelection,
} from "./ai-eval-live-run-contract";

const liveEnv = {
    AI_EVAL_SCENARIO_LIVE_ENABLED: "true",
    AI_EVAL_SCENARIO_INPUT_USD_PER_MILLION_TOKENS: "0.10",
    AI_EVAL_SCENARIO_OUTPUT_USD_PER_MILLION_TOKENS: "0.40",
    AI_EVAL_SCENARIO_MAX_ESTIMATED_COST_USD: "5",
    AI_EVAL_SCENARIO_MAX_CALLS: "200",
    AI_EVAL_SCENARIO_LIVE_CONCURRENCY: "2",
    CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "google_genai",
    CANDIDATE_ANSWER_ANALYSIS_PROFILE: "google_gemini_2_5_flash_v1",
    CANDIDATE_COACH_UPDATE_PROVIDER: "google_genai",
    CANDIDATE_COACH_UPDATE_PROFILE: "google_gemini_2_5_flash_coach_update_v1",
    GEMINI_API_KEY: "test-only-not-used",
};

describe("AI-eval credentialed live run contract", () => {
    it("fails closed until every provider, credential, rate, and ceiling is explicit", () => {
        const blocked = readAiEvalLiveExecutionPolicy({});
        expect(blocked.ready).toBe(false);
        expect(blocked.reasons).toContain("LIVE_EXECUTION_NOT_ENABLED");
        expect(blocked.reasons).toContain("PROVIDER_CREDENTIAL_MISSING");

        const ready = readAiEvalLiveExecutionPolicy(liveEnv);
        expect(ready).toMatchObject({
            ready: true,
            concurrency: 2,
            profileId: AI_EVAL_LIVE_PROFILE_ID,
            configurationFingerprint: AI_EVAL_LIVE_CONFIGURATION_FINGERPRINT,
        });
    });

    it("expands a selected round journey to its latest atomic dependencies", () => {
        const versions = aiEvalScenarioBaselineCases.map((scenario, index) => ({
            scenarioVersionId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
            inputFingerprint: String(index + 1).padStart(64, "a").slice(-64),
            versionNumber: 1,
            scenario,
        }));
        const journey = versions.find((version) => version.scenario.kind === "round_journey")!;
        const resolved = resolveAiEvalScenarioSelection({ requested: [journey], available: versions });

        expect(resolved.missingDependencies).toEqual([]);
        expect(resolved.dependencyCaseCount).toBe(journey.scenario.kind === "round_journey" ? journey.scenario.atomicCaseKeys.length : 0);
        expect(resolved.versions[0]?.scenarioVersionId).toBe(journey.scenarioVersionId);
    });

    it("freezes a conservative call, token, price, and cost envelope", () => {
        const scenario = aiEvalScenarioBaselineCases.find((item) => item.kind === "atomic_answer")!;
        const version = {
            scenarioVersionId: "00000000-0000-4000-8000-000000000001",
            inputFingerprint: "a".repeat(64),
            versionNumber: 1,
            scenario,
        };
        const preview = createAiEvalLiveCostPreview({
            requestedCaseCount: 1,
            versions: [version],
            dependencyCaseCount: 0,
            policy: readAiEvalLiveExecutionPolicy(liveEnv),
        });

        expect(preview).toMatchObject({
            requestedCaseCount: 1,
            expandedCaseCount: 1,
            atomicCaseCount: 1,
            journeyCaseCount: 0,
            calls: { minimum: 3, maximum: 6 },
            pricing: { source: "operator_configured" },
            withinLimits: true,
        });
        expect(preview.selectionFingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(preview.maximumEstimatedCostUsd).toBeGreaterThan(0);
    });
});
