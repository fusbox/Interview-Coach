import { describe, expect, it } from "vitest";

import { createCandidateSetupSessionTransition } from "./candidate-setup-session-creation";

describe("candidate setup session creation boundary", () => {
    it("normalizes setup input into a provisional candidate session transition", () => {
        expect(createCandidateSetupSessionTransition({
            payload: {
                targetRole: " Customer service representative ",
                jobDescription: " Help customers resolve service questions. ",
                resumeText: " Supported a front desk. ",
                interviewStage: "screening",
                questionCount: "5",
            },
            now: new Date("2026-07-08T18:00:00.000Z"),
            createSessionId: () => "candidate-session-123",
        })).toMatchObject({
            status: "session_created",
            sessionId: "candidate-session-123",
            nextRoute: "/candidate/session/candidate-session-123",
            setupSnapshot: {
                targetRole: "Customer service representative",
                jobDescription: "Help customers resolve service questions.",
                resumeText: "Supported a front desk.",
                interviewStage: "screening",
                questionCount: 5,
                resumeCaptureMode: "pasted_text",
                createdAt: "2026-07-08T18:00:00.000Z",
            },
            questionPlanSnapshot: {
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
                    expect.objectContaining({ id: "slot-1", category: "screening", label: "Screening" }),
                    expect.objectContaining({ id: "slot-2", category: "behavioral", label: "Behavioral" }),
                    expect.objectContaining({ id: "slot-3", category: "culture_fit", label: "Culture / Fit" }),
                    expect.objectContaining({ id: "slot-4", category: "screening", label: "Screening" }),
                    expect.objectContaining({
                        id: "slot-5",
                        category: "technical_role_specific",
                        label: "Technical / Role-Specific",
                    }),
                ],
            },
            questionWordingSnapshot: {
                status: "questions_worded",
                questions: [
                    expect.objectContaining({
                        slotId: "slot-1",
                        index: 0,
                        category: "screening",
                        questionText: "What interests you about this Customer service representative role?",
                    }),
                    expect.objectContaining({
                        slotId: "slot-2",
                        index: 1,
                        category: "behavioral",
                        questionText: "Tell me about a time you handled work similar to this Customer service representative role.",
                    }),
                    expect.objectContaining({
                        slotId: "slot-3",
                        index: 2,
                        category: "culture_fit",
                    }),
                    expect.objectContaining({
                        slotId: "slot-4",
                        index: 3,
                        category: "screening",
                    }),
                    expect.objectContaining({
                        slotId: "slot-5",
                        index: 4,
                        category: "technical_role_specific",
                    }),
                ],
            },
        });
    });

    it("rejects invalid setup input before a session id is consumed", () => {
        let consumed = false;

        expect(() => createCandidateSetupSessionTransition({
            payload: {
                targetRole: "",
                jobDescription: " ",
                interviewStage: "screening",
                questionCount: 5,
            },
            now: new Date("2026-07-08T18:00:00.000Z"),
            createSessionId: () => {
                consumed = true;
                return "candidate-session-123";
            },
        })).toThrow("Invalid candidate setup input.");
        expect(consumed).toBe(false);
    });
});
