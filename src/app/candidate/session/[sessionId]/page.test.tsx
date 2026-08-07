import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { CandidatePlannedSessionExperience } from "@/features/candidate-session-v2/CandidatePlannedSessionExperience";
import { CandidatePreSessionLanding } from "@/features/candidate-session-v2/CandidatePreSessionLanding";
import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import { createCandidateAnswerAnalysisProviderResultFixture } from "@/features/candidate-session-v2/candidate-answer-analysis-test-fixture";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { candidateAnswerAnalysisFixtureRunMetadata } from "@/features/candidate-session-v2/candidate-answer-analysis-fixture";
import type { CandidateAnswerEvaluationRunRecord } from "@/features/candidate-session-v2/candidate-answer-history";
import type { CandidateProvisionalSessionRecord } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import { saveCandidateProvisionalSession } from "@/features/candidate-session-v2/candidate-provisional-session-store";
import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import CandidateSessionPage, {
    renderCandidateSessionPage,
    toCandidateProvisionalSession,
} from "./CandidateSessionRoute";

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

it("distinguishes a paced visit from the full canonical question plan", () => {
    render(
        <CandidatePreSessionLanding
            variant="initial"
            targetRole="Material Handler I"
            stageLabel="First interview"
            questionCount={3}
            planQuestionCount={5}
            resumeIncluded={false}
            onStart={vi.fn()}
        />,
    );

    expect(screen.getByText(/up to 3 questions from your 5-question plan/i)).toBeInTheDocument();
    expect(screen.getByText("This visit")).toBeInTheDocument();
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

it("keeps the follow-up ready action server-owned before submission", () => {
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

    expect(screen.getByText(/Your practice is ready\./)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Customer service representative", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Question plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start practice" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Return to Coach Plan" })).toHaveAttribute(
        "href",
        "/candidate/dashboard",
    );
    expect(screen.queryByText("Development tools")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /question preview/i })).not.toBeInTheDocument();
});

it("renders the selected pace against the full canonical plan on the production landing", async () => {
    const session = createSession();
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: "first_interview",
        questionCount: 7,
    });
    saveCandidateProvisionalSession(window.sessionStorage, {
        ...session,
        setupSnapshot: {
            ...session.setupSnapshot,
            questionCount: 3,
            stageRecommendedQuestionCount: 7,
            canonicalPlanQuestionCount: 7,
            paceSize: 3,
        },
        questionPlanSnapshot,
        questionWordingSnapshot: {
            status: "questions_worded",
            questions: questionPlanSnapshot.slots.map((slot) => ({
                slotId: slot.id,
                index: slot.index,
                category: slot.category,
                questionText: `Canonical question ${slot.index + 1}.`,
            })),
        },
    });

    const ui = await CandidateSessionPage({ params: Promise.resolve({ sessionId: "session-v2-1" }) });
    await act(async () => {
        render(ui);
    });

    expect(screen.getByText(/up to 3 questions from your 7-question plan/i)).toBeInTheDocument();
    expect(screen.getByText("This visit")).toBeInTheDocument();
});

it("preserves the entering-practice transition before opening the shared live shell", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response(JSON.stringify({ status: "progress_saved" }), { status: 200 });
    });
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

it("opens durable candidate question assistance in the live session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
        status: "ready",
        output: {
            status: "candidate_question_hints_v1",
            doThis: "Start with your main answer before adding detail.",
            avoidThis: "Avoid losing the connection to what matters in the role.",
        },
    })));

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

    fireEvent.click(screen.getByRole("button", { name: "Hints" }));

    expect(screen.getByRole("dialog", { name: "Hints & framework" })).toBeInTheDocument();
    expect(await screen.findByText("Start with your main answer before adding detail.")).toBeInTheDocument();
    expect(screen.getByText("Avoid losing the connection to what matters in the role.")).toBeInTheDocument();
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

it("defaults to voice and durably remembers an explicit type choice", async () => {
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
            })}
            voiceAnswerEnabled
        />,
    );

    const recordMode = screen.getByRole("button", { name: "Record" });
    expect(recordMode).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Tap to record; tap again to stop.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start recording" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Type" }));
    expect(screen.getByRole("button", { name: "Type" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/progress",
        expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({
                status: "live_question",
                currentQuestionIndex: 0,
                answerMode: "text",
            }),
        }),
    ));
});

