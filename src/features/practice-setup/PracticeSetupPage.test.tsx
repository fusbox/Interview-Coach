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

        expect(screen.getByRole("heading", { name: "Practice Setup" })).toBeInTheDocument();
        expect(screen.queryByText(/practice setup/i, { selector: "p" })).not.toBeInTheDocument();
        expect(screen.queryByText(/add only the context/i)).not.toBeInTheDocument();
        expect(screen.getByLabelText(/target role/i)).toBeRequired();
        expect(screen.getByLabelText(/job description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/resume text/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/interview type/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/question count/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /start generating questions/i })).toBeInTheDocument();
    });

    it("keeps deferred setup fields and companion panels out of the MVP surface", () => {
        render(<PracticeSetupPage />);

        expect(screen.queryByText(/what happens next/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/setup state/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/draft state/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/resume file upload is coming next/i)).not.toBeInTheDocument();
        expect(screen.queryByRole("group", { name: /how ready do you feel/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("group", { name: /what should the coach pay attention to/i })).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/timeline/i)).not.toBeInTheDocument();
    });

    it("prefills the MVP form fields from a restored draft without rendering draft choice cards", () => {
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
                interviewType: "technical",
                questionCount: 7,
            },
        }} />);

        expect(screen.getByLabelText(/target role/i)).toHaveValue("Warehouse lead");
        expect(screen.getByLabelText(/interview type/i)).toHaveValue("technical");
        expect(screen.getByLabelText(/question count/i)).toHaveValue("7");
        expect(screen.queryByRole("link", { name: /warehouse lead/i })).not.toBeInTheDocument();
    });

    it("meets the candidate primary-page accessibility baseline", () => {
        const { container } = render(<PracticeSetupPage />);

        expect(getBasicAccessibilityViolations(container)).toEqual([]);
    });
});
