import { beforeEach, describe, expect, it, vi } from "vitest";

const enforceIpRateLimitMock = vi.fn();
const authorizeCandidateSessionRequestMock = vi.fn();
const generateTipsMock = vi.fn();

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
        expect(generateTipsMock).toHaveBeenCalledWith("Tell me about yourself", "QA Engineer", undefined, {}, undefined);
    });
});
