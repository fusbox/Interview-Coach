import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
const markViewedMock = vi.fn();
const requireCandidateTokenMock = vi.fn();
const updateSessionCommandMock = vi.fn();
const getSessionCommandMock = vi.fn();

vi.mock("@/lib/server/infrastructure/postgres-session-repository", () => ({
    PostgresSessionRepository: class {
        get = getMock;
        markViewed = markViewedMock;
    }
}));

vi.mock("@/lib/server/auth/candidate-token", () => ({
    requireCandidateToken: requireCandidateTokenMock
}));

vi.mock("@/lib/server/application/session/update-session", () => ({
    updateSessionCommand: updateSessionCommandMock
}));

vi.mock("@/lib/server/application/session/get-session", () => ({
    getSessionCommand: getSessionCommandMock
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe("/api/session/[session_id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireCandidateTokenMock.mockResolvedValue({ ok: true, status: 200 });
        updateSessionCommandMock.mockResolvedValue({ id: "session-1", status: "PAUSED" });
        getSessionCommandMock.mockResolvedValue({ id: "session-1", status: "IN_SESSION" });
    });

    it("GET returns 401 when candidate auth fails", async () => {
        requireCandidateTokenMock.mockResolvedValue({ ok: false, status: 401, error: "Missing candidate token" });
        const { GET } = await import("./route");

        const response = await GET(
            new Request("http://localhost/api/session/session-1", {
                method: "GET"
            }),
            { params: Promise.resolve({ session_id: "session-1" }) }
        );

        expect(response.status).toBe(401);
        expect(getSessionCommandMock).not.toHaveBeenCalled();
    });

    it("GET maps not found domain errors to 404", async () => {
        const { SessionUpdateNotFoundError } = await import("@/lib/server/application/session/errors");
        getSessionCommandMock.mockRejectedValue(new SessionUpdateNotFoundError("Session not found"));
        const { GET } = await import("./route");

        const response = await GET(
            new Request("http://localhost/api/session/session-1", {
                method: "GET"
            }),
            { params: Promise.resolve({ session_id: "session-1" }) }
        );

        expect(response.status).toBe(404);
    });

    it("GET returns the session from the application command", async () => {
        const { GET } = await import("./route");

        const response = await GET(
            new Request("http://localhost/api/session/session-1", {
                method: "GET"
            }),
            { params: Promise.resolve({ session_id: "session-1" }) }
        );

        expect(response.status).toBe(200);
        expect(getSessionCommandMock).toHaveBeenCalledWith("session-1");
        expect(await response.json()).toEqual({ id: "session-1", status: "IN_SESSION" });
    });

    it("PATCH returns 401 when candidate auth fails", async () => {
        requireCandidateTokenMock.mockResolvedValue({ ok: false, status: 401, error: "Missing candidate token" });
        const { PATCH } = await import("./route");

        const response = await PATCH(
            new Request("http://localhost/api/session/session-1", {
                method: "PATCH",
                body: JSON.stringify({ status: "PAUSED" })
            }),
            { params: Promise.resolve({ session_id: "session-1" }) }
        );

        expect(response.status).toBe(401);
        expect(updateSessionCommandMock).not.toHaveBeenCalled();
    });

    it("PATCH returns 422 when the request body is invalid", async () => {
        const { PATCH } = await import("./route");

        const response = await PATCH(
            new Request("http://localhost/api/session/session-1", {
                method: "PATCH",
                body: JSON.stringify({ status: "INVALID_STATUS" })
            }),
            { params: Promise.resolve({ session_id: "session-1" }) }
        );

        expect(response.status).toBe(400);
        expect(updateSessionCommandMock).not.toHaveBeenCalled();
    });

    it("PATCH maps not found domain errors to 404", async () => {
        const { SessionUpdateNotFoundError } = await import("@/lib/server/application/session/errors");
        updateSessionCommandMock.mockRejectedValue(new SessionUpdateNotFoundError("Session not found"));
        const { PATCH } = await import("./route");

        const response = await PATCH(
            new Request("http://localhost/api/session/session-1", {
                method: "PATCH",
                body: JSON.stringify({ status: "PAUSED" })
            }),
            { params: Promise.resolve({ session_id: "session-1" }) }
        );

        expect(response.status).toBe(404);
    });

    it("PATCH maps validation domain errors to 422", async () => {
        const { SessionUpdateValidationError } = await import("@/lib/server/application/session/errors");
        updateSessionCommandMock.mockRejectedValue(
            new SessionUpdateValidationError("Invalid session status transition: NOT_STARTED -> COMPLETED")
        );
        const { PATCH } = await import("./route");

        const response = await PATCH(
            new Request("http://localhost/api/session/session-1", {
                method: "PATCH",
                body: JSON.stringify({ status: "COMPLETED" })
            }),
            { params: Promise.resolve({ session_id: "session-1" }) }
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toBe("Invalid session status transition: NOT_STARTED -> COMPLETED");
    });

    it("PATCH returns the updated session from the application command", async () => {
        const { PATCH } = await import("./route");

        const response = await PATCH(
            new Request("http://localhost/api/session/session-1", {
                method: "PATCH",
                body: JSON.stringify({ status: "PAUSED" })
            }),
            { params: Promise.resolve({ session_id: "session-1" }) }
        );

        expect(response.status).toBe(200);
        expect(updateSessionCommandMock).toHaveBeenCalledWith("session-1", { status: "PAUSED" });
        expect(await response.json()).toEqual({ id: "session-1", status: "PAUSED" });
    });
});
