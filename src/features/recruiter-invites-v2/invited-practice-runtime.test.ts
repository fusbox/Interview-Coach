import { describe, expect, it } from "vitest";

import { createInvitedPracticeRuntimeSeed } from "./invited-practice-runtime";

describe("invited practice runtime seed", () => {
    it("projects an invite-owned session into the shared audience-neutral runtime", () => {
        const runtime = createInvitedPracticeRuntimeSeed({
            sessionId: "session-1",
            recipientId: "recipient-1",
            recruiterId: "recruiter-1",
            parentSessionId: null,
            attemptNumber: 1,
            status: "planned",
            setupSnapshot: {
                targetRole: "Quality Inspector",
                interviewStage: "screening",
            },
            questionPlanSnapshot: {
                interviewStage: "screening",
                questionCount: 1,
                categoryCounts: {
                    screening: 1,
                    behavioral: 0,
                    culture_fit: 0,
                    case_scenario: 0,
                    technical_role_specific: 0,
                },
                slots: [{
                    id: "slot-1",
                    index: 0,
                    category: "screening",
                    label: "Screening",
                    purpose: "Basic fit.",
                }],
            },
            questionWordingSnapshot: {
                status: "questions_worded",
                questions: [{
                    slotId: "slot-1",
                    index: 0,
                    category: "screening",
                    questionText: "Why are you interested?",
                }],
            },
            progress: {
                status: "planned",
                currentQuestionIndex: 0,
            },
        });

        expect(runtime).toMatchObject({
            audience: "invited_candidate",
            sessionId: "session-1",
            targetRole: "Quality Inspector",
            questionCount: 1,
            answeredCount: 0,
            coachedCount: 0,
            completionBehavior: {
                kind: "invited_debrief",
                practiceAgainEnabled: true,
            },
        });
        expect(runtime).not.toHaveProperty("candidateProfileId");
        expect(runtime).not.toHaveProperty("recruiterId");
    });
});
