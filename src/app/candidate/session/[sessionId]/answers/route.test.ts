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

    it("persists attempt identity in the latest-answer projection without creating another attempt on replay", async () => {
        const appendAnswerAttempt = vi.fn(async () => ({
            outcome: "created" as const,
            attempt: {
                candidateAnswerAttemptId: "11111111-1111-4111-8111-111111111111",
                candidatePracticeSessionId: "session-1",
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
                questionSlotId: "slot-1",
                questionIndex: 0,
                attemptNumber: 1,
                trigger: "initial_submit" as const,
                supersedesCandidateAnswerAttemptId: null,
                mode: "text" as const,
                answerText: "I would ask a clarifying question first.",
                submittedAt: "2026-07-09T20:01:00.000Z",
                idempotencyKey: "client-submit-key-1",
                payloadFingerprint: "fingerprint-1",
                createdAt: "2026-07-09T20:01:00.000Z",
            },
        }));
        const saveAnswerSubmission = vi.fn(async ({ answerSubmission }) => ({
            "slot-1": answerSubmission,
        }));

        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                headers: { "Idempotency-Key": "client-submit-key-1" },
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
                findSetupSession: vi.fn(async () => ({ answerIdempotencyRecords: {} })),
                saveAnswerSubmission,
            },
            answerAttemptRepository: { appendAnswerAttempt },
        });

        expect(response.status).toBe(202);
        expect(appendAnswerAttempt).toHaveBeenCalledWith(expect.objectContaining({
            candidatePracticeSessionId: "session-1",
            questionSlotId: "slot-1",
            trigger: "initial_submit",
            idempotencyKey: "client-submit-key-1",
            payloadFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        }));
        expect(saveAnswerSubmission).toHaveBeenCalledWith(expect.objectContaining({
            answerSubmission: expect.objectContaining({
                answerAttemptId: "11111111-1111-4111-8111-111111111111",
                attemptNumber: 1,
                trigger: "initial_submit",
                supersedesAnswerAttemptId: null,
            }),
        }));
        await expect(response.json()).resolves.toMatchObject({
            answerSubmissions: {
                "slot-1": {
                    answerAttemptId: "11111111-1111-4111-8111-111111111111",
                    attemptNumber: 1,
                },
            },
        });
    });

    it("appends a feedback-authorized retry as the next immutable answer attempt", async () => {
        const sourceAttemptId = "11111111-1111-4111-8111-111111111111";
        const retryAttemptId = "22222222-2222-4222-8222-222222222222";
        const appendAnswerAttempt = vi.fn(async () => ({
            outcome: "created" as const,
            attempt: {
                candidateAnswerAttemptId: retryAttemptId,
                candidatePracticeSessionId: "session-1",
                candidateProfileId: "candidate-1",
                questionSlotId: "slot-1",
                questionIndex: 0,
                attemptNumber: 2,
                trigger: "feedback_retry" as const,
                supersedesCandidateAnswerAttemptId: sourceAttemptId,
                mode: "text" as const,
                answerText: "I clarified the concern, acted, and confirmed the outcome.",
                submittedAt: "2026-07-14T19:00:00.000Z",
                idempotencyKey: "retry-key-1",
                payloadFingerprint: "fingerprint-2",
                createdAt: "2026-07-14T19:00:00.000Z",
            },
        }));
        const saveAnswerSubmission = vi.fn(async ({ answerSubmission }) => ({
            "slot-1": answerSubmission,
        }));

        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                headers: { "Idempotency-Key": "retry-key-1" },
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "I clarified the concern, acted, and confirmed the outcome.",
                    trigger: "feedback_retry",
                    supersedesAnswerAttemptId: sourceAttemptId,
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-14T19:00:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createFeedbackRetrySession(sourceAttemptId)),
                saveAnswerSubmission,
            },
            answerAttemptRepository: { appendAnswerAttempt },
        });

        expect(response.status).toBe(202);
        expect(appendAnswerAttempt).toHaveBeenCalledWith(expect.objectContaining({
            trigger: "feedback_retry",
            supersedesCandidateAnswerAttemptId: sourceAttemptId,
            payloadFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        }));
        expect(saveAnswerSubmission).toHaveBeenCalledWith(expect.objectContaining({
            answerSubmission: expect.objectContaining({
                answerAttemptId: retryAttemptId,
                attemptNumber: 2,
                trigger: "feedback_retry",
                supersedesAnswerAttemptId: sourceAttemptId,
            }),
        }));
    });

    it("rejects a stale feedback retry before it can append another attempt", async () => {
        const appendAnswerAttempt = vi.fn();
        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "Another retry from a stale tab.",
                    trigger: "feedback_retry",
                    supersedesAnswerAttemptId: "attempt-1",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-14T19:00:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({ candidateProfileId: "candidate-1" })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => createFeedbackRetrySession("attempt-2")),
                saveAnswerSubmission: vi.fn(),
            },
            answerAttemptRepository: { appendAnswerAttempt },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            code: "FEEDBACK_RETRY_NOT_AUTHORIZED",
            retryable: false,
        });
        expect(appendAnswerAttempt).not.toHaveBeenCalled();
    });

    it("clears a pending idempotency record when answer persistence throws", async () => {
        const clearAnswerIdempotencyRecord = vi.fn(async () => ({}));
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
                findSetupSession: vi.fn(async () => ({ answerIdempotencyRecords: {} })),
                saveAnswerSubmission: vi.fn(async () => {
                    throw new Error("database unavailable");
                }),
                saveAnswerIdempotencyRecord: vi.fn(async () => ({})),
                clearAnswerIdempotencyRecord,
            },
        });

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
            code: "ANSWER_SUBMIT_FAILED",
            error: "Candidate answer could not be saved.",
            retryable: true,
        });
        expect(clearAnswerIdempotencyRecord).toHaveBeenCalledWith(expect.objectContaining({
            candidatePracticeSessionId: "session-1",
            recordKey: expect.stringContaining("candidate_answer_submit:session-1:slot-1"),
        }));
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

    it("rejects answer text above the evaluator input ceiling before persistence", async () => {
        const findSetupSession = vi.fn();
        const saveAnswerSubmission = vi.fn();
        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "a".repeat(20_001),
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-09T20:01:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: { findSetupSession, saveAnswerSubmission },
        });

        expect(response.status).toBe(400);
        expect(findSetupSession).not.toHaveBeenCalled();
        expect(saveAnswerSubmission).not.toHaveBeenCalled();
    });

    it("rejects answer submissions after the durable session is completed", async () => {
        const appendAnswerAttempt = vi.fn();
        const saveAnswerSubmission = vi.fn();
        const response = await handleCandidateAnswerSubmitRequest({
            request: new Request("https://interviewcoach.talentarbor.com/candidate/session/session-1/answers", {
                method: "POST",
                headers: { "Idempotency-Key": "post-completion-submit" },
                body: JSON.stringify({
                    slotId: "slot-1",
                    questionIndex: 0,
                    mode: "text",
                    text: "This must not become post-completion evidence.",
                }),
            }),
            sessionId: "session-1",
            now: new Date("2026-07-15T16:20:00.000Z"),
            resolveCandidateSessionIdentity: vi.fn(async () => ({
                candidateProfileId: "22222222-2222-4222-8222-222222222222",
            })),
            practiceSessionRepository: {
                findSetupSession: vi.fn(async () => ({
                    status: "completed" as const,
                    answerIdempotencyRecords: {},
                })),
                saveAnswerSubmission,
            },
            answerAttemptRepository: { appendAnswerAttempt },
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            code: "SESSION_NOT_ACCEPTING_ANSWERS",
            error: "This practice session is no longer accepting answers.",
            retryable: false,
        });
        expect(appendAnswerAttempt).not.toHaveBeenCalled();
        expect(saveAnswerSubmission).not.toHaveBeenCalled();
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

function createFeedbackRetrySession(answerAttemptId: string) {
    return {
        answerIdempotencyRecords: {},
        answerSubmissions: {
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text" as const,
                text: "Saved source answer.",
                submittedAt: "2026-07-14T18:00:00.000Z",
                status: "pending_analysis" as const,
                answerAttemptId,
                attemptNumber: answerAttemptId === "attempt-2" ? 2 : 1,
                trigger: answerAttemptId === "attempt-2" ? "feedback_retry" as const : "initial_submit" as const,
                supersedesAnswerAttemptId: answerAttemptId === "attempt-2" ? "attempt-1" : null,
            },
        },
        answerAnalysisSnapshots: {
            "slot-1": {
                status: "answer_analysis_provider_result" as const,
                provider: "candidate_v2_answer_evaluator" as const,
                analyzedAt: "2026-07-14T18:01:00.000Z",
                answer: {
                    slotId: "slot-1",
                    questionIndex: 0,
                    answerAttemptId,
                    attemptNumber: answerAttemptId === "attempt-2" ? 2 : 1,
                    trigger: answerAttemptId === "attempt-2" ? "feedback_retry" as const : "initial_submit" as const,
                },
                coachFeedback: {
                    acknowledgement: "You gave me a starting point.",
                    observation: "Add one concrete result.",
                    nextPracticeFocus: "Try it again with the result.",
                },
                evidence: [],
            },
        },
        feedbackActionEvents: {
            "slot-1": {
                status: "feedback_action_selected" as const,
                answer: {
                    slotId: "slot-1",
                    questionIndex: 0,
                    answerAttemptId,
                    attemptNumber: answerAttemptId === "attempt-2" ? 2 : 1,
                    trigger: answerAttemptId === "attempt-2" ? "feedback_retry" as const : "initial_submit" as const,
                },
                stageId: "next_step" as const,
                actionKind: "retry_answer" as const,
                transition: "retry_current_question" as const,
                selectedAt: "2026-07-14T18:02:00.000Z",
            },
        },
    };
}
