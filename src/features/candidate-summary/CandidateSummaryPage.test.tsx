import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getBasicAccessibilityViolations } from "@/test/accessibility";
import type { CandidateSummaryModel } from "@/lib/server/candidate";
import { CandidateSummaryPage } from "./CandidateSummaryPage";

const summary: CandidateSummaryModel = {
    practiceDraftId: "draft-1",
    sessionId: "session-1",
    role: "QA Analyst",
    status: "COMPLETED",
    summaryNarrative: "You were clear and structured. Add stronger impact metrics next.",
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

describe("CandidateSummaryPage", () => {
    it("renders the candidate-owned session summary and actions", () => {
        render(<CandidateSummaryPage summary={summary} />);

        expect(screen.getByRole("heading", { name: /qa analyst summary/i })).toBeInTheDocument();
        expect(screen.getByText(summary.summaryNarrative)).toBeInTheDocument();
        expect(screen.getByText("1 of 2 answered")).toBeInTheDocument();
        expect(screen.getByText("Tell me about a release you improved.")).toBeInTheDocument();
        expect(screen.getByText("I improved release quality with a checklist.")).toBeInTheDocument();
        expect(screen.getByText("Add a clearer metric.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /back to dashboard/i })).toHaveAttribute("href", "/dashboard");
        expect(screen.getByRole("link", { name: /practice again/i })).toHaveAttribute("href", "/practice");
    });

    it("meets the candidate primary-page accessibility baseline", () => {
        const { container } = render(<CandidateSummaryPage summary={summary} />);

        expect(getBasicAccessibilityViolations(container)).toEqual([]);
    });
});
