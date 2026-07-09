import { describe, expect, it } from "vitest";

import { createCandidateQuestionPlan } from "./candidate-question-plan";

describe("candidate question plan", () => {
    it("creates a screening plan that emphasizes screening before deeper categories", () => {
        expect(createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 5,
        })).toMatchObject({
            interviewStage: "screening",
            questionCount: 5,
            categoryCounts: {
                screening: 2,
                behavioral: 1,
                culture_fit: 1,
                case_scenario: 0,
                technical_role_specific: 1,
            },
            slots: [
                { id: "slot-1", index: 0, category: "screening", label: "Screening" },
                { id: "slot-2", index: 1, category: "behavioral", label: "Behavioral" },
                { id: "slot-3", index: 2, category: "culture_fit", label: "Culture / Fit" },
                { id: "slot-4", index: 3, category: "screening", label: "Screening" },
                { id: "slot-5", index: 4, category: "technical_role_specific", label: "Technical / Role-Specific" },
            ],
        });
    });

    it("creates a first interview plan across all five question categories", () => {
        expect(createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 7,
        }).categoryCounts).toEqual({
            screening: 2,
            behavioral: 2,
            culture_fit: 1,
            case_scenario: 1,
            technical_role_specific: 1,
        });
    });

    it("creates a final interview plan without screening emphasis", () => {
        expect(createCandidateQuestionPlan({
            interviewStage: "final_interview",
            questionCount: 10,
        }).categoryCounts).toEqual({
            screening: 0,
            behavioral: 3,
            culture_fit: 3,
            case_scenario: 2,
            technical_role_specific: 2,
        });
    });
});
