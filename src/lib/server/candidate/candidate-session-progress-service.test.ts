import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    findCandidatePracticeDraftBySessionIdMock,
    withCandidateMutationBoundaryMock,
    updateCandidatePracticeDraftProgressBySessionIdMock,
    updateSessionCommandMock,
} = vi.hoisted(() => ({
    findCandidatePracticeDraftBySessionIdMock: vi.fn(),
    withCandidateMutationBoundaryMock: vi.fn(async ({ mutate }) => mutate()),
    updateCandidatePracticeDraftProgressBySessionIdMock: vi.fn(),
    updateSessionCommandMock: vi.fn(),
}));

vi.mock("./candidate-practice-draft-repository", () => ({
    findCandidatePracticeDraftBySessionId: findCandidatePracticeDraftBySessionIdMock,
    updateCandidatePracticeDraftProgressBySessionId: updateCandidatePracticeDraftProgressBySessionIdMock,
}));

vi.mock("@/lib/server/application/session/update-session", () => ({
    updateSessionCommand: updateSessionCommandMock,
}));

vi.mock("./candidate-mutation-boundary", () => ({
    withCandidateMutationBoundary: withCandidateMutationBoundaryMock,
}));

describe("candidate session progress service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findCandidatePracticeDraftBySessionIdMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        });
        updateCandidatePracticeDraftProgressBySessionIdMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            status: "in_session",
            resumeTargetScreen: "session_in_progress",
        });
    });

    it("starts a candidate-owned session and moves the draft resume target into session progress", async () => {
        updateSessionCommandMock.mockResolvedValue({
            id: "session-1",
            status: "IN_SESSION",
            currentQuestionIndex: 0,
        });

        const { startCandidateOwnedSession } = await import("./candidate-session-progress-service");

        await expect(startCandidateOwnedSession({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        })).resolves.toEqual({
            ok: true,
            sessionId: "session-1",
            status: "IN_SESSION",
            currentQuestionIndex: 0,
            resumeTargetScreen: "session_in_progress",
        });

        expect(updateSessionCommandMock).toHaveBeenCalledWith("session-1", { status: "IN_SESSION" });
        expect(withCandidateMutationBoundaryMock).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId: "profile-1",
            operation: "session_progress",
            subjectId: "session-1",
        }));
        expect(updateCandidatePracticeDraftProgressBySessionIdMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            status: "in_session",
            resumeTargetScreen: "session_in_progress",
        });
    });

    it("advances a candidate-owned session to the next question and keeps the draft in progress", async () => {
        updateSessionCommandMock.mockResolvedValue({
            id: "session-1",
            status: "IN_SESSION",
            currentQuestionIndex: 1,
        });

        const { advanceCandidateOwnedSession } = await import("./candidate-session-progress-service");

        await expect(advanceCandidateOwnedSession({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            currentQuestionIndex: 1,
            status: "IN_SESSION",
        })).resolves.toMatchObject({
            ok: true,
            currentQuestionIndex: 1,
            resumeTargetScreen: "session_in_progress",
        });

        expect(updateSessionCommandMock).toHaveBeenCalledWith("session-1", {
            currentQuestionIndex: 1,
            status: "IN_SESSION",
        });
    });

    it("marks the draft for summary when the candidate-owned session completes", async () => {
        updateSessionCommandMock.mockResolvedValue({
            id: "session-1",
            status: "COMPLETED",
            currentQuestionIndex: 3,
        });

        const { advanceCandidateOwnedSession } = await import("./candidate-session-progress-service");

        await expect(advanceCandidateOwnedSession({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            currentQuestionIndex: 3,
            status: "COMPLETED",
        })).resolves.toMatchObject({
            ok: true,
            status: "COMPLETED",
            resumeTargetScreen: "session_summary",
        });

        expect(updateCandidatePracticeDraftProgressBySessionIdMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            status: "completed",
            resumeTargetScreen: "session_summary",
        });
    });

    it("pauses a candidate-owned session without losing the in-progress resume target", async () => {
        updateSessionCommandMock.mockResolvedValue({
            id: "session-1",
            status: "PAUSED",
            currentQuestionIndex: 1,
        });

        const { pauseCandidateOwnedSession } = await import("./candidate-session-progress-service");

        await expect(pauseCandidateOwnedSession({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        })).resolves.toMatchObject({
            ok: true,
            status: "PAUSED",
            resumeTargetScreen: "session_in_progress",
        });

        expect(updateSessionCommandMock).toHaveBeenCalledWith("session-1", { status: "PAUSED" });
        expect(updateCandidatePracticeDraftProgressBySessionIdMock).toHaveBeenCalledWith({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
            status: "in_session",
            resumeTargetScreen: "session_in_progress",
        });
    });

    it("resumes a paused candidate-owned session and keeps the draft in progress", async () => {
        updateSessionCommandMock.mockResolvedValue({
            id: "session-1",
            status: "IN_SESSION",
            currentQuestionIndex: 1,
        });

        const { resumeCandidateOwnedSession } = await import("./candidate-session-progress-service");

        await expect(resumeCandidateOwnedSession({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        })).resolves.toMatchObject({
            ok: true,
            status: "IN_SESSION",
            resumeTargetScreen: "session_in_progress",
        });

        expect(updateSessionCommandMock).toHaveBeenCalledWith("session-1", { status: "IN_SESSION" });
    });

    it("does not update the session when the draft is not owned by the current candidate", async () => {
        findCandidatePracticeDraftBySessionIdMock.mockResolvedValue(null);

        const { startCandidateOwnedSession } = await import("./candidate-session-progress-service");

        await expect(startCandidateOwnedSession({
            candidateProfileId: "profile-other",
            sessionId: "session-1",
        })).resolves.toEqual({
            ok: false,
            error: "Candidate session was not found.",
        });

        expect(updateSessionCommandMock).not.toHaveBeenCalled();
        expect(updateCandidatePracticeDraftProgressBySessionIdMock).not.toHaveBeenCalled();
    });

    it("returns rate-limit feedback without checking ownership when the boundary blocks the mutation", async () => {
        withCandidateMutationBoundaryMock.mockResolvedValue({
            ok: false,
            error: "Too many candidate updates. Please wait and try again.",
        });

        const { startCandidateOwnedSession } = await import("./candidate-session-progress-service");

        await expect(startCandidateOwnedSession({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        })).resolves.toEqual({
            ok: false,
            error: "Too many candidate updates. Please wait and try again.",
        });

        expect(findCandidatePracticeDraftBySessionIdMock).not.toHaveBeenCalled();
        expect(updateSessionCommandMock).not.toHaveBeenCalled();
    });
});
