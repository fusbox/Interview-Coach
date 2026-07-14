import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { CandidatePlannedSessionExperience } from "@/features/candidate-session-v2/CandidatePlannedSessionExperience";
import { CandidatePreSessionLanding } from "@/features/candidate-session-v2/CandidatePreSessionLanding";
import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type { CandidateProvisionalSessionRecord } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import { saveCandidateProvisionalSession } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import CandidateSessionPage, {
    renderCandidateSessionPage,
    resolveCandidateSessionIdentityFromDevLaunchCookie,
    toCandidateProvisionalSession,
} from "./page";

beforeEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.scrollTo = vi.fn();
});

it("shows a recovery state when the candidate session snapshot is missing", async () => {
    const ui = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    await act(async () => {
        render(ui);
    });

    expect(screen.getByText("Practice session")).toBeInTheDocument();
    expect(screen.getByText(/I need the setup details for this practice round/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to setup/i })).toHaveAttribute("href", "/candidate/setup");
});

it("describes broad practice without putting the not-sure-yet value into a sentence", () => {
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

it("prefetches the first question from the landing and unlocks audio when practice starts", () => {
    vi.useFakeTimers();
    const questionAudio = {
        unlock: vi.fn(),
        prefetch: vi.fn(),
        playOnce: vi.fn(),
    };
    const onStart = vi.fn();

    render(
        <CandidatePreSessionLanding
            variant="initial"
            targetRole="Material Handler I"
            stageLabel="First interview"
            questionCount={5}
            resumeIncluded={false}
            sessionId="session-v2-1"
            firstQuestion={{
                id: "slot-1",
                number: 1,
                category: "Screening",
                questionText: "Tell me about your interest in this role.",
            }}
            questionAudio={questionAudio}
            onStart={onStart}
        />,
    );

    expect(questionAudio.prefetch).toHaveBeenCalledWith({
        sessionId: "session-v2-1",
        questionKey: "slot-1",
        questionText: "Tell me about your interest in this role.",
    });

    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));

    expect(questionAudio.unlock).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
});

it("leaves the follow-up transition to the destination session route", () => {
    render(
        <CandidatePreSessionLanding
            variant="follow_up"
            targetRole="Material Handler I"
            stageLabel="First interview"
            questionCount={1}
            resumeIncluded={false}
            startActionUrl="/candidate/practice/ready/intent-1/start"
        />,
    );

    expect(screen.getByRole("form", { name: "Start follow-up practice" })).toHaveAttribute(
        "action",
        "/candidate/practice/ready/intent-1/start",
    );
    expect(screen.queryByRole("heading", { name: "Entering practice space" })).not.toBeInTheDocument();
});

it("renders the production pre-session landing without scaffold preview controls", async () => {
    saveCandidateProvisionalSession(window.sessionStorage, createSession());
    const ui = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    await act(async () => {
        render(ui);
    });

    expect(screen.getByRole("heading", { name: "Your practice is ready." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Customer service representative" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start practice" })).toBeEnabled();
    expect(screen.queryByText("Development tools")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /question preview/i })).not.toBeInTheDocument();
});

it("preserves the entering-practice transition before opening the shared live shell", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ status: "progress_saved" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession()}
        />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
    expect(screen.getByRole("heading", { name: "Entering practice space" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entering practice space" }).closest(
        ".candidate-practice-entry-overlay",
    )).not.toHaveClass("is-releasing");

    await act(async () => {
        vi.advanceTimersByTime(1_250);
    });

    expect(screen.getByRole("heading", { name: "Stored snapshot question for the first slot." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entering practice space" })).toBeInTheDocument();

    await act(async () => {
        vi.advanceTimersByTime(40);
    });

    expect(screen.getByRole("heading", { name: "Entering practice space" }).closest(
        ".candidate-practice-entry-overlay",
    )).toHaveClass("is-releasing");

    await act(async () => {
        vi.advanceTimersByTime(420);
    });

    expect(screen.queryByRole("heading", { name: "Entering practice space" })).not.toBeInTheDocument();
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to dashboard" })).toHaveAttribute(
        "href",
        "/candidate/dashboard",
    );
    expect(screen.queryByRole("button", { name: /back to plan/i })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/progress",
        expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({
                status: "live_question",
                currentQuestionIndex: 0,
            }),
        }),
    );
});

