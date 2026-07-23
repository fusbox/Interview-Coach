import { describe, expect, it } from "vitest";

import { aiEvalScenarioBaselineCases } from "./ai-eval-scenario-baseline";
import { compareAiEvalScenarioRuns } from "./ai-eval-scenario-run-comparison";
import type { AiEvalScenarioRunDetail } from "./ai-eval-scenario-repository";

describe("same-profile scenario run comparison", () => {
    it("derives candidate-visible, diagnostic, assertion, and metric changes without another run", () => {
        const prior = run("00000000-0000-4000-8000-000000000101", "Earlier coaching", 100, "pass");
        const current = run("00000000-0000-4000-8000-000000000102", "Updated coaching", 140, "review_required");

        const comparison = compareAiEvalScenarioRuns(current, prior);

        expect(comparison).toMatchObject({
            compatible: true,
            changedCaseCount: 1,
            changedCandidateVisibleLayerCount: 1,
            changedDiagnosticLayerCount: 0,
        });
        expect(comparison.cases[0]?.assertionChanged).toBe(true);
        expect(comparison.metrics.delta.totalTokens).toBe(40);
    });

    it("rejects comparisons across serving configuration or scenario fingerprints", () => {
        const prior = run("00000000-0000-4000-8000-000000000101", "Earlier", 100, "pass");
        const changed = run("00000000-0000-4000-8000-000000000102", "Later", 100, "pass");
        changed.configurationFingerprint = "b".repeat(64);
        changed.cases[0]!.inputFingerprint = "c".repeat(64);

        const comparison = compareAiEvalScenarioRuns(changed, prior);

        expect(comparison.compatible).toBe(false);
        expect(comparison.reasons).toEqual(expect.arrayContaining([
            "Configuration fingerprints differ.",
            "Scenario input-fingerprint sets differ.",
        ]));
    });
});

function run(
    runId: string,
    coaching: string,
    totalTokens: number,
    assertionResult: "pass" | "review_required",
): AiEvalScenarioRunDetail {
    return {
        runId,
        executionMode: "credentialed_live",
        lifecycleState: "completed",
        profileId: "same-live-profile",
        configurationFingerprint: "a".repeat(64),
        costPreview: null,
        caseCount: 1,
        completedCaseCount: 1,
        failedCaseCount: 0,
        assertionResult,
        requestedAt: "2026-07-22T12:00:00.000Z",
        completedAt: "2026-07-22T12:01:00.000Z",
        retentionExpiresAt: "2026-08-21T12:00:00.000Z",
        cases: [{
            runCaseId: `${runId}:case`,
            scenarioVersionId: "00000000-0000-4000-8000-000000000001",
            scenario: aiEvalScenarioBaselineCases[0]!,
            inputFingerprint: "d".repeat(64),
            ordinal: 1,
            lifecycleState: "completed",
            assertionResult,
            assertionReasons: [],
            errorCode: null,
            layers: [{
                runLayerId: `${runId}:layer`,
                outputLayer: "session_coaching",
                lifecycleState: "completed",
                assertionResult: "review_required",
                assertionReasons: [],
                candidateVisible: true,
                output: { coaching },
                diagnostics: {
                    evaluatorMetrics: {
                        latencyMs: 500,
                        tokenUsage: { inputTokens: totalTokens - 20, outputTokens: 20, totalTokens },
                    },
                    stageOutcomes: [
                        { stage: "extract", outcome: "accepted" },
                        { stage: "compose", outcome: "accepted" },
                    ],
                },
                errorCode: null,
            }],
        }],
    };
}
