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
        expect(screen.getByRole("button", { name: /ai generate questions/i })).toBeDisabled();
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
        expect(screen.getByRole("button", { name: /ai generate questions/i })).toBeEnabled();
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

        await user.click(screen.getByRole("button", { name: /ai generate questions/i }));

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

        expect(screen.getByRole("dialog", { name: "Review question setup" })).toBeInTheDocument();
        expect(screen.getByText("I've set up this question mix for a 5-question First conversation or screening practice session.")).toBeInTheDocument();
        expect(screen.getByText("Screening")).toBeInTheDocument();
        expect(screen.getByText("2 questions")).toBeInTheDocument();
        expect(screen.queryByLabelText("Behavioral question 1")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Looks good" }));

        expect(screen.queryByRole("dialog", { name: "Review question setup" })).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Screening Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Behavioral Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Culture / Fit Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Case / Scenario Questions" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Technical / Role-Specific Questions" })).toBeInTheDocument();
        expect(screen.queryByText("STAR Questions (Behavioral)")).not.toBeInTheDocument();
        expect(screen.queryByText("PERMA Questions (Culture/Fit)")).not.toBeInTheDocument();
        expect(screen.getByLabelText("Behavioral question 1")).toBeInTheDocument();
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

        await user.click(screen.getByRole("radio", { name: /first conversation or screening/i }));
        expect(setInterviewDetails).toHaveBeenLastCalledWith(expect.objectContaining({
            interviewStage: "initial_screening",
        }));

        await user.click(screen.getByRole("radio", { name: "7 questions" }));
        expect(setInterviewDetails).toHaveBeenLastCalledWith(expect.objectContaining({
            interviewStage: "initial_screening",
            questionCount: 7,
        }));
    });
});
