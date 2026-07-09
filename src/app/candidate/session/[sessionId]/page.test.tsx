import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import CandidateSessionPage, { renderCandidateSessionPage } from "./page";
import { saveCandidateProvisionalSession } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";

beforeEach(() => {
    vi.unstubAllGlobals();
    window.scrollTo = vi.fn();
});

it("shows a recovery state when a provisional session snapshot is missing", async () => {
    window.sessionStorage.clear();
    const ui = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    await act(async () => {
        render(ui);
    });

    expect(screen.getByText("Practice session")).toBeInTheDocument();
    expect(screen.getByText(/I need the setup details for this practice round/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to setup/i })).toHaveAttribute("href", "/candidate/setup");
});

it("renders the setup-created planned session shell for the requested session", async () => {
    window.sessionStorage.clear();
    saveCandidateProvisionalSession(window.sessionStorage, {
        status: "session_created",
        sessionId: "session-v2-1",
        nextRoute: "/candidate/session/session-v2-1",
        setupSnapshot: {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: "Supported a front desk.",
            interviewStage: "screening",
            questionCount: 5,
            resumeCaptureMode: "pasted_text",
            createdAt: "2026-07-08T18:00:00.000Z",
        },
        questionPlanSnapshot: createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 5,
        }),
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [
                {
                    slotId: "slot-1",
                    index: 0,
                    category: "screening",
                    questionText: "Stored snapshot question for the first slot.",
                },
                {
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral",
                    questionText: "Stored snapshot question for the second slot.",
                },
                {
                    slotId: "slot-3",
                    index: 2,
                    category: "culture_fit",
                    questionText: "Stored snapshot question for the third slot.",
                },
                {
                    slotId: "slot-4",
                    index: 3,
                    category: "screening",
                    questionText: "Stored snapshot question for the fourth slot.",
                },
                {
                    slotId: "slot-5",
                    index: 4,
                    category: "technical_role_specific",
                    questionText: "Stored snapshot question for the fifth slot.",
                },
            ],
        },
    });
    const ui = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    await act(async () => {
        render(ui);
    });

    expect(screen.getByRole("heading", { name: "Customer service representative" })).toBeInTheDocument();
    expect(screen.getByText("Screening call")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Included")).toBeInTheDocument();
    expect(screen.getByText(/Question wording comes next/i)).toBeInTheDocument();
    expect(screen.getByText(/Question wording request is ready/i)).toBeInTheDocument();
    expect(screen.getByText(/question wording is not connected yet/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Question preview/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Stored snapshot question for the first slot/i)).toBeInTheDocument();
    expect(screen.queryByText(/What interests you about this Customer service representative role/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Here is the mix I planned from." })).toBeInTheDocument();
    expect(screen.getByText(/Question wording has not been generated yet/i)).toBeInTheDocument();
    expect(screen.getAllByText("Screening")).toHaveLength(4);
    expect(screen.getAllByText("Behavioral")).toHaveLength(2);
    expect(screen.getAllByText("Culture / Fit")).toHaveLength(2);
    expect(screen.getAllByText("Technical / Role-Specific")).toHaveLength(2);
});

it("hydrates a candidate-owned durable planned session before browser storage fallback", async () => {
    window.sessionStorage.clear();
    const resolveDurableSession = vi.fn(async () => ({
        status: "session_created" as const,
        sessionId: "durable-session-1",
        nextRoute: "/candidate/session/durable-session-1" as const,
        setupSnapshot: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely across the warehouse.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 3,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-09T18:00:00.000Z",
        },
        questionPlanSnapshot: createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 3,
        }),
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questions: [
                {
                    slotId: "slot-1",
                    index: 0,
                    category: "screening" as const,
                    questionText: "Durable snapshot question for the first slot.",
                },
                {
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral" as const,
                    questionText: "Durable snapshot question for the second slot.",
                },
                {
                    slotId: "slot-3",
                    index: 2,
                    category: "culture_fit" as const,
                    questionText: "Durable snapshot question for the third slot.",
                },
            ],
        },
        progress: {
            status: "question_preview" as const,
            currentQuestionIndex: 1,
        },
    }));

    const ui = await renderCandidateSessionPage({
        params: Promise.resolve({ sessionId: "durable-session-1" }),
        dependencies: {
            resolveDurableSession,
        },
    });

    await act(async () => {
        render(ui);
    });

    expect(resolveDurableSession).toHaveBeenCalledWith({ sessionId: "durable-session-1" });
    expect(screen.getByRole("heading", { name: "Question 2 of 3" })).toBeInTheDocument();
    expect(screen.getByText("Durable snapshot question for the second slot.")).toBeInTheDocument();
    expect(screen.queryByText(/I need the setup details for this practice round/i)).not.toBeInTheDocument();
});

