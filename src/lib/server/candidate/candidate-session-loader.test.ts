import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    findCandidatePracticeDraftBySessionIdMock,
    getSessionMock,
    markViewedMock,
    resolveCandidateProfileFromIdentityMock,
    resolveLocalCandidateAuthHandoffMock,
    withCandidateRouteMetricsMock,
} = vi.hoisted(() => ({
    findCandidatePracticeDraftBySessionIdMock: vi.fn(),
    getSessionMock: vi.fn(),
    markViewedMock: vi.fn(),
    resolveCandidateProfileFromIdentityMock: vi.fn(),
    resolveLocalCandidateAuthHandoffMock: vi.fn(),
    withCandidateRouteMetricsMock: vi.fn(async ({ load }) => load()),
}));

vi.mock("./candidate-dev-auth-resolver", () => ({
    resolveLocalCandidateAuthHandoff: resolveLocalCandidateAuthHandoffMock,
}));

vi.mock("./candidate-profile-repository", () => ({
    resolveCandidateProfileFromIdentity: resolveCandidateProfileFromIdentityMock,
}));

vi.mock("./candidate-practice-draft-repository", () => ({
    findCandidatePracticeDraftBySessionId: findCandidatePracticeDraftBySessionIdMock,
}));

vi.mock("@/lib/server/infrastructure/session-repository", () => ({
    createSessionRepository: vi.fn(async () => ({
        get: getSessionMock,
        markViewed: markViewedMock,
    })),
}));

vi.mock("./candidate-observability", () => ({
    withCandidateRouteMetrics: withCandidateRouteMetricsMock,
}));

describe("candidate session loader", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue({
            provider: "dev_mock",
            issuer: "interview-coach-local",
            subject: "candidate@example.com",
            email: "candidate@example.com",
            displayName: "Candidate",
            workspace: "local_dev",
        });
        resolveCandidateProfileFromIdentityMock.mockResolvedValue({
            candidateProfileId: "profile-1",
        });
        findCandidatePracticeDraftBySessionIdMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            resumeTargetScreen: "session_entry",
        });
        getSessionMock.mockResolvedValue({
            id: "session-1",
            status: "NOT_STARTED",
            role: "QA analyst",
            jobDescription: "Test regulated workflows.",
            questions: [
                {
                    id: "question-1",
                    text: "Tell me about a release you improved.",
                    category: "Behavioral",
                    index: 0,
                },
            ],
            currentQuestionIndex: 0,
            answers: {},
            initialsRequired: false,
        });
        markViewedMock.mockResolvedValue(undefined);
    });

    it("loads a candidate-owned session through the practice draft ownership link", async () => {
        const { loadCandidateSessionForCurrentCandidate } = await import("./candidate-session-loader");

        await expect(loadCandidateSessionForCurrentCandidate("session-1")).resolves.toMatchObject({
            practiceDraftId: "draft-1",
            session: {
                id: "session-1",
                role: "QA analyst",
                questions: [
                    {
                        text: "Tell me about a release you improved.",
                    },
                ],
            },
        });
        expect(findCandidatePracticeDraftBySessionIdMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        });
        expect(getSessionMock).toHaveBeenCalledWith("session-1");
        expect(markViewedMock).toHaveBeenCalledWith("session-1");
        expect(withCandidateRouteMetricsMock).toHaveBeenCalledWith(expect.objectContaining({
            route: "/session/[sessionId]",
            operation: "load_session",
        }));
    });

    it("returns null when no candidate handoff exists", async () => {
        resolveLocalCandidateAuthHandoffMock.mockResolvedValue(null);

        const { loadCandidateSessionForCurrentCandidate } = await import("./candidate-session-loader");

        await expect(loadCandidateSessionForCurrentCandidate("session-1")).resolves.toBeNull();
        expect(resolveCandidateProfileFromIdentityMock).not.toHaveBeenCalled();
        expect(findCandidatePracticeDraftBySessionIdMock).not.toHaveBeenCalled();
        expect(getSessionMock).not.toHaveBeenCalled();
        expect(withCandidateRouteMetricsMock).toHaveBeenCalledWith(expect.objectContaining({
            route: "/session/[sessionId]",
            operation: "load_session",
        }));
    });

    it("returns null when the session is not linked to the current candidate draft", async () => {
        findCandidatePracticeDraftBySessionIdMock.mockResolvedValue(null);

        const { loadCandidateSessionForCurrentCandidate } = await import("./candidate-session-loader");

        await expect(loadCandidateSessionForCurrentCandidate("session-2")).resolves.toBeNull();
        expect(getSessionMock).not.toHaveBeenCalled();
    });

    it("returns null when the linked session no longer exists", async () => {
        getSessionMock.mockResolvedValue(null);

        const { loadCandidateSessionForCurrentCandidate } = await import("./candidate-session-loader");

        await expect(loadCandidateSessionForCurrentCandidate("session-1")).resolves.toBeNull();
    });
});
