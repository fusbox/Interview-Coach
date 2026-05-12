import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadCandidateSummaryForCurrentCandidateMock, notFoundMock } = vi.hoisted(() => ({
    loadCandidateSummaryForCurrentCandidateMock: vi.fn(),
    notFoundMock: vi.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
}));

vi.mock("next/navigation", () => ({
    notFound: notFoundMock,
}));

vi.mock("@/lib/server/candidate", () => ({
    loadCandidateSummaryForCurrentCandidate: loadCandidateSummaryForCurrentCandidateMock,
}));

describe("/summary/[sessionId] page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders a candidate-owned summary", async () => {
        loadCandidateSummaryForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            sessionId: "session-1",
            role: "QA Analyst",
            status: "COMPLETED",
            summaryNarrative: "You were clear and structured.",
            answeredCount: 1,
            questionCount: 1,
            answers: [
                {
                    questionId: "question-1",
                    questionText: "Question one?",
                    category: "Behavioral",
                    transcript: "Answer one.",
                    recommendation: "Add a metric.",
                },
            ],
        });
        const { default: SummaryRoute } = await import("./page");

        render(await SummaryRoute({ params: Promise.resolve({ sessionId: "session-1" }) }));

        expect(loadCandidateSummaryForCurrentCandidateMock).toHaveBeenCalledWith("session-1");
        expect(screen.getByRole("heading", { name: /qa analyst summary/i })).toBeInTheDocument();
    });

    it("returns not found when the summary is missing or not owned", async () => {
        loadCandidateSummaryForCurrentCandidateMock.mockResolvedValue(null);
        const { default: SummaryRoute } = await import("./page");

        await expect(SummaryRoute({ params: Promise.resolve({ sessionId: "session-other" }) }))
            .rejects
            .toThrow("NEXT_NOT_FOUND");
        expect(notFoundMock).toHaveBeenCalled();
    });
});