it("releases a routed follow-up transition over the already-mounted live question", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/candidate/session/session-v2-1?entry=1");

    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession({
                progress: {
                    status: "live_question",
                    currentQuestionIndex: 0,
                },
            })}
            entryTransitionRequested
        />,
    );

    expect(screen.getByRole("heading", { name: "Entering practice space" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Stored snapshot question for the first slot." })).toBeInTheDocument();
    expect(window.location.search).toBe("");

    await act(async () => {
        vi.advanceTimersByTime(1_250);
    });
    await act(async () => {
        vi.advanceTimersByTime(40);
    });

    expect(screen.getByRole("heading", { name: "Entering practice space" }).closest(
        ".candidate-practice-entry-overlay",
    )).toHaveClass("is-releasing");

    await act(async () => {
        vi.advanceTimersByTime(420);
    });

    expect(screen.queryByRole("heading", { name: "Entering practice space" })).not.toBeInTheDocument();
});

it("recovers the exact live question and uses the dashboard as the candidate exit", async () => {
    const resolveDurableSession = vi.fn(async () => createSession({
        progress: {
            status: "live_question",
            currentQuestionIndex: 1,
        },
    }));
    const ui = await renderCandidateSessionPage({
        params: Promise.resolve({ sessionId: "session-v2-1" }),
        dependencies: { resolveDurableSession },
    });

    await act(async () => {
        render(ui);
    });

    expect(screen.getByRole("heading", { name: "Stored snapshot question for the second slot." })).toBeInTheDocument();
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to dashboard" })).toHaveAttribute(
        "href",
        "/candidate/dashboard?targetRole=customer+service+representative",
    );
    expect(screen.queryByRole("button", { name: /resume session/i })).not.toBeInTheDocument();
});

it("migrates recovered preview progress into the live question contract", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ status: "progress_saved" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const ui = await renderCandidateSessionPage({
        params: Promise.resolve({ sessionId: "session-v2-1" }),
        dependencies: {
            resolveDurableSession: vi.fn(async () => createSession({
                progress: {
                    status: "question_preview",
                    currentQuestionIndex: 1,
                },
            })),
        },
    });

    await act(async () => {
        render(ui);
    });

    expect(screen.getByRole("heading", { name: "Stored snapshot question for the second slot." })).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/progress",
        expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({
                status: "live_question",
                currentQuestionIndex: 1,
            }),
        }),
    ));
});

it("restores and saves the draft for the active durable question", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ status: "answer_draft_saved" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const ui = await renderCandidateSessionPage({
        params: Promise.resolve({ sessionId: "session-v2-1" }),
        dependencies: {
            resolveDurableSession: vi.fn(async () => createSession({
                progress: {
                    status: "live_question",
                    currentQuestionIndex: 1,
                },
                answerDrafts: {
                    "slot-2": {
                        slotId: "slot-2",
                        questionIndex: 1,
                        mode: "text",
                        text: "My saved answer",
                        updatedAt: "2026-07-13T18:00:00.000Z",
                    },
                },
            })),
        },
    });

    await act(async () => {
        render(ui);
    });

    const answer = screen.getByRole("textbox", { name: "Type your answer" });
    expect(answer).toHaveValue("My saved answer");
    fireEvent.change(answer, { target: { value: "My revised answer" } });

    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/answer-drafts",
        expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({
                slotId: "slot-2",
                questionIndex: 1,
                mode: "text",
                text: "My revised answer",
            }),
        }),
    );
});

it("submits a typed answer and keeps the explicit provider-unavailable state", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/answers")) {
            return new Response(JSON.stringify({
                status: "answer_submit_saved",
                answerSubmissions: {
                    "slot-1": {
                        slotId: "slot-1",
                        questionIndex: 0,
                        mode: "text",
                        text: "I would ask a clarifying question first.",
                        submittedAt: "2026-07-13T18:00:00.000Z",
                        status: "pending_analysis",
                    },
                },
            }), { status: 202 });
        }
        if (url.endsWith("/answers/slot-1/analysis")) {
            return new Response(JSON.stringify({
                status: "answer_analysis_unavailable",
                reason: "provider_not_configured",
            }), { status: 503 });
        }
        return new Response(JSON.stringify({ status: "answer_draft_saved" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession({
                progress: {
                    status: "live_question",
                    currentQuestionIndex: 0,
                },
            })}
        />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Type your answer" }), {
        target: { value: "I would ask a clarifying question first." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(await screen.findByText(/Answer saved. Coaching is still being connected/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/answers",
        expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/answers/slot-1/analysis",
        expect.objectContaining({ method: "POST" }),
    );
});

it("continues from saved coaching to the next live question", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ status: "progress_saved" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession({
                progress: {
                    status: "live_question",
                    currentQuestionIndex: 0,
                },
                answerAnalysisSnapshots: {
                    "slot-1": createAnalysisSnapshot("slot-1", 0),
                },
            })}
        />,
    );

    expect(screen.getByRole("heading", { name: "Coach feedback" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue to next question" }));

    expect(screen.getByRole("heading", { name: "Stored snapshot question for the second slot." })).toBeInTheDocument();
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/progress",
        expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({
                status: "live_question",
                currentQuestionIndex: 1,
            }),
        }),
    );
});

