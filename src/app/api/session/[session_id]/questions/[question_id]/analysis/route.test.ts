import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();
const analyzeAnswerMock = vi.fn();
const beginIdempotentRequestMock = vi.fn();
const completeIdempotentRequestMock = vi.fn();
const releaseIdempotentRequestMock = vi.fn();

const session = {
    id: "session-1",
    status: "AWAITING_EVALUATION",
    role: "QA Engineer",
    intakeData: {},
    questions: [{ id: "question-1", text: "Q1", index: 0, category: "Tech" }],
    currentQuestionIndex: 0,
    answers: {
        "question-1": {
            transcript: "old answer",
            submittedAt: "2026-03-17T00:00:00.000Z"
        }
    },
    initialsRequired: false
};

vi.mock("@/lib/server/api-handler-utils", () => ({
    validatedSessionHandler: (
        request: Request,
        params: { session_id: string; question_id: string },
        handler: (
            request: Request,
            context: {
                params: { session_id: string; question_id: string };
                session: typeof session;
                correlationId: string;
            }
        ) => Promise<Response>
    ) => handler(request, { params, session, correlationId: "corr-1" })
}));

vi.mock("@/lib/server/infrastructure/postgres-session-repository", () => ({
    PostgresSessionRepository: class {
        update = updateMock;
    }
}));

vi.mock("@/lib/server/services/ai-service", () => ({
    AIService: {
        analyzeAnswer: analyzeAnswerMock
    }
}));

vi.mock("@/lib/server/idempotency", () => ({
    beginIdempotentRequest: beginIdempotentRequestMock,
    completeIdempotentRequest: completeIdempotentRequestMock,
    releaseIdempotentRequest: releaseIdempotentRequestMock
}));

describe("POST /api/session/[session_id]/questions/[question_id]/analysis", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        session.intakeData = {};
        beginIdempotentRequestMock.mockResolvedValue({ kind: "acquired" });
        completeIdempotentRequestMock.mockResolvedValue(undefined);
        releaseIdempotentRequestMock.mockResolvedValue(undefined);
        updateMock.mockResolvedValue(undefined);
        analyzeAnswerMock.mockResolvedValue({
            transcript: "normalized transcript",
            summary: "analysis"
        });
    });

    it("returns 400 for invalid analysis payloads", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/analysis", {
            method: "POST",
            body: JSON.stringify({ audioData: { mimeType: "audio/webm" } })
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.code).toBe("INVALID_REQUEST");
        expect(analyzeAnswerMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
        expect(beginIdempotentRequestMock).not.toHaveBeenCalled();
    });

    it("reserves and completes idempotency around answer analysis generation", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/analysis", {
            method: "POST",
            headers: {
                "Idempotency-Key": "analysis:session-1:question-1:123",
            },
            body: JSON.stringify({})
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.answers["question-1"].analysis.summary).toBe("analysis");
        expect(beginIdempotentRequestMock).toHaveBeenCalledWith({
            scope: "session_analysis:question-1",
            actorId: "session-1",
            key: "analysis:session-1:question-1:123",
            payload: {
                questionId: "question-1",
                submittedAt: "2026-03-17T00:00:00.000Z",
                transcript: "old answer",
                modality: undefined,
                retryContext: undefined,
            },
        });
        expect(analyzeAnswerMock).toHaveBeenCalledTimes(1);
        expect(analyzeAnswerMock.mock.calls[0][7]).toEqual(expect.objectContaining({
            appName: "recruiter_app",
        }));
        expect(updateMock).toHaveBeenCalledTimes(1);
        expect(completeIdempotentRequestMock).toHaveBeenCalledWith({
            scope: "session_analysis:question-1",
            actorId: "session-1",
            key: "analysis:session-1:question-1:123",
            statusCode: 200,
            body: expect.objectContaining({
                answers: expect.objectContaining({
                    "question-1": expect.objectContaining({
                        analysis: expect.objectContaining({ summary: "analysis" })
                    })
                })
            }),
        });
    });

    it("upgrades canonical answer modality to voice when audio analysis is provided", async () => {
        analyzeAnswerMock.mockResolvedValue({
            transcript: "voice transcript",
            summary: "voice analysis",
            meta: { tier: 1, modality: "voice" },
        });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/analysis", {
            method: "POST",
            body: JSON.stringify({
                audioData: {
                    base64: "abc123",
                    mimeType: "audio/webm",
                },
            })
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.answers["question-1"]).toEqual(expect.objectContaining({
            modality: "voice",
            transcript: "voice transcript",
        }));
        expect(beginIdempotentRequestMock).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({
                modality: "voice",
            }),
        }));
        expect(analyzeAnswerMock.mock.calls[0]).toEqual([
            expect.objectContaining({ id: "question-1" }),
            "old answer",
            { base64: "abc123", mimeType: "audio/webm" },
            expect.objectContaining({ title: "QA Engineer" }),
            {},
            undefined,
            { current: 1, total: 1 },
            expect.objectContaining({
                privacyFlags: ["contains_audio_input"],
            }),
        ]);
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            answers: {
                "question-1": expect.objectContaining({
                    modality: "voice",
                    transcript: "voice transcript",
                }),
            },
        }));
    });

    it("labels candidate-led answer analysis with the candidate app name", async () => {
        session.intakeData = {
            candidateProfileId: "candidate-profile-1",
            roleProfileId: "role-profile-1",
        };
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/analysis", {
            method: "POST",
            body: JSON.stringify({})
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });

        expect(res.status).toBe(200);
        expect(analyzeAnswerMock.mock.calls[0][7]).toEqual(expect.objectContaining({
            appName: "candidate_app",
        }));
    });

    it("replays completed answer analysis without calling the model again", async () => {
        beginIdempotentRequestMock.mockResolvedValue({
            kind: "replay",
            statusCode: 200,
            body: {
                ...session,
                answers: {
                    "question-1": {
                        ...session.answers["question-1"],
                        analysis: { summary: "cached analysis" }
                    }
                }
            }
        });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/analysis", {
            method: "POST",
            headers: {
                "Idempotency-Key": "analysis:session-1:question-1:123",
            },
            body: JSON.stringify({})
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.answers["question-1"].analysis.summary).toBe("cached analysis");
        expect(analyzeAnswerMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
        expect(completeIdempotentRequestMock).not.toHaveBeenCalled();
    });

    it("returns 409 when matching answer analysis is already in progress", async () => {
        beginIdempotentRequestMock.mockResolvedValue({ kind: "pending" });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/analysis", {
            method: "POST",
            headers: {
                "Idempotency-Key": "analysis:session-1:question-1:123",
            },
            body: JSON.stringify({})
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe("REQUEST_IN_PROGRESS");
        expect(analyzeAnswerMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
    });
});
