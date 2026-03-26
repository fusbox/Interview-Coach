import { beforeEach, describe, expect, it, vi } from "vitest";

const analyzeAnswerMock = vi.fn();
const authorizeCandidateSessionRequestMock = vi.fn();

vi.mock("@/lib/server/services/ai-service", () => ({
    AIService: {
        analyzeAnswer: analyzeAnswerMock
    }
}));

vi.mock("@/lib/server/candidate-route-auth", () => ({
    authorizeCandidateSessionRequest: authorizeCandidateSessionRequestMock
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe("POST /api/analysis", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authorizeCandidateSessionRequestMock.mockResolvedValue(null);
    });

    it("returns the sanitized validation envelope for malformed input", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/analysis", {
            method: "POST",
            body: JSON.stringify({ question: "Tell me about yourself" })
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body).toMatchObject({
            code: "INVALID_REQUEST",
            message: "Invalid request",
            retryable: false
        });
        expect(body.correlationId).toBeDefined();
        expect(body.details).toBeUndefined();
    });

    it("returns the sanitized internal error envelope when analysis fails", async () => {
        analyzeAnswerMock.mockRejectedValue(new Error("provider exploded with stack details"));
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/analysis", {
            method: "POST",
            body: JSON.stringify({
                question: "Tell me about yourself",
                sessionId: "session-1",
                questionId: "q1",
                input: "A valid answer",
                blueprint: {},
                intakeData: {}
            })
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body).toMatchObject({
            code: "INTERNAL_ERROR",
            message: "Internal server error",
            retryable: true
        });
        expect(body.correlationId).toBeDefined();
        expect(JSON.stringify(body)).not.toContain("provider exploded");
    });

    it("returns a sanitized unauthorized envelope when candidate token is missing", async () => {
        authorizeCandidateSessionRequestMock.mockResolvedValue(new Response(JSON.stringify({
            code: "UNAUTHORIZED",
            message: "Missing candidate token",
            retryable: false
        }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        }));
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/analysis", {
            method: "POST",
            body: JSON.stringify({
                question: "Tell me about yourself",
                sessionId: "session-1",
                questionId: "q1",
                input: "A valid answer",
                blueprint: {},
                intakeData: {}
            })
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body).toMatchObject({
            code: "UNAUTHORIZED",
            message: "Missing candidate token",
            retryable: false
        });
    });
});
