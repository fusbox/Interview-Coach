import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getBasicAccessibilityViolations } from "@/test/accessibility";

import { PracticeSetupPage } from "./PracticeSetupPage";

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

describe("PracticeSetupPage", () => {
    it("renders the first candidate-owned setup form fields", () => {
        render(<PracticeSetupPage />);

        expect(screen.getByRole("heading", { name: /set up your practice/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/target role/i)).toBeRequired();
        expect(screen.getByLabelText(/job description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/resume text/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /start generating questions/i })).toBeInTheDocument();
    });

    it("keeps future personalization and upload paths visible but secondary", () => {
        render(<PracticeSetupPage />);

        expect(screen.getByText(/resume file upload is coming next/i)).toBeInTheDocument();
        expect(screen.getByText(/personalization intake will plug into this setup later/i)).toBeInTheDocument();
    });

    it("renders available draft choices with stable draft links", () => {
        render(<PracticeSetupPage restoredDraft={{
            practiceDraftId: "draft-2",
            availableDrafts: [
                {
                    practiceDraftId: "draft-2",
                    draftLabel: "Warehouse lead",
                    targetRole: "Warehouse lead",
                    status: "draft",
                    resumeTargetScreen: "practice_setup",
                    lastActivityAt: "2026-05-12T12:00:00.000Z",
                    createdAt: "2026-05-11T12:00:00.000Z",
                },
            ],
            initialValues: {
                targetRole: "Warehouse lead",
                jobDescription: null,
                resumeText: null,
            },
        }} />);

        expect(screen.getByRole("link", { name: /warehouse lead/i })).toHaveAttribute("href", "/practice?draftId=draft-2");
        expect(screen.getByText(/may 12, 2026/i)).toBeInTheDocument();
    });

    it("meets the candidate primary-page accessibility baseline", () => {
        const { container } = render(<PracticeSetupPage />);

        expect(getBasicAccessibilityViolations(container)).toEqual([]);
    });
});
