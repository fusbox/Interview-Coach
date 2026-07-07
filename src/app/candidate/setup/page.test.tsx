import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import CandidateSetupPage from "./page";

it("renders the candidate setup inputs with required markers", () => {
    render(<CandidateSetupPage />);

    expect(
        screen.getByRole("heading", { name: "Tell me what interview you are preparing for." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Practice setup")).toBeInTheDocument();
    expect(screen.queryByText(/Start with the role and job description/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Target role *")).toBeRequired();
    expect(screen.getByLabelText("Job description *")).toBeRequired();
    expect(screen.getByText("Interview stage *")).toBeInTheDocument();
    expect(screen.getByText("Question count *")).toBeInTheDocument();
    expect(screen.getByLabelText("Paste resume text")).toBeInTheDocument();
});

it("supports pasted, uploaded, and photographed resume text sources", () => {
    render(<CandidateSetupPage />);

    expect(screen.getByRole("button", { name: /paste text/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/upload file/i)).toHaveAttribute("accept", ".pdf,.doc,.docx,.txt,image/*");
    expect(screen.getByLabelText(/take photo/i)).toHaveAttribute("capture", "environment");

    const resume = new File(["resume"], "resume.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/upload file/i), { target: { files: [resume] } });

    expect(screen.getByRole("button", { name: /paste text/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/Selected: resume.pdf/i)).toBeInTheDocument();
});

it("changes the recommended question count when the interview stage changes", () => {
    render(<CandidateSetupPage />);

    expect(screen.getAllByText("7 questions")).toHaveLength(2);
    expect(screen.getByText(/I recommend 7 questions/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /final interview/i }));

    expect(screen.getAllByText("10 questions")).toHaveLength(2);
    expect(screen.getByText(/I recommend 10 questions/i)).toBeInTheDocument();
    expect(screen.getByText(/you can choose a different count/i)).toBeInTheDocument();
});

it("shows a progress transition after setup submission", () => {
    render(<CandidateSetupPage />);

    expect(screen.getByRole("button", { name: /start practice/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Target role *"), {
        target: { value: "Customer service representative" },
    });
    fireEvent.change(screen.getByLabelText("Job description *"), {
        target: { value: "Help customers resolve service questions." },
    });

    expect(screen.getByRole("button", { name: /start practice/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /start practice/i }));

    expect(screen.getByText(/Building your practice plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Preparing the transition into your first session/i)).toBeInTheDocument();
});
