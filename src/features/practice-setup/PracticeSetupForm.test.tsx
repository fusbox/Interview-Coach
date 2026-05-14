import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PracticeSetupForm } from "./PracticeSetupForm";

const { startPracticeGenerationActionMock } = vi.hoisted(() => ({
    startPracticeGenerationActionMock: vi.fn(),
}));

const { routerPushMock } = vi.hoisted(() => ({
    routerPushMock: vi.fn(),
}));

vi.mock("./actions", () => ({
    startPracticeGenerationAction: startPracticeGenerationActionMock,
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: routerPushMock,
    }),
}));

describe("PracticeSetupForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("prefills values from a restored draft", () => {
        render(
            <PracticeSetupForm
                initialValues={{
                    targetRole: "QA analyst",
                    jobDescription: "Test regulated workflows.",
                    resumeText: "Validated releases.",
                }}
            />,
        );

        expect(screen.getByLabelText(/target role/i)).toHaveValue("QA analyst");
        expect(screen.getByLabelText(/job description/i)).toHaveValue("Test regulated workflows.");
        expect(screen.getByLabelText(/resume text/i)).toHaveValue("Validated releases.");
    });

    it("announces target role validation errors and associates the message to the field", async () => {
        const user = userEvent.setup();
        render(<PracticeSetupForm />);

        await user.click(screen.getByRole("button", { name: /start generating questions/i }));

        const targetRole = screen.getByLabelText(/target role/i);
        const error = await screen.findByText("Target role is required.");

        expect(screen.getByRole("alert")).toHaveTextContent(/review the highlighted fields/i);
        expect(targetRole).toHaveAttribute("aria-invalid", "true");
        expect(targetRole).toHaveAttribute("aria-describedby", expect.stringContaining(error.id));
    });

    it("renders server submission errors in an announced region", () => {
        render(<PracticeSetupForm submissionError="We could not save your draft. Please try again." />);

        expect(screen.getByRole("alert")).toHaveTextContent("We could not save your draft. Please try again.");
    });

    it("submits a restored draft into generation after client validation passes", async () => {
        const user = userEvent.setup();
        startPracticeGenerationActionMock.mockResolvedValue({
            ok: true,
            practiceDraftId: "draft-1",
            sessionId: "session-1",
            resumeTargetScreen: "session_entry",
        });
        render(
            <PracticeSetupForm
                practiceDraftId="draft-1"
                initialValues={{
                    targetRole: "QA analyst",
                    jobDescription: "Test regulated workflows.",
                    resumeText: "Validated releases.",
                }}
            />,
        );

        await user.click(screen.getByRole("button", { name: /start generating questions/i }));

        expect(startPracticeGenerationActionMock).toHaveBeenCalledWith({
            practiceDraftId: "draft-1",
            setup: {
                targetRole: "QA analyst",
                jobDescription: "Test regulated workflows.",
                resumeText: "Validated releases.",
            },
            intakeResponses: {
                confidenceLevel: null,
                interviewType: null,
                timeline: null,
                concerns: null,
                practiceFocus: [],
            },
        });
        expect(routerPushMock).toHaveBeenCalledWith("/session/session-1");
    });

    it("submits structured intake selections with the setup context", async () => {
        const user = userEvent.setup();
        startPracticeGenerationActionMock.mockResolvedValue({
            ok: true,
            practiceDraftId: "draft-1",
            sessionId: "session-1",
            resumeTargetScreen: "session_entry",
        });
        render(
            <PracticeSetupForm
                practiceDraftId="draft-1"
                initialValues={{
                    targetRole: "Customer success manager",
                    jobDescription: null,
                    resumeText: null,
                    confidenceLevel: "medium",
                    interviewType: "behavioral",
                    timeline: "Interview next week",
                    concerns: "Staying concise",
                    practiceFocus: ["structure"],
                }}
            />,
        );

        await user.click(screen.getByLabelText(/specific examples/i));
        await user.click(screen.getByRole("button", { name: /start generating questions/i }));

        expect(startPracticeGenerationActionMock).toHaveBeenCalledWith(expect.objectContaining({
            intakeResponses: {
                confidenceLevel: "medium",
                interviewType: "behavioral",
                timeline: "Interview next week",
                concerns: "Staying concise",
                practiceFocus: ["structure", "specific examples"],
            },
        }));
    });
});
