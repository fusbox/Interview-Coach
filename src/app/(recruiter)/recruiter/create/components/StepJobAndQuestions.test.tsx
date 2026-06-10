import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StepJobAndQuestions } from "./StepJobAndQuestions";
import type { Details, InterviewDetails, QuestionInput, StepFooterProps } from "../constants";

function StepFooterStub({ onNext, isNextDisabled, customAction }: StepFooterProps) {
    return (
        <div>
            {customAction}
            <button type="button" onClick={onNext} disabled={isNextDisabled}>
                Next
            </button>
        </div>
    );
}

describe("StepJobAndQuestions", () => {
    const defaultInterviewDetails: InterviewDetails = {
        interviewStage: "not_sure",
        questionCount: 5,
    };

    it("keeps next disabled until req id, role, job description, and a question are present", async () => {
        const user = userEvent.setup();
        let details: Details = { role: "", jd: "", firstName: "", lastName: "", candidateEmail: "", reqId: "" };
        let interviewDetails = defaultInterviewDetails;
        let star: QuestionInput[] = [{ id: "s1", text: "", category: "STAR", label: "STAR 1" }];
        const perma: QuestionInput[] = [];
        const technical: QuestionInput[] = [];

        const setDetails = vi.fn((next: Details) => {
            details = next;
            rerenderComponent();
        });
        const setStar = vi.fn((next: QuestionInput[]) => {
            star = next;
            rerenderComponent();
        });
        const setInterviewDetails = vi.fn((next: InterviewDetails) => {
            interviewDetails = next;
            rerenderComponent();
        });

        const renderComponent = () => render(
            <StepJobAndQuestions
                details={details}
                setDetails={setDetails}
                interviewDetails={interviewDetails}
                setInterviewDetails={setInterviewDetails}
                star={star}
                setStar={setStar}
                perma={perma}
                setPerma={vi.fn()}
                technical={technical}
                setTechnical={vi.fn()}
                onNext={vi.fn()}
                StepFooter={StepFooterStub}
                onSaveTemplate={vi.fn()}
            />
        );

        const rendered = renderComponent();
        const rerenderComponent = () => {
            rendered.rerender(
                <StepJobAndQuestions
                    details={details}
                    setDetails={setDetails}
                    interviewDetails={interviewDetails}
                    setInterviewDetails={setInterviewDetails}
                    star={star}
                    setStar={setStar}
                    perma={perma}
                    setPerma={vi.fn()}
                    technical={technical}
                    setTechnical={vi.fn()}
                    onNext={vi.fn()}
                    StepFooter={StepFooterStub}
                    onSaveTemplate={vi.fn()}
                />
            );
        };

        expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

        fireEvent.change(screen.getByLabelText("Req ID"), { target: { value: "REQ-10" } });
        fireEvent.change(screen.getByLabelText("Target Role"), { target: { value: "QA Engineer" } });
        fireEvent.change(screen.getByLabelText("Job Description"), {
            target: { value: "Own QA coverage for customer-facing product releases." }
        });
        await user.click(screen.getByRole("button", { name: "Enter my own questions" }));
        await user.click(screen.getByRole("button", { name: "Looks good" }));
        fireEvent.change(screen.getByLabelText("Behavioral question 1"), {
            target: { value: "Tell me about a time you improved quality." }
        });

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
        });
    });

    it("applies a template and saves a new template from the modal", async () => {
        const user = userEvent.setup();
        const onSaveTemplate = vi.fn().mockResolvedValue(undefined);
        let details: Details = { role: "QA Engineer", jd: "", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-11" };
        let interviewDetails = defaultInterviewDetails;
        let star: QuestionInput[] = [{ id: "s1", text: "Existing question", category: "STAR", label: "STAR 1" }];
        let perma: QuestionInput[] = [];
        let technical: QuestionInput[] = [];

        const setDetails = vi.fn((next: Details) => {
            details = next;
            rerenderComponent();
        });
        const setStar = vi.fn((next: QuestionInput[]) => {
            star = next;
            rerenderComponent();
        });
        const setPerma = vi.fn((next: QuestionInput[]) => {
            perma = next;
            rerenderComponent();
        });
        const setTechnical = vi.fn((next: QuestionInput[]) => {
            technical = next;
            rerenderComponent();
        });
        const setInterviewDetails = vi.fn((next: InterviewDetails) => {
            interviewDetails = next;
            rerenderComponent();
        });

        const templates = [{
            id: "template-1",
            recruiterId: "recruiter-1",
            name: "Warehouse Pack",
            isShared: true,
            targetRole: "Warehouse Associate",
            questions: {
                star: [{ id: "t-star", text: "Describe a time you handled a safety issue.", category: "STAR", label: "Safety" }],
                perma: [{ id: "t-perma", text: "What energizes you at work?", category: "PERMA", label: "Meaning" }],
                technical: [{ id: "t-tech", text: "How do you inspect a pallet jack before use?", category: "Technical", label: "Technical Q1" }],
            },
            createdAt: "2026-03-20T10:00:00.000Z",
            updatedAt: "2026-03-20T10:00:00.000Z",
        }];

        const renderComponent = () => render(
            <StepJobAndQuestions
                details={details}
                setDetails={setDetails}
                interviewDetails={interviewDetails}
                setInterviewDetails={setInterviewDetails}
                star={star}
                setStar={setStar}
                perma={perma}
                setPerma={setPerma}
                technical={technical}
                setTechnical={setTechnical}
                onNext={vi.fn()}
                StepFooter={StepFooterStub}
                onSaveTemplate={onSaveTemplate}
                templates={templates}
            />
        );

        const rendered = renderComponent();
        const rerenderComponent = () => {
            rendered.rerender(
                <StepJobAndQuestions
                    details={details}
                    setDetails={setDetails}
                    interviewDetails={interviewDetails}
                    setInterviewDetails={setInterviewDetails}
                    star={star}
                    setStar={setStar}
                    perma={perma}
                    setPerma={setPerma}
                    technical={technical}
                    setTechnical={setTechnical}
                    onNext={vi.fn()}
                    StepFooter={StepFooterStub}
                    onSaveTemplate={onSaveTemplate}
                    templates={templates}
                />
            );
        };

        await user.selectOptions(screen.getByLabelText("Use a Template"), "template-1");

        expect(setDetails).toHaveBeenCalledWith(expect.objectContaining({ role: "Warehouse Associate" }));
        expect(setStar).toHaveBeenCalledWith(templates[0].questions.star);
        expect(setPerma).toHaveBeenCalledWith(templates[0].questions.perma);
        expect(setTechnical).toHaveBeenCalledWith(templates[0].questions.technical);

        await user.click(screen.getByRole("button", { name: /save as template/i }));
        expect(await screen.findByRole("dialog", { name: "Save Interview Template" })).toBeInTheDocument();

        const dialog = await screen.findByRole("dialog", { name: "Save Interview Template" });
        const templateNameInput = within(dialog).getByLabelText("Template Name");
        await user.clear(templateNameInput);
        await user.type(templateNameInput, "Night Shift Pack");
        await user.click(within(dialog).getByRole("button", { name: "Save Template" }));

        await waitFor(() => {
            expect(onSaveTemplate).toHaveBeenCalledWith("Night Shift Pack", true);
        });
    });

    it("keeps question creation gated until job details are complete", async () => {
        const user = userEvent.setup();

        render(
            <StepJobAndQuestions
                details={{ role: "", jd: "", firstName: "", lastName: "", candidateEmail: "", reqId: "" }}
                setDetails={vi.fn()}
                interviewDetails={defaultInterviewDetails}
                setInterviewDetails={vi.fn()}
                star={[{ id: "s1", text: "", category: "STAR", label: "STAR 1" }]}
                setStar={vi.fn()}
                perma={[]}
                setPerma={vi.fn()}
                technical={[]}
                setTechnical={vi.fn()}
                onNext={vi.fn()}
                onGenerateQuestionsAI={vi.fn()}
                StepFooter={StepFooterStub}
                onSaveTemplate={vi.fn()}
            />
        );

        expect(screen.queryByRole("button", { name: "Add Questions" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Generate Questions with AI" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Enter my own questions" })).toBeDisabled();
        expect(screen.queryByLabelText("Behavioral question 1")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Enter my own questions" }));
        expect(screen.queryByLabelText("Behavioral question 1")).not.toBeInTheDocument();
    });

    it("shows direct question entry actions and recruiter-specific stage choices", () => {
        render(
            <StepJobAndQuestions
                details={{ role: "QA Engineer", jd: "Support release validation and regression coverage.", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-15" }}
                setDetails={vi.fn()}
                interviewDetails={{ interviewStage: "initial_interview", questionCount: 5 }}
                setInterviewDetails={vi.fn()}
                star={[{ id: "s1", text: "", category: "STAR", label: "STAR 1" }]}
                setStar={vi.fn()}
                perma={[]}
                setPerma={vi.fn()}
                technical={[]}
                setTechnical={vi.fn()}
                onNext={vi.fn()}
                onGenerateQuestionsAI={vi.fn()}
                StepFooter={StepFooterStub}
                onSaveTemplate={vi.fn()}
            />
        );

        expect(screen.queryByRole("button", { name: "Add Questions" })).not.toBeInTheDocument();
        const aiButton = screen.getByRole("button", { name: "Generate Questions with AI" });
        expect(aiButton).toBeEnabled();
        expect(aiButton.querySelector("svg")).toHaveClass("text-amber-300");
        expect(screen.getByRole("button", { name: "Enter my own questions" })).toBeEnabled();
        expect(screen.queryByText("Not sure yet")).not.toBeInTheDocument();
        expect(screen.getByText("General practice")).toBeInTheDocument();
    });

    it("shows a visible failure panel when AI question generation rejects", async () => {
        const user = userEvent.setup();
        const onGenerateQuestionsAI = vi.fn().mockRejectedValue(new Error("Generation failed"));

        render(
            <StepJobAndQuestions
                details={{ role: "QA Engineer", jd: "Support release validation and regression coverage.", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-12" }}
                setDetails={vi.fn()}
                interviewDetails={defaultInterviewDetails}
                setInterviewDetails={vi.fn()}
                star={[{ id: "s1", text: "", category: "STAR", label: "STAR 1" }]}
                setStar={vi.fn()}
                perma={[]}
                setPerma={vi.fn()}
                technical={[]}
                setTechnical={vi.fn()}
                onNext={vi.fn()}
                onGenerateQuestionsAI={onGenerateQuestionsAI}
                StepFooter={StepFooterStub}
                onSaveTemplate={vi.fn()}
            />
        );

        await user.click(screen.getByRole("button", { name: "Generate Questions with AI" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "AI question generation failed. Please review the job details and try again."
        );
        expect(onGenerateQuestionsAI).toHaveBeenCalledTimes(1);
    });

    it("confirms the planned question mix before manual question entry is shown", async () => {
        const user = userEvent.setup();

        render(
            <StepJobAndQuestions
                details={{ role: "QA Engineer", jd: "Support release validation and regression coverage.", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-14" }}
                setDetails={vi.fn()}
                interviewDetails={{ interviewStage: "initial_screening", questionCount: 5 }}
                setInterviewDetails={vi.fn()}
                star={[{ id: "s1", text: "", category: "STAR", label: "STAR 1" }]}
                setStar={vi.fn()}
                perma={[]}
                setPerma={vi.fn()}
                technical={[]}
                setTechnical={vi.fn()}
                onNext={vi.fn()}
                onGenerateQuestionsAI={vi.fn()}
                StepFooter={StepFooterStub}
                onSaveTemplate={vi.fn()}
            />
        );

        await user.click(screen.getByRole("button", { name: "Enter my own questions" }));

        const dialog = screen.getByRole("dialog", { name: "Review question setup" });
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveClass("rounded-3xl", "border-border", "shadow-floating");
        expect(screen.getByText("5 questions - First conversation or screening")).toBeInTheDocument();
        expect(screen.getByText("Screening")).toBeInTheDocument();
        expect(screen.getByText("2 questions")).toBeInTheDocument();
        expect(screen.queryByLabelText("Behavioral question 1")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Looks good" }));

        expect(screen.queryByRole("dialog", { name: "Review question setup" })).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Screening Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Behavioral Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Culture / Fit Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Technical / Role-Specific Questions" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Case / Scenario Questions" })).not.toBeInTheDocument();
        expect(screen.queryByText("STAR Questions (Behavioral)")).not.toBeInTheDocument();
        expect(screen.queryByText("PERMA Questions (Culture/Fit)")).not.toBeInTheDocument();
    });

    it("replaces question entry actions with a compact accepted setup banner", async () => {
        const user = userEvent.setup();
        let star: QuestionInput[] = [];
        let perma: QuestionInput[] = [];
        let technical: QuestionInput[] = [];

        const setStar = vi.fn((next: QuestionInput[]) => {
            star = next;
            rerenderComponent();
        });
        const setPerma = vi.fn((next: QuestionInput[]) => {
            perma = next;
            rerenderComponent();
        });
        const setTechnical = vi.fn((next: QuestionInput[]) => {
            technical = next;
            rerenderComponent();
        });

        const renderComponent = () => render(
            <StepJobAndQuestions
                details={{ role: "QA Engineer", jd: "Support release validation and regression coverage.", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-17" }}
                setDetails={vi.fn()}
                interviewDetails={{ interviewStage: "initial_screening", questionCount: 5 }}
                setInterviewDetails={vi.fn()}
                star={star}
                setStar={setStar}
                perma={perma}
                setPerma={setPerma}
                technical={technical}
                setTechnical={setTechnical}
                onNext={vi.fn()}
                onGenerateQuestionsAI={vi.fn()}
                StepFooter={StepFooterStub}
                onSaveTemplate={vi.fn()}
            />
        );

        const rendered = renderComponent();
        const rerenderComponent = () => {
            rendered.rerender(
                <StepJobAndQuestions
                    details={{ role: "QA Engineer", jd: "Support release validation and regression coverage.", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-17" }}
                    setDetails={vi.fn()}
                    interviewDetails={{ interviewStage: "initial_screening", questionCount: 5 }}
                    setInterviewDetails={vi.fn()}
                    star={star}
                    setStar={setStar}
                    perma={perma}
                    setPerma={setPerma}
                    technical={technical}
                    setTechnical={setTechnical}
                    onNext={vi.fn()}
                    onGenerateQuestionsAI={vi.fn()}
                    StepFooter={StepFooterStub}
                    onSaveTemplate={vi.fn()}
                />
            );
        };

        await user.click(screen.getByRole("button", { name: "Enter my own questions" }));
        await user.click(screen.getByRole("button", { name: "Looks good" }));

        expect(screen.getByText("Question setup")).toBeInTheDocument();
        expect(screen.getByText("5 questions - First conversation or screening")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Interview Details" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Generate Questions with AI" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Enter my own questions" })).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Start over" }));

        expect(screen.queryByText("5 questions - First conversation or screening")).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Screening Questions" })).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Interview Details" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Generate Questions with AI" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Enter my own questions" })).toBeEnabled();
    });

    it("restores the accepted setup banner and visible question list when returning with existing questions", () => {
        render(
            <StepJobAndQuestions
                details={{ role: "QA Engineer", jd: "Support release validation and regression coverage.", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-18" }}
                setDetails={vi.fn()}
                interviewDetails={{ interviewStage: "initial_screening", questionCount: 5 }}
                setInterviewDetails={vi.fn()}
                star={[
                    { id: "screening-1", text: "Tell me about yourself.", category: "Screening", label: "Screening Q1" },
                    { id: "behavioral-1", text: "Tell me about a time you helped a client.", category: "Behavioral", label: "Behavioral Q1" },
                ]}
                setStar={vi.fn()}
                perma={[{ id: "culture-1", text: "What team environment fits you?", category: "Culture / Fit", label: "Culture Q1" }]}
                setPerma={vi.fn()}
                technical={[{ id: "technical-1", text: "How do you use a CRM?", category: "Technical", label: "Technical Q1" }]}
                setTechnical={vi.fn()}
                onNext={vi.fn()}
                onGenerateQuestionsAI={vi.fn()}
                StepFooter={StepFooterStub}
                onSaveTemplate={vi.fn()}
            />
        );

        expect(screen.getByText("Question setup")).toBeInTheDocument();
        expect(screen.getByText("5 questions - First conversation or screening")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Interview Details" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Generate Questions with AI" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Enter my own questions" })).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Screening Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Behavioral Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Culture / Fit Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Technical / Role-Specific Questions" })).toBeInTheDocument();
    });

    it("trims AI-generated questions to the confirmed question setup", async () => {
        const user = userEvent.setup();
        let star: QuestionInput[] = [];
        let perma: QuestionInput[] = [];
        let technical: QuestionInput[] = [];

        const setStar = vi.fn((next: QuestionInput[]) => {
            star = next;
            rerenderComponent();
        });
        const setPerma = vi.fn((next: QuestionInput[]) => {
            perma = next;
            rerenderComponent();
        });
        const setTechnical = vi.fn((next: QuestionInput[]) => {
            technical = next;
            rerenderComponent();
        });
        const onGenerateQuestionsAI = vi.fn(async () => {
            star = [
                { id: "screening-1", text: "Tell me about yourself.", category: "Screening", label: "Background" },
                { id: "screening-2", text: "Why are you interested in this role?", category: "Screening", label: "Interest" },
                { id: "behavioral-1", text: "Tell me about a time you helped a client.", category: "Behavioral", label: "Behavioral Q1" },
                { id: "behavioral-2", text: "Tell me about a time you learned quickly.", category: "Behavioral", label: "Behavioral Q2" },
                { id: "case-1", text: "How would you handle a scheduling conflict?", category: "Case / Scenario", label: "Case / Scenario Q1" },
            ];
            perma = [
                { id: "culture-1", text: "What helps you do your best work?", category: "Culture / Fit", label: "Culture Q1" },
                { id: "culture-2", text: "What team environment fits you?", category: "Culture / Fit", label: "Culture Q2" },
            ];
            technical = [
                { id: "tech-1", text: "How do you use a CRM?", category: "Technical", label: "Technical Q1" },
                { id: "tech-2", text: "How do you document customer issues?", category: "Technical", label: "Technical Q2" },
            ];
            rerenderComponent();
        });

        const renderComponent = () => render(
            <StepJobAndQuestions
                details={{ role: "Client Services Specialist", jd: "Support clients, document issues, and resolve account questions.", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-16" }}
                setDetails={vi.fn()}
                interviewDetails={{ interviewStage: "initial_screening", questionCount: 5 }}
                setInterviewDetails={vi.fn()}
                star={star}
                setStar={setStar}
                perma={perma}
                setPerma={setPerma}
                technical={technical}
                setTechnical={setTechnical}
                onNext={vi.fn()}
                onGenerateQuestionsAI={onGenerateQuestionsAI}
                StepFooter={StepFooterStub}
                onSaveTemplate={vi.fn()}
            />
        );

        const rendered = renderComponent();
        const rerenderComponent = () => {
            rendered.rerender(
                <StepJobAndQuestions
                    details={{ role: "Client Services Specialist", jd: "Support clients, document issues, and resolve account questions.", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-16" }}
                    setDetails={vi.fn()}
                    interviewDetails={{ interviewStage: "initial_screening", questionCount: 5 }}
                    setInterviewDetails={vi.fn()}
                    star={star}
                    setStar={setStar}
                    perma={perma}
                    setPerma={setPerma}
                    technical={technical}
                    setTechnical={setTechnical}
                    onNext={vi.fn()}
                    onGenerateQuestionsAI={onGenerateQuestionsAI}
                    StepFooter={StepFooterStub}
                    onSaveTemplate={vi.fn()}
                />
            );
        };

        await user.click(screen.getByRole("button", { name: "Generate Questions with AI" }));
        expect(await screen.findByRole("dialog", { name: "Review question setup" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Looks good" }));

        expect(onGenerateQuestionsAI).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("heading", { name: "Screening Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Behavioral Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Culture / Fit Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Technical / Role-Specific Questions" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Case / Scenario Questions" })).not.toBeInTheDocument();
        expect(screen.getAllByRole("textbox", { name: /^Screening question/i })).toHaveLength(2);
        expect(screen.getAllByRole("textbox", { name: /^Behavioral question/i })).toHaveLength(1);
        expect(screen.getAllByRole("textbox", { name: /^Culture \/ Fit question/i })).toHaveLength(1);
        expect(screen.getAllByRole("textbox", { name: /^Technical \/ Role-Specific question/i })).toHaveLength(1);
        expect(screen.queryByDisplayValue("Tell me about a time you learned quickly.")).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue("How would you handle a scheduling conflict?")).not.toBeInTheDocument();
    });

    it("updates interview stage and question count controls", async () => {
        const user = userEvent.setup();
        let interviewDetails = defaultInterviewDetails;
        const setInterviewDetails = vi.fn((next: InterviewDetails) => {
            interviewDetails = next;
            rerenderComponent();
        });

        const renderComponent = () => render(
            <StepJobAndQuestions
                details={{ role: "QA Engineer", jd: "Support release validation and regression coverage.", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-13" }}
                setDetails={vi.fn()}
                interviewDetails={interviewDetails}
                setInterviewDetails={setInterviewDetails}
                star={[{ id: "s1", text: "", category: "STAR", label: "STAR 1" }]}
                setStar={vi.fn()}
                perma={[]}
                setPerma={vi.fn()}
                technical={[]}
                setTechnical={vi.fn()}
                onNext={vi.fn()}
                StepFooter={StepFooterStub}
                onSaveTemplate={vi.fn()}
            />
        );

        const rendered = renderComponent();
        const rerenderComponent = () => {
            rendered.rerender(
                <StepJobAndQuestions
                    details={{ role: "QA Engineer", jd: "Support release validation and regression coverage.", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-13" }}
                    setDetails={vi.fn()}
                    interviewDetails={interviewDetails}
                    setInterviewDetails={setInterviewDetails}
                    star={[{ id: "s1", text: "", category: "STAR", label: "STAR 1" }]}
                    setStar={vi.fn()}
                    perma={[]}
                    setPerma={vi.fn()}
                    technical={[]}
                    setTechnical={vi.fn()}
                    onNext={vi.fn()}
                    StepFooter={StepFooterStub}
                    onSaveTemplate={vi.fn()}
                />
            );
        };

        const screeningStageOption = screen.getByRole("radio", { name: /first conversation or screening/i });
        const sevenQuestionOption = screen.getByRole("radio", { name: "7 questions" });

        expect(screeningStageOption).toHaveClass("accent-primary");
        expect(sevenQuestionOption).toHaveClass("accent-primary");

        await user.click(screeningStageOption);
        expect(setInterviewDetails).toHaveBeenLastCalledWith(expect.objectContaining({
            interviewStage: "initial_screening",
        }));

        await user.click(sevenQuestionOption);
        expect(setInterviewDetails).toHaveBeenLastCalledWith(expect.objectContaining({
            interviewStage: "initial_screening",
            questionCount: 7,
        }));
    });
});
