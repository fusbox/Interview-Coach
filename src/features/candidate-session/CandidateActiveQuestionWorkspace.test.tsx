import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("CandidateActiveQuestionWorkspace", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    });

    it("submits text answers through the shared session submit and analysis APIs", async () => {
        const user = userEvent.setup();

        render(
            <CandidateActiveQuestionWorkspace
                sessionId="session-1"
                role="Manufacturing Technician"
                currentQuestion={question}
                nextQuestion={null}
            />,
        );

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
        expect(refreshMock).toHaveBeenCalled();
    });

    it("shows the recruiter-style loader while shared answer analysis is pending", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));

        render(
            <CandidateActiveQuestionWorkspace
                sessionId="session-1"
                role="Manufacturing Technician"
                currentQuestion={question}
                nextQuestion={null}
            />,
        );

        await user.click(screen.getByRole("button", { name: /text mode/i }));
        await user.type(screen.getByRole("textbox", { name: /type your answer/i }), "I clarified the change and adapted.");
        await user.click(screen.getByRole("button", { name: /submit answer/i }));

        expect(await screen.findByText("Reviewing your response...")).toBeInTheDocument();
        expect(screen.getByText("Taking a look...")).toBeInTheDocument();
        expect(screen.getByText("Reviewing answer content...")).toBeInTheDocument();
        expect(screen.getByText("Creating feedback...")).toBeInTheDocument();
    });


    it("keeps coach lens panels open until the user changes the lens", async () => {
        const user = userEvent.setup();

        render(
            <CandidateActiveQuestionWorkspace
                sessionId="session-1"
                role="Manufacturing Technician"
                currentQuestion={question}
                nextQuestion={null}
            />,
        );

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

        render(
            <CandidateActiveQuestionWorkspace
                sessionId="session-1"
                role="Manufacturing Technician"
                currentQuestion={question}
                nextQuestion={null}
            />,
        );

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
    });
});
