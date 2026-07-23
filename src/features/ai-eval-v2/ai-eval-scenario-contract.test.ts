import { describe, expect, it } from "vitest";

import {
    aiEvalScenarioBaselineCases,
    aiEvalScenarioBaselineCoverage,
    aiEvalScenarioBaselineManifest,
} from "./ai-eval-scenario-baseline";
import {
    createAiEvalScenarioFingerprint,
    parseAiEvalScenario,
} from "./ai-eval-scenario-contract";

describe("AI-eval scenario contract", () => {
    it("extends the twelve-case evaluator corpus into a broad synthetic baseline", () => {
        expect(aiEvalScenarioBaselineCases.length).toBeGreaterThan(24);
        expect(aiEvalScenarioBaselineCoverage).toMatchObject({ passed: true });
        expect(aiEvalScenarioBaselineManifest.members).toHaveLength(aiEvalScenarioBaselineCases.length);
        expect(aiEvalScenarioBaselineManifest.manifestFingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(new Set(aiEvalScenarioBaselineCases.map((scenario) => scenario.scenarioKey)).size)
            .toBe(aiEvalScenarioBaselineCases.length);
    });

    it("creates a stable canonical fingerprint independent of object key order", () => {
        const source = aiEvalScenarioBaselineCases[0];
        const reordered = Object.fromEntries(Object.entries(source).reverse());
        expect(createAiEvalScenarioFingerprint(parseAiEvalScenario(reordered)))
            .toBe(createAiEvalScenarioFingerprint(source));
    });

    it("rejects resume context that contradicts the staged synthetic payload", () => {
        const source = aiEvalScenarioBaselineCases.find((scenario) => scenario.kind === "atomic_answer")!;
        expect(() => parseAiEvalScenario({
            ...source,
            roleContext: {
                ...source.roleContext,
                resumeContext: "absent",
                processedResumeText: "This should not be present.",
            },
        })).toThrow(/Absent resume context/);
    });
});
