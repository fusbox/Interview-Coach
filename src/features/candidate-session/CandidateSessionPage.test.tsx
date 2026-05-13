import { render, screen } from "@testing-library/react";
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

const loadedSession: LoadedCandidateSession = {
    practiceDraftId: "draft-1",
    session: {
        id: "session-1",
        status: "REVIEWING",
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
    it("offers candidate coaching after an answer is saved but before analysis exists", () => {
        render(<CandidateSessionPage loadedSession={loadedSession} />);

        expect(screen.getByText("Saved answer")).toBeInTheDocument();
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

        expect(screen.getByText("Coach feedback")).toBeInTheDocument();
        expect(screen.getByText("You gave a useful starting point.")).toBeInTheDocument();
        expect(screen.getByText("Add the measurable result")).toBeInTheDocument();
        expect(screen.getByText("Tie the checklist to a release outcome.")).toBeInTheDocument();
        expect(screen.getByText("Add a clearer metric.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /get coaching/i })).not.toBeInTheDocument();
    });
});
