import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadPracticeSetupDraftForCurrentCandidateMock } = vi.hoisted(() => ({
    loadPracticeSetupDraftForCurrentCandidateMock: vi.fn(),
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

        render(await PracticePage());

        expect(screen.getByText(/Practice setup feature boundary empty/)).toBeInTheDocument();
    });

    it("passes a restored draft into the practice setup feature", async () => {
        loadPracticeSetupDraftForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            initialValues: {
                targetRole: "QA analyst",
                jobDescription: null,
                resumeText: null,
            },
        });
        const { default: PracticePage } = await import("./page");

        render(await PracticePage());

        expect(screen.getByText(/Practice setup feature boundary draft-1/)).toBeInTheDocument();
    });
});
