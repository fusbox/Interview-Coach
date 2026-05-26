import { describe, expect, it, vi } from "vitest";

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

describe("/api/analysis retired route", () => {
    it("returns 410 for POST without calling auth or answer analysis", async () => {
        const { POST } = await import("./route");

        const res = await POST();
        const body = await res.json();

        expect(res.status).toBe(410);
        expect(res.headers.get("Cache-Control")).toBe("no-store");
        expect(body).toMatchObject({
            code: "ROUTE_RETIRED",
            retryable: false,
            replacement: "/api/session/[session_id]/questions/[question_id]/analysis",
        });
        expect(analyzeAnswerMock).not.toHaveBeenCalled();
        expect(authorizeCandidateSessionRequestMock).not.toHaveBeenCalled();
    });

    it("returns 410 for GET", async () => {
        const { GET } = await import("./route");

        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(410);
        expect(body.code).toBe("ROUTE_RETIRED");
    });
});
