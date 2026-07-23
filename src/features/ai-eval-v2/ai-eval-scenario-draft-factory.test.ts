import { describe, expect, it } from "vitest";

import { aiEvalScenarioBaselineCases } from "./ai-eval-scenario-baseline";
import { createAiEvalScenarioFingerprint } from "./ai-eval-scenario-contract";
import { cloneAiEvalScenario, createBlankAiEvalScenario } from "./ai-eval-scenario-draft-factory";

describe("AI-eval scenario draft factory", () => {
    it("creates a complete synthetic atomic-answer working copy", () => {
        const scenario = createBlankAiEvalScenario("ABC-123");

        expect(scenario.kind).toBe("atomic_answer");
        expect(scenario.scenarioKey).toBe("operator_scenario_abc123");
        expect(scenario.audiences).toEqual(["both"]);
        expect(scenario.intendedOutputLayers).toHaveLength(6);
    });

    it("clones content while giving the working copy a distinct identity", () => {
        const source = aiEvalScenarioBaselineCases[0]!;
        const clone = cloneAiEvalScenario(source, "DEF-456");

        expect(clone.scenarioKey).toBe("operator_clone_def456");
        expect(clone.title).toBe(`Copy of ${source.title}`);
        expect(createAiEvalScenarioFingerprint(clone)).not.toBe(createAiEvalScenarioFingerprint(source));
    });
});
