import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getBasicAccessibilityViolations } from "@/test/accessibility";
import type { CandidateSummaryModel } from "@/lib/server/candidate";
import { CandidateSummaryPage } from "./CandidateSummaryPage";

const summary: CandidateSummaryModel = {
    practiceDraftId: "draft-1",
    sessionId: "session-1",
    candidateFirstName: "Fu",
    role: "QA Analyst",
    status: "COMPLETED",
    summaryNarrative: [
        "## Executive Summary",
        "You were clear and structured.",
        "",
        "## Core Strengths",
        "You adapted well under pressure.",
        "",
        "## Primary Growth Area",
        "Add stronger impact metrics next.",
        "",
        "## Momentum & Next Steps",
        "Practice one answer with a measurable result.",
    ].join("\n"),
    answeredCount: 1,
    questionCount: 2,
    answers: [
        {
            questionId: "question-1",
            questionText: "Tell me about a release you improved.",
            category: "Behavioral",
            transcript: "I improved release quality with a checklist.",
            recommendation: "Add a clearer metric.",
        },
    ],
};

vi.mock("@/app/actions/feedback", () => ({
    captureFeedbackAction: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("CandidateSummaryPage", () => {
    it("renders the recruiter-style candidate-owned debrief and actions", () => {
        render(<CandidateSummaryPage summary={summary} />);

        expect(screen.getByRole("heading", { name: /great practice round, fu/i })).toBeInTheDocument();
        expect(screen.getByText("Here's your feedback summary.")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /executive summary/i })).toBeInTheDocument();
        expect(screen.getByText("You adapted well under pressure.")).toBeInTheDocument();
        expect(screen.getByText("Add stronger impact metrics next.")).toBeInTheDocument();
        expect(screen.getByText("How was your session?")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /practice again/i })).toHaveAttribute("href", "/practice");
        expect(screen.queryByText(/shared with your recruiter/i)).not.toBeInTheDocument();
    });

    it("renders the debrief skeleton while the generated narrative is pending", () => {
        render(<CandidateSummaryPage summary={{ ...summary, summaryNarrative: null }} />);

        expect(screen.getByRole("heading", { name: /great practice round, fu/i })).toBeInTheDocument();
        expect(screen.getByText("One moment while I create your feedback summary")).toBeInTheDocument();
        expect(screen.getByLabelText(/feedback summary is loading/i)).toBeInTheDocument();
    });

    it("meets the candidate primary-page accessibility baseline", () => {
        const { container } = render(<CandidateSummaryPage summary={summary} />);

        expect(getBasicAccessibilityViolations(container)).toEqual([]);
    });
});
