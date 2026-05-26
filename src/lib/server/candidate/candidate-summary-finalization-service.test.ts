import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    createSessionRepositoryMock,
    findCandidatePracticeDraftBySessionIdMock,
    getSessionMock,
    updateSessionCommandMock,
    withCandidateMutationBoundaryMock,
} = vi.hoisted(() => ({
    createSessionRepositoryMock: vi.fn(),
    findCandidatePracticeDraftBySessionIdMock: vi.fn(),
    getSessionMock: vi.fn(),
    updateSessionCommandMock: vi.fn(),
    withCandidateMutationBoundaryMock: vi.fn(async ({ mutate }) => mutate()),
}));

vi.mock("@/lib/server/infrastructure/session-repository", () => ({
    createSessionRepository: createSessionRepositoryMock,
}));

vi.mock("@/lib/server/application/session/update-session", () => ({
    updateSessionCommand: updateSessionCommandMock,
}));

vi.mock("./candidate-practice-draft-repository", () => ({
    findCandidatePracticeDraftBySessionId: findCandidatePracticeDraftBySessionIdMock,
}));

vi.mock("./candidate-mutation-boundary", () => ({
    withCandidateMutationBoundary: withCandidateMutationBoundaryMock,
}));

describe("candidate summary finalization service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findCandidatePracticeDraftBySessionIdMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        });
        createSessionRepositoryMock.mockResolvedValue({
            get: getSessionMock,
        });
    });

    it("generates the completed candidate session summary after the summary page has loaded", async () => {
        getSessionMock.mockResolvedValue({
            id: "session-1",
            status: "COMPLETED",
            summaryNarrative: null,
        });
        updateSessionCommandMock.mockResolvedValue({
            id: "session-1",
            status: "COMPLETED",
            summaryNarrative: "Generated summary",
        });

        const { finalizeCandidateOwnedSummary } = await import("./candidate-summary-finalization-service");

        await expect(finalizeCandidateOwnedSummary({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        })).resolves.toEqual({ ok: true, generated: true });

        expect(updateSessionCommandMock).toHaveBeenCalledWith("session-1", { status: "COMPLETED" });
        expect(withCandidateMutationBoundaryMock).toHaveBeenCalledWith(expect.objectContaining({
            candidateProfileId: "profile-1",
            operation: "session_summary_finalize",
            subjectId: "session-1",
        }));
    });

    it("does not generate a summary for a session that is not completed", async () => {
        getSessionMock.mockResolvedValue({
            id: "session-1",
            status: "IN_SESSION",
            summaryNarrative: null,
        });

        const { finalizeCandidateOwnedSummary } = await import("./candidate-summary-finalization-service");

        await expect(finalizeCandidateOwnedSummary({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        })).resolves.toEqual({ ok: false, error: "Candidate summary is not ready yet." });

        expect(updateSessionCommandMock).not.toHaveBeenCalled();
    });

    it("is a no-op when the completed session already has a summary", async () => {
        getSessionMock.mockResolvedValue({
            id: "session-1",
            status: "COMPLETED",
            summaryNarrative: "Existing summary",
        });

        const { finalizeCandidateOwnedSummary } = await import("./candidate-summary-finalization-service");

        await expect(finalizeCandidateOwnedSummary({
            candidateProfileId: "profile-1",
            sessionId: "session-1",
        })).resolves.toEqual({ ok: true, generated: false });

        expect(updateSessionCommandMock).not.toHaveBeenCalled();
    });
});
