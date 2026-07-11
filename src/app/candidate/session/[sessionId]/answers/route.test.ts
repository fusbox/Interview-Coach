import { describe, expect, it, vi } from "vitest";

import { handleCandidateAnswerSubmitRequest, resolveCandidateAnswerSubmitIdentityFromDevLaunchCookie } from "./route";

describe("/candidate/session/[sessionId]/answers route", () => {
    it("resolves explicit dev host-launch cookies for answer submit attempts", () => {
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
        vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");

        expect(resolveCandidateAnswerSubmitIdentityFromDevLaunchCookie(
            "ic_candidate_launch_session=dev-host-launch-100001",
        )).toEqual({
            candidateProfileId: "10000000-0000-4000-8000-000000000001",
        });
    });

    it("persists a typed answer submission after candidate-owned session verification", async () => {
        const findSetupSession = vi.fn(async () => ({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            answerIdempotencyRecords: {},
        }));
        const saveAnswerSubmission = vi.fn(async () => ({
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text" as const,
                text: "I would ask a clarifying question first.",
                submittedAt: "2026-07-09T20:01:00.000Z",
                status: "pending_analysis" as const,
            },
        }));

        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:01:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession,
                saveAnswerSubmission,
            },
        });

        expect(response.status).toBe(202);
        await expect(response.json()).resolves.toEqual({
            status: "answer_submit_saved",
            answerSubmissions: {
                "slot-1": {
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                    submittedAt: "2026-07-09T20:01:00.000Z",
                    status: "pending_analysis",
                },
            },
            request: {
                status: "answer_submit_requested",
                requestedAt: "2026-07-09T20:01:00.000Z",
                draft: {
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                    updatedAt: "2026-07-09T20:01:00.000Z",
                },
            },
            next: "analysis_not_connected",
        });
        expect(findSetupSession).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
        });
        expect(saveAnswerSubmission).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            candidateProfileId: "22222222-2222-4222-8222-222222222222",
            answerSubmission: {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                submittedAt: "2026-07-09T20:01:00.000Z",
                status: "pending_analysis",
            },
        });
    });

    it("replays a completed typed answer submit with the same idempotency key and payload", async () => {
        const responseBody = {
            status: "answer_submit_saved",
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
            next: "analysis_not_connected",
        };
        const saveAnswerSubmission = vi.fn();

        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                headers: {
                    "Idempotency-Key": "client-submit-key-1",
                },
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:01:30.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    answerIdempotencyRecords: {
                        "answer_submit:candidate_answer_submit:session-1:slot-1:client-submit-key-1": {
                            recordKey: "answer_submit:candidate_answer_submit:session-1:slot-1:client-submit-key-1",
                            operation: "answer_submit" as const,
                            scope: "candidate_answer_submit:session-1:slot-1",
                            actorId: "22222222-2222-4222-8222-222222222222",
                            key: "client-submit-key-1",
                            payload: {
                                candidatePracticeSessionId: "session-1",
                                slotId: "slot-1",
                                questionIndex: 0,
                                mode: "text" as const,
                                text: "I would ask a clarifying question first.",
                            },
                            status: "completed" as const,
                            requestedAt: "2026-07-09T20:01:00.000Z",
                            completedAt: "2026-07-09T20:01:00.000Z",
                            response: {
                                statusCode: 202,
                                body: responseBody,
                            },
                        },
                    },
                })),
                saveAnswerSubmission,
            },
        });

        expect(response.status).toBe(202);
        await expect(response.json()).resolves.toEqual(responseBody);
        expect(saveAnswerSubmission).not.toHaveBeenCalled();
    });

    it("returns a retryable conflict when the same answer submit is already in progress", async () => {
        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                headers: {
                    "Idempotency-Key": "client-submit-key-1",
                },
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:01:30.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    answerIdempotencyRecords: {
                        "answer_submit:candidate_answer_submit:session-1:slot-1:client-submit-key-1": {
                            recordKey: "answer_submit:candidate_answer_submit:session-1:slot-1:client-submit-key-1",
                            operation: "answer_submit" as const,
                            scope: "candidate_answer_submit:session-1:slot-1",
                            actorId: "22222222-2222-4222-8222-222222222222",
                            key: "client-submit-key-1",
                            payload: {
                                candidatePracticeSessionId: "session-1",
                                slotId: "slot-1",
                                questionIndex: 0,
                                mode: "text" as const,
                                text: "I would ask a clarifying question first.",
                            },
                            status: "pending" as const,
                            requestedAt: "2026-07-09T20:01:00.000Z",
                        },
                    },
                })),
                saveAnswerSubmission: vi.fn(),
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            code: "REQUEST_IN_PROGRESS",
            error: "An identical answer submit request is already in progress.",
            retryable: true,
        });
    });

    it("returns a nonretryable conflict when an answer submit key is reused with a different payload", async () => {
        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                headers: {
                    "Idempotency-Key": "client-submit-key-1",
                },
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "This is a different answer.",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:01:30.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    answerIdempotencyRecords: {
                        "answer_submit:candidate_answer_submit:session-1:slot-1:client-submit-key-1": {
                            recordKey: "answer_submit:candidate_answer_submit:session-1:slot-1:client-submit-key-1",
                            operation: "answer_submit" as const,
                            scope: "candidate_answer_submit:session-1:slot-1",
                            actorId: "22222222-2222-4222-8222-222222222222",
                            key: "client-submit-key-1",
                            payload: {
                                candidatePracticeSessionId: "session-1",
                                slotId: "slot-1",
                                questionIndex: 0,
                                mode: "text" as const,
                                text: "I would ask a clarifying question first.",
                            },
                            status: "completed" as const,
                            requestedAt: "2026-07-09T20:01:00.000Z",
                        },
                    },
                })),
                saveAnswerSubmission: vi.fn(),
            },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            code: "IDEMPOTENCY_MISMATCH",
            error: "Idempotency key cannot be reused with a different answer submit payload.",
            retryable: false,
        });
    });

    it("rejects blank typed answer submissions as candidate-correctable input", async () => {
        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "   ",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:01:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(),
                saveAnswerSubmission: vi.fn(),
            },
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "Invalid answer submit request.",
        });
    });

    it("fails closed when candidate identity is unavailable", async () => {
        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:01:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => null),
            practiceSessionRepository: {
                findSetupSession: vi.fn(),
                saveAnswerSubmission: vi.fn(),
            },
        });

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: "Candidate session identity is required.",
        });
    });

    it("returns not found when the durable session is not owned by the candidate", async () => {
        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I would ask a clarifying question first.",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:01:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => null),
                saveAnswerSubmission: vi.fn(),
            },
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "Candidate practice session was not found.",
        });
    });
});
