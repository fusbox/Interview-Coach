import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CandidateActiveQuestionWorkspace } from "./CandidateActiveQuestionWorkspace";

const {
    refreshMock,
    unlockMock,
    prefetchMock,
    speakMock,
    stopSpeakingMock,
    startRecordingMock,
    stopRecordingMock,
    warmUpMock,
    resetAudioMock,
    fetchStrongResponseMock,
} = vi.hoisted(() => ({
    refreshMock: vi.fn(),
    unlockMock: vi.fn().mockResolvedValue(undefined),
    prefetchMock: vi.fn(),
    speakMock: vi.fn().mockResolvedValue(undefined),
    stopSpeakingMock: vi.fn(),
    startRecordingMock: vi.fn().mockResolvedValue(undefined),
    stopRecordingMock: vi.fn().mockResolvedValue(undefined),
    warmUpMock: vi.fn().mockResolvedValue(null),
    resetAudioMock: vi.fn(),
    fetchStrongResponseMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: refreshMock,
    }),
}));

vi.mock("@/app/actions/feedback", () => ({
    captureFeedbackAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/features/audio/audio-engine", () => ({
    audioEngine: {
        unlock: unlockMock,
    },
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

vi.mock("@/features/audio/hooks/useAudioRecording", () => ({
    useAudioRecording: () => ({
        isRecording: false,
        isInitializing: false,
        audioBlob: new Blob(["voice"], { type: "audio/webm" }),
        mediaStream: null,
        permissionError: false,
        permissionMessage: null,
        startRecording: startRecordingMock,
        stopRecording: stopRecordingMock,
        warmUp: warmUpMock,
        resetAudio: resetAudioMock,
    }),
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
        fetchStrongResponse: fetchStrongResponseMock,
    }),
}));

const question = {
    id: "question-1",
    text: "Tell me about a time you adapted quickly.",
    category: "Behavioral",
    index: 0,
};

const analyzedSessionResponse = {
    id: "session-1",
    answers: {
        "question-1": {
            questionId: "question-1",
            transcript: "I clarified the change and adapted.",
            submittedAt: 1770000000000,
            analysis: {
                ack: "You gave a useful starting point.",
                recommendation: "Try again with a more specific result.",
                contentPulse: {
                    dimension: "outcome_explicitness",
                    headline: "Connect the action to impact",
                    body: "Name what changed because of your adaptation.",
                    quote: "clarified the change",
                },
                nextAction: {
                    label: "Retry My Answer",
                    actionType: "redo_answer",
                },
                meta: {
                    tier: 1,
                    modality: "text",
                },
            },
        },
    },
};

function renderWorkspace(overrides: Partial<ComponentProps<typeof CandidateActiveQuestionWorkspace>> = {}) {
    return render(
        <CandidateActiveQuestionWorkspace
            sessionId="session-1"
            role="Manufacturing Technician"
            currentQuestion={question}
            nextQuestion={null}
            isLastQuestion={false}
            advanceAction={vi.fn()}
            retryQuestionAction={vi.fn()}
            {...overrides}
        />,
    );
}

describe("CandidateActiveQuestionWorkspace", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(analyzedSessionResponse), { status: 200 })));
    });

    it("submits text answers through the shared session submit and analysis APIs, then opens recruiter-style feedback", async () => {
        const user = userEvent.setup();

        renderWorkspace();

        await user.click(screen.getByRole("button", { name: /text mode/i }));
        await user.type(screen.getByRole("textbox", { name: /type your answer/i }), "I clarified the change and adapted.");
        await user.click(screen.getByRole("button", { name: /submit answer/i }));

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        expect(fetch).toHaveBeenNthCalledWith(
            1,
            "/api/session/session-1/questions/question-1/submit",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    text: "I clarified the change and adapted.",
                    modality: "text",
                }),
            }),
        );
        expect(fetch).toHaveBeenNthCalledWith(
            2,
            "/api/session/session-1/questions/question-1/analysis",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ audioData: undefined }),
            }),
        );
        expect(await screen.findByRole("button", { name: /explore feedback/i })).toBeInTheDocument();
        expect(screen.getByText("You gave a useful starting point.")).toBeInTheDocument();
        expect(refreshMock).not.toHaveBeenCalled();
    });

    it("shows the recruiter-style loader while shared answer analysis is pending", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));

        renderWorkspace();

        await user.click(screen.getByRole("button", { name: /text mode/i }));
        await user.type(screen.getByRole("textbox", { name: /type your answer/i }), "I clarified the change and adapted.");
        await user.click(screen.getByRole("button", { name: /submit answer/i }));

        expect(await screen.findByText("Reviewing your response...")).toBeInTheDocument();
        expect(screen.getByText("Taking a look...")).toBeInTheDocument();
        expect(screen.getByText("Reviewing answer content...")).toBeInTheDocument();
        expect(screen.getByText("Creating feedback...")).toBeInTheDocument();
    });

    it("right-aligns the text answer submit action to the answer rail", async () => {
        const user = userEvent.setup();

        renderWorkspace();

        await user.click(screen.getByRole("button", { name: /text mode/i }));

        const actions = screen.getByLabelText("Text answer actions");
        expect(actions).toHaveClass("px-0");
        expect(actions).toHaveClass("py-4");
        expect(actions.firstElementChild).toHaveClass("justify-end");
    });


    it("keeps coach lens panels open until the user changes the lens", async () => {
        const user = userEvent.setup();

        renderWorkspace();

        await user.click(screen.getByRole("button", { name: /hints/i }));

        expect(screen.getAllByText("What to Aim For").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Use a specific example.").length).toBeGreaterThan(0);

        await user.click(screen.getByRole("button", { name: /example/i }));

        expect(screen.queryAllByText("What to Aim For")).toHaveLength(0);
        expect(screen.getByText("Example Strong Response")).toBeInTheDocument();
        expect(screen.getByText("A strong answer.")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /example/i }));

        expect(screen.queryByText("Example Strong Response")).not.toBeInTheDocument();
    });

    it("submits captured voice audio through the shared analysis API", async () => {
        const user = userEvent.setup();

        renderWorkspace();

        await user.click(screen.getByRole("button", { name: /submit recording/i }));

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        expect(fetch).toHaveBeenNthCalledWith(
            1,
            "/api/session/session-1/questions/question-1/submit",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    text: "",
                    modality: "voice",
                }),
            }),
        );
        expect(fetch).toHaveBeenNthCalledWith(
            2,
            "/api/session/session-1/questions/question-1/analysis",
            expect.objectContaining({
                method: "POST",
                body: expect.stringContaining("\"mimeType\":\"audio/webm\""),
            }),
        );
        expect(await screen.findByRole("button", { name: /explore feedback/i })).toBeInTheDocument();
    });
});
