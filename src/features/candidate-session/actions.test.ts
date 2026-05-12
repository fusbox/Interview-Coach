import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    advanceCandidateOwnedSessionMock,
    redirectMock,
    resolveCandidateProfileFromIdentityMock,
    resolveLocalCandidateAuthHandoffMock,
    startCandidateOwnedSessionMock,
} = vi.hoisted(() => ({
    advanceCandidateOwnedSessionMock: vi.fn(),
    redirectMock: vi.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
    resolveCandidateProfileFromIdentityMock: vi.fn(),
    resolveLocalCandidateAuthHandoffMock: vi.fn(),
    startCandidateOwnedSessionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    redirect: redirectMock,
}));

vi.mock("@/lib/server/candidate", () => ({
    resolveLocalCandidateAuthHandoff: resolveLocalCandidateAuthHandoffMock,
    resolveCandidateProfileFromIdentity: resolveCandidateProfileFromIdentityMock,
    startCandidateOwnedSession: startCandidateOwnedSessionMock,
    advanceCandidateOwnedSession: advanceCandidateOwnedSessionMock,
}));

describe("candidate session actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue({
            provider: "dev_mock",
            issuer: "interview-coach-local",
            subject: "candidate@example.com",
            email: "candidate@example.com",
            workspace: "local_dev",
        });
        resolveCandidateProfileFromIdentityMock.mockResolvedValue({
            candidateProfileId: "profile-1",
        });
    });

    it("starts the current candidate-owned session and redirects back to the route", async () => {
        startCandidateOwnedSessionMock.mockResolvedValue({
            ok: true,
            sessionId: "session-1",
            status: "IN_SESSION",
            currentQuestionIndex: 0,
            resumeTargetScreen: "session_in_progress",
        });
        const { startCandidateSessionAction } = await import("./actions");

        await expect(startCandidateSessionAction("session-1")).rejects.toThrow("NEXT_REDIRECT:/session/session-1");

        expect(startCandidateOwnedSessionMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        });
    });

    it("advances the current candidate-owned session and redirects back to the route", async () => {
        advanceCandidateOwnedSessionMock.mockResolvedValue({
            ok: true,
            sessionId: "session-1",
            status: "IN_SESSION",
            currentQuestionIndex: 1,
            resumeTargetScreen: "session_in_progress",
        });
        const { advanceCandidateSessionAction } = await import("./actions");

        await expect(advanceCandidateSessionAction("session-1", 1, "IN_SESSION")).rejects.toThrow("NEXT_REDIRECT:/session/session-1");

        expect(advanceCandidateOwnedSessionMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            currentQuestionIndex: 1,
            status: "IN_SESSION",
        });
    });

    it("returns an error when no candidate auth handoff exists", async () => {
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue(null);
        const { startCandidateSessionAction } = await import("./actions");

        await expect(startCandidateSessionAction("session-1")).resolves.toEqual({
            ok: false,
            error: "Candidate session is required.",
        });
        expect(startCandidateOwnedSessionMock).not.toHaveBeenCalled();
    });
});
