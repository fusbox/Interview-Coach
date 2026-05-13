import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadCandidateDashboardForCurrentCandidateMock, notFoundMock } = vi.hoisted(() => ({
    loadCandidateDashboardForCurrentCandidateMock: vi.fn(),
    notFoundMock: vi.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
}));

vi.mock("next/navigation", () => ({
    notFound: notFoundMock,
}));

vi.mock("@/lib/server/candidate", () => ({
    loadCandidateDashboardForCurrentCandidate: loadCandidateDashboardForCurrentCandidateMock,
}));

describe("/dashboard page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the candidate dashboard model", async () => {
        loadCandidateDashboardForCurrentCandidateMock.mockResolvedValue({
            candidate: {
                candidateProfileId: "profile-1",
                displayName: "Candidate One",
                email: "candidate@example.com",
            },
            stats: {
                activeCount: 1,
                completedCount: 0,
                totalPracticeCount: 1,
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
            completedItems: [],
            nextBestAction: {
                title: "Resume QA Analyst",
                body: "You have 1 of 3 answered. Pick up this active practice before starting another round.",
                href: "/session/session-1",
                actionLabel: "Resume practice",
            },
        });
        const { default: DashboardRoute } = await import("./page");

        render(await DashboardRoute());

        expect(loadCandidateDashboardForCurrentCandidateMock).toHaveBeenCalled();
        expect(screen.getByRole("heading", { name: /welcome back, candidate one/i })).toBeInTheDocument();
        expect(screen.getByText("QA Analyst")).toBeInTheDocument();
    });

    it("returns not found when candidate context is unavailable", async () => {
        loadCandidateDashboardForCurrentCandidateMock.mockResolvedValue(null);
        const { default: DashboardRoute } = await import("./page");

        await expect(DashboardRoute()).rejects.toThrow("NEXT_NOT_FOUND");
        expect(notFoundMock).toHaveBeenCalled();
    });
});
