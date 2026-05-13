import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getBasicAccessibilityViolations } from "@/test/accessibility";
import { CandidateDashboardPage } from "./CandidateDashboardPage";
import type { CandidateDashboardModel } from "@/lib/server/candidate";

const baseModel: CandidateDashboardModel = {
    candidate: {
        candidateProfileId: "profile-1",
        displayName: "Candidate One",
        email: "candidate@example.com",
    },
    stats: {
        activeCount: 1,
        completedCount: 1,
        totalPracticeCount: 2,
    },
    activeItems: [
        {
            practiceDraftId: "draft-1",
            title: "QA Analyst",
            statusLabel: "In progress",
            progressLabel: "1 of 3 answered",
            href: "/session/session-1",
            lastActivityLabel: "May 12, 2026",
        },
    ],
    completedItems: [
        {
            practiceDraftId: "draft-2",
            title: "Support Lead",
            statusLabel: "Completed",
            progressLabel: "2 of 2 answered",
            href: "/summary/session-2",
            repeatHref: "/practice",
            lastActivityLabel: "May 11, 2026",
            summarySnippet: "Clearer answers and stronger examples.",
        },
    ],
    nextBestAction: {
        title: "Resume QA Analyst",
        body: "You have 1 of 3 answered. Pick up this active practice before starting another round.",
        href: "/session/session-1",
        actionLabel: "Resume practice",
    },
};

describe("CandidateDashboardPage", () => {
    it("renders active and completed candidate-owned practice items", () => {
        render(<CandidateDashboardPage dashboard={baseModel} />);

        expect(screen.getByRole("heading", { name: /welcome back, candidate one/i })).toBeInTheDocument();
        expect(screen.getByText("QA Analyst")).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: /resume practice/i })[0]).toHaveAttribute("href", "/session/session-1");
        expect(screen.getByText("Support Lead")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /review summary/i })).toHaveAttribute("href", "/summary/session-2");
        expect(screen.getByRole("link", { name: /practice again/i })).toHaveAttribute("href", "/practice");
        expect(screen.getByText("Resume QA Analyst")).toBeInTheDocument();
        expect(screen.getByText(/pick up this active practice/i)).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: /resume practice/i })[1]).toHaveAttribute("href", "/session/session-1");
    });

    it("renders an empty state with a start-practice action", () => {
        render(<CandidateDashboardPage dashboard={{
            ...baseModel,
            stats: {
                activeCount: 0,
                completedCount: 0,
                totalPracticeCount: 0,
            },
            activeItems: [],
            completedItems: [],
            nextBestAction: {
                title: "Start with a target role",
                body: "Create a lightweight practice setup when you know what role you want to prepare for.",
                href: "/practice",
                actionLabel: "Start practice",
            },
        }} />);

        expect(screen.getByText(/no practice yet/i)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /start a practice session/i })).toHaveAttribute("href", "/practice");
    });

    it("meets the candidate primary-page accessibility baseline", () => {
        const { container } = render(<CandidateDashboardPage dashboard={baseModel} />);

        expect(getBasicAccessibilityViolations(container)).toEqual([]);
    });
});
