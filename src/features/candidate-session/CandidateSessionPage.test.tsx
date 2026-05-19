import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LoadedCandidateSession } from "@/lib/server/candidate";
import { CandidateSessionPage } from "./CandidateSessionPage";

const {
    enginePrefetchMock,
    prefetchMock,
    refreshMock,
    speakMock,
    stopSpeakingMock,
    unlockMock,
} = vi.hoisted(() => ({
    prefetchMock: vi.fn(),
    refreshMock: vi.fn(),
    speakMock: vi.fn(),
    stopSpeakingMock: vi.fn(),
    enginePrefetchMock: vi.fn(),
    unlockMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: refreshMock,
    }),
}));

vi.mock("@/app/actions/feedback", () => ({
    captureFeedbackAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("./actions", () => ({
    advanceCandidateSessionAction: vi.fn(),
    analyzeCandidateAnswerAction: vi.fn(),
    pauseCandidateSessionAction: vi.fn(),
    resumeCandidateSessionAction: vi.fn(),
    retryCandidateQuestionAction: vi.fn(),
    startCandidateSessionAction: vi.fn(),
    submitCandidateAnswerAction: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
    showDemoTools: () => true,
}));

vi.mock("@/features/audio/hooks/useTextToSpeech", () => ({
    useTextToSpeech: () => ({
        isPlaying: false,
        isLoading: false,
        prefetch: prefetchMock,
        speak: speakMock,
        stop: stopSpeakingMock,
    }),
}));

vi.mock("@/features/audio/hooks/useSpeechToText", () => ({
    useSpeechToText: () => ({
        transcript: "",
        startListening: vi.fn(),
        stopListening: vi.fn(),
        abortListening: vi.fn(),
        error: null,
    }),
}));

vi.mock("@/features/audio/hooks/useAudioRecording", () => ({
    useAudioRecording: () => ({
        isRecording: false,
        isInitializing: false,
        audioBlob: null,
        mediaStream: null,
        permissionError: false,
        permissionMessage: null,
        startRecording: vi.fn(),
        stopRecording: vi.fn(),
        warmUp: vi.fn(),
        resetAudio: vi.fn(),
    }),
}));

vi.mock("@/features/audio/audio-engine", () => ({
    audioEngine: {
        prefetch: enginePrefetchMock,
        unlock: unlockMock,
    },
}));

vi.mock("@/features/session/hooks/useSmartHints", () => ({
    useSmartHints: () => ({
        hints: {
            doThis: "Use a specific release example.",
            avoidThis: "Avoid describing process without outcome.",
        },
        isLoading: false,
    }),
}));

vi.mock("@/features/session/hooks/useStrongResponse", () => ({
    useStrongResponse: () => ({
        data: {
            strongResponse: "A strong answer.",
            whyThisWorks: "This works because it is specific.",
        },
        isLoading: false,
        fetchStrongResponse: vi.fn(),
    }),
}));

const loadedSession: LoadedCandidateSession = {
    practiceDraftId: "draft-1",
    session: {
        id: "session-1",
        status: "AWAITING_EVALUATION",
        role: "QA Analyst",
        jobDescription: "Test regulated workflows.",
        currentQuestionIndex: 0,
        initialsRequired: false,
        questions: [
            { id: "question-1", text: "Tell me about a release you improved.", category: "Behavioral", index: 0 },
        ],
        answers: {
            "question-1": {
                questionId: "question-1",
                transcript: "I tightened the release checklist.",
                submittedAt: 1770000000000,
            },
        },
    },
};

describe("CandidateSessionPage", () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
            const normalizedMessage = args.map(String).join(" ");
            if (
                normalizedMessage.includes("Invalid value for prop") &&
                normalizedMessage.includes("`action`") &&
                normalizedMessage.includes("form")
            ) {
                return;
            }

            throw new Error(`Unexpected console.error in CandidateSessionPage test: ${normalizedMessage}`);
        });
        Object.defineProperty(HTMLFormElement.prototype, "requestSubmit", {
            configurable: true,
            value: vi.fn(),
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it("renders an invite-style session entry screen before the first candidate question", async () => {
        const user = userEvent.setup();

        render(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        status: "NOT_STARTED",
                        answers: {},
                    },
                }}
            />,
        );

        expect(screen.getByRole("heading", { name: /let's get you ready for your interview/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /begin first question/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /start practice/i })).not.toBeInTheDocument();
        expect(prefetchMock).toHaveBeenCalledWith(
            "question-1",
            "Tell me about a release you improved.",
            { sessionId: "session-1" },
        );

        await user.click(screen.getByRole("button", { name: /begin first question/i }));

        expect(unlockMock).toHaveBeenCalled();
        expect(enginePrefetchMock).toHaveBeenCalledWith(
            "question-1",
            "Tell me about a release you improved.",
            { sessionId: "session-1" },
        );
    });

    it("reuses the recruiter-style active question workspace for candidate practice", async () => {
        const user = userEvent.setup();

        render(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        status: "IN_SESSION",
                        questions: [
                            loadedSession.session.questions[0],
                            { id: "question-2", text: "How do you handle ambiguity?", category: "Behavioral", index: 1 },
                        ],
                        answers: {},
                    },
                }}
            />,
        );

        expect(screen.getByRole("banner")).toHaveTextContent("QA Analyst");
        expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
        expect(screen.getByText("50% Complete")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /exit session/i })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Tell me about a release you improved." })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /hints/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /example/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /voice mode/i })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: /text mode/i })).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByRole("button", { name: /record answer/i })).toBeInTheDocument();
        expect(screen.getByText("Tap to record; tap again to stop")).toBeInTheDocument();
        expect(screen.queryByRole("textbox", { name: /type your answer/i })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /read question/i })).toBeInTheDocument();
        expect(screen.queryByText("Session status")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /text mode/i }));

        expect(screen.getByRole("button", { name: /voice mode/i })).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByRole("button", { name: /text mode/i })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("textbox", { name: /type your answer/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Type your answer here...")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /submit answer/i })).toBeInTheDocument();
        expect(prefetchMock).toHaveBeenCalledWith(
            "question-1",
            "Tell me about a release you improved.",
            { sessionId: "session-1" },
        );
        expect(prefetchMock).toHaveBeenCalledWith(
            "question-2",
            "How do you handle ambiguity?",
            { sessionId: "session-1" },
        );
        expect(speakMock).toHaveBeenCalledWith(
            "Tell me about a release you improved.",
            "question-1",
            { sessionId: "session-1" },
        );
    });

    it("exposes recruiter-style hint and example controls for the active candidate question", () => {
        render(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        status: "IN_SESSION",
                        answers: {},
                        questions: [
                            {
                                ...loadedSession.session.questions[0],
                                tips: {
                                    doThis: "Use a specific release example.",
                                    avoidThis: "Avoid describing process without outcome.",
                                },
                            },
                        ],
                    },
                }}
            />,
        );

        expect(screen.getByRole("button", { name: /hints/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /example/i })).toBeInTheDocument();
    });

    it("keeps recruiter-style text submission surface available for active candidate practice", async () => {
        const user = userEvent.setup();

        render(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        status: "IN_SESSION",
                        answers: {},
                    },
                }}
            />,
        );

        await user.click(screen.getByRole("button", { name: /text mode/i }));
        expect(screen.getByRole("textbox", { name: /type your answer/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /submit answer/i })).toBeInTheDocument();
    });

    it("offers candidate coaching after an answer is saved but before analysis exists", () => {
        render(<CandidateSessionPage loadedSession={loadedSession} />);

        expect(screen.getByText("Your saved answer")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /get coaching/i })).toBeInTheDocument();
        expect(screen.queryByText(/add a clearer metric/i)).not.toBeInTheDocument();
    });

    it("renders candidate-facing coaching when answer analysis exists", () => {
        render(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        answers: {
                            "question-1": {
                                ...loadedSession.session.answers["question-1"],
                                analysis: {
                                    ack: "You gave a useful starting point.",
                                    recommendation: "Add a clearer metric.",
                                    contentPulse: {
                                        dimension: "outcome_explicitness",
                                        headline: "Add the measurable result",
                                        body: "Tie the checklist to a release outcome.",
                                        quote: "release checklist",
                                    },
                                },
                            },
                        },
                    },
                }}
            />,
        );

        expect(screen.getByRole("button", { name: /explore feedback/i })).toBeInTheDocument();
        expect(screen.getByText("You gave a useful starting point.")).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: /skip and finish session/i }).length).toBeGreaterThan(0);
        expect(screen.queryByRole("button", { name: /get coaching/i })).not.toBeInTheDocument();
    });

    it("shows recruiter-style resume controls for paused and completed candidate sessions", () => {
        const { rerender } = render(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        status: "PAUSED",
                    },
                }}
            />,
        );

        expect(screen.getByText("Practice saved")).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: /resume session/i }).length).toBeGreaterThan(0);

        rerender(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        status: "COMPLETED",
                    },
                }}
            />,
        );

        expect(screen.getByText("Session complete")).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: /review summary/i })[0]).toHaveAttribute("href", "/summary/session-1");
    });

    it("includes the hidden engagement debug inspector from the recruiter session experience", async () => {
        const user = userEvent.setup();

        render(
            <CandidateSessionPage
                loadedSession={{
                    ...loadedSession,
                    session: {
                        ...loadedSession.session,
                        engagedTimeSeconds: 42,
                        answers: {
                            "question-1": {
                                ...loadedSession.session.answers["question-1"],
                                analysis: {
                                    __debugPrompt: "Candidate analysis prompt snapshot",
                                    recommendation: "Keep the structure.",
                                },
                            },
                        },
                    },
                }}
            />,
        );

        await user.click(screen.getByRole("button", { name: /open engagement debug inspector/i }));

        expect(screen.getByText("Debug Inspector")).toBeInTheDocument();
        expect(screen.getByText("Session Total")).toBeInTheDocument();
        expect(screen.getByText(/42s/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /ai context/i }));
        expect(screen.getByText("Tips & Hints Generator")).toBeInTheDocument();
        expect(screen.getByText("Strong Response Generator")).toBeInTheDocument();
        expect(screen.getByText("Core Analysis Evaluator")).toBeInTheDocument();
        expect(screen.getByText("Candidate analysis prompt snapshot")).toBeInTheDocument();
    });
});
