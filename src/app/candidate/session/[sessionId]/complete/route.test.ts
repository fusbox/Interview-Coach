import { afterEach, describe, expect, it, vi } from "vitest";

import {
    createDefaultCandidateSessionCompleteDependencies,
    handleCandidateSessionCompleteRequest,
} from "./route";

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
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("assembles Coach Update fixture and fault runtimes only inside explicit local development", () => {
        vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5432/interviewcoach_smoke");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "test-secret");
        vi.stubEnv("CANDIDATE_ANSWER_ANALYSIS_PROVIDER", "fixture");
        vi.stubEnv("NODE_ENV", "test");

        expect(createDefaultCandidateSessionCompleteDependencies().ensureCoachUpdateArtifact).toEqual(expect.any(Function));

        vi.stubEnv("CANDIDATE_COACH_UPDATE_PROVIDER", "fault");
        vi.stubEnv("CANDIDATE_COACH_UPDATE_FAULT_MODE", "provider_5xx");
        expect(createDefaultCandidateSessionCompleteDependencies().ensureCoachUpdateArtifact).toEqual(expect.any(Function));

        vi.stubEnv("NODE_ENV", "production");
        expect(createDefaultCandidateSessionCompleteDependencies().ensureCoachUpdateArtifact).toBeUndefined();
    });

    it("persists candidate-led completion from the durable session facts and returns the dashboard transition", async () => {
        const completeSession = vi.fn(async (input) => ({
            completionSnapshot: input.completionSnapshot,
            progress: input.completionSnapshot.finalProgress,
        }));
        const ensureCoachUpdateArtifact = vi.fn(async () => ({
            status: "coach_update_unavailable" as const,
            reason: "source_not_ready" as const,
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
                    roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
            ensureCoachUpdateArtifact,
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
                nextRoute: "/candidate/dashboard?prep=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            },
            nextRoute: "/candidate/dashboard?prep=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            coachUpdateStatus: "coach_update_unavailable",
        });
        expect(completeSession).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            completionSnapshot: expect.objectContaining({
                status: "candidate_session_completed",
                nextRoute: "/candidate/dashboard?prep=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            }),
        });
        expect(ensureCoachUpdateArtifact).toHaveBeenCalledWith({
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            sourceCandidatePracticeSessionId: "session-1",
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

    it("replays the first stored completion without rebuilding it from later compatibility fields", async () => {
        const completionSnapshot = {
            status: "candidate_session_completed" as const,
            audience: "candidate_led" as const,
            sessionId: "session-1",
            completedAt: "2026-07-09T20:05:00.000Z",
            finalProgress: { status: "completed" as const, currentQuestionIndex: 0 },
            questionCount: 1,
            answeredCount: 1,
            coachedCount: 1,
            answeredQuestionKeys: ["slot-1"],
            coachedQuestionKeys: ["slot-1"],
            skippedOrUnansweredQuestionKeys: [],
            nextRoute: "/candidate/dashboard?prep=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        };
        const completeSession = vi.fn(async () => ({
            completionSnapshot,
            progress: completionSnapshot.finalProgress,
        }));
        const ensureCoachUpdateArtifact = vi.fn(async () => {
            throw new Error("provider detail must not block completion");
        });
        const response = await handleCandidateSessionCompleteRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/complete", {
                method: "POST",
            }),
            sessionId: "session-1",
            now: new Date("2026-07-10T20:05:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    status: "completed" as const,
                    completionSnapshot,
                    questionWordingSnapshot: null,
                })),
                completeSession,
            },
            ensureCoachUpdateArtifact,
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            status: "candidate_session_completed",
            completionSnapshot: {
                completedAt: "2026-07-09T20:05:00.000Z",
            },
            coachUpdateStatus: "coach_update_unavailable",
        });
        expect(completeSession).toHaveBeenCalledWith(expect.objectContaining({ completionSnapshot }));
        expect(ensureCoachUpdateArtifact).toHaveBeenCalledTimes(1);
    });
});