it("restores and saves answer drafts for a durable candidate-owned session", async () => {
    window.sessionStorage.clear();
    const fetch = vi.fn(async () => new Response(JSON.stringify({
        status: "answer_draft_saved",
        answerDrafts: {},
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const resolveDurableSession = vi.fn(async () => ({
        status: "session_created" as const,
        sessionId: "durable-session-1",
        nextRoute: "/candidate/session/durable-session-1" as const,
        setupSnapshot: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely across the warehouse.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 3,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-09T18:00:00.000Z",
        },
        questionPlanSnapshot: createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 3,
        }),
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questions: [
                {
                    slotId: "slot-1",
                    index: 0,
                    category: "screening" as const,
                    questionText: "Durable snapshot question for the first slot.",
                },
                {
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral" as const,
                    questionText: "Durable snapshot question for the second slot.",
                },
                {
                    slotId: "slot-3",
                    index: 2,
                    category: "culture_fit" as const,
                    questionText: "Durable snapshot question for the third slot.",
                },
            ],
        },
        progress: {
            status: "question_preview" as const,
            currentQuestionIndex: 1,
        },
        answerDrafts: {
            "slot-2": {
                slotId: "slot-2",
                questionIndex: 1,
                mode: "text" as const,
                text: "I handled a busy shift by prioritizing safety and communication.",
                updatedAt: "2026-07-09T20:00:00.000Z",
            },
        },
    }));

    const ui = await renderCandidateSessionPage({
        params: Promise.resolve({ sessionId: "durable-session-1" }),
        dependencies: {
            resolveDurableSession,
        },
    });

    await act(async () => {
        render(ui);
    });

    const answerDraft = screen.getByRole("textbox", { name: "Draft answer" });
    expect(answerDraft).toHaveValue("I handled a busy shift by prioritizing safety and communication.");

    fireEvent.change(answerDraft, {
        target: {
            value: "I handled a busy shift by prioritizing safety, communication, and clean handoffs.",
        },
    });

    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/durable-session-1/answer-drafts",
        expect.objectContaining({
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                slotId: "slot-2",
                questionIndex: 1,
                mode: "text",
                text: "I handled a busy shift by prioritizing safety, communication, and clean handoffs.",
            }),
        }),
    );
});

it("opens a read-only first question shell from the carried wording snapshot", async () => {
    window.sessionStorage.clear();
    saveCandidateProvisionalSession(window.sessionStorage, {
        status: "session_created",
        sessionId: "session-v2-1",
        nextRoute: "/candidate/session/session-v2-1",
        setupSnapshot: {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: "Supported a front desk.",
            interviewStage: "screening",
            questionCount: 5,
            resumeCaptureMode: "pasted_text",
            createdAt: "2026-07-08T18:00:00.000Z",
        },
        questionPlanSnapshot: createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 5,
        }),
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [
                {
                    slotId: "slot-1",
                    index: 0,
                    category: "screening",
                    questionText: "Stored snapshot question for the first slot.",
                },
                {
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral",
                    questionText: "Stored snapshot question for the second slot.",
                },
                {
                    slotId: "slot-3",
                    index: 2,
                    category: "culture_fit",
                    questionText: "Stored snapshot question for the third slot.",
                },
                {
                    slotId: "slot-4",
                    index: 3,
                    category: "screening",
                    questionText: "Stored snapshot question for the fourth slot.",
                },
                {
                    slotId: "slot-5",
                    index: 4,
                    category: "technical_role_specific",
                    questionText: "Stored snapshot question for the fifth slot.",
                },
            ],
        },
    });
    const ui = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    await act(async () => {
        render(ui);
    });

    expect(screen.getByRole("button", { name: "Start questions" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Open first question preview" }));

    expect(screen.getByRole("heading", { name: "Question 1 of 5" })).toBeInTheDocument();
    expect(screen.getByText("Stored snapshot question for the first slot.")).toBeInTheDocument();
    expect(screen.getByText(/This is a read-only question shell/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit answer/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back to plan" })).toBeInTheDocument();
});

it("keeps local answer drafts on the question surface without enabling submission", async () => {
    window.sessionStorage.clear();
    saveCandidateProvisionalSession(window.sessionStorage, {
        status: "session_created",
        sessionId: "session-v2-1",
        nextRoute: "/candidate/session/session-v2-1",
        setupSnapshot: {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: "Supported a front desk.",
            interviewStage: "screening",
            questionCount: 5,
            resumeCaptureMode: "pasted_text",
            createdAt: "2026-07-08T18:00:00.000Z",
        },
        questionPlanSnapshot: createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 5,
        }),
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [
                {
                    slotId: "slot-1",
                    index: 0,
                    category: "screening",
                    questionText: "Stored snapshot question for the first slot.",
                },
                {
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral",
                    questionText: "Stored snapshot question for the second slot.",
                },
                {
                    slotId: "slot-3",
                    index: 2,
                    category: "culture_fit",
                    questionText: "Stored snapshot question for the third slot.",
                },
                {
                    slotId: "slot-4",
                    index: 3,
                    category: "screening",
                    questionText: "Stored snapshot question for the fourth slot.",
                },
                {
                    slotId: "slot-5",
                    index: 4,
                    category: "technical_role_specific",
                    questionText: "Stored snapshot question for the fifth slot.",
                },
            ],
        },
    });
    const ui = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    await act(async () => {
        render(ui);
    });

    fireEvent.click(screen.getByRole("button", { name: "Open first question preview" }));

    expect(screen.getByRole("button", { name: "Type answer" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Record answer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add photo notes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /submit answer/i })).toBeDisabled();

    const answerDraft = screen.getByRole("textbox", { name: "Draft answer" });
    fireEvent.change(answerDraft, {
        target: {
            value: "I would greet the customer, ask one clarifying question, and confirm the next step.",
        },
    });

    fireEvent.click(screen.getByRole("button", { name: "Next question preview" }));
    expect(screen.getByRole("textbox", { name: "Draft answer" })).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Previous question preview" }));
    expect(screen.getByRole("textbox", { name: "Draft answer" })).toHaveValue(
        "I would greet the customer, ask one clarifying question, and confirm the next step.",
    );
    expect(screen.getByText(/Drafts stay on this screen only/i)).toBeInTheDocument();
});

