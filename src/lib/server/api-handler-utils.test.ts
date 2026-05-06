import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextResponse } from "next/server";

const requireCandidateTokenMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("@/lib/server/auth/candidate-token", () => ({
    requireCandidateToken: requireCandidateTokenMock
}));

vi.mock("@/lib/server/infrastructure/postgres-session-repository", () => ({
    PostgresSessionRepository: class {
        get = getSessionMock;
    }
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

const session = {
    id: "session-1",
    questions: [{ id: "question-1", text: "Q1" }],
    answers: {}
};

describe("validatedSessionHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireCandidateTokenMock.mockResolvedValue({ ok: true, status: 200 });
        getSessionMock.mockResolvedValue(session);
    });

    it("returns a sanitized unauthorized envelope for missing candidate auth", async () => {
        requireCandidateTokenMock.mockResolvedValue({ ok: false, status: 401, error: "Missing candidate token" });
        const { validatedSessionHandler } = await import("./api-handler-utils");

        const res = await validatedSessionHandler(
            new Request("http://localhost/api/session/s1/questions/q1/answer"),
            { session_id: "session-1", question_id: "question-1" },
            async () => NextResponse.json({ ok: true })
        );
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body).toMatchObject({
            code: "UNAUTHORIZED",
            message: "Missing candidate token",
            retryable: false
        });
        expect(body.correlationId).toBeDefined();
    });

    it("returns a sanitized internal error envelope for unexpected handler failures", async () => {
        const { validatedSessionHandler } = await import("./api-handler-utils");

        const res = await validatedSessionHandler(
            new Request("http://localhost/api/session/s1/questions/q1/answer"),
            { session_id: "session-1", question_id: "question-1" },
            async () => {
                throw new Error("sensitive stack detail");
            }
        );
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body).toMatchObject({
            code: "INTERNAL_ERROR",
            message: "Internal server error",
            retryable: true
        });
        expect(body.correlationId).toBeDefined();
        expect(JSON.stringify(body)).not.toContain("sensitive stack detail");
    });
});
