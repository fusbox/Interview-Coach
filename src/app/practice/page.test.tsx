import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadPracticeSetupDraftForCurrentCandidateMock } = vi.hoisted(() => ({
    loadPracticeSetupDraftForCurrentCandidateMock: vi.fn(),
}));

vi.mock("@/components/shell/CandidateShell", () => ({
    CandidateShell: ({ children, showNavigation = true }: { children: ReactNode; showNavigation?: boolean }) => (
        <div data-testid="candidate-shell" data-show-navigation={String(showNavigation)}>{children}</div>
    ),
}));

vi.mock("@/features/practice-setup", () => ({
    PracticeSetupPage: ({ restoredDraft }: { restoredDraft: { practiceDraftId: string } | null }) => (
        <div>Practice setup feature boundary {restoredDraft?.practiceDraftId ?? "empty"}</div>
    ),
}));

vi.mock("@/lib/server/candidate", () => ({
    loadPracticeSetupDraftForCurrentCandidate: loadPracticeSetupDraftForCurrentCandidateMock,
}));

describe("/practice page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("delegates rendering to the practice setup feature", async () => {
        loadPracticeSetupDraftForCurrentCandidateMock.mockResolvedValue(null);
        const { default: PracticePage } = await import("./page");

        render(await PracticePage({}));

        expect(screen.getByTestId("candidate-shell")).toBeInTheDocument();
        expect(screen.getByTestId("candidate-shell")).toHaveAttribute("data-show-navigation", "true");
        expect(screen.getByText(/Practice setup feature boundary empty/)).toBeInTheDocument();
    });

    it("passes a selected draft id into the practice setup loader", async () => {
        loadPracticeSetupDraftForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            initialValues: {
                targetRole: "QA analyst",
                jobDescription: null,
                resumeText: null,
            },
        });
        const { default: PracticePage } = await import("./page");

        render(await PracticePage({
            searchParams: Promise.resolve({ draftId: "draft-1" }),
        }));

        expect(screen.getByText(/Practice setup feature boundary draft-1/)).toBeInTheDocument();
        expect(loadPracticeSetupDraftForCurrentCandidateMock).toHaveBeenCalledWith("draft-1");
    });
});
