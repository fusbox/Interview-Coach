import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBasicAccessibilityViolations } from "@/test/accessibility";
import type { CandidateSummaryModel } from "@/lib/server/candidate";
import { CandidateSummaryPage } from "./CandidateSummaryPage";

const { fetchMock, refreshMock } = vi.hoisted(() => ({
    fetchMock: vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true, generated: true }),
    }),
    refreshMock: vi.fn(),
}));

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

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: refreshMock,
    }),
}));

describe("CandidateSummaryPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", fetchMock);
        window.sessionStorage.clear();
    });

    it("renders the recruiter-style candidate-owned debrief and actions", () => {
        render(<CandidateSummaryPage summary={summary} />);

        expect(screen.getByRole("heading", { name: /great practice round, fu/i })).toBeInTheDocument();
        expect(screen.getByText("Here's your feedback summary.")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /executive summary/i })).toBeInTheDocument();
        expect(screen.getByText("You adapted well under pressure.")).toBeInTheDocument();
        expect(screen.getByText("Add stronger impact metrics next.")).toBeInTheDocument();
        expect(screen.getByText("How was your session?")).toBeInTheDocument();
        const dashboardLink = screen.getByRole("link", { name: /back to dashboard/i });
        const practiceSetupLink = screen.getByRole("link", { name: /back to practice setup/i });

        expect(dashboardLink).toHaveAttribute("href", "/dashboard");
        expect(practiceSetupLink).toHaveAttribute("href", "/practice");
        expect(dashboardLink).toHaveClass("summary-nav-link");
        expect(practiceSetupLink).toHaveClass("summary-nav-link");
        expect(screen.queryByRole("link", { name: /practice again/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /close this window/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/shared with your recruiter/i)).not.toBeInTheDocument();
        expect(screen.getByText(/this summary is saved for your own review/i)).toBeInTheDocument();
        expect(screen.getByText(/protected by access controls/i)).toBeInTheDocument();
        expect(screen.getByText(/not shared with recruiters, employers, or hiring-decision users/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/company footer placeholder/i)).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("renders the debrief skeleton while the generated narrative is pending and finalizes after load", async () => {
        render(<CandidateSummaryPage summary={{ ...summary, summaryNarrative: null }} />);

        expect(screen.getByRole("heading", { name: /great practice round, fu/i })).toBeInTheDocument();
        expect(screen.getByText("One moment while I create your feedback summary")).toBeInTheDocument();
        expect(screen.getByLabelText(/feedback summary is loading/i)).toBeInTheDocument();
        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
            "/api/candidate/sessions/session-1/summary/finalize",
            { method: "POST" },
        ));
    });

    it("meets the candidate primary-page accessibility baseline", () => {
        const { container } = render(<CandidateSummaryPage summary={summary} />);

        expect(getBasicAccessibilityViolations(container)).toEqual([]);
    });
});
