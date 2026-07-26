import { describe, expect, it } from "vitest";

import { createCandidateAnswerAnalysisProviderResultFixture } from "@/features/candidate-session-v2/candidate-answer-analysis-test-fixture";
import type { InvitedPracticeSessionRuntimeRecord } from "./invited-practice-session-runtime-repository";
import { createInvitedPracticeDebrief } from "./invited-practice-debrief";

describe("invited practice debrief", () => {
    it("projects only the latest saved answer and candidate-safe coaching in question order", () => {
        const result = createInvitedPracticeDebrief(completedSession(), 2);

        expect(result).toMatchObject({
            sessionId: "session-2",
            sessionAttemptNumber: 2,
            targetRole: "Quality Inspector",
            questionCount: 2,
            answeredCount: 2,
            coachedCount: 1,
            questions: [
                {
                    questionNumber: 1,
                    answerText: "My latest answer.",
                    coaching: {
                        observation: "Your example is relevant.",
                        nextPracticeFocus: "Add the outcome.",
                    },
                },
                {
                    questionNumber: 2,
                    answerText: "My second answer.",
                    coaching: null,
                },
            ],
        });
        expect(result).not.toHaveProperty("questions.0.evidence");
    });

    it("does not create a debrief for an unfinished session", () => {
        expect(createInvitedPracticeDebrief({
            ...completedSession(),
            status: "in_progress",
            completionSnapshot: null,
        }, 1)).toBeNull();
    });
});

function completedSession(): InvitedPracticeSessionRuntimeRecord {
    return {
        invitedPracticeSessionId: "session-2",
        recruiterInvitationRecipientId: "recipient-1",
        recruiterId: "recruiter-1",
        status: "completed",
        setupSnapshot: {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect products.",
            resumeText: null,
            interviewStage: "screening",
            questionCount: 2,
            resumeCaptureMode: "none",
            createdAt: "2026-07-20T00:00:00.000Z",
        },
        questionPlanSnapshot: {
            interviewStage: "screening",
            questionCount: 2,
            categoryCounts: {
                screening: 2,
                behavioral: 0,
                culture_fit: 0,
                case_scenario: 0,
                technical_role_specific: 0,
            },
            slots: [],
        },
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [
                { slotId: "slot-2", index: 1, category: "screening", questionText: "Question two?" },
                { slotId: "slot-1", index: 0, category: "behavioral", questionText: "Question one?" },
            ],
        },
        progress: { status: "completed", currentQuestionIndex: 1 },
        answerDrafts: {},
        answerSubmissions: {
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 1,
                mode: "text",
                text: "My latest answer.",
                submittedAt: "2026-07-20T00:05:00.000Z",
                status: "pending_analysis",
            },
            "slot-2": {
                slotId: "slot-2",
                questionIndex: 2,
                mode: "text",
                text: "My second answer.",
                submittedAt: "2026-07-20T00:06:00.000Z",
                status: "pending_analysis",
            },
        },
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {
            "slot-1": createCandidateAnswerAnalysisProviderResultFixture({
                analyzedAt: "2026-07-20T00:05:05.000Z",
                answer: { slotId: "slot-1", questionIndex: 1 },
                coachFeedback: {
                    acknowledgement: "You gave a relevant example.",
                    observation: "Your example is relevant.",
                    nextPracticeFocus: "Add the outcome.",
                },
            }),
        },
        feedbackActionEvents: {},
        completionSnapshot: {
            status: "invited_session_completed",
            audience: "invited_candidate",
            sessionId: "session-2",
            completedAt: "2026-07-20T00:07:00.000Z",
            finalProgress: { status: "completed", currentQuestionIndex: 1 },
            questionCount: 2,
            answeredCount: 2,
            coachedCount: 1,
            answeredQuestionKeys: ["slot-1", "slot-2"],
            coachedQuestionKeys: ["slot-1"],
            skippedOrUnansweredQuestionKeys: [],
            nextRoute: "/candidate/invited",
        },
    };
}
