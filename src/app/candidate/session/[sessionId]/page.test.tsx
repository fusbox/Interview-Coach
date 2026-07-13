import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import CandidateSessionPage, { renderCandidateSessionPage, toCandidateProvisionalSession } from "./page";
import { CandidatePlannedSessionExperience } from "@/features/candidate-session-v2/CandidatePlannedSessionExperience";
import { CandidatePreSessionLanding } from "@/features/candidate-session-v2/CandidatePreSessionLanding";
import { saveCandidateProvisionalSession } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import { resolveCandidateSessionIdentityFromDevLaunchCookie } from "./page";

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

it("describes broad practice without exposing the raw not-sure-yet stage label in a sentence", () => {
    render(
        <CandidatePreSessionLanding
            variant="initial"
            targetRole="Material Handler I"
            stageLabel="Not sure yet"
            questionCount={5}
            resumeIncluded={false}
            onStart={vi.fn()}
        />,
    );

    expect(screen.getByText(/5 questions based on the role details you shared/i)).toBeInTheDocument();
    expect(screen.queryByText(/for your not sure yet/i)).not.toBeInTheDocument();
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

    expect(screen.getByRole("heading", { name: "Your practice is ready." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Customer service representative" })).toBeInTheDocument();
    expect(screen.getByText("Screening call")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Included")).toBeInTheDocument();
    expect(screen.getByText(/After each answer, I'll help you see what's working/i)).toBeInTheDocument();
    expect(screen.getByText(/Your progress is saved as you go/i)).toBeInTheDocument();
    expect(screen.getByText(/not used to make hiring decisions/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start practice" })).toBeEnabled();
    expect(screen.queryByText(/Stored snapshot question for the first slot/i)).not.toBeInTheDocument();
    expect(screen.getByText("Development tools")).toBeInTheDocument();
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

it("maps durable feedback action events into the recovered session shell snapshot", () => {
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: "first_interview",
        questionCount: 3,
    });
    const feedbackActionEvent = {
        status: "feedback_action_selected" as const,
        answer: {
            slotId: "slot-1",
            questionIndex: 0,
        },
        stageId: "next_step" as const,
        actionKind: "pause_session" as const,
        transition: "pause_session" as const,
        selectedAt: "2026-07-10T20:03:00.000Z",
    };

    expect(toCandidateProvisionalSession({
        candidatePracticeSessionId: "durable-session-1",
        candidateProfileId: "22222222-2222-4222-8222-222222222222",
        roleProfileId: null,
        candidateLaunchSessionId: null,
        status: "in_progress",
        setupSnapshot: {
            targetRole: "Material Handler I",
            jobDescription: "Move materials safely across the warehouse.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 3,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-09T18:00:00.000Z",
        },
        questionPlanSnapshot,
        questionWordingSnapshot: null,
        questionWordingStatus: "not_requested",
        progress: {
            status: "live_question" as const,
            currentQuestionIndex: 0,
        },
        answerDrafts: {},
        answerSubmissions: {},
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {
            "slot-1": feedbackActionEvent,
        },
        completionSnapshot: null,
    })).toMatchObject({
        status: "session_created",
        sessionId: "durable-session-1",
        feedbackActionEvents: {
            "slot-1": feedbackActionEvent,
        },
    });
});

it("resolves explicit dev host-launch cookies for durable session recovery", async () => {
    vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
    vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");

    expect(resolveCandidateSessionIdentityFromDevLaunchCookie(
        "ic_candidate_launch_session=dev-host-launch-100001",
    )).toEqual({
        candidateProfileId: "10000000-0000-4000-8000-000000000001",
    });
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

it("persists durable question preview progress so pause and resume returns to the active question", async () => {
    window.sessionStorage.clear();
    const fetch = vi.fn(async () => new Response(JSON.stringify({
        status: "progress_saved",
        progress: {
            status: "question_preview",
            currentQuestionIndex: 2,
        },
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

    fireEvent.click(screen.getByRole("button", { name: "Next question preview" }));

    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/durable-session-1/progress",
        expect.objectContaining({
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                status: "question_preview",
                currentQuestionIndex: 2,
            }),
        }),
    );
});

it("starts a live question from the carried wording snapshot and persists live progress", async () => {
    window.sessionStorage.clear();
    const fetch = vi.fn(async () => new Response(JSON.stringify({
        status: "progress_saved",
        progress: {
            status: "live_question",
            currentQuestionIndex: 0,
        },
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
            status: "planned" as const,
            currentQuestionIndex: 0,
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

    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));

    expect(screen.getByRole("heading", { name: "Getting your practice ready." })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Question 1 of 3" }, { timeout: 1_000 })).toBeInTheDocument();
    expect(screen.getByText("Durable snapshot question for the first slot.")).toBeInTheDocument();
    expect(screen.getByText(/Live practice has started/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit answer/i })).toBeDisabled();
    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/durable-session-1/progress",
        expect.objectContaining({
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                status: "live_question",
                currentQuestionIndex: 0,
            }),
        }),
    );
});

it("does not expose question preview navigation in live answer mode", async () => {
    window.sessionStorage.clear();
    const fetch = vi.fn(async () => new Response(JSON.stringify({
        status: "progress_saved",
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
            status: "planned" as const,
            currentQuestionIndex: 0,
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

    fireEvent.click(screen.getByRole("button", { name: "Open first question preview" }));
    expect(screen.getByRole("button", { name: "Next question preview" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Start questions" }));

    expect(screen.getByText(/Live practice has started/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next question preview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous question preview" })).not.toBeInTheDocument();
});

it("attempts typed answer submission from a live question and surfaces the fail-closed boundary", async () => {
    window.sessionStorage.clear();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/answers")) {
            return new Response(JSON.stringify({
                status: "answer_submit_saved",
                next: "analysis_not_connected",
            }), { status: 202 });
        }

        if (url.endsWith("/answers/slot-1/analysis")) {
            return new Response(JSON.stringify({
                status: "answer_analysis_unavailable",
                reason: "provider_not_configured",
            }), { status: 503 });
        }

        return new Response(JSON.stringify({
            status: "answer_draft_saved",
            answerDrafts: {},
        }), { status: 200 });
    });
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
            status: "live_question" as const,
            currentQuestionIndex: 0,
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
    fireEvent.change(answerDraft, {
        target: {
            value: "I would ask a clarifying question first.",
        },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/durable-session-1/answers",
        expect.objectContaining({
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
            }),
        }),
    );
    expect(await screen.findByText(/Answer saved. Coaching is still being connected/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/durable-session-1/answers/slot-1/analysis",
        expect.objectContaining({
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        }),
    );
});

it("shows read-only coach feedback when answer analysis returns an isolated V2 snapshot", async () => {
    window.sessionStorage.clear();
    const analysisSnapshot = {
        status: "answer_analysis_provider_result" as const,
        provider: "candidate_v2_answer_evaluator" as const,
        analyzedAt: "2026-07-09T20:03:00.000Z",
        answer: {
            slotId: "slot-1",
            questionIndex: 0,
        },
        coachFeedback: {
            acknowledgement: "You named a practical first step.",
            observation: "The answer would be stronger with the result of your choice.",
            nextPracticeFocus: "Add what changed after you set the priority.",
        },
        evidence: [
            {
                criterionId: "answer_specificity",
                applicability: "observed" as const,
                score: 3,
            },
        ],
    };
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/answers")) {
            return new Response(JSON.stringify({
                status: "answer_submit_saved",
                next: "analysis_not_connected",
            }), { status: 202 });
        }

        if (url.endsWith("/answers/slot-1/analysis")) {
            return new Response(JSON.stringify({
                status: "answer_analysis_saved",
                analysisSnapshot,
            }), { status: 200 });
        }

        return new Response(JSON.stringify({
            status: "answer_draft_saved",
            answerDrafts: {},
        }), { status: 200 });
    });
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
            status: "live_question" as const,
            currentQuestionIndex: 0,
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

    fireEvent.change(screen.getByRole("textbox", { name: "Draft answer" }), {
        target: {
            value: "I would ask a clarifying question first.",
        },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(await screen.findByText("Answer saved. Coaching is ready to review.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Coach feedback" })).toBeInTheDocument();
    expect(screen.getByText("You named a practical first step.")).toBeInTheDocument();
    expect(screen.getByText("The answer would be stronger with the result of your choice.")).toBeInTheDocument();
    expect(screen.getByText("Add what changed after you set the priority.")).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
});

it("continues from saved coach feedback directly to the next live question", async () => {
    window.sessionStorage.clear();
    const analysisSnapshot = {
        status: "answer_analysis_provider_result" as const,
        provider: "candidate_v2_answer_evaluator" as const,
        analyzedAt: "2026-07-09T20:03:00.000Z",
        answer: {
            slotId: "slot-1",
            questionIndex: 0,
        },
        coachFeedback: {
            acknowledgement: "You named a practical first step.",
            observation: "The answer would be stronger with the result of your choice.",
            nextPracticeFocus: "Add what changed after you set the priority.",
        },
        evidence: [
            {
                criterionId: "answer_specificity",
                applicability: "observed" as const,
                score: 3,
            },
        ],
    };
    const fetch = vi.fn(async () => new Response(JSON.stringify({
        status: "progress_saved",
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
            status: "live_question" as const,
            currentQuestionIndex: 0,
        },
        answerAnalysisSnapshots: {
            "slot-1": analysisSnapshot,
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

    expect(screen.getByRole("heading", { name: "Coach feedback" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue to next question" }));

    expect(screen.getByRole("heading", { name: "Question 2 of 3" })).toBeInTheDocument();
    expect(screen.getByText("Durable snapshot question for the second slot.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/durable-session-1/progress",
        expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({
                status: "live_question",
                currentQuestionIndex: 1,
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

    fireEvent.click(screen.getByRole("button", { name: "Open first question preview" }));

    expect(screen.getByRole("heading", { name: "Question 1 of 5" })).toBeInTheDocument();
    expect(screen.getByText("Stored snapshot question for the first slot.")).toBeInTheDocument();
    expect(screen.getByText(/This is a read-only question preview/i)).toBeInTheDocument();
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
    expect(screen.getByText(/Drafts save as you write/i)).toBeInTheDocument();
});

it("does not clear the first live answer draft when the same initial session is reissued", () => {
    window.sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
        status: "answer_draft_saved",
        answerDrafts: {},
    }), { status: 200 })));
    const setupSnapshot = {
        targetRole: "Customer service representative",
        jobDescription: "Help customers resolve service questions.",
        resumeText: null,
        interviewStage: "first_interview" as const,
        questionCount: 2,
        resumeCaptureMode: "none" as const,
        createdAt: "2026-07-08T18:00:00.000Z",
    };
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: "first_interview",
        questionCount: 2,
    });
    const initialSession = {
        status: "session_created" as const,
        sessionId: "durable-session-1",
        nextRoute: "/candidate/session/durable-session-1" as const,
        setupSnapshot,
        questionPlanSnapshot,
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questions: [
                {
                    slotId: "slot-1",
                    index: 0,
                    category: "screening" as const,
                    questionText: "Stored snapshot question for the first slot.",
                },
                {
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral" as const,
                    questionText: "Stored snapshot question for the second slot.",
                },
            ],
        },
        progress: {
            status: "live_question" as const,
            currentQuestionIndex: 0,
        },
        answerDrafts: {},
    };
    const { rerender } = render(
        <CandidatePlannedSessionExperience
            sessionId="durable-session-1"
            dashboardHref="/candidate/dashboard"
            initialSession={initialSession}
        />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Draft answer" }), {
        target: {
            value: "My first answer should stay visible.",
        },
    });
    rerender(
        <CandidatePlannedSessionExperience
            sessionId="durable-session-1"
            dashboardHref="/candidate/dashboard"
            initialSession={{
                ...initialSession,
                answerDrafts: {},
            }}
        />,
    );

    expect(screen.getByRole("textbox", { name: "Draft answer" })).toHaveValue("My first answer should stay visible.");
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
    fireEvent.click(screen.getByRole("button", { name: "Open first question preview" }));
    expect(screen.getByRole("heading", { name: "Question 1 of 3" })).toBeInTheDocument();
});

it("does not expose candidate-owned session completion before practice starts", async () => {
    window.sessionStorage.clear();
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: {
            ...window.location,
            assign,
        },
    });
    const fetch = vi.fn(async () => new Response(JSON.stringify({
        status: "candidate_session_completed",
        nextRoute: "/candidate/dashboard",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const resolveDurableSession = vi.fn(async () => ({
        status: "session_created" as const,
        sessionId: "durable-session-1",
        nextRoute: "/candidate/session/durable-session-1" as const,
        setupSnapshot: {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 2,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-08T18:00:00.000Z",
        },
        questionPlanSnapshot: createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 2,
        }),
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questions: [
                {
                    slotId: "slot-1",
                    index: 0,
                    category: "screening" as const,
                    questionText: "Stored snapshot question for the first slot.",
                },
                {
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral" as const,
                    questionText: "Stored snapshot question for the second slot.",
                },
            ],
        },
        progress: {
            status: "planned" as const,
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

    expect(screen.queryByRole("button", { name: "Finish session" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
});

it("finishes directly from the final live question after coaching is ready", async () => {
    window.sessionStorage.clear();
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: {
            ...window.location,
            assign,
        },
    });
    const analysisSnapshot = {
        status: "answer_analysis_provider_result" as const,
        provider: "candidate_v2_answer_evaluator" as const,
        analyzedAt: "2026-07-09T20:03:00.000Z",
        answer: {
            slotId: "slot-2",
            questionIndex: 1,
        },
        coachFeedback: {
            acknowledgement: "You connected the example to the job.",
            observation: "Name the outcome to make it stronger.",
            nextPracticeFocus: "Practice closing with what changed.",
        },
        evidence: [
            {
                criterionId: "answer_specificity",
                applicability: "observed" as const,
                score: 3,
            },
        ],
    };
    const fetch = vi.fn(async () => new Response(JSON.stringify({
        status: "candidate_session_completed",
        nextRoute: "/candidate/dashboard",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const resolveDurableSession = vi.fn(async () => ({
        status: "session_created" as const,
        sessionId: "durable-session-1",
        nextRoute: "/candidate/session/durable-session-1" as const,
        setupSnapshot: {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 2,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-08T18:00:00.000Z",
        },
        questionPlanSnapshot: createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 2,
        }),
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questions: [
                {
                    slotId: "slot-1",
                    index: 0,
                    category: "screening" as const,
                    questionText: "Stored snapshot question for the first slot.",
                },
                {
                    slotId: "slot-2",
                    index: 1,
                    category: "behavioral" as const,
                    questionText: "Stored snapshot question for the second slot.",
                },
            ],
        },
        progress: {
            status: "live_question" as const,
            currentQuestionIndex: 1,
        },
        answerAnalysisSnapshots: {
            "slot-2": analysisSnapshot,
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

    fireEvent.click(screen.getByRole("button", { name: "Finish session" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/durable-session-1/complete",
        expect.objectContaining({
            method: "POST",
        }),
    ));
    expect(assign).toHaveBeenCalledWith("/candidate/dashboard");
});
