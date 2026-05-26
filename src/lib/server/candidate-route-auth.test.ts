import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCandidateTokenMock = vi.fn();
const resolveLocalCandidateAuthHandoffMock = vi.fn();
const resolveCandidateProfileFromIdentityMock = vi.fn();
const findCandidatePracticeDraftBySessionIdMock = vi.fn();

vi.mock("@/lib/server/auth/candidate-token", () => ({
    requireCandidateToken: requireCandidateTokenMock,
}));

vi.mock("@/lib/server/candidate", () => ({
    resolveLocalCandidateAuthHandoff: resolveLocalCandidateAuthHandoffMock,
    resolveCandidateProfileFromIdentity: resolveCandidateProfileFromIdentityMock,
    findCandidatePracticeDraftBySessionId: findCandidatePracticeDraftBySessionIdMock,
}));

describe("authorizeCandidateSessionRequest", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireCandidateTokenMock.mockResolvedValue({ ok: false, status: 401, error: "Missing candidate token" });
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue(null);
        resolveCandidateProfileFromIdentityMock.mockResolvedValue({ candidateProfileId: "candidate-1" });
        findCandidatePracticeDraftBySessionIdMock.mockResolvedValue(null);
    });

    it("allows an invite-token candidate request", async () => {
        requireCandidateTokenMock.mockResolvedValue({ ok: true, status: 200 });
        const { authorizeCandidateSessionRequest } = await import("./candidate-route-auth");

        const response = await authorizeCandidateSessionRequest(
            new Request("http://localhost/api/tts"),
            "session-1",
            "corr-1",
        );

        expect(response).toBeNull();
        expect(resolveLocalCandidateAuthHandoffMock).not.toHaveBeenCalled();
    });

    it("allows an authenticated candidate-owned session without an invite token", async () => {
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue({
            provider: "password",
            issuer: "interview-coach-local",
            subject: "candidate@example.com",
            email: "candidate@example.com",
            displayName: "Candidate",
            workspace: "local_dev",
        });
        resolveCandidateProfileFromIdentityMock.mockResolvedValue({ candidateProfileId: "candidate-1" });
        findCandidatePracticeDraftBySessionIdMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            sessionId: "session-1",
        });
        const { authorizeCandidateSessionRequest } = await import("./candidate-route-auth");

        const response = await authorizeCandidateSessionRequest(
            new Request("http://localhost/api/tts"),
            "session-1",
            "corr-1",
        );

        expect(response).toBeNull();
        expect(findCandidatePracticeDraftBySessionIdMock).toHaveBeenCalledWith({
            candidateProfileId: "candidate-1",
            sessionId: "session-1",
        });
    });

    it("returns the original auth failure when no invite token or candidate-owned session is available", async () => {
        const { authorizeCandidateSessionRequest } = await import("./candidate-route-auth");

        const response = await authorizeCandidateSessionRequest(
            new Request("http://localhost/api/tts"),
            "session-1",
            "corr-1",
        );
        const body = await response?.json();

        expect(response?.status).toBe(401);
        expect(body).toMatchObject({
            code: "UNAUTHORIZED",
            message: "Missing candidate token",
        });
    });
});
