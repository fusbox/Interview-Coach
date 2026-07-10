import { describe, expect, it, vi } from "vitest";

import {
    handleCandidateAnswerAnalysisRequest,
    resolveCandidateAnswerAnalysisIdentityFromDevLaunchCookie,
} from "./route";

describe("/candidate/session/[sessionId]/answers/[slotId]/analysis route", () => {
    it("resolves explicit dev host-launch cookies for answer analysis requests", () => {
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");

        expect(resolveCandidateAnswerAnalysisIdentityFromDevLaunchCookie(
            "ic_candidate_launch_session=dev-host-launch-100001",
        )).toEqual({
            candidateProfileId: "10000000-0000-4000-8000-000000000001",
        });
    });

    it("reads a candidate-owned pending answer and fails closed while the analysis provider is unavailable", async () => {
        const findSetupSession = vi.fn(async () => ({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            setupSnapshot: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials and maintain inventory.",
                resumeText: null,
                interviewStage: "first_interview" as const,
                questionCount: 7,
                resumeCaptureMode: "none" as const,
                createdAt: "2026-07-09T20:00:00.000Z",
            },
            questionWordingSnapshot: {
                status: "questions_worded" as const,
                questions: [
                    {
                        slotId: "slot-1",
                        index: 0,
                        category: "behavioral" as const,
                        questionText: "Tell me about a time you prioritized similar work.",
                    },
                ],
            },
            answerSubmissions: {
                "slot-1": {
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text" as const,
                    text: "I would ask a clarifying question first.",
                    submittedAt: "2026-07-09T20:01:00.000Z",
                    status: "pending_analysis" as const,
                },
            },
        }));
        const requestAnswerAnalysis = vi.fn(async () => null);

        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:02:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession,
            },
            requestAnswerAnalysis,
        });

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
            status: "answer_analysis_unavailable",
            reason: "provider_not_configured",
            request: {
                status: "answer_analysis_requested",
                requestedAt: "2026-07-09T20:02:00.000Z",
                answerSubmission: {
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                    submittedAt: "2026-07-09T20:01:00.000Z",
                    status: "pending_analysis",
                },
            },
        });
        expect(findSetupSession).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
        });
        expect(requestAnswerAnalysis).toHaveBeenCalledWith({
            status: "answer_analysis_provider_requested",
            provider: "candidate_v2_answer_evaluator",
            requestedAt: "2026-07-09T20:02:00.000Z",
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                submittedAt: "2026-07-09T20:01:00.000Z",
            },
            question: {
                slotId: "slot-1",
                questionIndex: 0,
                category: "behavioral",
                questionText: "Tell me about a time you prioritized similar work.",
            },
            setupContext: {
                targetRole: "Material Handler I",
                jobDescription: "Move materials and maintain inventory.",
                resumeText: null,
                interviewStage: "first_interview",
                questionCount: 7,
            },
        });
    });

    it("fails closed when candidate identity is unavailable", async () => {
        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:02:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => null),
            practiceSessionRepository: {
                findSetupSession: vi.fn(),
            },
        });

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: "Candidate session identity is required.",
        });
    });

    it("does not request analysis when the candidate-owned session has no pending answer for the slot", async () => {
        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:02:00.000Z"),
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
                        questionCount: 7,
                        resumeCaptureMode: "none" as const,
                        createdAt: "2026-07-09T20:00:00.000Z",
                    },
                    questionWordingSnapshot: {
                        status: "questions_worded" as const,
                        questions: [
                            {
                                slotId: "slot-1",
                                index: 0,
                                category: "behavioral" as const,
                                questionText: "Tell me about a time you prioritized similar work.",
                            },
                        ],
                    },
                    answerSubmissions: {},
                })),
            },
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "Candidate pending answer was not found.",
        });
    });

    it("persists a valid provider result as an isolated V2 analysis snapshot", async () => {
        const analysisSnapshot = {
            status: "answer_analysis_provider_result" as const,
            provider: "candidate_v2_answer_evaluator" as const,
            analyzedAt: "2026-07-09T20:03:00.000Z",
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
        const saveAnswerAnalysisSnapshot = vi.fn(async () => ({
            "slot-1": analysisSnapshot,
        }));

        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:02:00.000Z"),
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
                        questionCount: 7,
                        resumeCaptureMode: "none" as const,
                        createdAt: "2026-07-09T20:00:00.000Z",
                    },
                    questionWordingSnapshot: {
                        status: "questions_worded" as const,
                        questions: [
                            {
                                slotId: "slot-1",
                                index: 0,
                                category: "behavioral" as const,
                                questionText: "Tell me about a time you prioritized similar work.",
                            },
                        ],
                    },
                    answerSubmissions: {
                        "slot-1": {
                            slotId: "slot-1",
                            questionIndex: 0,
                            mode: "text" as const,
                            text: "I would ask a clarifying question first.",
                            submittedAt: "2026-07-09T20:01:00.000Z",
                            status: "pending_analysis" as const,
                        },
                    },
                })),
                saveAnswerAnalysisSnapshot,
            },
            requestAnswerAnalysis: vi.fn(async () => analysisSnapshot),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            status: "answer_analysis_saved",
            analysisSnapshot,
        });
        expect(saveAnswerAnalysisSnapshot).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            analysisSnapshot,
        });
    });
});
