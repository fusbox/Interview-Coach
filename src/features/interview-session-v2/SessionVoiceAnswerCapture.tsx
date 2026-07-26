"use client";

import { AlertCircle, Loader2, Mic, RotateCcw, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { VoiceTranscriptDraft } from "./voice-answer-transcription";
import {
    SessionVoiceAnswerBrowserError,
    assertSessionVoiceRecordingBounds,
    createSessionVoiceOperationKeys,
    normalizeSessionVoiceCaptureMimeType,
    requestSessionVoiceTranscript,
    selectSessionVoiceCaptureMimeType,
    type SessionVoiceRecording,
} from "./session-voice-answer-browser";
import { VOICE_TRANSCRIPTION_MAX_DURATION_MS } from "./voice-transcription-media-contract";

type VoiceCapturePhase =
    | "notice"
    | "requesting_permission"
    | "recording"
    | "recorded"
    | "transcribing"
    | "submitting"
    | "review"
    | "failed";

type SessionVoiceAnswerCaptureProps = {
    mutationBasePath: string;
    questionSlotId: string;
    questionIndex: number;
    initialTranscriptDraft?: VoiceTranscriptDraft | null;
    onQuickSubmitTranscript?: (draft: VoiceTranscriptDraft) => Promise<void> | void;
    onReviewedSubmitTranscript?: (input: {
        draft: VoiceTranscriptDraft;
        transcriptText: string;
    }) => Promise<void> | void;
    onSwitchToText: () => void;
    onUnsafeLocalWorkChange?: (hasUnsafeLocalWork: boolean) => void;
    onAnswerModeLockChange?: (isAnswerModeLocked: boolean) => void;
};

export function SessionVoiceAnswerCapture({
    mutationBasePath,
    questionSlotId,
    questionIndex,
    initialTranscriptDraft = null,
    onQuickSubmitTranscript,
    onReviewedSubmitTranscript,
    onSwitchToText,
    onUnsafeLocalWorkChange,
    onAnswerModeLockChange,
}: SessionVoiceAnswerCaptureProps) {
    const [phase, setPhase] = useState<VoiceCapturePhase>(initialTranscriptDraft ? "review" : "notice");
    const [recording, setRecording] = useState<SessionVoiceRecording | null>(null);
    const [transcriptDraft, setTranscriptDraft] = useState<VoiceTranscriptDraft | null>(initialTranscriptDraft);
    const [transcriptText, setTranscriptText] = useState(initialTranscriptDraft?.transcriptText ?? "");
    const [elapsedMs, setElapsedMs] = useState(0);
    const [error, setError] = useState<SessionVoiceAnswerBrowserError | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startedAtRef = useRef(0);
    const stopTimeoutRef = useRef<number | null>(null);
    const timerRef = useRef<number | null>(null);
    const recordingRef = useRef<SessionVoiceRecording | null>(null);
    const lastTranscriptionIntentRef = useRef<"submit_answer" | "review_transcript">("review_transcript");

    const discardRecording = useCallback(() => {
        const currentRecording = recordingRef.current;
        if (currentRecording) URL.revokeObjectURL(currentRecording.playbackUrl);
        recordingRef.current = null;
        setRecording(null);
    }, []);

    const stopMedia = useCallback(() => {
        if (stopTimeoutRef.current !== null) window.clearTimeout(stopTimeoutRef.current);
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        stopTimeoutRef.current = null;
        timerRef.current = null;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }, []);

    useEffect(() => {
        const hasUnsafeLocalWork = phase === "recording" || phase === "recorded" || phase === "transcribing";
        onUnsafeLocalWorkChange?.(hasUnsafeLocalWork);
        if (!hasUnsafeLocalWork) return;
        const warnBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warnBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", warnBeforeUnload);
            onUnsafeLocalWorkChange?.(false);
        };
    }, [onUnsafeLocalWorkChange, phase]);

    useEffect(() => {
        const isAnswerModeLocked = phase === "requesting_permission"
            || phase === "recording"
            || phase === "recorded"
            || phase === "transcribing"
            || phase === "submitting"
            || phase === "review";
        onAnswerModeLockChange?.(isAnswerModeLocked);
        return () => onAnswerModeLockChange?.(false);
    }, [onAnswerModeLockChange, phase]);

    useEffect(() => () => {
        const recorder = recorderRef.current;
        if (recorder?.state === "recording") recorder.stop();
        stopMedia();
        const currentRecording = recordingRef.current;
        if (currentRecording) URL.revokeObjectURL(currentRecording.playbackUrl);
    }, [stopMedia]);

    const startRecording = useCallback(async () => {
        setError(null);
        const requestedMimeType = typeof MediaRecorder === "undefined"
            ? null
            : selectSessionVoiceCaptureMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder));
        if (!requestedMimeType || !navigator.mediaDevices?.getUserMedia) {
            setError(new SessionVoiceAnswerBrowserError(
                "recording_unsupported",
                "Voice recording isn't available in this browser. You can still type your answer.",
                false,
            ));
            setPhase("failed");
            return;
        }

        discardRecording();
        setTranscriptDraft(null);
        setTranscriptText("");
        setPhase("requesting_permission");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: requestedMimeType });
            const actualMimeType = normalizeSessionVoiceCaptureMimeType(recorder.mimeType);
            if (!actualMimeType) {
                stream.getTracks().forEach((track) => track.stop());
                throw new SessionVoiceAnswerBrowserError(
                    "recording_format_unsupported",
                    "This browser's recording format isn't supported here. You can still type your answer.",
                    false,
                );
            }
            streamRef.current = stream;
            recorderRef.current = recorder;
            chunksRef.current = [];
            recorder.addEventListener("dataavailable", (event) => {
                if (event.data.size) chunksRef.current.push(event.data);
            });
            recorder.addEventListener("stop", () => {
                const durationMs = Math.max(1, Date.now() - startedAtRef.current);
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
                stopMedia();
                try {
                    const nextRecording: SessionVoiceRecording = {
                        blob,
                        durationMs,
                        mimeType: actualMimeType,
                        playbackUrl: URL.createObjectURL(blob),
                        operationKeys: createSessionVoiceOperationKeys(),
                    };
                    assertSessionVoiceRecordingBounds(nextRecording);
                    recordingRef.current = nextRecording;
                    setRecording(nextRecording);
                    setPhase("recorded");
                } catch (recordingError) {
                    setError(toBrowserError(recordingError));
                    setPhase("failed");
                }
            }, { once: true });
            recorder.addEventListener("error", () => {
                stopMedia();
                setError(new SessionVoiceAnswerBrowserError(
                    "recording_failed",
                    "I couldn't finish that recording. Try again or type your answer.",
                    true,
                ));
                setPhase("failed");
            }, { once: true });
            startedAtRef.current = Date.now();
            setElapsedMs(0);
            recorder.start(250);
            setPhase("recording");
            timerRef.current = window.setInterval(() => {
                setElapsedMs(Math.min(Date.now() - startedAtRef.current, VOICE_TRANSCRIPTION_MAX_DURATION_MS));
            }, 250);
            stopTimeoutRef.current = window.setTimeout(() => {
                if (recorder.state === "recording") recorder.stop();
            }, VOICE_TRANSCRIPTION_MAX_DURATION_MS);
        } catch (captureError) {
            stopMedia();
            setError(captureError instanceof SessionVoiceAnswerBrowserError
                ? captureError
                : new SessionVoiceAnswerBrowserError(
                    "microphone_unavailable",
                    "I couldn't access your microphone. Check its permission or type your answer instead.",
                    true,
                ));
            setPhase("failed");
        }
    }, [discardRecording, stopMedia]);

    const stopRecording = useCallback(() => {
        const recorder = recorderRef.current;
        if (recorder?.state === "recording") recorder.stop();
    }, []);

    const transcribe = useCallback(async (intent: "submit_answer" | "review_transcript") => {
        if (!recording) return;
        lastTranscriptionIntentRef.current = intent;
        setError(null);
        setPhase("transcribing");
        try {
            const draft = await requestSessionVoiceTranscript({
                mutationBasePath,
                questionSlotId,
                questionIndex,
                recording,
                intent,
            });
            setTranscriptDraft(draft);
            setTranscriptText(draft.transcriptText);
            if (intent === "submit_answer" && onQuickSubmitTranscript) {
                setPhase("submitting");
                await onQuickSubmitTranscript(draft);
                discardRecording();
                return;
            }
            setPhase("review");
        } catch (transcriptionError) {
            setError(toBrowserError(transcriptionError));
            setPhase("failed");
        }
    }, [discardRecording, mutationBasePath, onQuickSubmitTranscript, questionIndex, questionSlotId, recording]);

    const submitRecoveredTranscript = useCallback(async () => {
        if (!transcriptDraft || !transcriptText.trim()) return;
        const isQuickSubmitRecovery = transcriptDraft.submissionPath === "quick_submit";
        if (isQuickSubmitRecovery ? !onQuickSubmitTranscript : !onReviewedSubmitTranscript) return;
        setPhase("submitting");
        setError(null);
        try {
            if (isQuickSubmitRecovery) {
                await onQuickSubmitTranscript!(transcriptDraft);
            } else {
                await onReviewedSubmitTranscript!({
                    draft: transcriptDraft,
                    transcriptText: transcriptText.trim(),
                });
            }
            discardRecording();
        } catch (submissionError) {
            setError(toBrowserError(submissionError));
            setPhase("review");
        }
    }, [discardRecording, onQuickSubmitTranscript, onReviewedSubmitTranscript, transcriptDraft, transcriptText]);

    const isQuickSubmitRecovery = transcriptDraft?.submissionPath === "quick_submit";

    return (
        <div className="session-voice-answer" data-phase={phase}>
            {phase === "notice" ? (
                <div className="session-voice-answer__notice">
                    <Mic size={22} aria-hidden="true" />
                    <div>
                        <h3>Record your answer</h3>
                        <p>
                            Your microphone is used only while you record. Audio is sent to create a transcript.
                            Interview Coach does not keep a separate audio file after it is processed.
                        </p>
                    </div>
                    <button className="candidate-button candidate-button--primary" type="button" onClick={startRecording}>
                        <Mic size={17} aria-hidden="true" />
                        Start recording
                    </button>
                </div>
            ) : null}

            {phase === "requesting_permission" ? (
                <VoiceProgress>Waiting for microphone permission...</VoiceProgress>
            ) : null}

            {phase === "recording" ? (
                <div className="session-voice-answer__recording">
                    <span className="sr-only" role="status" aria-live="polite">Recording started.</span>
                    <span className="session-voice-answer__recording-dot" aria-hidden="true" />
                    <div>
                        <strong>Recording</strong>
                        <span aria-hidden="true">{formatDuration(elapsedMs)} of 3:00</span>
                    </div>
                    <button className="candidate-button candidate-button--primary" type="button" onClick={stopRecording}>
                        <Square size={16} aria-hidden="true" />
                        Stop recording
                    </button>
                </div>
            ) : null}

            {phase === "recorded" && recording ? (
                <div className="session-voice-answer__recorded">
                    <div>
                        <strong>Recording ready</strong>
                        <span>{formatDuration(recording.durationMs)}</span>
                    </div>
                    <audio controls preload="metadata" src={recording.playbackUrl}>
                        Your browser does not support audio playback.
                    </audio>
                    <div className="session-voice-answer__actions">
                        <button
                            className="candidate-button candidate-button--primary"
                            type="button"
                            disabled={!onQuickSubmitTranscript}
                            onClick={() => void transcribe("submit_answer")}
                        >
                            Submit answer
                        </button>
                        <button className="candidate-button candidate-button--secondary" type="button" onClick={() => void startRecording()}>
                            <RotateCcw size={16} aria-hidden="true" />
                            Retry
                        </button>
                        <button className="candidate-button candidate-button--secondary session-voice-answer__review-action" type="button" onClick={() => void transcribe("review_transcript")}>
                            Review
                        </button>
                    </div>
                </div>
            ) : null}

            {phase === "transcribing" ? <VoiceProgress>Preparing your transcript...</VoiceProgress> : null}
            {phase === "submitting" ? <VoiceProgress>Saving your answer...</VoiceProgress> : null}

            {phase === "review" && transcriptDraft ? (
                <div className="session-voice-answer__review">
                    {recording ? (
                        <audio controls preload="metadata" src={recording.playbackUrl}>
                            Your browser does not support audio playback.
                        </audio>
                    ) : null}
                    <label>
                        <span>{isQuickSubmitRecovery ? "Your transcript is ready" : "Review your transcript"}</span>
                        <textarea
                            rows={7}
                            value={transcriptText}
                            readOnly={isQuickSubmitRecovery}
                            onChange={(event) => setTranscriptText(event.target.value)}
                        />
                    </label>
                    <div className="session-voice-answer__actions">
                        <button
                            className="candidate-button candidate-button--primary"
                            type="button"
                            disabled={!transcriptText.trim() || (isQuickSubmitRecovery
                                ? !onQuickSubmitTranscript
                                : !onReviewedSubmitTranscript)}
                            onClick={() => void submitRecoveredTranscript()}
                        >
                            {isQuickSubmitRecovery ? "Continue submitting answer" : "Submit answer"}
                        </button>
                        <button className="candidate-button candidate-button--secondary" type="button" onClick={() => void startRecording()}>
                            <RotateCcw size={16} aria-hidden="true" />
                            Retry
                        </button>
                    </div>
                </div>
            ) : null}

            {phase === "failed" && error ? (
                <div className="session-voice-answer__failure" role="alert">
                    <AlertCircle size={20} aria-hidden="true" />
                    <p>{error.publicMessage}</p>
                    <div className="session-voice-answer__actions">
                        {recording && error.retryable ? (
                            <button className="candidate-button candidate-button--secondary" type="button" onClick={() => void transcribe(lastTranscriptionIntentRef.current)}>
                                Try again
                            </button>
                        ) : (
                            <button className="candidate-button candidate-button--secondary" type="button" onClick={() => void startRecording()}>
                                Record again
                            </button>
                        )}
                        <button className="candidate-button candidate-button--secondary" type="button" onClick={onSwitchToText}>
                            Type answer
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function VoiceProgress({ children }: { children: string }) {
    return (
        <div className="session-voice-answer__progress" role="status" aria-live="polite">
            <Loader2 className="session-live-shell__status-spinner" size={20} aria-hidden="true" />
            <p>{children}</p>
        </div>
    );
}

function formatDuration(milliseconds: number) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function toBrowserError(value: unknown) {
    return value instanceof SessionVoiceAnswerBrowserError
        ? value
        : new SessionVoiceAnswerBrowserError(
            "voice_operation_failed",
            "I couldn't finish that voice answer. Your recording is still here, so you can try again.",
            true,
        );
}
