import { beforeEach, describe, expect, it, vi } from "vitest";

const enforceIpRateLimitMock = vi.fn();
const authorizeCandidateSessionRequestMock = vi.fn();
const generateStrongResponseMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("@/lib/server/abuse-protection", () => ({
    enforceIpRateLimit: enforceIpRateLimitMock,
}));

vi.mock("@/lib/server/candidate-route-auth", () => ({
    authorizeCandidateSessionRequest: authorizeCandidateSessionRequestMock,
}));

vi.mock("@/lib/server/services/strong-response-service", () => ({
    StrongResponseService: {
        generateStrongResponse: generateStrongResponseMock,
    },
}));

vi.mock("@/lib/server/infrastructure/postgres-session-repository", () => ({
    PostgresSessionRepository: class {
        get = getSessionMock;
    },
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe("POST /api/response/generate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        enforceIpRateLimitMock.mockResolvedValue(null);
        authorizeCandidateSessionRequestMock.mockResolvedValue(null);
        getSessionMock.mockResolvedValue({ id: "session-1", recruiterId: "recruiter-1" });
        generateStrongResponseMock.mockResolvedValue({
            strongResponse: "Example answer",
            whyThisWorks: "Because it is grounded and specific",
        });
    });

    it("returns 400 when the request body fails shared schema validation", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/response/generate", {
            method: "POST",
            body: JSON.stringify({
                question: "",
                sessionId: "",
            }),
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.code).toBe("INVALID_REQUEST");
        expect(generateStrongResponseMock).not.toHaveBeenCalled();
    });

    it("uses the shared request schema and calls the service for a valid request", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/response/generate", {
            method: "POST",
            body: JSON.stringify({
                question: "Tell me about yourself",
                role: "QA Engineer",
                resumeText: "Resume text",
                sessionId: "session-1",
            }),
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.strongResponse).toBe("Example answer");
        expect(authorizeCandidateSessionRequestMock).toHaveBeenCalledWith(req, "session-1", expect.any(String));
        expect(generateStrongResponseMock).toHaveBeenCalledWith(
            "Tell me about yourself",
            "QA Engineer",
            "Resume text",
            expect.objectContaining({
                appName: "candidate_app",
                sessionId: "session-1",
                sourceRefs: [{ type: "route", route: "/api/response/generate" }],
                createdBy: "recruiter-1",
                privacyFlags: ["contains_resume"]
            })
        );
    });
});
