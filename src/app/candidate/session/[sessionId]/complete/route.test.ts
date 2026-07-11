import { describe, expect, it, vi } from "vitest";

import { handleCandidateSessionCompleteRequest } from "./route";

const analysisSnapshot = {
    status: "answer_analysis_provider_result" as const,
    provider: "candidate_v2_answer_evaluator" as const,
    analyzedAt: "2026-07-10T22:03:00.000Z",
    answer: {
        slotId: "slot-1",
        questionIndex: 0,
    },
    coachFeedback: {
        acknowledgement: "You gave a direct answer.",
        observation: "Add a specific example.",
        nextPracticeFocus: "Name one task you handled well.",
    },
    evidence: [
        {
            criterionId: "answer_specificity",
            applicability: "observed" as const,
            score: 3,
        },
    ],
};

describe("/candidate/session/[sessionId]/complete route", () => {
    it("persists candidate-led completion from the durable session facts and returns the dashboard transition", async () => {
        const completeSession = vi.fn(async (input) => ({
            completionSnapshot: input.completionSnapshot,
            progress: input.completionSnapshot.finalProgress,
        }));

        const response = await handleCandidateSessionCompleteRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/complete", {
                method: "POST",
            }),
            sessionId: "session-1",
            now: new Date("2026-07-10T22:10:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    candidatePracticeSessionId: "session-1",
                    candidateProfileId: "22222222-2222-4222-8222-222222222222",
                    setupSnapshot: {
                        targetRole: "Material Handler I",
                        jobDescription: "Move materials and maintain inventory.",
                        resumeText: null,
                        interviewStage: "first_interview" as const,
                        questionCount: 3,
                        resumeCaptureMode: "none" as const,
                        createdAt: "2026-07-10T22:00:00.000Z",
                    },
                    questionWordingSnapshot: {
                        status: "questions_worded" as const,
                        questions: [
                            {
                                slotId: "slot-1",
                                index: 0,
                                category: "screening" as const,
                                questionText: "What interests you about this Material Handler role?",
                            },
                            {
                                slotId: "slot-2",
                                index: 1,
                                category: "behavioral" as const,
                                questionText: "Tell me about a time you handled a deadline.",
                            },
                            {
                                slotId: "slot-3",
                                index: 2,
                                category: "case_scenario" as const,
                                questionText: "How would you handle a shipment delay?",
                            },
                        ],
                    },
                    progress: {
                        status: "live_question" as const,
                        currentQuestionIndex: 2,
                    },
                    answerSubmissions: {
                        "slot-1": {
                            slotId: "slot-1",
                            questionIndex: 0,
                            mode: "text" as const,
                            text: "I like keeping materials organized.",
                            submittedAt: "2026-07-10T22:01:00.000Z",
                            status: "pending_analysis" as const,
                        },
                        "slot-2": {
                            slotId: "slot-2",
                            questionIndex: 1,
                            mode: "text" as const,
                            text: "I prioritized the urgent shipment.",
                            submittedAt: "2026-07-10T22:05:00.000Z",
                            status: "pending_analysis" as const,
                        },
                    },
                    answerAnalysisSnapshots: {
                        "slot-1": analysisSnapshot,
                    },
                })),
                completeSession,
            },
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            status: "candidate_session_completed",
            completionSnapshot: {
                status: "candidate_session_completed",
                audience: "candidate_led",
                sessionId: "session-1",
                completedAt: "2026-07-10T22:10:00.000Z",
                finalProgress: {
                    status: "completed",
                    currentQuestionIndex: 2,
                },
                questionCount: 3,
                answeredCount: 2,
                coachedCount: 1,
                answeredQuestionKeys: ["slot-1", "slot-2"],
                coachedQuestionKeys: ["slot-1"],
                skippedOrUnansweredQuestionKeys: ["slot-3"],
                nextRoute: "/candidate/dashboard",
            },
            nextRoute: "/candidate/dashboard",
        });
        expect(completeSession).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            completionSnapshot: expect.objectContaining({
                status: "candidate_session_completed",
                nextRoute: "/candidate/dashboard",
            }),
        });
    });

    it("fails closed when question wording is unavailable", async () => {
        const response = await handleCandidateSessionCompleteRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/complete", {
                method: "POST",
            }),
            sessionId: "session-1",
            now: new Date("2026-07-10T22:10:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    candidatePracticeSessionId: "session-1",
                    candidateProfileId: "22222222-2222-4222-8222-222222222222",
                    questionWordingSnapshot: null,
                })),
                completeSession: vi.fn(),
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "Question wording is required before completion.",
        });
    });
});
