import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SessionVoiceAnswerCapture } from "./SessionVoiceAnswerCapture";

describe("SessionVoiceAnswerCapture", () => {
    it("does not request microphone access before the user starts recording", () => {
        const getUserMedia = vi.fn();
        Object.defineProperty(navigator, "mediaDevices", {
            configurable: true,
            value: { getUserMedia },
        });

        render(
            <SessionVoiceAnswerCapture
                mutationBasePath="/candidate/session/session-1"
                questionSlotId="slot-1"
                questionIndex={0}
                onSwitchToText={vi.fn()}
            />,
        );

        expect(screen.getByRole("button", { name: "Start recording" })).toBeInTheDocument();
        expect(screen.getByText(/Interview Coach does not keep a separate audio file/)).toBeInTheDocument();
        expect(getUserMedia).not.toHaveBeenCalled();
    });

    it("recovers quick submit as a read-only continuation and reuses its original submission path", async () => {
        const onQuickSubmitTranscript = vi.fn(async () => undefined);
        const onReviewedSubmitTranscript = vi.fn(async () => undefined);
        render(
            <SessionVoiceAnswerCapture
                mutationBasePath="/candidate/session/session-1"
                questionSlotId="slot-1"
                questionIndex={0}
                initialTranscriptDraft={{
                    status: "voice_transcript_draft",
                    slotId: "slot-1",
                    questionIndex: 0,
                    transcriptText: "Recovered quick transcript.",
                    sourceTranscriptionRunId: "run-quick-1",
                    submissionPath: "quick_submit",
                    updatedAt: "2026-07-21T12:00:00.000Z",
                }}
                onQuickSubmitTranscript={onQuickSubmitTranscript}
                onReviewedSubmitTranscript={onReviewedSubmitTranscript}
                onSwitchToText={vi.fn()}
            />,
        );

        expect(screen.getByRole("textbox", { name: "Your transcript is ready" })).toHaveAttribute("readonly");
        fireEvent.click(screen.getByRole("button", { name: "Continue submitting answer" }));
        await waitFor(() => expect(onQuickSubmitTranscript).toHaveBeenCalledOnce());
        expect(onReviewedSubmitTranscript).not.toHaveBeenCalled();
    });

    it("recovers a durable transcript directly into optional review without claiming audio playback", () => {
        const onAnswerModeLockChange = vi.fn();
        render(
            <SessionVoiceAnswerCapture
                mutationBasePath="/candidate/session/session-1"
                questionSlotId="slot-1"
                questionIndex={0}
                initialTranscriptDraft={{
                    status: "voice_transcript_draft",
                    slotId: "slot-1",
                    questionIndex: 0,
                    transcriptText: "Recovered transcript.",
                    sourceTranscriptionRunId: "run-1",
                    submissionPath: "transcript_review",
                    updatedAt: "2026-07-21T12:00:00.000Z",
                }}
                onSwitchToText={vi.fn()}
                onAnswerModeLockChange={onAnswerModeLockChange}
            />,
        );

        expect(screen.getByRole("textbox", { name: "Review your transcript" })).toHaveValue("Recovered transcript.");
        expect(document.querySelector("audio")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Submit answer" })).toBeDisabled();
        expect(onAnswerModeLockChange).toHaveBeenLastCalledWith(true);
    });

    it("offers the typed fallback when recording is unsupported", () => {
        const onSwitchToText = vi.fn();
        const originalMediaRecorder = globalThis.MediaRecorder;
        Object.defineProperty(globalThis, "MediaRecorder", { configurable: true, value: undefined });
        render(
            <SessionVoiceAnswerCapture
                mutationBasePath="/candidate/session/session-1"
                questionSlotId="slot-1"
                questionIndex={0}
                onSwitchToText={onSwitchToText}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
        expect(screen.getByRole("alert")).toHaveTextContent("Voice recording isn't available in this browser");
        fireEvent.click(screen.getByRole("button", { name: "Type answer" }));
        expect(onSwitchToText).toHaveBeenCalledOnce();
        Object.defineProperty(globalThis, "MediaRecorder", { configurable: true, value: originalMediaRecorder });
    });
});
