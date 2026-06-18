import { describe, expect, it } from "vitest";

import {
    buildPracticeCoverageBaseline,
    buildQuestionPlan,
    getInterviewStageLabel,
    INTERVIEW_STAGE_OPTIONS,
    normalizeInterviewStage,
    parseQuestionPlanSnapshot,
    QUESTION_PLAN_CATEGORY_ORDER,
} from "./question-plan-service";

describe("question-plan-service", () => {
    it("creates an exact initial screening question mix in canonical category order", () => {
        const plan = buildQuestionPlan({
            interviewStage: "initial_screening",
            questionCount: 5,
        });

        expect(plan.questionCount).toBe(5);
        expect(plan.categoryCounts).toMatchObject({
            screening: 2,
            culture_fit: 1,
            behavioral: 1,
            technical_role_specific: 1,
        });
        expect(plan.slots).toHaveLength(5);
        expect(plan.slots.map((slot) => slot.category)).toEqual([
            "screening",
            "screening",
            "behavioral",
            "culture_fit",
            "technical_role_specific",
        ]);
    });

    it("keeps every generated slot within the canonical question category taxonomy", () => {
        const plan = buildQuestionPlan({
            interviewStage: "initial_interview",
            questionCount: 9,
        });

        expect(plan.slots).toHaveLength(9);
        expect(new Set(plan.slots.map((slot) => slot.category))).toEqual(new Set(QUESTION_PLAN_CATEGORY_ORDER));
        expect(plan.slots.map((slot) => slot.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        expect(Object.values(plan.categoryCounts).reduce((sum, count) => sum + count, 0)).toBe(9);
    });

    it("clamps manually requested question count to the supported recruiter range", () => {
        expect(buildQuestionPlan({ interviewStage: "not_sure", questionCount: 0 }).questionCount).toBe(1);
        expect(buildQuestionPlan({ interviewStage: "not_sure", questionCount: 50 }).questionCount).toBe(20);
    });

    it("exposes plain-language interview stage labels for users", () => {
        expect(INTERVIEW_STAGE_OPTIONS.map((option) => option.label)).toEqual([
            "Not sure yet",
            "First conversation or screening",
            "First interview",
            "Follow-up or final interview",
            "No interview scheduled",
        ]);
        expect(getInterviewStageLabel("initial_screening")).toBe("First conversation or screening");
        expect(getInterviewStageLabel(null)).toBe("Not sure yet");
    });

    it("normalizes missing or unknown interview stage values to not sure yet", () => {
        expect(normalizeInterviewStage(null)).toBe("not_sure");
        expect(normalizeInterviewStage("")).toBe("not_sure");
        expect(normalizeInterviewStage("screening")).toBe("not_sure");
        expect(normalizeInterviewStage("follow_up_final")).toBe("follow_up_final");
    });

    it("derives practice coverage baseline from the same stage-aware question plan", () => {
        const baseline = buildPracticeCoverageBaseline({
            interviewStage: "initial_screening",
            questionCount: 5,
        });

        expect(baseline).toEqual({
            interviewStage: "initial_screening",
            minimumQuestionCount: 5,
            categoryMinimums: expect.objectContaining({
                screening: 2,
                behavioral: 1,
                culture_fit: 1,
                technical_role_specific: 1,
                case_scenario: 0,
            }),
        });
    });

    it("parses persisted question plan snapshots and repairs inconsistent shapes", () => {
        const snapshot = parseQuestionPlanSnapshot({
            interviewStage: "initial_screening",
            questionCount: 3,
            categoryCounts: {
                screening: 1,
                behavioral: 1,
                culture_fit: 1,
                case_scenario: 0,
                technical_role_specific: 0,
            },
            slots: [
                { id: "screening-1", index: 0, category: "screening" },
                { id: "behavioral-1", index: 1, category: "behavioral" },
                { id: "culture_fit-1", index: 2, category: "culture_fit" },
            ],
        });

        expect(snapshot?.categoryCounts).toMatchObject({
            screening: 1,
            behavioral: 1,
            culture_fit: 1,
        });

        const repaired = parseQuestionPlanSnapshot({
            interviewStage: "initial_screening",
            questionCount: 3,
            categoryCounts: {
                screening: 1,
            },
            slots: [],
        });

        expect(repaired?.slots).toHaveLength(3);
        expect(repaired?.categoryCounts).toMatchObject({
            screening: 1,
            behavioral: 1,
            culture_fit: 1,
        });
    });
});
