import { describe, expect, it } from "vitest";

import { createCandidateQuestionPlan } from "./candidate-question-plan";
import {
    createCandidateQuestionWordingUnavailableResult,
    createFixtureCandidateQuestionWordingResult,
    createCandidateQuestionWordingRequest,
    parseCandidateQuestionWordingResult,
} from "./candidate-question-wording";

const setupSnapshot = {
    targetRole: "Customer service representative",
    jobDescription: "Help customers resolve billing and service questions.",
    resumeText: "Supported a high-volume front desk.",
    interviewStage: "screening" as const,
    questionCount: 5,
    resumeCaptureMode: "pasted_text" as const,
    createdAt: "2026-07-08T18:00:00.000Z",
};

describe("candidate question wording boundary", () => {
    it("creates a wording request from one setup snapshot and one plan snapshot", () => {
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 5,
        });

        expect(createCandidateQuestionWordingRequest({
            setupSnapshot,
            questionPlanSnapshot,
            now: new Date("2026-07-08T19:00:00.000Z"),
        })).toEqual({
            status: "question_wording_requested",
            requestedAt: "2026-07-08T19:00:00.000Z",
            setupSnapshot,
            questionPlanSnapshot,
        });
    });

    it("rejects a wording request when the plan snapshot does not match setup", () => {
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 5,
        });

        expect(() => createCandidateQuestionWordingRequest({
            setupSnapshot,
            questionPlanSnapshot,
            now: new Date("2026-07-08T19:00:00.000Z"),
        })).toThrow("Question plan snapshot does not match setup snapshot.");
    });

    it("accepts question wording only when every question maps to the carried plan", () => {
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 3,
        });

        expect(parseCandidateQuestionWordingResult({
            status: "questions_worded",
            questions: [
                {
                    slotId: "slot-1",
                    category: "screening",
                    questionText: "What interests you about this customer service role?",
                },
                {
                    slotId: "slot-2",
                    category: "behavioral",
                    questionText: "Tell me about a time you helped someone resolve a problem.",
                },
                {
                    slotId: "slot-3",
                    category: "culture_fit",
                    questionText: "What kind of support helps you do your best work?",
                },
            ],
        }, questionPlanSnapshot)).toEqual({
            status: "questions_worded",
            questions: [
                expect.objectContaining({
                    slotId: "slot-1",
                    index: 0,
                    category: "screening",
                }),
                expect.objectContaining({
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral",
                }),
                expect.objectContaining({
                    slotId: "slot-3",
                    index: 2,
                    category: "culture_fit",
                }),
            ],
        });
    });

    it("rejects question wording that skips, duplicates, or misclassifies plan slots", () => {
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 3,
        });

        expect(() => parseCandidateQuestionWordingResult({
            status: "questions_worded",
            questions: [
                {
                    slotId: "slot-1",
                    category: "screening",
                    questionText: "What interests you about this customer service role?",
                },
                {
                    slotId: "slot-1",
                    category: "screening",
                    questionText: "What customer issue have you handled before?",
                },
                {
                    slotId: "slot-3",
                    category: "behavioral",
                    questionText: "Tell me how you prefer to work with a team.",
                },
            ],
        }, questionPlanSnapshot)).toThrow("Question wording result must map exactly to the question plan.");
    });

    it("represents unavailable wording as an explicit fail-closed result", () => {
        expect(createCandidateQuestionWordingUnavailableResult()).toEqual({
            status: "question_wording_unavailable",
            reason: "provider_not_configured",
        });
    });

    it("creates deterministic fixture wording that parses through the strict result boundary", () => {
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 5,
        });

        const result = parseCandidateQuestionWordingResult(
            createFixtureCandidateQuestionWordingResult({
                setupSnapshot,
                questionPlanSnapshot,
            }),
            questionPlanSnapshot,
        );

        expect(result).toMatchObject({
            status: "questions_worded",
            questions: [
                {
                    slotId: "slot-1",
                    index: 0,
                    category: "screening",
                    questionText: "What interests you about this Customer service representative role?",
                },
                {
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral",
                    questionText: "Tell me about a time you handled work similar to this Customer service representative role.",
                },
                {
                    slotId: "slot-3",
                    index: 2,
                    category: "culture_fit",
                },
                {
                    slotId: "slot-4",
                    index: 3,
                    category: "screening",
                },
                {
                    slotId: "slot-5",
                    index: 4,
                    category: "technical_role_specific",
                },
            ],
        });
        expect(result.questions).toHaveLength(5);
        expect(result.questions[1].questionText).not.toContain(setupSnapshot.jobDescription);
        expect(result.questions.every((question) => question.questionText.length < 180)).toBe(true);
        expect(result.questions.every((question) => !("assistance" in question))).toBe(true);
    });
});
