import { describe, expect, it } from "vitest";

import { createFixtureCandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";
import {
    createCandidatePracticePlanBaseline,
    createCandidateQuestionGenerationPlan,
    deriveCandidateBaselineWording,
    deriveCandidateInitialRoundPlan,
    deriveCandidateInitialRoundWording,
    getCandidateStageBaselineQuestionCount,
} from "./candidate-practice-plan-baseline";

describe("candidate practice-plan baseline", () => {
    it("keeps the stage baseline independent from a smaller first round", () => {
        const baseline = createCandidatePracticePlanBaseline("first_interview");
        const generationPlan = createCandidateQuestionGenerationPlan({ baseline, selectedQuestionCount: 3 });
        const round = deriveCandidateInitialRoundPlan({ baseline, generationPlan, selectedQuestionCount: 3 });

        expect(baseline.questionCount).toBe(7);
        expect(generationPlan.questionCount).toBe(7);
        expect(round.questionCount).toBe(3);
        expect(round.slots.map((slot) => [slot.planQuestionId, slot.coverageKind])).toEqual([
            ["slot-1", "baseline"],
            ["slot-2", "baseline"],
            ["slot-3", "baseline"],
        ]);
    });

    it("marks above-baseline questions supplemental without changing the denominator", () => {
        const baseline = createCandidatePracticePlanBaseline("screening");
        const generationPlan = createCandidateQuestionGenerationPlan({ baseline, selectedQuestionCount: 7 });
        const round = deriveCandidateInitialRoundPlan({ baseline, generationPlan, selectedQuestionCount: 7 });

        expect(baseline.questionCount).toBe(5);
        expect(round.slots.slice(0, 5).every((slot) => slot.coverageKind === "baseline")).toBe(true);
        expect(round.slots.slice(5).map((slot) => slot.coverageKind)).toEqual(["supplemental", "supplemental"]);
    });

    it("persists full baseline wording while exposing only the selected round", () => {
        const baseline = createCandidatePracticePlanBaseline("first_interview");
        const generationPlan = createCandidateQuestionGenerationPlan({ baseline, selectedQuestionCount: 3 });
        const round = deriveCandidateInitialRoundPlan({ baseline, generationPlan, selectedQuestionCount: 3 });
        const setupSnapshot = {
            targetRole: "Warehouse lead",
            jobDescription: "Coordinate safety workflows.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: generationPlan.questionCount,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-19T18:00:00.000Z",
        };
        const generatedWording = createFixtureCandidateQuestionWordingResult({
            setupSnapshot,
            questionPlanSnapshot: generationPlan,
        });

        expect(deriveCandidateBaselineWording({ baseline, generatedWording }).questions).toHaveLength(7);
        expect(deriveCandidateInitialRoundWording({ roundPlan: round, generatedWording }).questions).toHaveLength(3);
    });

    it("uses the ratified stage baseline counts", () => {
        expect([
            "practice_only",
            "screening",
            "first_interview",
            "follow_up",
            "final_interview",
        ].map((stage) => getCandidateStageBaselineQuestionCount(stage as Parameters<typeof getCandidateStageBaselineQuestionCount>[0]))).toEqual([
            5,
            5,
            7,
            10,
            10,
        ]);
    });
});
