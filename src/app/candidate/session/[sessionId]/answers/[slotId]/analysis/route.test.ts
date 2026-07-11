import { describe, expect, it, vi } from "vitest";

import {
    createDefaultCandidateAnswerAnalysisDependencies,
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

    it("assembles no default analysis provider when provider config is missing", () => {
        vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable");
        vi.stubEnv("CANDIDATE_ANSWER_ANALYSIS_PROVIDER", "");

        expect(createDefaultCandidateAnswerAnalysisDependencies().requestAnswerAnalysis).toBeUndefined();
    });

    it("assembles the deterministic fixture analysis provider only for explicit local dev validation", async () => {
        vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");
        vi.stubEnv("CANDIDATE_ANSWER_ANALYSIS_PROVIDER", "fixture");

        const provider = createDefaultCandidateAnswerAnalysisDependencies().requestAnswerAnalysis;

        await expect(provider?.({
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
        })).resolves.toEqual({
            status: "answer_analysis_provider_result",
            provider: "candidate_v2_answer_evaluator",
            analyzedAt: "2026-07-09T20:02:00.000Z",
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
            },
            coachFeedback: {
                acknowledgement: "You have a workable starting point for this answer.",
                observation: "Your response connects to the question, but it will be stronger with a clearer example, action, and result.",
                nextPracticeFocus: "Practice adding one concrete detail from your work history and the outcome it led to.",
            },
            evidence: [
                {
                    criterionId: "answer_relevance",
                    applicability: "observed",
                    score: 3,
                },
                {
                    criterionId: "specific_example",
                    applicability: "insufficient_data",
                },
            ],
        });
    });

    it("does not assemble the fixture analysis provider outside explicit local dev validation", () => {
        vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "false");
        vi.stubEnv("CANDIDATE_ANSWER_ANALYSIS_PROVIDER", "fixture");

        expect(createDefaultCandidateAnswerAnalysisDependencies().requestAnswerAnalysis).toBeUndefined();
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

    it("replays completed answer analysis with the same idempotency key and submitted answer payload", async () => {
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
            evidence: [],
        };
        const responseBody = {
            status: "answer_analysis_saved",
            analysisSnapshot,
        };
        const requestAnswerAnalysis = vi.fn();

        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
                headers: {
                    "Idempotency-Key": "client-analysis-key-1",
                },
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:03:30.000Z"),
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
                        questions: [],
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
                    answerIdempotencyRecords: {
                        "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-analysis-key-1": {
                            recordKey: "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-analysis-key-1",
                            operation: "answer_analysis" as const,
                            scope: "candidate_answer_analysis:session-1:slot-1",
                            actorId: "22222222-2222-4222-8222-222222222222",
                            key: "client-analysis-key-1",
                            payload: {
                                candidatePracticeSessionId: "session-1",
                                slotId: "slot-1",
                                questionIndex: 0,
                                mode: "text" as const,
                                text: "I would ask a clarifying question first.",
                                submittedAt: "2026-07-09T20:01:00.000Z",
                            },
                            status: "completed" as const,
                            requestedAt: "2026-07-09T20:02:00.000Z",
                            completedAt: "2026-07-09T20:03:00.000Z",
                            response: {
                                statusCode: 200,
                                body: responseBody,
                            },
                        },
                    },
                })),
            },
            requestAnswerAnalysis,
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(responseBody);
        expect(requestAnswerAnalysis).not.toHaveBeenCalled();
    });

    it("returns a retryable conflict when the same answer analysis is already in progress", async () => {
        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
                headers: {
                    "Idempotency-Key": "client-analysis-key-1",
                },
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:03:30.000Z"),
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
                    questionWordingSnapshot: null,
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
                    answerIdempotencyRecords: {
                        "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-analysis-key-1": {
                            recordKey: "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-analysis-key-1",
                            operation: "answer_analysis" as const,
                            scope: "candidate_answer_analysis:session-1:slot-1",
                            actorId: "22222222-2222-4222-8222-222222222222",
                            key: "client-analysis-key-1",
                            payload: {
                                candidatePracticeSessionId: "session-1",
                                slotId: "slot-1",
                                questionIndex: 0,
                                mode: "text" as const,
                                text: "I would ask a clarifying question first.",
                                submittedAt: "2026-07-09T20:01:00.000Z",
                            },
                            status: "pending" as const,
                            requestedAt: "2026-07-09T20:02:00.000Z",
                        },
                    },
                })),
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            code: "REQUEST_IN_PROGRESS",
            error: "An identical answer analysis request is already in progress.",
            retryable: true,
        });
    });

    it("returns a nonretryable conflict when an answer analysis key is reused with a different submitted answer", async () => {
        const response = await handleCandidateAnswerAnalysisRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers/slot-1/analysis", {
                method: "POST",
                headers: {
                    "Idempotency-Key": "client-analysis-key-1",
                },
            }),
            sessionId: "session-1",
            slotId: "slot-1",
            now: new Date("2026-07-09T20:03:30.000Z"),
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
                    questionWordingSnapshot: null,
                    answerSubmissions: {
                        "slot-1": {
                            slotId: "slot-1",
                            questionIndex: 0,
                            mode: "text" as const,
                            text: "This is a changed answer.",
                            submittedAt: "2026-07-09T20:01:00.000Z",
                            status: "pending_analysis" as const,
                        },
                    },
                    answerIdempotencyRecords: {
                        "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-analysis-key-1": {
                            recordKey: "answer_analysis:candidate_answer_analysis:session-1:slot-1:client-analysis-key-1",
                            operation: "answer_analysis" as const,
                            scope: "candidate_answer_analysis:session-1:slot-1",
                            actorId: "22222222-2222-4222-8222-222222222222",
                            key: "client-analysis-key-1",
                            payload: {
                                candidatePracticeSessionId: "session-1",
                                slotId: "slot-1",
                                questionIndex: 0,
                                mode: "text" as const,
                                text: "I would ask a clarifying question first.",
                                submittedAt: "2026-07-09T20:01:00.000Z",
                            },
                            status: "completed" as const,
                            requestedAt: "2026-07-09T20:02:00.000Z",
                        },
                    },
                })),
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            code: "IDEMPOTENCY_MISMATCH",
            error: "Idempotency key cannot be reused with a different answer analysis payload.",
            retryable: false,
        });
    });
});
