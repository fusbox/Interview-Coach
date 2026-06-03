import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBasicAccessibilityViolations } from "@/test/accessibility";

const {
    loadCandidateSessionForCurrentCandidateMock,
    notFoundMock,
    prefetchMock,
    refreshMock,
    speakMock,
    stopSpeakingMock,
    unlockMock,
} = vi.hoisted(() => ({
    loadCandidateSessionForCurrentCandidateMock: vi.fn(),
    notFoundMock: vi.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
    prefetchMock: vi.fn(),
    refreshMock: vi.fn(),
    speakMock: vi.fn(),
    stopSpeakingMock: vi.fn(),
    unlockMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({
    notFound: notFoundMock,
    useRouter: () => ({
        refresh: refreshMock,
    }),
}));

vi.mock("@/lib/server/candidate", () => ({
    loadCandidateSessionForCurrentCandidate: loadCandidateSessionForCurrentCandidateMock,
}));

vi.mock("@/features/candidate-session/actions", () => ({
    startCandidateSessionAction: vi.fn(),
    advanceCandidateSessionAction: vi.fn(),
    analyzeCandidateAnswerAction: vi.fn(),
    pauseCandidateSessionAction: vi.fn(),
    resumeCandidateSessionAction: vi.fn(),
    retryCandidateQuestionAction: vi.fn(),
    submitCandidateAnswerAction: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
    showDemoTools: () => false,
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
        isListening: false,
        transcript: "",
        startListening: vi.fn(),
        stopListening: vi.fn(),
        abortListening: vi.fn(),
        error: null,
        isSupported: true,
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
        prefetch: prefetchMock,
        unlock: unlockMock,
    },
}));

vi.mock("@/features/session/hooks/useSmartHints", () => ({
    useSmartHints: () => ({
        hints: {
            doThis: "Use a specific example.",
            avoidThis: "Avoid vague claims.",
        },
        isLoading: false,
    }),
}));

vi.mock("@/features/session/hooks/useStrongResponse", () => ({
    useStrongResponse: () => ({
        data: {
            strongResponse: "A strong answer.",
            whyThisWorks: "It connects actions to outcomes.",
        },
        isLoading: false,
        fetchStrongResponse: vi.fn(),
    }),
}));

describe("/session/[sessionId] page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(HTMLFormElement.prototype, "requestSubmit", {
            configurable: true,
            value: vi.fn(),
        });
    });

    it("renders real candidate-owned session state", async () => {
        loadCandidateSessionForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            session: {
                id: "session-1",
                status: "NOT_STARTED",
                role: "QA analyst",
                jobDescription: "Test regulated workflows.",
                currentQuestionIndex: 0,
                questions: [
                    {
                        id: "question-1",
                        text: "Tell me about a release you improved.",
                        category: "Behavioral",
                        index: 0,
                    },
                ],
                answers: {},
                initialsRequired: false,
            },
        });
        const { default: CandidateSessionRoute } = await import("./page");

        render(await CandidateSessionRoute({ params: Promise.resolve({ sessionId: "session-1" }) }));

        expect(loadCandidateSessionForCurrentCandidateMock).toHaveBeenCalledWith("session-1");
        expect(screen.getByRole("heading", { name: /let's get you ready for your interview/i })).toBeInTheDocument();
        expect(screen.getByText(/QA analyst/)).toBeInTheDocument();
        expect(screen.queryByText("Tell me about a release you improved.")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /begin first question/i })).toBeInTheDocument();
        expect(prefetchMock).toHaveBeenCalledWith(
            "question-1",
            "Tell me about a release you improved.",
            { sessionId: "session-1" },
        );
    }, 10000);

    it("meets the candidate primary-page accessibility baseline", async () => {
        loadCandidateSessionForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            session: {
                id: "session-1",
                status: "IN_SESSION",
                role: "QA analyst",
                currentQuestionIndex: 0,
                questions: [
                    { id: "question-1", text: "Question one?", category: "Behavioral", index: 0 },
                ],
                answers: {},
                initialsRequired: false,
            },
        });
        const { default: CandidateSessionRoute } = await import("./page");

        const { container } = render(await CandidateSessionRoute({ params: Promise.resolve({ sessionId: "session-1" }) }));

        expect(getBasicAccessibilityViolations(container)).toEqual([]);
    });

    it("renders the recruiter-style answer workspace for an in-progress session", async () => {
        const user = userEvent.setup();

        loadCandidateSessionForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            session: {
                id: "session-1",
                status: "IN_SESSION",
                role: "QA analyst",
                currentQuestionIndex: 0,
                questions: [
                    { id: "question-1", text: "Question one?", category: "Behavioral", index: 0 },
                    { id: "question-2", text: "Question two?", category: "Technical", index: 1 },
                ],
                answers: {},
                initialsRequired: false,
            },
        });
        const { default: CandidateSessionRoute } = await import("./page");

        render(await CandidateSessionRoute({ params: Promise.resolve({ sessionId: "session-1" }) }));

        expect(screen.getByRole("button", { name: /exit session/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /read question/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /hints/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /example/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /record answer/i })).toBeInTheDocument();
        expect(screen.queryByRole("textbox", { name: /type your answer/i })).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /text mode/i }));

        expect(screen.getByRole("textbox", { name: /type your answer/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /submit answer/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /continue to next question/i })).not.toBeInTheDocument();
    });

    it("renders feedback recovery for a submitted answer without usable analysis", async () => {
        loadCandidateSessionForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            session: {
                id: "session-1",
                status: "REVIEWING",
                role: "QA analyst",
                currentQuestionIndex: 0,
                questions: [
                    { id: "question-1", text: "Question one?", category: "Behavioral", index: 0 },
                    { id: "question-2", text: "Question two?", category: "Technical", index: 1 },
                ],
                answers: {
                    "question-1": {
                        questionId: "question-1",
                        transcript: "I improved release quality with a checklist.",
                        submittedAt: 1770000000000,
                    },
                },
                initialsRequired: false,
            },
        });
        const { default: CandidateSessionRoute } = await import("./page");

        render(await CandidateSessionRoute({ params: Promise.resolve({ sessionId: "session-1" }) }));

        expect(screen.getByText("I improved release quality with a checklist.")).toBeInTheDocument();
        expect(screen.getByText("Feedback recovery")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /finish preparing your coaching/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /regenerate feedback/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /retry question/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /continue to next question/i })).not.toBeInTheDocument();
    });

    it("renders a resume action for a paused session", async () => {
        loadCandidateSessionForCurrentCandidateMock.mockResolvedValue({
            practiceDraftId: "draft-1",
            session: {
                id: "session-1",
                status: "PAUSED",
                role: "QA analyst",
                currentQuestionIndex: 0,
                questions: [
                    { id: "question-1", text: "Question one?", category: "Behavioral", index: 0 },
                ],
                answers: {},
                initialsRequired: false,
            },
        });
        const { default: CandidateSessionRoute } = await import("./page");

        render(await CandidateSessionRoute({ params: Promise.resolve({ sessionId: "session-1" }) }));

        expect(screen.getAllByRole("button", { name: /resume/i }).length).toBeGreaterThan(0);
    });

    it("returns not found when the session is not owned by the current candidate", async () => {
        loadCandidateSessionForCurrentCandidateMock.mockResolvedValue(null);
        const { default: CandidateSessionRoute } = await import("./page");

        await expect(CandidateSessionRoute({ params: Promise.resolve({ sessionId: "session-other" }) }))
            .rejects
            .toThrow("NEXT_NOT_FOUND");
        expect(notFoundMock).toHaveBeenCalled();
    });
});
