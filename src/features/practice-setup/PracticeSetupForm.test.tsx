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
                    interviewType: "behavioral",
                }}
            />,
        );

        expect(screen.getByLabelText(/target role/i)).toHaveValue("QA analyst");
        expect(screen.getByLabelText(/job description/i)).toHaveValue("Test regulated workflows.");
        expect(screen.getByLabelText(/resume text/i)).toHaveValue("Validated releases.");
        expect(screen.getByLabelText(/interview type/i)).toHaveValue("behavioral");
        expect(screen.getByLabelText(/question count/i)).toHaveValue("5");
    });

    it("uses the recruiter create card elevation", () => {
        render(<PracticeSetupForm />);

        expect(screen.getByRole("form", { name: /practice setup form/i })).toHaveClass("shadow-raised-1");
    });

    it("uses a single balanced default interview type option", () => {
        render(<PracticeSetupForm />);

        expect(screen.getByRole("option", { name: "Balanced practice" })).toHaveValue("");
        expect(screen.queryByRole("option", { name: "General" })).not.toBeInTheDocument();
    });

    it("treats restored general interview type values as balanced practice", () => {
        render(
            <PracticeSetupForm
                initialValues={{
                    targetRole: "QA analyst",
                    interviewType: "general",
                }}
            />,
        );

        expect(screen.getByLabelText(/interview type/i)).toHaveValue("");
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

        await user.click(screen.getByLabelText(/i understand interview coach uses ai/i));
        await user.click(screen.getByRole("button", { name: /start generating questions/i }));

        expect(startPracticeGenerationActionMock).toHaveBeenCalledWith({
            practiceDraftId: "draft-1",
            setup: {
                targetRole: "QA analyst",
                jobDescription: "Test regulated workflows.",
                resumeText: "Validated releases.",
                questionCount: 5,
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

    it("requires the AI and data acknowledgement before generating practice questions", async () => {
        const user = userEvent.setup();
        startPracticeGenerationActionMock.mockResolvedValue({
            ok: true,
            practiceDraftId: "draft-1",
            sessionId: "session-1",
            resumeTargetScreen: "session_entry",
        });
        render(<PracticeSetupForm initialValues={{ targetRole: "QA analyst" }} />);

        expect(screen.getByText(/resume text is optional/i)).toBeInTheDocument();
        expect(screen.getByText(/interview coach uses ai to generate practice questions/i)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /start generating questions/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent(/confirm the ai and data acknowledgement/i);
        expect(startPracticeGenerationActionMock).not.toHaveBeenCalled();

        await user.click(screen.getByLabelText(/i understand interview coach uses ai/i));
        await user.click(screen.getByRole("button", { name: /start generating questions/i }));

        expect(startPracticeGenerationActionMock).toHaveBeenCalledTimes(1);
    });

    it("submits the MVP interview type while deferring non-MVP intake fields", async () => {
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
                    questionCount: 7,
                    interviewType: "behavioral",
                }}
            />,
        );

        await user.selectOptions(screen.getByLabelText(/question count/i), "7");
        await user.click(screen.getByLabelText(/i understand interview coach uses ai/i));
        await user.click(screen.getByRole("button", { name: /start generating questions/i }));

        expect(startPracticeGenerationActionMock).toHaveBeenCalledWith(expect.objectContaining({
            setup: {
                targetRole: "Customer success manager",
                jobDescription: null,
                resumeText: null,
                questionCount: 7,
            },
            intakeResponses: {
                confidenceLevel: null,
                interviewType: "behavioral",
                timeline: null,
                concerns: null,
                practiceFocus: [],
            },
        }));
    });
});
