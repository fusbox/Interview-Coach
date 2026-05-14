import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBasicAccessibilityViolations } from "@/test/accessibility";

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

vi.mock("@/features/candidate-session/actions", () => ({
    startCandidateSessionAction: vi.fn(),
    advanceCandidateSessionAction: vi.fn(),
    analyzeCandidateAnswerAction: vi.fn(),
    pauseCandidateSessionAction: vi.fn(),
    resumeCandidateSessionAction: vi.fn(),
    retryCandidateQuestionAction: vi.fn(),
    submitCandidateAnswerAction: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
    showDemoTools: () => false,
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
        expect(screen.getByRole("button", { name: /start practice/i })).toBeInTheDocument();
    });

    it("meets the candidate primary-page accessibility baseline", async () => {
        loadCandidateSessionForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            session: {
                id: "session-1",
                status: "IN_SESSION",
                role: "QA analyst",
                currentQuestionIndex: 0,
                questions: [
                    { id: "question-1", text: "Question one?", category: "Behavioral", index: 0 },
                ],
                answers: {},
                initialsRequired: false,
            },
        });
        const { default: CandidateSessionRoute } = await import("./page");

        const { container } = render(await CandidateSessionRoute({ params: Promise.resolve({ sessionId: "session-1" }) }));

        expect(getBasicAccessibilityViolations(container)).toEqual([]);
    });

    it("renders the recruiter-style answer workspace for an in-progress session", async () => {
        loadCandidateSessionForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            session: {
                id: "session-1",
                status: "IN_SESSION",
                role: "QA analyst",
                currentQuestionIndex: 0,
                questions: [
                    { id: "question-1", text: "Question one?", category: "Behavioral", index: 0 },
                    { id: "question-2", text: "Question two?", category: "Technical", index: 1 },
                ],
                answers: {},
                initialsRequired: false,
            },
        });
        const { default: CandidateSessionRoute } = await import("./page");

        render(await CandidateSessionRoute({ params: Promise.resolve({ sessionId: "session-1" }) }));

        expect(screen.getByRole("button", { name: /pause session/i })).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: /type your answer/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /submit answer/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /continue to next question/i })).not.toBeInTheDocument();
    });

    it("renders saved answer state and retry action for a submitted answer", async () => {
        loadCandidateSessionForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            session: {
                id: "session-1",
                status: "REVIEWING",
                role: "QA analyst",
                currentQuestionIndex: 0,
                questions: [
                    { id: "question-1", text: "Question one?", category: "Behavioral", index: 0 },
                    { id: "question-2", text: "Question two?", category: "Technical", index: 1 },
                ],
                answers: {
                    "question-1": {
                        questionId: "question-1",
                        transcript: "I improved release quality with a checklist.",
                        submittedAt: 1770000000000,
                    },
                },
                initialsRequired: false,
            },
        });
        const { default: CandidateSessionRoute } = await import("./page");

        render(await CandidateSessionRoute({ params: Promise.resolve({ sessionId: "session-1" }) }));

        expect(screen.getByText("I improved release quality with a checklist.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /retry question/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /continue to next question/i })).toBeInTheDocument();
    });

    it("renders a resume action for a paused session", async () => {
        loadCandidateSessionForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            session: {
                id: "session-1",
                status: "PAUSED",
                role: "QA analyst",
                currentQuestionIndex: 0,
                questions: [
                    { id: "question-1", text: "Question one?", category: "Behavioral", index: 0 },
                ],
                answers: {},
                initialsRequired: false,
            },
        });
        const { default: CandidateSessionRoute } = await import("./page");

        render(await CandidateSessionRoute({ params: Promise.resolve({ sessionId: "session-1" }) }));

        expect(screen.getAllByRole("button", { name: /resume/i }).length).toBeGreaterThan(0);
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
