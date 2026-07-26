import { describe, expect, it, vi } from "vitest";

import { createCandidateAnswerAnalysisProviderResultFixture } from "@/features/candidate-session-v2/candidate-answer-analysis-test-fixture";

import { handleCandidateFeedbackActionRequest } from "./route-implementation";

const analysisSnapshot = createCandidateAnswerAnalysisProviderResultFixture({
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
});

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

    it("rejects a forged transition that is not available from the posted stage", async () => {
        const response = await handleCandidateFeedbackActionRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/feedback-actions", {
                method: "POST",
                body: JSON.stringify({
                    status: "feedback_action_selected",
                    answer: { slotId: "slot-1", questionIndex: 0 },
                    stageId: "acknowledgement",
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
                    answerAnalysisSnapshots: { "slot-1": analysisSnapshot },
                })),
                saveFeedbackActionEvent: vi.fn(),
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "Feedback action is not available from this coaching stage.",
        });
    });

    it("rejects feedback retry without immutable answer-attempt identity", async () => {
        const response = await handleCandidateFeedbackActionRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/feedback-actions", {
                method: "POST",
                body: JSON.stringify({
                    status: "feedback_action_selected",
                    answer: { slotId: "slot-1", questionIndex: 0 },
                    stageId: "next_step",
                    actionKind: "retry_answer",
                    transition: "retry_current_question",
                    selectedAt: "2026-07-10T20:03:00.000Z",
                }),
            }),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    answerAnalysisSnapshots: { "slot-1": analysisSnapshot },
                })),
                saveFeedbackActionEvent: vi.fn(),
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "A feedback retry requires immutable answer-attempt identity.",
        });
    });

    it("persists retry only for the exact latest analyzed answer attempt", async () => {
        const answerAttemptId = "11111111-1111-4111-8111-111111111111";
        const analysisWithAttempt = {
            ...analysisSnapshot,
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
                answerAttemptId,
                attemptNumber: 1,
                trigger: "initial_submit" as const,
            },
        };
        const feedbackActionEvent = {
            status: "feedback_action_selected" as const,
            answer: analysisWithAttempt.answer,
            stageId: "next_step" as const,
            actionKind: "retry_answer" as const,
            transition: "retry_current_question" as const,
            selectedAt: "2026-07-10T20:03:00.000Z",
        };
        const saveFeedbackActionEvent = vi.fn(async () => ({ "slot-1": feedbackActionEvent }));

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
                findSetupSession: vi.fn(async () => ({
                    answerAnalysisSnapshots: { "slot-1": analysisWithAttempt },
                    answerSubmissions: {
                        "slot-1": {
                            slotId: "slot-1",
                            questionIndex: 0,
                            mode: "text" as const,
                            text: "Saved answer.",
                            submittedAt: "2026-07-10T20:01:00.000Z",
                            status: "pending_analysis" as const,
                            answerAttemptId,
                            attemptNumber: 1,
                            trigger: "initial_submit" as const,
                            supersedesAnswerAttemptId: null,
                        },
                    },
                })),
                saveFeedbackActionEvent,
            },
        });

        expect(response.status).toBe(200);
        expect(saveFeedbackActionEvent).toHaveBeenCalledWith(expect.objectContaining({
            feedbackActionEvent,
        }));
    });

    it("rejects an action whose attempt metadata conflicts with the saved attempt", async () => {
        const answerAttemptId = "11111111-1111-4111-8111-111111111111";
        const analysisWithAttempt = {
            ...analysisSnapshot,
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
                answerAttemptId,
                attemptNumber: 1,
                trigger: "initial_submit" as const,
            },
        };
        const response = await handleCandidateFeedbackActionRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/feedback-actions", {
                method: "POST",
                body: JSON.stringify({
                    status: "feedback_action_selected",
                    answer: {
                        ...analysisWithAttempt.answer,
                        attemptNumber: 2,
                    },
                    stageId: "next_step",
                    actionKind: "retry_answer",
                    transition: "retry_current_question",
                    selectedAt: "2026-07-10T20:03:00.000Z",
                }),
            }),
            sessionId: "session-1",
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    answerAnalysisSnapshots: { "slot-1": analysisWithAttempt },
                    answerSubmissions: {
                        "slot-1": {
                            slotId: "slot-1",
                            questionIndex: 0,
                            mode: "text" as const,
                            text: "Saved answer.",
                            submittedAt: "2026-07-10T20:01:00.000Z",
                            status: "pending_analysis" as const,
                            answerAttemptId,
                            attemptNumber: 1,
                            trigger: "initial_submit" as const,
                            supersedesAnswerAttemptId: null,
                        },
                    },
                })),
                saveFeedbackActionEvent: vi.fn(),
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "Feedback action does not match the latest analyzed answer attempt.",
        });
    });
});
