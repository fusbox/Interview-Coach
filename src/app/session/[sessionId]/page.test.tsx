import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadCandidateSessionForCurrentCandidateMock, notFoundMock } = vi.hoisted(() => ({
    loadCandidateSessionForCurrentCandidateMock: vi.fn(),
    notFoundMock: vi.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
}));

vi.mock("next/navigation", () => ({
    notFound: notFoundMock,
}));

vi.mock("@/lib/server/candidate", () => ({
    loadCandidateSessionForCurrentCandidate: loadCandidateSessionForCurrentCandidateMock,
}));

describe("/session/[sessionId] page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders real candidate-owned session state", async () => {
        loadCandidateSessionForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            session: {
                id: "session-1",
                status: "NOT_STARTED",
                role: "QA analyst",
                jobDescription: "Test regulated workflows.",
                currentQuestionIndex: 0,
                questions: [
                    {
                        id: "question-1",
                        text: "Tell me about a release you improved.",
                        category: "Behavioral",
                        index: 0,
                    },
                ],
                answers: {},
                initialsRequired: false,
            },
        });
        const { default: CandidateSessionRoute } = await import("./page");

        render(await CandidateSessionRoute({ params: Promise.resolve({ sessionId: "session-1" }) }));

        expect(loadCandidateSessionForCurrentCandidateMock).toHaveBeenCalledWith("session-1");
        expect(screen.getByRole("heading", { name: /qa analyst/i })).toBeInTheDocument();
        expect(screen.getByText("Tell me about a release you improved.")).toBeInTheDocument();
        expect(screen.getByText(/Question 1 of 1/)).toBeInTheDocument();
    });

    it("returns not found when the session is not owned by the current candidate", async () => {
        loadCandidateSessionForCurrentCandidateMock.mockResolvedValue(null);
        const { default: CandidateSessionRoute } = await import("./page");

        await expect(CandidateSessionRoute({ params: Promise.resolve({ sessionId: "session-other" }) }))
            .rejects
            .toThrow("NEXT_NOT_FOUND");
        expect(notFoundMock).toHaveBeenCalled();
    });
});
