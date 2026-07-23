import { describe, expect, it } from "vitest";

import { aiEvalScenarioBaselineCases } from "./ai-eval-scenario-baseline";
import {
    createAiEvalScenarioFixtureExecutor,
    getAllScenarioOutputLayers,
} from "./ai-eval-scenario-fixture-executor";

describe("AI-eval scenario fixture executor", () => {
    it("uses production projections to render every atomic candidate-visible layer", async () => {
        const scenario = aiEvalScenarioBaselineCases.find((item) => item.scenarioKey === "strong_content_typed")!;
        const result = await createAiEvalScenarioFixtureExecutor().execute(scenario);

        expect(result.layers.map((layer) => layer.outputLayer).sort())
            .toEqual(getAllScenarioOutputLayers().sort());
        expect(result.layers.find((layer) => layer.outputLayer === "session_coaching")?.output)
            .toMatchObject({ status: "feedback_interaction_ready" });
        expect(result.layers.find((layer) => layer.outputLayer === "transcript_evidence")?.output)
            .toMatchObject({ status: "annotated" });
        expect(result.layers.find((layer) => layer.outputLayer === "coach_update")?.output)
            .toMatchObject({ status: "candidate_coach_update_content_v2" });
        expect(result.layers.find((layer) => layer.outputLayer === "candidate_dashboard")?.output)
            .toHaveProperty("practiceNext");
    });

    it("reuses referenced atomic fixtures to create all round-journey surfaces", async () => {
        const scenario = aiEvalScenarioBaselineCases.find((item) => item.scenarioKey === "technical_reference_boundary_journey")!;
        const result = await createAiEvalScenarioFixtureExecutor({ scenarioLibrary: [scenario] }).execute(scenario);

        expect(result.layers.map((layer) => layer.outputLayer))
            .toEqual(["coach_update", "invited_completion", "candidate_dashboard"]);
        expect(result.layers.every((layer) => layer.assertionResult === "review_required")).toBe(true);
        expect(result.layers[0]?.output).toMatchObject({
            status: "scenario_round_coach_update_v1",
            targetRole: "Application Support Engineer",
        });
    });

    it("does not persist a raw provider response or assembled prompt in diagnostics", async () => {
        const scenario = aiEvalScenarioBaselineCases.find((item) => item.kind === "atomic_answer")!;
        const result = await createAiEvalScenarioFixtureExecutor().execute(scenario);
        const serialized = JSON.stringify(result);

        expect(serialized).not.toContain('"assembledPrompt":');
        expect(serialized).not.toContain('"rawProviderOutput":');
        expect(serialized).toContain('"rawProviderOutputStored":false');
    });

    it("applies every encoded atomic semantic expectation to deterministic outputs", async () => {
        const executor = createAiEvalScenarioFixtureExecutor();
        const atomic = aiEvalScenarioBaselineCases.filter((scenario) => scenario.kind === "atomic_answer");
        const results = await Promise.all(atomic.map((scenario) => executor.execute(scenario)));
        const diagnostics = results.map((result) => {
            const diagnostic = result.layers.find((layer) => layer.outputLayer === "evaluator_diagnostics");
            return {
                scenarioKey: result.scenarioKey,
                assertionResult: diagnostic?.assertionResult,
                assertionReasons: diagnostic?.assertionReasons ?? [],
            };
        });

        expect(diagnostics.map((diagnostic) => diagnostic.scenarioKey))
            .toEqual(atomic.map((scenario) => scenario.scenarioKey));
        expect(diagnostics.every((diagnostic) => diagnostic.assertionResult === "pass" || diagnostic.assertionResult === "fail"))
            .toBe(true);
        expect(diagnostics.some((diagnostic) => diagnostic.assertionResult === "pass")).toBe(true);
        expect(diagnostics.some((diagnostic) => diagnostic.assertionResult === "fail")).toBe(true);
        expect(diagnostics
            .filter((diagnostic) => diagnostic.assertionResult === "fail")
            .every((diagnostic) => diagnostic.assertionReasons.length > 0))
            .toBe(true);
    });
});
