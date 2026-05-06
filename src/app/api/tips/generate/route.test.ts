import { beforeEach, describe, expect, it, vi } from "vitest";

const enforceIpRateLimitMock = vi.fn();
const authorizeCandidateSessionRequestMock = vi.fn();
const generateTipsMock = vi.fn();
const beginIdempotentRequestMock = vi.fn();
const completeIdempotentRequestMock = vi.fn();
const releaseIdempotentRequestMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("@/lib/server/abuse-protection", () => ({
    enforceIpRateLimit: enforceIpRateLimitMock,
}));

vi.mock("@/lib/server/candidate-route-auth", () => ({
    authorizeCandidateSessionRequest: authorizeCandidateSessionRequestMock,
}));

vi.mock("@/lib/server/services/tips-service", () => ({
    TipsService: {
        generateTips: generateTipsMock,
    },
}));

vi.mock("@/lib/server/idempotency", () => ({
    beginIdempotentRequest: beginIdempotentRequestMock,
    completeIdempotentRequest: completeIdempotentRequestMock,
    releaseIdempotentRequest: releaseIdempotentRequestMock,
}));

vi.mock("@/lib/server/infrastructure/postgres-session-repository", () => ({
    PostgresSessionRepository: class {
        get = getSessionMock;
    },
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        error: vi.fn(),
    },
}));

describe("POST /api/tips/generate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        enforceIpRateLimitMock.mockResolvedValue(null);
        authorizeCandidateSessionRequestMock.mockResolvedValue(null);
        beginIdempotentRequestMock.mockResolvedValue({ kind: "acquired" });
        completeIdempotentRequestMock.mockResolvedValue(undefined);
        releaseIdempotentRequestMock.mockResolvedValue(undefined);
        getSessionMock.mockResolvedValue({ id: "session-1", recruiterId: "recruiter-1" });
        generateTipsMock.mockResolvedValue({
            doThis: "Do this",
            avoidThis: "Avoid this",
        });
    });

    it("returns 400 when the shared request schema validation fails", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/tips/generate", {
            method: "POST",
            body: JSON.stringify({
                question: "",
                role: "",
                sessionId: "",
            }),
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.code).toBe("INVALID_REQUEST");
        expect(generateTipsMock).not.toHaveBeenCalled();
    });

    it("uses the shared request schema and calls the service for a valid request", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/tips/generate", {
            method: "POST",
            body: JSON.stringify({
                question: "Tell me about yourself",
                role: "QA Engineer",
                blueprint: {},
                sessionId: "session-1",
            }),
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.doThis).toBe("Do this");
        expect(authorizeCandidateSessionRequestMock).toHaveBeenCalledWith(req, "session-1", expect.any(String));
        expect(generateTipsMock).toHaveBeenCalledWith(
            "Tell me about yourself",
            "QA Engineer",
            undefined,
            {},
            undefined,
            expect.objectContaining({
                appName: "candidate_app",
                sessionId: "session-1",
                sourceRefs: [{ type: "route", route: "/api/tips/generate" }],
                createdBy: "recruiter-1"
            })
        );
    });

    it("uses idempotency when a key is provided", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/tips/generate", {
            method: "POST",
            headers: {
                "Idempotency-Key": "smart_hints:session-1:q1",
            },
            body: JSON.stringify({
                question: "Tell me about yourself",
                role: "QA Engineer",
                blueprint: {},
                sessionId: "session-1",
            }),
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.doThis).toBe("Do this");
        expect(beginIdempotentRequestMock).toHaveBeenCalledWith({
            scope: "tips_generate",
            actorId: "session-1",
            key: "smart_hints:session-1:q1",
            payload: expect.objectContaining({
                question: "Tell me about yourself",
                role: "QA Engineer",
                sessionId: "session-1",
            }),
        });
        expect(completeIdempotentRequestMock).toHaveBeenCalledWith({
            scope: "tips_generate",
            actorId: "session-1",
            key: "smart_hints:session-1:q1",
            statusCode: 200,
            body: {
                doThis: "Do this",
                avoidThis: "Avoid this",
            },
        });
    });

    it("replays a completed idempotent tips response without regenerating", async () => {
        beginIdempotentRequestMock.mockResolvedValue({
            kind: "replay",
            statusCode: 200,
            body: {
                doThis: "Cached do",
                avoidThis: "Cached avoid",
            },
        });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/tips/generate", {
            method: "POST",
            headers: {
                "Idempotency-Key": "smart_hints:session-1:q1",
            },
            body: JSON.stringify({
                question: "Tell me about yourself",
                role: "QA Engineer",
                blueprint: {},
                sessionId: "session-1",
            }),
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.doThis).toBe("Cached do");
        expect(generateTipsMock).not.toHaveBeenCalled();
        expect(completeIdempotentRequestMock).not.toHaveBeenCalled();
    });

    it("returns 409 for a duplicate in-flight tips request", async () => {
        beginIdempotentRequestMock.mockResolvedValue({ kind: "pending" });
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/tips/generate", {
            method: "POST",
            headers: {
                "Idempotency-Key": "smart_hints:session-1:q1",
            },
            body: JSON.stringify({
                question: "Tell me about yourself",
                role: "QA Engineer",
                blueprint: {},
                sessionId: "session-1",
            }),
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe("REQUEST_IN_PROGRESS");
        expect(generateTipsMock).not.toHaveBeenCalled();
    });
});
