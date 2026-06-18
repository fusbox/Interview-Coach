import type { ReactNode } from "react";

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

vi.mock("@/components/shell/CandidateShell", () => ({
    CandidateShell: ({ children }: { children: ReactNode }) => (
        <div data-testid="candidate-shell">{children}</div>
    ),
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
            selectedTargetInterviewId: "qa analyst",
            targetInterviews: [
                {
                    id: "qa analyst",
                    label: "QA Analyst",
                    href: "/dashboard?targetRole=qa%20analyst",
                    isSelected: true,
                    activeCount: 1,
                    completedCount: 0,
                },
            ],
            activeItems: [
                {
                    practiceDraftId: "draft-1",
                    roleProfileId: "role-profile-1",
                    roleContextLabel: "Role context saved",
                    title: "QA Analyst",
                    statusLabel: "In progress",
                    progressLabel: "1 of 3 answered",
                    href: "/session/session-1",
                    lastActivityLabel: "May 12, 2026",
                    prepProfile: {
                        prepProfileId: "role-profile-1",
                        primarySignal: {
                            label: "Make the answer easy to follow",
                            state: "emerging",
                        },
                        signals: [
                            {
                                prepProfileId: "role-profile-1",
                                signalId: "content:structural_clarity",
                                label: "Make the answer easy to follow",
                                lane: "interview_structure",
                                evidenceState: "emerging",
                                evidenceCounts: {
                                    not_practiced: 0,
                                    emerging: 1,
                                    clear: 0,
                                    strong: 0,
                                },
                                priority: "primary",
                                sourceRefs: [
                                    {
                                        type: "content_pulse",
                                        id: "question-1",
                                        label: "Structure the answer",
                                        excerpt: "The answer needs a clearer beginning, middle, and end.",
                                    },
                                ],
                            },
                        ],
                        signalCounts: {
                            not_practiced: 0,
                            emerging: 1,
                            clear: 0,
                            strong: 0,
                        },
                        recommendation: {
                            label: "Resume QA Analyst",
                            reason: "You have an unfinished practice round for this target interview.",
                            source: "unfinished_session",
                            href: "/session/session-1",
                        },
                    },
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

        render(await DashboardRoute({ searchParams: Promise.resolve({ targetRole: "QA Analyst" }) }));

        expect(loadCandidateDashboardForCurrentCandidateMock).toHaveBeenCalledWith({ targetRole: "QA Analyst" });
        expect(screen.getByTestId("candidate-shell")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /candidate dashboard/i })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: /welcome back/i })).not.toBeInTheDocument();
        expect(screen.getByRole("region", { name: /preparedness map/i })).toHaveTextContent("Structure");
        expect(screen.getByRole("button", { name: /open structure details/i })).toHaveTextContent("Emerging");
        expect(screen.getByRole("region", { name: /practice next/i })).toHaveTextContent("Resume QA Analyst");
        expect(screen.queryByRole("region", { name: /resume-to-role bridge/i })).not.toBeInTheDocument();
    });

    it("returns not found when candidate context is unavailable", async () => {
        loadCandidateDashboardForCurrentCandidateMock.mockResolvedValue(null);
        const { default: DashboardRoute } = await import("./page");

        await expect(DashboardRoute({})).rejects.toThrow("NEXT_NOT_FOUND");
        expect(notFoundMock).toHaveBeenCalled();
    });
});
