import { describe, expect, it, vi } from "vitest";

import { handleCandidateFeedbackActionRequest } from "./route";

const analysisSnapshot = {
    status: "answer_analysis_provider_result" as const,
    provider: "candidate_v2_answer_evaluator" as const,
    analyzedAt: "2026-07-10T20:02:00.000Z",
    answer: {
        slotId: "slot-1",
        questionIndex: 0,
    },
    coachFeedback: {
        acknowledgement: "You named a practical first step.",
        observation: "The answer would be stronger with the result of your choice.",
        nextPracticeFocus: "Add what changed after you set the priority.",
    },
    evidence: [
        {
            criterionId: "answer_specificity",
            applicability: "observed" as const,
            score: 3,
        },
    ],
};

describe("/candidate/session/[sessionId]/feedback-actions route", () => {
    it("persists a selected feedback action after candidate-owned analysis exists", async () => {
        const feedbackActionEvent = {
            status: "feedback_action_selected" as const,
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
            },
            stageId: "next_step" as const,
            actionKind: "continue_to_next_question" as const,
            transition: "advance_to_next_question" as const,
            selectedAt: "2026-07-10T20:03:00.000Z",
        };
        const findSetupSession = vi.fn(async () => ({
            answerAnalysisSnapshots: {
                "slot-1": analysisSnapshot,
            },
        }));
        const saveFeedbackActionEvent = vi.fn(async () => ({
            "slot-1": feedbackActionEvent,
        }));

        const response = await handleCandidateFeedbackActionRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/feedback-actions", {
                method: "POST",
                body: JSON.stringify(feedbackActionEvent),
            }),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession,
                saveFeedbackActionEvent,
            },
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            status: "feedback_action_saved",
            feedbackActionEvents: {
                "slot-1": feedbackActionEvent,
            },
        });
        expect(findSetupSession).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
        });
        expect(saveFeedbackActionEvent).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            feedbackActionEvent,
        });
    });

    it("fails closed when the selected action does not map to a saved analysis snapshot", async () => {
        const response = await handleCandidateFeedbackActionRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/feedback-actions", {
                method: "POST",
                body: JSON.stringify({
                    status: "feedback_action_selected",
                    answer: {
                        slotId: "slot-2",
                        questionIndex: 1,
                    },
                    stageId: "next_step",
                    actionKind: "continue_to_next_question",
                    transition: "advance_to_next_question",
                    selectedAt: "2026-07-10T20:03:00.000Z",
                }),
            }),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    answerAnalysisSnapshots: {
                        "slot-1": analysisSnapshot,
                    },
                })),
                saveFeedbackActionEvent: vi.fn(),
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "Feedback action does not match a saved analysis snapshot.",
        });
    });
});
