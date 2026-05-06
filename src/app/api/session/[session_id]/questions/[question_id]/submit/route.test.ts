import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteAnalysisMock = vi.fn();
const updateMock = vi.fn();
const beginIdempotentRequestMock = vi.fn();
const completeIdempotentRequestMock = vi.fn();
const releaseIdempotentRequestMock = vi.fn();
const incrementMetricMock = vi.fn();

const session = {
    id: "session-1",
    status: "IN_SESSION",
    role: "QA Engineer",
    questions: [{ id: "question-1", text: "Q1", index: 0, category: "Tech" }],
    currentQuestionIndex: 0,
    answers: {},
    initialsRequired: false,
};

vi.mock("@/lib/server/api-handler-utils", () => ({
    validatedSessionHandler: (request: Request, params: { session_id: string; question_id: string }, handler: (request: Request, context: { params: { session_id: string; question_id: string }; session: typeof session; correlationId: string }) => Promise<Response>) =>
        handler(request, {
            params,
            session,
            correlationId: "corr-1"
        })
}));

vi.mock("@/lib/server/infrastructure/postgres-session-repository", () => ({
    PostgresSessionRepository: class {
        deleteAnalysis = deleteAnalysisMock;
        update = updateMock;
    }
}));

vi.mock("@/lib/server/idempotency", () => ({
    beginIdempotentRequest: beginIdempotentRequestMock,
    completeIdempotentRequest: completeIdempotentRequestMock,
    releaseIdempotentRequest: releaseIdempotentRequestMock
}));

vi.mock("@/lib/server/metrics", () => ({
    incrementMetric: incrementMetricMock
}));

describe("POST /api/session/[session_id]/questions/[question_id]/submit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        beginIdempotentRequestMock.mockResolvedValue({ kind: "acquired" });
        completeIdempotentRequestMock.mockResolvedValue(undefined);
        releaseIdempotentRequestMock.mockResolvedValue(undefined);
        deleteAnalysisMock.mockResolvedValue(undefined);
        updateMock.mockResolvedValue(undefined);
    });

    it("replays a previously stored response for a duplicate idempotency key", async () => {
        beginIdempotentRequestMock.mockResolvedValue({
            kind: "replay",
            statusCode: 200,
            body: { ...session, status: "AWAITING_EVALUATION" }
        });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/submit", {
            method: "POST",
            headers: { "Idempotency-Key": "same-key" },
            body: JSON.stringify({ text: "Answer 1" })
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.status).toBe("AWAITING_EVALUATION");
        expect(updateMock).not.toHaveBeenCalled();
        expect(incrementMetricMock).toHaveBeenCalledWith("session_submit_total", {
            outcome: "replay_success",
            analysisIncluded: false
        });
    });

    it("returns 409 when the same key is reused for a different payload", async () => {
        beginIdempotentRequestMock.mockResolvedValue({ kind: "conflict" });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/submit", {
            method: "POST",
            headers: { "Idempotency-Key": "same-key" },
            body: JSON.stringify({ text: "Different answer" })
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe("IDEMPOTENCY_MISMATCH");
        expect(incrementMetricMock).toHaveBeenCalledWith("session_submit_total", {
            outcome: "idempotency_mismatch",
            analysisIncluded: false
        });
    });

    it("persists and stores the first successful submit response", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/submit", {
            method: "POST",
            headers: { "Idempotency-Key": "submit-key-1" },
            body: JSON.stringify({ text: "Answer 1" })
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.status).toBe("AWAITING_EVALUATION");
        expect(deleteAnalysisMock).toHaveBeenCalledWith("session-1", "question-1");
        expect(updateMock).toHaveBeenCalledTimes(1);
        expect(completeIdempotentRequestMock).toHaveBeenCalledWith(expect.objectContaining({
            scope: "session_submit:question-1",
            actorId: "session-1",
            key: "submit-key-1",
            statusCode: 200
        }));
        expect(incrementMetricMock).toHaveBeenCalledWith("session_submit_total", {
            outcome: "success",
            analysisIncluded: false
        });
    });

    it("returns 400 when analysis payload fails schema validation", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/submit", {
            method: "POST",
            body: JSON.stringify({
                text: "Answer 1",
                analysis: {
                    ack: 123
                }
            })
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.code).toBe("INVALID_REQUEST");
        expect(updateMock).not.toHaveBeenCalled();
        expect(incrementMetricMock).toHaveBeenCalledWith("session_submit_total", {
            outcome: "invalid_request",
            analysisIncluded: false
        });
    });

    it("returns 409 when an identical request is already in progress", async () => {
        beginIdempotentRequestMock.mockResolvedValue({ kind: "pending" });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/submit", {
            method: "POST",
            headers: { "Idempotency-Key": "same-key" },
            body: JSON.stringify({ text: "Answer 1" })
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe("REQUEST_IN_PROGRESS");
        expect(incrementMetricMock).toHaveBeenCalledWith("session_submit_total", {
            outcome: "request_in_progress",
            analysisIncluded: false
        });
    });

    it("records analysisIncluded when a submit succeeds with analysis", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/submit", {
            method: "POST",
            body: JSON.stringify({
                text: "Answer 1",
                analysis: {
                    ack: "Strong structure.",
                    score: 4,
                    rationale: "Grounded in the answer.",
                    highlights: ["Clear example"],
                    improvements: ["Add more detail"]
                }
            })
        });

        const res = await POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) });

        expect(res.status).toBe(200);
        expect(incrementMetricMock).toHaveBeenCalledWith("session_submit_total", {
            outcome: "success",
            analysisIncluded: true
        });
    });

    it("records error when submit persistence fails", async () => {
        updateMock.mockRejectedValueOnce(new Error("write failed"));
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/session/session-1/questions/question-1/submit", {
            method: "POST",
            headers: { "Idempotency-Key": "submit-key-1" },
            body: JSON.stringify({ text: "Answer 1" })
        });

        await expect(() =>
            POST(req, { params: Promise.resolve({ session_id: "session-1", question_id: "question-1" }) })
        ).rejects.toThrow("write failed");

        expect(releaseIdempotentRequestMock).toHaveBeenCalledWith({
            scope: "session_submit:question-1",
            actorId: "session-1",
            key: "submit-key-1"
        });
        expect(incrementMetricMock).toHaveBeenCalledWith("session_submit_total", {
            outcome: "error",
            analysisIncluded: false
        });
    });
});
