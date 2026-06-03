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

    it("prefills values from a restored draft", async () => {
        const user = userEvent.setup();
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
        expect(screen.getByLabelText(/resume content/i)).toHaveValue("Validated releases.");

        await user.click(screen.getByRole("button", { name: /advanced setup/i }));

        expect(screen.getByRole("radio", { name: /Behavioral stories/i })).toBeChecked();
        expect(screen.getByRole("radio", { name: "5 questions" })).toBeChecked();
    });

    it("uses the recruiter create card elevation", () => {
        render(<PracticeSetupForm />);

        expect(screen.getByRole("form", { name: /practice setup form/i })).toHaveClass("shadow-raised-1");
    });

    it("keeps practice focus and question count in advanced setup", async () => {
        const user = userEvent.setup();
        render(<PracticeSetupForm />);

        expect(screen.getByRole("button", { name: /advanced setup/i })).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByLabelText(/practice focus/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/question count/i)).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /advanced setup/i }));

        expect(screen.getByRole("button", { name: /advanced setup/i })).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("group", { name: /practice focus/i })).toBeInTheDocument();
        expect(screen.getByRole("group", { name: /question count/i })).toBeInTheDocument();
    });

    it("uses a single balanced default interview type option", async () => {
        const user = userEvent.setup();
        render(<PracticeSetupForm />);

        await user.click(screen.getByRole("button", { name: /advanced setup/i }));

        expect(screen.getByRole("radio", { name: /Balanced practice/i })).toHaveAttribute("value", "");
        expect(screen.getByRole("radio", { name: /Balanced practice/i })).toBeChecked();
        expect(screen.queryByRole("radio", { name: "General" })).not.toBeInTheDocument();
    });

    it("frames interview type as practice focus with candidate-facing option labels", async () => {
        const user = userEvent.setup();
        render(<PracticeSetupForm />);

        await user.click(screen.getByRole("button", { name: /advanced setup/i }));

        expect(screen.getByRole("group", { name: /practice focus/i })).toHaveAccessibleDescription(
            "Choose what this round should emphasize. Balanced practice mixes common interview question types.",
        );
        expect(screen.getByRole("radio", { name: /Behavioral stories/i })).toHaveAttribute("value", "behavioral");
        expect(screen.getByRole("radio", { name: /Screening basics/i })).toHaveAttribute("value", "screening");
        expect(screen.getByText(/practice examples about judgment/i)).toBeInTheDocument();
        expect(screen.getByText(/focus on explaining tools/i)).toBeInTheDocument();
    });

    it("treats restored general interview type values as balanced practice", async () => {
        const user = userEvent.setup();
        render(
            <PracticeSetupForm
                initialValues={{
                    targetRole: "QA analyst",
                    interviewType: "general",
                }}
            />,
        );

        await user.click(screen.getByRole("button", { name: /advanced setup/i }));

        expect(screen.getByRole("radio", { name: /Balanced practice/i })).toBeChecked();
    });

    it("keeps advanced setup selections when the accordion is closed and reopened", async () => {
        const user = userEvent.setup();
        render(<PracticeSetupForm />);

        await user.click(screen.getByRole("button", { name: /advanced setup/i }));
        await user.click(screen.getByRole("radio", { name: /Technical depth/i }));
        await user.click(screen.getByRole("radio", { name: "7 questions" }));
        await user.click(screen.getByRole("button", { name: /advanced setup/i }));

        expect(screen.getByRole("button", { name: /advanced setup/i })).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("group", { name: /practice focus/i })).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /advanced setup/i }));

        expect(screen.getByRole("radio", { name: /Technical depth/i })).toBeChecked();
        expect(screen.getByRole("radio", { name: "7 questions" })).toBeChecked();
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

    it("announces job description validation errors and associates the message to the field", async () => {
        const user = userEvent.setup();
        render(<PracticeSetupForm initialValues={{ targetRole: "QA analyst" }} />);

        await user.click(screen.getByRole("button", { name: /start generating questions/i }));

        const jobDescription = screen.getByLabelText(/job description/i);
        const error = await screen.findByText("Job description is required.");

        expect(screen.getByRole("alert")).toHaveTextContent(/review the highlighted fields/i);
        expect(jobDescription).toHaveAttribute("required");
        expect(jobDescription).toHaveAttribute("aria-invalid", "true");
        expect(jobDescription).toHaveAttribute("aria-describedby", expect.stringContaining(error.id));
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
        render(<PracticeSetupForm initialValues={{ targetRole: "QA analyst", jobDescription: "Test regulated workflows." }} />);

        expect(screen.getByText(/resume content is optional/i)).toBeInTheDocument();
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
                    jobDescription: "Own customer renewals and adoption goals.",
                    resumeText: null,
                    questionCount: 7,
                    interviewType: "behavioral",
                }}
            />,
        );

        await user.click(screen.getByRole("button", { name: /advanced setup/i }));
        await user.click(screen.getByRole("radio", { name: "7 questions" }));
        await user.click(screen.getByLabelText(/i understand interview coach uses ai/i));
        await user.click(screen.getByRole("button", { name: /start generating questions/i }));

        expect(startPracticeGenerationActionMock).toHaveBeenCalledWith(expect.objectContaining({
            setup: {
                targetRole: "Customer success manager",
                jobDescription: "Own customer renewals and adoption goals.",
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
