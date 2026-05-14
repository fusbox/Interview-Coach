import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LoadedCandidateSession } from "@/lib/server/candidate";
import { CandidateSessionPage } from "./CandidateSessionPage";

vi.mock("./actions", () => ({
    advanceCandidateSessionAction: vi.fn(),
    analyzeCandidateAnswerAction: vi.fn(),
    pauseCandidateSessionAction: vi.fn(),
    resumeCandidateSessionAction: vi.fn(),
    retryCandidateQuestionAction: vi.fn(),
    startCandidateSessionAction: vi.fn(),
    submitCandidateAnswerAction: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
    showDemoTools: () => true,
}));

const loadedSession: LoadedCandidateSession = {
    practiceDraftId: "draft-1",
    session: {
        id: "session-1",
        status: "AWAITING_EVALUATION",
        role: "QA Analyst",
        jobDescription: "Test regulated workflows.",
        currentQuestionIndex: 0,
        initialsRequired: false,
        questions: [
            { id: "question-1", text: "Tell me about a release you improved.", category: "Behavioral", index: 0 },
        ],
        answers: {
            "question-1": {
                questionId: "question-1",
                transcript: "I tightened the release checklist.",
                submittedAt: 1770000000000,
            },
        },
    },
};

describe("CandidateSessionPage", () => {
    it("reuses the recruiter-style session workspace for candidate practice", () => {
        render(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        status: "IN_SESSION",
                        questions: [
                            loadedSession.session.questions[0],
                            { id: "question-2", text: "How do you handle ambiguity?", category: "Behavioral", index: 1 },
                        ],
                        answers: {},
                    },
                }}
            />,
        );

        expect(screen.getByRole("banner")).toHaveTextContent("QA Analyst");
        expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
        expect(screen.getByText("50% Complete")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /pause session/i })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Tell me about a release you improved." })).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: /type your answer/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /submit answer/i })).toBeInTheDocument();
        expect(screen.getAllByText("Coach's Lens").length).toBeGreaterThan(0);
    });

    it("offers candidate coaching after an answer is saved but before analysis exists", () => {
        render(<CandidateSessionPage loadedSession={loadedSession} />);

        expect(screen.getByText("Your saved answer")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /get coaching/i })).toBeInTheDocument();
        expect(screen.queryByText(/add a clearer metric/i)).not.toBeInTheDocument();
    });

    it("renders candidate-facing coaching when answer analysis exists", () => {
        render(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        answers: {
                            "question-1": {
                                ...loadedSession.session.answers["question-1"],
                                analysis: {
                                    ack: "You gave a useful starting point.",
                                    recommendation: "Add a clearer metric.",
                                    contentPulse: {
                                        dimension: "outcome_explicitness",
                                        headline: "Add the measurable result",
                                        body: "Tie the checklist to a release outcome.",
                                        quote: "release checklist",
                                    },
                                },
                            },
                        },
                    },
                }}
            />,
        );

        expect(screen.getAllByText("Coach's Lens").length).toBeGreaterThan(0);
        expect(screen.getByText("You gave a useful starting point.")).toBeInTheDocument();
        expect(screen.getByText("Add the measurable result")).toBeInTheDocument();
        expect(screen.getByText("Tie the checklist to a release outcome.")).toBeInTheDocument();
        expect(screen.getByText("Add a clearer metric.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /get coaching/i })).not.toBeInTheDocument();
    });

    it("shows recruiter-style resume controls for paused and completed candidate sessions", () => {
        const { rerender } = render(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        status: "PAUSED",
                    },
                }}
            />,
        );

        expect(screen.getByText("Practice saved")).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: /resume session/i }).length).toBeGreaterThan(0);

        rerender(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        status: "COMPLETED",
                    },
                }}
            />,
        );

        expect(screen.getByText("Session complete")).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: /review summary/i })[0]).toHaveAttribute("href", "/summary/session-1");
    });

    it("includes the hidden engagement debug inspector from the recruiter session experience", async () => {
        const user = userEvent.setup();

        render(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        engagedTimeSeconds: 42,
                        answers: {
                            "question-1": {
                                ...loadedSession.session.answers["question-1"],
                                analysis: {
                                    __debugPrompt: "Candidate analysis prompt snapshot",
                                    recommendation: "Keep the structure.",
                                },
                            },
                        },
                    },
                }}
            />,
        );

        await user.click(screen.getByRole("button", { name: /open engagement debug inspector/i }));

        expect(screen.getByText("Debug Inspector")).toBeInTheDocument();
        expect(screen.getByText("Session Total")).toBeInTheDocument();
        expect(screen.getByText(/42s/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /ai context/i }));
        expect(screen.getByText("Candidate analysis prompt snapshot")).toBeInTheDocument();
    });
});