it("keeps completion unavailable before practice starts", () => {
    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession()}
        />,
    );

    expect(screen.queryByRole("button", { name: "Finish session" })).not.toBeInTheDocument();
});

it("uses the existing completion route while final finish CTA design remains deferred", async () => {
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
    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession({
                progress: {
                    status: "live_question",
                    currentQuestionIndex: 2,
                },
                answerAnalysisSnapshots: {
                    "slot-3": createAnalysisSnapshot("slot-3", 2),
                },
            })}
        />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Finish session" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/complete",
        expect.objectContaining({ method: "POST" }),
    ));
    expect(assign).toHaveBeenCalledWith("/candidate/dashboard");
});

it("maps durable answer and feedback state into recovered candidate session facts", () => {
    const durableSession = {
        candidatePracticeSessionId: "session-v2-1",
        candidateProfileId: "candidate-1",
        roleProfileId: null,
        candidateLaunchSessionId: null,
        status: "in_progress",
        setupSnapshot: createSession().setupSnapshot,
        questionPlanSnapshot: createSession().questionPlanSnapshot,
        questionWordingSnapshot: createSession().questionWordingSnapshot ?? null,
        questionWordingStatus: "worded",
        progress: {
            status: "live_question",
            currentQuestionIndex: 1,
        },
        answerDrafts: {},
        answerSubmissions: {
            "slot-1": {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "Saved answer",
                submittedAt: "2026-07-13T18:00:00.000Z",
                status: "pending_analysis",
            },
        },
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {},
        completionSnapshot: null,
    } satisfies CandidatePracticeSessionRecord;

    expect(toCandidateProvisionalSession(durableSession)).toMatchObject({
        sessionId: "session-v2-1",
        progress: {
            status: "live_question",
            currentQuestionIndex: 1,
        },
        answerSubmissions: {
            "slot-1": {
                text: "Saved answer",
            },
        },
    });
});

it("resolves explicit dev host-launch cookies for durable session recovery", () => {
    vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_MODE", "true");
    vi.stubEnv("CANDIDATE_HOST_LAUNCH_DEV_SECRET", "local-dev-shared-secret");

    expect(resolveCandidateSessionIdentityFromDevLaunchCookie(
        "ic_candidate_launch_session=dev-host-launch-100001",
    )).toEqual({
        candidateProfileId: "10000000-0000-4000-8000-000000000001",
    });
});

function createSession(overrides: Partial<CandidateProvisionalSessionRecord> = {}): CandidateProvisionalSessionRecord {
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: "first_interview",
        questionCount: 3,
    });

    return {
        status: "session_created",
        sessionId: "session-v2-1",
        nextRoute: "/candidate/session/session-v2-1",
        setupSnapshot: {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview",
            questionCount: 3,
            resumeCaptureMode: "none",
            createdAt: "2026-07-13T17:00:00.000Z",
        },
        questionPlanSnapshot,
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
            ],
        },
        progress: {
            status: "planned",
            currentQuestionIndex: 0,
        },
        answerDrafts: {},
        answerSubmissions: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {},
        ...overrides,
    };
}

function createAnalysisSnapshot(slotId: string, questionIndex: number): CandidateAnswerAnalysisProviderResult {
    return {
        status: "answer_analysis_provider_result",
        provider: "candidate_v2_answer_evaluator",
        analyzedAt: "2026-07-13T18:03:00.000Z",
        answer: {
            slotId,
            questionIndex,
        },
        coachFeedback: {
            acknowledgement: "You named a practical first step.",
            observation: "The answer would be stronger with a concrete outcome.",
            nextPracticeFocus: "Add what changed after your action.",
        },
        evidence: [
            {
                criterionId: "answer_specificity",
                applicability: "observed",
                score: 3,
            },
        ],
    };
}
