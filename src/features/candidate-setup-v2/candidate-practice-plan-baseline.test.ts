import { describe, expect, it } from "vitest";

import { createFixtureCandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";
import {
    createCandidatePracticePlanBaseline,
    createCandidateQuestionGenerationPlan,
    deriveCandidateBaselineWording,
    deriveCandidateInitialRoundPlan,
    deriveCandidateInitialRoundWording,
    getCandidateStageBaselineQuestionCount,
    parseCandidatePracticePlanBaselineSnapshot,
} from "./candidate-practice-plan-baseline";

describe("candidate practice-plan baseline", () => {
    it("keeps the full stage baseline in the initial session when the selected pace is smaller", () => {
        const baseline = createCandidatePracticePlanBaseline("first_interview", 3);
        const generationPlan = createCandidateQuestionGenerationPlan({ baseline, selectedQuestionCount: 3 });
        const round = deriveCandidateInitialRoundPlan({ baseline, generationPlan });

        expect(baseline.questionCount).toBe(7);
        expect(generationPlan.questionCount).toBe(7);
        expect(round.questionCount).toBe(7);
        expect(baseline).toMatchObject({
            status: "candidate_practice_plan_baseline_v2",
            stageRecommendedQuestionCount: 7,
            paceSize: 3,
        });
        expect(round.slots.map((slot) => [slot.planQuestionId, slot.coverageKind])).toEqual([
            ["slot-1", "baseline"],
            ["slot-2", "baseline"],
            ["slot-3", "baseline"],
            ["slot-4", "baseline"],
            ["slot-5", "baseline"],
            ["slot-6", "baseline"],
            ["slot-7", "baseline"],
        ]);
    });

    it("expands the canonical denominator when setup selects more than the stage recommendation", () => {
        const baseline = createCandidatePracticePlanBaseline("screening", 7);
        const generationPlan = createCandidateQuestionGenerationPlan({ baseline, selectedQuestionCount: 7 });
        const round = deriveCandidateInitialRoundPlan({ baseline, generationPlan });

        expect(baseline.questionCount).toBe(7);
        expect(baseline.stageRecommendedQuestionCount).toBe(5);
        expect(round.slots.every((slot) => slot.coverageKind === "baseline")).toBe(true);
    });

    it("persists full baseline wording in the canonical initial session", () => {
        const baseline = createCandidatePracticePlanBaseline("first_interview", 3);
        const generationPlan = createCandidateQuestionGenerationPlan({ baseline, selectedQuestionCount: 3 });
        const round = deriveCandidateInitialRoundPlan({ baseline, generationPlan });
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
        expect(deriveCandidateInitialRoundWording({ roundPlan: round, generatedWording }).questions).toHaveLength(7);
    });

    it("rejects a persisted pace larger than its immutable baseline", () => {
        const baseline = createCandidatePracticePlanBaseline("screening", 5);

        expect(parseCandidatePracticePlanBaselineSnapshot({
            ...baseline,
            paceSize: 7,
        })).toBeNull();
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