it("restores voice as the last-used mode when the runtime remains available", () => {
    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession({
                progress: {
                    status: "live_question",
                    currentQuestionIndex: 0,
                    answerMode: "voice",
                },
            })}
            voiceAnswerEnabled
        />,
    );

    expect(screen.getByRole("button", { name: "Record" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Tap to record; tap again to stop.")).toBeInTheDocument();
});

it("submits a recovered reviewed transcript as a source-linked voice answer", async () => {
    const sourceRunId = "44444444-4444-4444-8444-444444444444";
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/answers")) {
            return new Response(JSON.stringify({
                status: "answer_submit_saved",
                answerSubmissions: {
                    "slot-1": {
                        slotId: "slot-1",
                        questionIndex: 0,
                        mode: "voice",
                        text: "I checked the labels and documented the result.",
                        submittedAt: "2026-07-21T17:01:00.000Z",
                        status: "pending_analysis",
                        answerAttemptId: "11111111-1111-4111-8111-111111111111",
                        attemptNumber: 1,
                        trigger: "initial_submit",
                        supersedesAnswerAttemptId: null,
                        sourceVoiceTranscriptionRunId: sourceRunId,
                        voiceSubmissionPath: "transcript_review",
                        voiceTranscriptEdited: true,
                    },
                },
            }), { status: 202 });
        }
        if (url.endsWith("/analysis")) {
            return new Response(JSON.stringify({
                status: "answer_analysis_unavailable",
                retryable: false,
            }), { status: 503 });
        }
        throw new Error(`Unexpected request: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetch);

    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession({
                progress: { status: "live_question", currentQuestionIndex: 0 },
                answerDrafts: {
                    "slot-1": {
                        slotId: "slot-1",
                        questionIndex: 0,
                        mode: "text",
                        text: "This typed draft must not be submitted.",
                        updatedAt: "2026-07-21T16:59:00.000Z",
                    },
                },
                voiceTranscriptDrafts: {
                    "slot-1": {
                        status: "voice_transcript_draft",
                        slotId: "slot-1",
                        questionIndex: 0,
                        transcriptText: "I checked the labels and documented the result.",
                        sourceTranscriptionRunId: sourceRunId,
                        submissionPath: "transcript_review",
                        updatedAt: "2026-07-21T17:00:00.000Z",
                    },
                },
            })}
            voiceAnswerEnabled
        />,
    );

    expect(screen.getByLabelText("Review your transcript")).toHaveValue(
        "I checked the labels and documented the result.",
    );
    expect(screen.queryByRole("button", { name: "Type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    await waitFor(() => expect(screen.getByText("Answer saved")).toBeInTheDocument());
    expect(screen.getByText("I checked the labels and documented the result.")).toBeInTheDocument();
    expect(screen.queryByText("This typed draft must not be submitted.")).not.toBeInTheDocument();
    const answerCall = fetch.mock.calls.find(([input]) => String(input).endsWith("/answers"));
    expect(answerCall?.[1]).toMatchObject({
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `voice-answer:${sourceRunId}:transcript_review`,
        },
    });
    expect(JSON.parse(String(answerCall?.[1]?.body))).toMatchObject({
        mode: "voice",
        text: "I checked the labels and documented the result.",
        sourceVoiceTranscriptionRunId: sourceRunId,
        voiceSubmissionPath: "transcript_review",
    });
});

it("submits the active typed draft without reusing a stored voice transcript", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/answer-drafts")) {
            return new Response(JSON.stringify({ status: "answer_draft_saved" }), { status: 200 });
        }
        if (url.endsWith("/answers")) {
            return new Response(JSON.stringify({
                status: "answer_submit_saved",
                answerSubmissions: {
                    "slot-1": {
                        slotId: "slot-1",
                        questionIndex: 0,
                        mode: "text",
                        text: "This typed answer is the active submission.",
                        submittedAt: "2026-07-21T17:01:00.000Z",
                        status: "pending_analysis",
                        answerAttemptId: "11111111-1111-4111-8111-111111111111",
                        attemptNumber: 1,
                        trigger: "initial_submit",
                        supersedesAnswerAttemptId: null,
                    },
                },
            }), { status: 202 });
        }
        if (url.endsWith("/analysis")) {
            return new Response(JSON.stringify({
                status: "answer_analysis_unavailable",
                retryable: false,
            }), { status: 503 });
        }
        throw new Error(`Unexpected request: ${url} ${init?.method ?? "GET"}`);
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
                    answerMode: "text",
                },
                answerDrafts: {
                    "slot-1": {
                        slotId: "slot-1",
                        questionIndex: 0,
                        mode: "text",
                        text: "This typed answer is the active submission.",
                        updatedAt: "2026-07-21T17:00:00.000Z",
                    },
                },
                voiceTranscriptDrafts: {
                    "slot-1": {
                        status: "voice_transcript_draft",
                        slotId: "slot-1",
                        questionIndex: 0,
                        transcriptText: "This stored voice transcript must not be submitted.",
                        sourceTranscriptionRunId: "55555555-5555-4555-8555-555555555555",
                        submissionPath: "transcript_review",
                        updatedAt: "2026-07-21T16:59:00.000Z",
                    },
                },
            })}
            voiceAnswerEnabled
        />,
    );

    expect(screen.getByRole("textbox", { name: "Type your answer" })).toHaveValue(
        "This typed answer is the active submission.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    await waitFor(() => expect(screen.getByText("Answer saved")).toBeInTheDocument());
    expect(screen.getByText("This typed answer is the active submission.")).toBeInTheDocument();
    expect(screen.queryByText("This stored voice transcript must not be submitted.")).not.toBeInTheDocument();
    const answerCall = fetch.mock.calls.find(([input]) => String(input).endsWith("/answers"));
    expect(JSON.parse(String(answerCall?.[1]?.body))).toMatchObject({
        mode: "text",
        text: "This typed answer is the active submission.",
    });
});

it("recovers the exact live question and uses the dashboard as the candidate exit", async () => {
    const resolveDurableSession = vi.fn(async () => createSession({
        roleProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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

    expect(await screen.findByRole("heading", { name: "Stored snapshot question for the second slot." })).toBeInTheDocument();
    expect(await screen.findByText("Question 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to dashboard" })).toHaveAttribute(
        "href",
        "/candidate/dashboard?prep=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(screen.queryByRole("button", { name: /resume session/i })).not.toBeInTheDocument();
});

it("focuses an unanswered canonical question requested by the dashboard", async () => {
    const ui = await renderCandidateSessionPage({
        params: Promise.resolve({ sessionId: "session-v2-1" }),
        searchParams: Promise.resolve({ pace: "one", question: "slot-2" }),
        dependencies: {
            resolveDurableSession: vi.fn(async () => createSession({
                progress: { status: "live_question", currentQuestionIndex: 0 },
            })),
        },
    });

    await act(async () => {
        render(ui);
    });

    expect(screen.getByRole("heading", { name: "Stored snapshot question for the second slot." })).toBeInTheDocument();
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
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
    vi.useFakeTimers();
    const fetch = vi.fn(async (input: RequestInfo | URL) => (
        String(input).endsWith("/question-assistance")
            ? Response.json({
                status: "ready",
                output: {
                    status: "candidate_question_hints_v1",
                    doThis: "Answer directly.",
                    avoidThis: "Avoid unsupported claims.",
                },
            })
            : new Response(JSON.stringify({ status: "answer_draft_saved" }), { status: 200 })
    ));
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
    expect(screen.queryByText("Changes waiting to save.")).not.toBeInTheDocument();
    expect(fetch.mock.calls.filter(([input]) => String(input).endsWith("/answer-drafts"))).toHaveLength(0);

    await act(async () => {
        vi.advanceTimersByTime(600);
        await Promise.resolve();
        await Promise.resolve();
    });

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
    expect(screen.queryByText("Draft saved.")).not.toBeInTheDocument();
});

it("serializes autosaves so an older request cannot overtake newer typing", async () => {
    vi.useFakeTimers();
    let resolveFirstDraftSave: ((response: Response) => void) | null = null;
    const firstDraftSave = new Promise<Response>((resolve) => {
        resolveFirstDraftSave = resolve;
    });
    let draftSaveCalls = 0;
    const fetch = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
        void _init;
        if (!String(input).endsWith("/answer-drafts")) {
            return Promise.resolve(new Response(null, { status: 500 }));
        }

        draftSaveCalls += 1;
        return draftSaveCalls === 1
            ? firstDraftSave
            : Promise.resolve(new Response(JSON.stringify({ status: "answer_draft_saved" }), { status: 200 }));
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

    const answer = screen.getByRole("textbox", { name: "Type your answer" });
    fireEvent.change(answer, { target: { value: "Older draft" } });
    await act(async () => {
        vi.advanceTimersByTime(600);
    });
    expect(draftSaveCalls).toBe(1);

    fireEvent.change(answer, { target: { value: "Newest draft" } });
    await act(async () => {
        vi.advanceTimersByTime(600);
    });
    expect(draftSaveCalls).toBe(1);

    await act(async () => {
        resolveFirstDraftSave?.(new Response(JSON.stringify({ status: "answer_draft_saved" }), { status: 200 }));
        await Promise.resolve();
        await Promise.resolve();
    });

    expect(draftSaveCalls).toBe(2);
    expect(fetch.mock.calls
        .filter(([input]) => String(input).endsWith("/answer-drafts"))
        .map(([, request]) => JSON.parse(String(request?.body)))
        .map((body) => body.text)).toEqual([
        "Older draft",
        "Newest draft",
    ]);
    expect(screen.queryByText("Draft saved.")).not.toBeInTheDocument();
});

it("keeps a saved answer locked and retries only coaching after analysis fails", async () => {
    let analysisAttempts = 0;
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
            analysisAttempts += 1;
            if (analysisAttempts > 1) {
                return new Response(JSON.stringify({
                    status: "answer_analysis_saved",
                    analysisSnapshot: createAnalysisSnapshot("slot-1", 0),
                }), { status: 200 });
            }
            return new Response(JSON.stringify({
                code: "ANSWER_ANALYSIS_FAILED",
                retryable: true,
                analysisRecovery: {
                    status: "answer_analysis_recovery",
                    state: "retryable",
                    canRetryAnalysis: true,
                    canContinueWithoutCoaching: true,
                },
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

    expect(await screen.findByText(/Your answer is saved. I couldn't prepare coaching just now/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Type your answer" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Submitted answer")).toHaveTextContent(
        "I would ask a clarifying question first.",
    );
    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/answers",
        expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/answers/slot-1/analysis",
        expect.objectContaining({ method: "POST" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Try coaching again" }));

    expect(await screen.findByRole("dialog", { name: "Your coaching" })).toBeInTheDocument();
    expect(screen.getByText("You named a practical first step.")).toBeInTheDocument();
    expect(fetch.mock.calls.filter(([input]) => String(input).endsWith("/answers"))).toHaveLength(1);
    expect(fetch.mock.calls.filter(([input]) => String(input).endsWith("/answers/slot-1/analysis"))).toHaveLength(2);
});

it("recovers a persisted answer after reload as analysis-only work", async () => {
    const answerAttemptId = "33333333-3333-4333-8333-333333333333";
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/answers/slot-1/analysis")) {
            return new Response(JSON.stringify({
                status: "answer_analysis_saved",
                analysisSnapshot: createAnalysisSnapshotWithAttempt("slot-1", 0, answerAttemptId, 1),
            }), { status: 200 });
        }
        return new Response(null, { status: 500 });
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
                answerSubmissions: {
                    "slot-1": createAnswerSubmissionWithAttempt("slot-1", 0, answerAttemptId, 1),
                },
            })}
        />,
    );

    expect(screen.getByText(/Your answer is saved. I couldn't prepare coaching just now/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Type your answer" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Submitted answer")).toHaveTextContent("A saved answer.");
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Try coaching again" }));

    expect(await screen.findByRole("dialog", { name: "Your coaching" })).toBeInTheDocument();
    expect(screen.getByText("You named a practical first step.")).toBeInTheDocument();
    expect(fetch.mock.calls.filter(([input]) => String(input).endsWith("/answers"))).toHaveLength(0);
    expect(fetch.mock.calls.filter(([input]) => String(input).endsWith("/answers/slot-1/analysis"))).toHaveLength(1);
});

it("keeps a failed draft save editable and retries it in place", async () => {
    let draftSaveAttempts = 0;
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/answer-drafts")) {
            draftSaveAttempts += 1;
            return draftSaveAttempts === 1
                ? new Response(JSON.stringify({ error: "Draft save failed." }), { status: 503 })
                : new Response(JSON.stringify({ status: "answer_draft_saved" }), { status: 200 });
        }
        return new Response(null, { status: 500 });
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

    const answer = screen.getByRole("textbox", { name: "Type your answer" });
    fireEvent.change(answer, { target: { value: "My answer is still here." } });
    fireEvent.blur(answer);

    expect(await screen.findByText("Your latest changes aren't saved yet.")).toBeInTheDocument();
    expect(answer).not.toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));

    await waitFor(() => expect(draftSaveAttempts).toBe(2));
    await waitFor(() => expect(screen.queryByText("Your latest changes aren't saved yet."))
        .not.toBeInTheDocument());
    expect(screen.queryByText("Draft saved.")).not.toBeInTheDocument();
});

it("keeps the draft editable and retries submission when the answer was not accepted", async () => {
    let submitAttempts = 0;
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/answer-drafts")) {
            return new Response(JSON.stringify({ status: "answer_draft_saved" }), { status: 200 });
        }
        if (url.endsWith("/answers")) {
            submitAttempts += 1;
            if (submitAttempts === 1) {
                return new Response(JSON.stringify({ error: "Answer save failed." }), { status: 503 });
            }
            return new Response(JSON.stringify({
                status: "answer_submit_saved",
                answerSubmissions: {
                    "slot-1": {
                        slotId: "slot-1",
                        questionIndex: 0,
                        mode: "text",
                        text: "My answer stayed here.",
                        submittedAt: "2026-07-14T18:00:00.000Z",
                        status: "pending_analysis",
                    },
                },
            }), { status: 202 });
        }
        if (url.endsWith("/answers/slot-1/analysis")) {
            return new Response(JSON.stringify({
                status: "answer_analysis_saved",
                analysisSnapshot: createAnalysisSnapshot("slot-1", 0),
            }), { status: 200 });
        }
        return new Response(null, { status: 500 });
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

    const answer = screen.getByRole("textbox", { name: "Type your answer" });
    fireEvent.change(answer, { target: { value: "My answer stayed here." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(await screen.findByText(/I couldn't save your answer. Your draft is still here/i)).toBeInTheDocument();
    expect(answer).not.toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Try submit again" }));

    expect(await screen.findByRole("dialog", { name: "Your coaching" })).toBeInTheDocument();
    expect(screen.getByText("You named a practical first step.")).toBeInTheDocument();
    expect(submitAttempts).toBe(2);
});

it("continues from saved coaching to the next live question", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/feedback-actions")) {
            const event = JSON.parse(String(init?.body));
            return new Response(JSON.stringify({
                status: "feedback_action_saved",
                feedbackActionEvents: { "slot-1": event },
            }), { status: 200 });
        }
        return new Response(JSON.stringify({ status: "progress_saved" }), { status: 200 });
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
                answerAnalysisSnapshots: {
                    "slot-1": createAnalysisSnapshot("slot-1", 0),
                },
                answerSubmissions: {
                    "slot-1": createAnswerSubmission("slot-1", 0),
                },
            })}
        />,
    );

    expect(screen.getByRole("dialog", { name: "Your coaching" })).toBeInTheDocument();
    expect(screen.getByText("You named a practical first step.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Explore feedback" }));
    expect(await screen.findAllByText("The answer would be stronger with a concrete outcome.")).not.toHaveLength(0);
    await waitFor(() => expect(screen.getByRole("heading", { name: "One useful focus" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Add what changed after your action.");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Try the answer again" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Continue to next question" }));

    expect(await screen.findByRole("heading", { name: "Stored snapshot question for the second slot." })).toBeInTheDocument();
    expect(await screen.findByText("Question 2 of 3")).toBeInTheDocument();
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

it("returns to the dashboard after one settled question in a one-question visit", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: {
            ...window.location,
            assign,
        },
    });
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/feedback-actions")) {
            const event = JSON.parse(String(init?.body));
            return new Response(JSON.stringify({
                status: "feedback_action_saved",
                feedbackActionEvents: { "slot-1": event },
            }), { status: 200 });
        }
        return new Response(JSON.stringify({ status: "progress_saved" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            visitPace="one"
            initialSession={createSession({
                progress: { status: "live_question", currentQuestionIndex: 0 },
                answerAnalysisSnapshots: {
                    "slot-1": createAnalysisSnapshot("slot-1", 0),
                },
                answerSubmissions: {
                    "slot-1": createAnswerSubmission("slot-1", 0),
                },
            })}
        />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Explore feedback" }));
    await screen.findAllByText("The answer would be stronger with a concrete outcome.");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Add what changed after your action.");
    fireEvent.click(screen.getByRole("button", { name: "Continue to next question" }));

    expect(await screen.findByRole("heading", { name: "Returning to your dashboard" })).toBeInTheDocument();
    expect(await screen.findByText(/answer is saved.*continue your plan/i)).toBeInTheDocument();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/candidate/dashboard"));
    expect(fetch).not.toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/progress",
        expect.anything(),
    );
});

it("recovers a terminal analysis state in a new tab and continues without coaching", async () => {
    const answerAttemptId = "77777777-7777-4777-8777-777777777777";
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response(JSON.stringify({ status: "progress_saved" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession({
                progress: { status: "live_question", currentQuestionIndex: 0 },
                answerSubmissions: {
                    "slot-1": createAnswerSubmissionWithAttempt("slot-1", 0, answerAttemptId, 1),
                },
                answerAnalysisRecoveries: {
                    "slot-1": {
                        status: "answer_analysis_recovery",
                        state: "unavailable",
                        canRetryAnalysis: false,
                        canContinueWithoutCoaching: true,
                    },
                },
            })}
        />,
    );

    expect(screen.queryByRole("button", { name: "Try coaching again" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue without coaching" }));

    expect(await screen.findByRole("heading", { name: "Stored snapshot question for the second slot." })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/progress",
        expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ status: "live_question", currentQuestionIndex: 1 }),
        }),
    );
    expect(fetch.mock.calls.some(([input]) => String(input).includes("/analysis"))).toBe(false);
});

it("finishes the last answered question without coaching and returns to the dashboard", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...window.location, assign },
    });
    const fetch = vi.fn(async () => new Response(JSON.stringify({
        status: "candidate_session_completed",
        nextRoute: "/candidate/dashboard?prep=profile-1",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const answerAttemptId = "88888888-8888-4888-8888-888888888888";
    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession({
                progress: { status: "live_question", currentQuestionIndex: 2 },
                answerSubmissions: {
                    "slot-1": createAnswerSubmission("slot-1", 0),
                    "slot-2": createAnswerSubmission("slot-2", 1),
                    "slot-3": createAnswerSubmissionWithAttempt("slot-3", 2, answerAttemptId, 1),
                },
                answerAnalysisRecoveries: {
                    "slot-3": {
                        status: "answer_analysis_recovery",
                        state: "unavailable",
                        canRetryAnalysis: false,
                        canContinueWithoutCoaching: true,
                    },
                },
            })}
        />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Finish without coaching" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/complete",
        expect.objectContaining({ method: "POST" }),
    ));
    expect(assign).toHaveBeenCalledWith("/candidate/dashboard?prep=profile-1");
});

it("reopens a coached answer and submits the retry as a linked attempt", async () => {
    const sourceAttemptId = "11111111-1111-4111-8111-111111111111";
    const retryAttemptId = "22222222-2222-4222-8222-222222222222";
    const answerRequestBodies: Array<Record<string, unknown>> = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/feedback-actions")) {
            const event = JSON.parse(String(init?.body));
            return new Response(JSON.stringify({
                status: "feedback_action_saved",
                feedbackActionEvents: { "slot-1": event },
            }), { status: 200 });
        }
        if (url.endsWith("/answer-drafts")) {
            return new Response(JSON.stringify({ status: "answer_draft_saved" }), { status: 200 });
        }
        if (url.endsWith("/answers")) {
            answerRequestBodies.push(JSON.parse(String(init?.body)));
            return new Response(JSON.stringify({
                status: "answer_submit_saved",
                answerSubmissions: {
                    "slot-1": createAnswerSubmissionWithAttempt("slot-1", 0, retryAttemptId, 2),
                },
            }), { status: 202 });
        }
        if (url.endsWith("/answers/slot-1/analysis")) {
            return new Response(JSON.stringify({
                status: "answer_analysis_saved",
                analysisSnapshot: createAnalysisSnapshotWithAttempt("slot-1", 0, retryAttemptId, 2),
            }), { status: 200 });
        }
        return new Response(null, { status: 500 });
    });
    vi.stubGlobal("fetch", fetch);
    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession({
                progress: { status: "live_question", currentQuestionIndex: 0 },
                answerSubmissions: {
                    "slot-1": createAnswerSubmissionWithAttempt("slot-1", 0, sourceAttemptId, 1),
                },
                answerAnalysisSnapshots: {
                    "slot-1": createAnalysisSnapshotWithAttempt("slot-1", 0, sourceAttemptId, 1),
                },
            })}
        />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Explore feedback" }));
    expect(await screen.findAllByText("The answer would be stronger with a concrete outcome.")).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Add what changed after your action.");
    fireEvent.click(screen.getByRole("button", { name: "Retry my answer" }));

    const answer = await screen.findByRole("textbox", { name: "Type your answer" });
    await waitFor(() => expect(answer).not.toHaveAttribute("readonly"));
    fireEvent.change(answer, { target: { value: "A clearer answer with the result included." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(await screen.findByRole("dialog", { name: "Your coaching" })).toBeInTheDocument();
    expect(screen.getByText("You named a practical first step.")).toBeInTheDocument();
    expect(answerRequestBodies).toEqual([expect.objectContaining({
        trigger: "feedback_retry",
        supersedesAnswerAttemptId: sourceAttemptId,
        text: "A clearer answer with the result included.",
    })]);
});

it("recovers an unsubmitted feedback retry as an editable preserved draft", () => {
    const sourceAttemptId = "11111111-1111-4111-8111-111111111111";
    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession({
                progress: { status: "live_question", currentQuestionIndex: 0 },
                answerDrafts: {
                    "slot-1": {
                        slotId: "slot-1",
                        questionIndex: 0,
                        mode: "text",
                        text: "My in-progress retry draft.",
                        updatedAt: "2026-07-14T20:00:00.000Z",
                    },
                },
                answerSubmissions: {
                    "slot-1": createAnswerSubmissionWithAttempt("slot-1", 0, sourceAttemptId, 1),
                },
                answerAnalysisSnapshots: {
                    "slot-1": createAnalysisSnapshotWithAttempt("slot-1", 0, sourceAttemptId, 1),
                },
                feedbackActionEvents: {
                    "slot-1": {
                        status: "feedback_action_selected",
                        answer: {
                            slotId: "slot-1",
                            questionIndex: 0,
                            answerAttemptId: sourceAttemptId,
                            attemptNumber: 1,
                            trigger: "initial_submit",
                        },
                        stageId: "next_step",
                        actionKind: "retry_answer",
                        transition: "retry_current_question",
                        selectedAt: "2026-07-14T19:59:00.000Z",
                    },
                },
            })}
        />,
    );

    expect(screen.queryByText("Coach read")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Type your answer" })).toHaveValue("My in-progress retry draft.");
    expect(screen.getByRole("textbox", { name: "Type your answer" })).not.toHaveAttribute("readonly");
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

it("does not carry a failed finish message into feedback for a retried answer", async () => {
    const sourceAttemptId = "11111111-1111-4111-8111-111111111111";
    const retryAttemptId = "22222222-2222-4222-8222-222222222222";
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/feedback-actions")) {
            const event = JSON.parse(String(init?.body));
            return new Response(JSON.stringify({
                status: "feedback_action_saved",
                feedbackActionEvents: { "slot-3": event },
            }), { status: 200 });
        }
        if (url.endsWith("/complete")) {
            return new Response(null, { status: 503 });
        }
        if (url.endsWith("/answer-drafts")) {
            return new Response(JSON.stringify({ status: "answer_draft_saved" }), { status: 200 });
        }
        if (url.endsWith("/answers")) {
            return new Response(JSON.stringify({
                status: "answer_submit_saved",
                answerSubmissions: {
                    "slot-3": createAnswerSubmissionWithAttempt("slot-3", 2, retryAttemptId, 2),
                },
            }), { status: 202 });
        }
        if (url.endsWith("/answers/slot-3/analysis")) {
            return new Response(JSON.stringify({
                status: "answer_analysis_saved",
                analysisSnapshot: createAnalysisSnapshotWithAttempt("slot-3", 2, retryAttemptId, 2),
            }), { status: 200 });
        }
        return new Response(null, { status: 500 });
    });
    vi.stubGlobal("fetch", fetch);
    render(
        <CandidatePlannedSessionExperience
            sessionId="session-v2-1"
            dashboardHref="/candidate/dashboard"
            initialSession={createSession({
                progress: { status: "live_question", currentQuestionIndex: 2 },
                answerSubmissions: {
                    "slot-1": createAnswerSubmission("slot-1", 0),
                    "slot-2": createAnswerSubmission("slot-2", 1),
                    "slot-3": createAnswerSubmissionWithAttempt("slot-3", 2, sourceAttemptId, 1),
                },
                answerAnalysisSnapshots: {
                    "slot-3": createAnalysisSnapshotWithAttempt("slot-3", 2, sourceAttemptId, 1),
                },
            })}
        />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Explore feedback" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "Finish session" }));
    expect(await screen.findAllByText("I could not finish this session yet. Try again.")).not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Retry my answer" }));
    const answer = await screen.findByRole("textbox", { name: "Type your answer" });
    await waitFor(() => expect(answer).not.toHaveAttribute("readonly"));
    fireEvent.change(answer, { target: { value: "A stronger retry with a clear outcome." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(await screen.findByRole("dialog", { name: "Your coaching" })).toBeInTheDocument();
    expect(screen.queryAllByText("I could not finish this session yet. Try again.")).toHaveLength(0);
});

it("finishes the session from the last staged coaching step", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: {
            ...window.location,
            assign,
        },
    });
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/feedback-actions")) {
            const event = JSON.parse(String(init?.body));
            return new Response(JSON.stringify({
                status: "feedback_action_saved",
                feedbackActionEvents: { "slot-3": event },
            }), { status: 200 });
        }
        return new Response(JSON.stringify({
            status: "candidate_session_completed",
            nextRoute: "/candidate/dashboard",
        }), { status: 200 });
    });
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
                answerSubmissions: {
                    "slot-1": createAnswerSubmission("slot-1", 0),
                    "slot-2": createAnswerSubmission("slot-2", 1),
                    "slot-3": createAnswerSubmission("slot-3", 2),
                },
            })}
        />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Explore feedback" }));
    expect(await screen.findAllByText("The answer would be stronger with a concrete outcome.")).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Add what changed after your action.");
    fireEvent.click(screen.getByRole("button", { name: "Finish session" }));

    expect(await screen.findByRole("heading", { name: "Preparing your Coach Plan" })).toBeInTheDocument();

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
        "/candidate/session/session-v2-1/complete",
        expect.objectContaining({ method: "POST" }),
    ));
    expect(assign).toHaveBeenCalledWith("/candidate/dashboard");
});

it("maps durable answer and feedback state into recovered candidate session facts", () => {
    const answerAttemptId = "99999999-9999-4999-8999-999999999999";
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
                answerAttemptId,
                attemptNumber: 1,
                trigger: "initial_submit",
                supersedesAnswerAttemptId: null,
            },
        },
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: {},
        feedbackActionEvents: {},
        completionSnapshot: null,
    } satisfies CandidatePracticeSessionRecord;

    expect(toCandidateProvisionalSession(durableSession, {
        evaluationRuns: [createEvaluationRun({
            candidateAnswerAttemptId: answerAttemptId,
            lifecycleState: "rejected",
            validation: { retryableByNewRun: false },
            errorCode: "PROVIDER_SAFETY_BLOCKED",
        })],
        now: new Date("2026-07-13T18:01:00.000Z"),
    })).toMatchObject({
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
        answerAnalysisRecoveries: {
            "slot-1": {
                state: "unavailable",
                canRetryAnalysis: false,
                canContinueWithoutCoaching: true,
            },
        },
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
    return createCandidateAnswerAnalysisProviderResultFixture({
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
        evidenceFirst: {
            candidateFeedback: {
                acknowledgement: "You named a practical first step.",
                primaryStrength: null,
                biggestUpgrade: "The answer would be stronger with a concrete outcome.",
                redoPrompt: "Add what changed after your action.",
            },
            intervention: "polish_then_continue",
        },
    });
}

function createAnswerSubmission(slotId: string, questionIndex: number) {
    return {
        slotId,
        questionIndex,
        mode: "text" as const,
        text: "A saved answer.",
        submittedAt: "2026-07-13T18:02:00.000Z",
        status: "pending_analysis" as const,
    };
}

function createAnswerSubmissionWithAttempt(
    slotId: string,
    questionIndex: number,
    answerAttemptId: string,
    attemptNumber: number,
) {
    return {
        ...createAnswerSubmission(slotId, questionIndex),
        answerAttemptId,
        attemptNumber,
        trigger: attemptNumber === 1 ? "initial_submit" as const : "feedback_retry" as const,
        supersedesAnswerAttemptId: attemptNumber === 1 ? null : "11111111-1111-4111-8111-111111111111",
    };
}

function createAnalysisSnapshotWithAttempt(
    slotId: string,
    questionIndex: number,
    answerAttemptId: string,
    attemptNumber: number,
): CandidateAnswerAnalysisProviderResult {
    return {
        ...createAnalysisSnapshot(slotId, questionIndex),
        answer: {
            slotId,
            questionIndex,
            answerAttemptId,
            attemptNumber,
            trigger: attemptNumber === 1 ? "initial_submit" : "feedback_retry",
        },
    };
}

function createEvaluationRun(
    overrides: Partial<CandidateAnswerEvaluationRunRecord>,
): CandidateAnswerEvaluationRunRecord {
    const lifecycleState = overrides.lifecycleState ?? "failed";
    return {
        candidateAnswerEvaluationRunId: "evaluation-run-1",
        candidateAnswerAttemptId: overrides.candidateAnswerAttemptId ?? "answer-attempt-1",
        purpose: "candidate_coaching",
        provider: candidateAnswerAnalysisFixtureRunMetadata.provider,
        modelName: candidateAnswerAnalysisFixtureRunMetadata.modelName,
        promptVersion: candidateAnswerAnalysisFixtureRunMetadata.promptVersion,
        evaluatorVersion: candidateAnswerAnalysisFixtureRunMetadata.evaluatorVersion,
        configurationManifest: candidateAnswerAnalysisFixtureRunMetadata.configurationManifest,
        configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
        inputFingerprint: "input-fingerprint-1",
        idempotencyKey: "analysis-key-1",
        generationAttempt: 1,
        lifecycleState,
        result: lifecycleState === "completed" ? { status: "accepted" } : null,
        validation: overrides.validation ?? null,
        errorCode: lifecycleState === "failed" || lifecycleState === "rejected"
            ? overrides.errorCode ?? "TEST_FAILURE"
            : null,
        requestedAt: "2026-07-13T18:00:00.000Z",
        claimExpiresAt: "2026-07-13T18:01:00.000Z",
        completedAt: lifecycleState === "requested" ? null : "2026-07-13T18:00:30.000Z",
        createdAt: "2026-07-13T18:00:00.000Z",
        updatedAt: "2026-07-13T18:00:30.000Z",
        ...overrides,
    };
}
