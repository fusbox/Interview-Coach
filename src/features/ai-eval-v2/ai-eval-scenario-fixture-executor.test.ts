import { describe, expect, it } from "vitest";

import {
    candidateAnswerAnalysisFixtureRunMetadata,
    runFixtureEvidenceFirstEvaluator,
} from "@/features/candidate-session-v2/candidate-answer-analysis-fixture";

import { aiEvalScenarioBaselineCases } from "./ai-eval-scenario-baseline";
import {
    createAiEvalScenarioExecutor,
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
            .toMatchObject({ status: "candidate_coach_update_content_v3" });
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

    it("isolates Coach Update synthesis failures without discarding valid output layers", async () => {
        const executor = createAiEvalScenarioExecutor({
            dependencies: failingCoachUpdateDependencies(),
        });
        const atomic = aiEvalScenarioBaselineCases.find((item) => item.scenarioKey === "field_service_concise_sufficient")!;
        const atomicResult = await executor.execute(atomic);

        expect(atomicResult.layers.find((layer) => layer.outputLayer === "coach_update")).toMatchObject({
            errorCode: "UNSAFE_CANDIDATE_LANGUAGE",
            assertionResult: "fail",
        });
        expect(atomicResult.layers
            .filter((layer) => layer.outputLayer !== "coach_update")
            .every((layer) => layer.errorCode === null)).toBe(true);

        const journey = aiEvalScenarioBaselineCases.find((item) => item.scenarioKey === "warehouse_first_round_journey")!;
        const journeyResult = await executor.execute(journey);
        expect(journeyResult.layers.find((layer) => layer.outputLayer === "coach_update")?.errorCode)
            .toBe("UNSAFE_CANDIDATE_LANGUAGE");
        expect(journeyResult.layers.find((layer) => layer.outputLayer === "candidate_dashboard")).toMatchObject({
            errorCode: null,
            output: { coachUpdateState: "unavailable" },
        });
    });

    it("passes structured technical references and STT voice markers into evaluation requests", async () => {
        const requests: Array<Parameters<typeof runFixtureEvidenceFirstEvaluator>[0]> = [];
        const executor = createAiEvalScenarioExecutor({
            dependencies: failingCoachUpdateDependencies(requests),
        });
        const technical = aiEvalScenarioBaselineCases.find((item) => item.scenarioKey === "confidently_wrong_database_indexing")!;
        const voice = aiEvalScenarioBaselineCases.find((item) => item.scenarioKey === "strong_content_voice_with_fillers")!;

        await executor.execute(technical);
        await executor.execute(voice);

        expect(requests[0]?.technicalReference).toMatchObject({
            expectedConcepts: expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), description: expect.any(String) }),
            ]),
        });
        expect(requests[1]?.voiceMarkers).toEqual({
            fillerWordCount: 6,
            longPauseCount: 1,
            wordsPerMinute: 132,
        });
    });

    it("evaluates prior attempts independently before constructing repeat-practice comparison facts", async () => {
        const requests: Array<Parameters<typeof runFixtureEvidenceFirstEvaluator>[0]> = [];
        const scenario = aiEvalScenarioBaselineCases.find((item) => item.scenarioKey === "manager_repeat_improved")!;
        const executor = createAiEvalScenarioExecutor({
            dependencies: failingCoachUpdateDependencies(requests),
            scenarioLibrary: [scenario],
        });

        await executor.execute(scenario);

        expect(requests).toHaveLength(2);
        expect(requests.map((request) => request.answer.text)).toEqual([
            "I reviewed the missed scans with the associate, learned that the new location labels were hard to distinguish, practiced the scan sequence with them, and checked in after each break for two shifts. Their errors returned to the team average, and I asked the manager to replace the confusing labels.",
            "I talked to them and their work got better.",
        ]);
        expect(requests.map((request) => request.answer.attemptNumber)).toEqual([2, 1]);
        expect(requests.map((request) => request.answer.trigger)).toEqual(["feedback_retry", "initial_submit"]);
        expect(requests[0]?.answer.answerAttemptId).not.toBe(requests[1]?.answer.answerAttemptId);
    });
});

function failingCoachUpdateDependencies(
    requests: Array<Parameters<typeof runFixtureEvidenceFirstEvaluator>[0]> = [],
) {
    return {
        now: () => "2026-07-22T12:00:00.000Z",
        async evaluateAtomic({
            scenario,
            request,
        }: {
            scenario: Extract<(typeof aiEvalScenarioBaselineCases)[number], { kind: "atomic_answer" }>;
            request: Parameters<typeof runFixtureEvidenceFirstEvaluator>[0];
        }) {
            requests.push(request);
            return {
                acceptedRun: await runFixtureEvidenceFirstEvaluator(request, {
                    evaluationRunId: `scenario-fixture:${scenario.scenarioKey}`,
                }),
                metadata: candidateAnswerAnalysisFixtureRunMetadata,
            };
        },
        async synthesizeCoachUpdate() {
            throw new Error("unsafe_candidate_language");
        },
    };
}
