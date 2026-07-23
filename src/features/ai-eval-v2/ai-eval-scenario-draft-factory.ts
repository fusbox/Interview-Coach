import {
    AI_EVAL_SCENARIO_OUTPUT_LAYERS,
    AI_EVAL_SCENARIO_SCHEMA_VERSION,
    parseAiEvalScenario,
    type AiEvalScenario,
} from "./ai-eval-scenario-contract";

export function createBlankAiEvalScenario(suffix: string) {
    return parseAiEvalScenario({
        schemaVersion: AI_EVAL_SCENARIO_SCHEMA_VERSION,
        kind: "atomic_answer",
        scenarioKey: `operator_scenario_${suffix.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 24)}`,
        title: "Untitled coaching scenario",
        rationale: "Exercise a synthetic candidate answer against the evidence-first coaching contract.",
        tags: ["operator_authored"],
        audiences: ["both"],
        intendedOutputLayers: [...AI_EVAL_SCENARIO_OUTPUT_LAYERS],
        roleContext: {
            roleFamily: "customer_service",
            targetRole: "Customer Service Representative",
            jobDescription: "Support customers, investigate concerns, communicate next steps, and document outcomes.",
            processedResumeText: null,
            resumeContext: "absent",
            interviewStage: "first_interview",
        },
        question: {
            lineageKey: `operator_question_${suffix.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 24)}`,
            category: "behavioral",
            text: "Tell me about a time you helped resolve a customer concern.",
            plannedPurpose: "Look for context, personal action, reasoning, and a concrete outcome.",
        },
        answer: {
            text: "A customer was unsure why an order was delayed. I checked the tracking history, explained the cause, and gave them the next confirmed update time. They understood what would happen next and did not need to call again.",
            mode: "text",
        },
        technicalReference: null,
        priorAttempts: [],
        expected: {
            allowedUsability: ["usable", "strong"],
            markerValues: {},
            requiredSensitiveFlags: [],
            technicalAccuracy: null,
            requiredCoachingConcepts: [],
            forbiddenCoachingConcepts: ["score", "rank", "hiring decision"],
            expectedAssertion: "review_required",
        },
    });
}

export function cloneAiEvalScenario(source: AiEvalScenario, suffix: string) {
    return parseAiEvalScenario({
        ...source,
        scenarioKey: `operator_clone_${suffix.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 24)}`,
        title: `Copy of ${source.title}`.slice(0, 200),
    });
}