it("restores read-only question preview progress after remount", async () => {
    window.sessionStorage.clear();
    saveCandidateProvisionalSession(window.sessionStorage, {
        status: "session_created",
        sessionId: "session-v2-1",
        nextRoute: "/candidate/session/session-v2-1",
        setupSnapshot: {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: "Supported a front desk.",
            interviewStage: "screening",
            questionCount: 5,
            resumeCaptureMode: "pasted_text",
            createdAt: "2026-07-08T18:00:00.000Z",
        },
        questionPlanSnapshot: createCandidateQuestionPlan({
            interviewStage: "screening",
            questionCount: 5,
        }),
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: [
                {
                    slotId: "slot-1",
                    index: 0,
                    category: "screening",
                    questionText: "Stored snapshot question for the first slot.",
                },
                {
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral",
                    questionText: "Stored snapshot question for the second slot.",
                },
                {
                    slotId: "slot-3",
                    index: 2,
                    category: "culture_fit",
                    questionText: "Stored snapshot question for the third slot.",
                },
                {
                    slotId: "slot-4",
                    index: 3,
                    category: "screening",
                    questionText: "Stored snapshot question for the fourth slot.",
                },
                {
                    slotId: "slot-5",
                    index: 4,
                    category: "technical_role_specific",
                    questionText: "Stored snapshot question for the fifth slot.",
                },
            ],
        },
    });
    const ui = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    const mounted = render(ui);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "Open first question preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Next question preview" }));

    expect(screen.getByRole("heading", { name: "Question 2 of 5" })).toBeInTheDocument();

    mounted.unmount();
    const remountedUi = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    await act(async () => {
        render(remountedUi);
    });

    expect(screen.getByRole("heading", { name: "Question 2 of 5" })).toBeInTheDocument();
    expect(screen.getByText("Stored snapshot question for the second slot.")).toBeInTheDocument();
});

it("prefers the carried question plan snapshot over render-time setup derivation", async () => {
    window.sessionStorage.clear();
    saveCandidateProvisionalSession(window.sessionStorage, {
        status: "session_created",
        sessionId: "session-v2-1",
        nextRoute: "/candidate/session/session-v2-1",
        setupSnapshot: {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 7,
            resumeCaptureMode: "none",
            createdAt: "2026-07-08T18:00:00.000Z",
        },
        questionPlanSnapshot: createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 3,
        }),
    });
    const ui = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    await act(async () => {
        render(ui);
    });

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getAllByText("Culture / Fit")).toHaveLength(2);
    expect(screen.queryByText("Scenario")).not.toBeInTheDocument();
    expect(screen.queryByText("Technical / Role-Specific")).not.toBeInTheDocument();
});

it("routes candidate-owned session completion back to the candidate dashboard", async () => {
    window.sessionStorage.clear();
    saveCandidateProvisionalSession(window.sessionStorage, {
        status: "session_created",
        sessionId: "session-v2-1",
        nextRoute: "/candidate/session/session-v2-1",
        setupSnapshot: {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 7,
            resumeCaptureMode: "none",
            createdAt: "2026-07-08T18:00:00.000Z",
        },
        questionPlanSnapshot: createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 7,
        }),
    });
    const ui = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    await act(async () => {
        render(ui);
    });

    expect(screen.getByRole("link", { name: "Finish session" })).toHaveAttribute(
        "href",
        "/candidate/dashboard",
    );
});
