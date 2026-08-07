"use client";

import {
    AlertCircle,
    CheckCircle2,
    Loader2,
    Mic,
    Pause,
    Play,
    RotateCcw,
    Square,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import styles from "./SessionVoiceAnswerCapture.module.css";
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
import {
    startSessionVoiceLevelMonitor,
    type SessionVoiceLevelMonitor,
} from "./session-voice-level-monitor";

type VoiceCapturePhase =
    | "notice"
    | "requesting_permission"
    | "recording"
    | "recorded"
    | "transcribing_review"
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
    onInteractionGateChange?: (isInteractionGated: boolean) => void;
    onSubmitProgressChange?: (isPreparingAnswer: boolean) => void;
    onRecordingChange?: (isRecording: boolean) => void;
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
    onInteractionGateChange,
    onSubmitProgressChange,
    onRecordingChange,
}: SessionVoiceAnswerCaptureProps) {
    const [phase, setPhase] = useState<VoiceCapturePhase>(initialTranscriptDraft ? "review" : "notice");
    const [recording, setRecording] = useState<SessionVoiceRecording | null>(null);
    const [transcriptDraft, setTranscriptDraft] = useState<VoiceTranscriptDraft | null>(initialTranscriptDraft);
    const [transcriptText, setTranscriptText] = useState(initialTranscriptDraft?.transcriptText ?? "");
    const [elapsedMs, setElapsedMs] = useState(0);
    const [error, setError] = useState<SessionVoiceAnswerBrowserError | null>(null);
    const [isPlaybackActive, setIsPlaybackActive] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const waveformRef = useRef<HTMLDivElement | null>(null);
    const levelMonitorRef = useRef<SessionVoiceLevelMonitor | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startedAtRef = useRef(0);
    const timerRef = useRef<number | null>(null);
    const recordingRef = useRef<SessionVoiceRecording | null>(null);
    const lastTranscriptionIntentRef = useRef<"submit_answer" | "review_transcript">("review_transcript");

    const stopLevelMonitor = useCallback(() => {
        levelMonitorRef.current?.stop();
        levelMonitorRef.current = null;
    }, []);

    const updateWaveformLevels = useCallback((levels: number[]) => {
        const bars = waveformRef.current?.querySelectorAll<HTMLElement>("[data-voice-level]");
        bars?.forEach((bar, index) => {
            bar.style.setProperty("--voice-level", String(levels[index] ?? 0.08));
        });
    }, []);

    const discardRecording = useCallback(() => {
        audioRef.current?.pause();
        setIsPlaybackActive(false);
        const currentRecording = recordingRef.current;
        if (currentRecording) URL.revokeObjectURL(currentRecording.playbackUrl);
        recordingRef.current = null;
        setRecording(null);
    }, []);

    const stopMedia = useCallback(() => {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        stopLevelMonitor();
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }, [stopLevelMonitor]);

    useEffect(() => {
        const hasUnsafeLocalWork = phase === "recording"
            || phase === "recorded"
            || phase === "transcribing_review"
            || phase === "submitting";
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
        onRecordingChange?.(phase === "recording");
        return () => onRecordingChange?.(false);
    }, [onRecordingChange, phase]);

    useEffect(() => {
        const isAnswerModeLocked = phase === "requesting_permission"
            || phase === "recording"
            || phase === "recorded"
            || phase === "transcribing_review"
            || phase === "submitting"
            || phase === "review";
        onAnswerModeLockChange?.(isAnswerModeLocked);
        return () => onAnswerModeLockChange?.(false);
    }, [onAnswerModeLockChange, phase]);

    useEffect(() => {
        const isInteractionGated = phase === "recorded"
            || phase === "transcribing_review"
            || phase === "submitting"
            || phase === "review";
        onInteractionGateChange?.(isInteractionGated);
        return () => onInteractionGateChange?.(false);
    }, [onInteractionGateChange, phase]);

    useEffect(() => () => {
        const recorder = recorderRef.current;
        if (recorder?.state === "recording") recorder.stop();
        stopMedia();
        const currentRecording = recordingRef.current;
        if (currentRecording) URL.revokeObjectURL(currentRecording.playbackUrl);
        onSubmitProgressChange?.(false);
    }, [onSubmitProgressChange, stopMedia]);

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
            stopLevelMonitor();
            levelMonitorRef.current = startSessionVoiceLevelMonitor({
                stream,
                barCount: 16,
                onLevels: updateWaveformLevels,
            });
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
                setElapsedMs(Date.now() - startedAtRef.current);
            }, 250);
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
    }, [discardRecording, stopLevelMonitor, stopMedia, updateWaveformLevels]);

    const stopRecording = useCallback(() => {
        const recorder = recorderRef.current;
        if (recorder?.state === "recording") recorder.stop();
    }, []);

    const togglePlayback = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) {
            try {
                await audio.play();
                setIsPlaybackActive(true);
            } catch {
                setIsPlaybackActive(false);
            }
        } else {
            audio.pause();
            setIsPlaybackActive(false);
        }
    }, []);

    const transcribe = useCallback(async (intent: "submit_answer" | "review_transcript") => {
        if (!recording) return;
        lastTranscriptionIntentRef.current = intent;
        setError(null);
        const isQuickSubmit = intent === "submit_answer";
        setPhase(isQuickSubmit ? "submitting" : "transcribing_review");
        if (isQuickSubmit) {
            onSubmitProgressChange?.(true);
        }
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
            if (isQuickSubmit && onQuickSubmitTranscript) {
                await onQuickSubmitTranscript(draft);
                discardRecording();
                return;
            }
            setPhase("review");
        } catch (transcriptionError) {
            setError(toBrowserError(transcriptionError));
            setPhase("failed");
        } finally {
            if (isQuickSubmit) {
                onSubmitProgressChange?.(false);
            }
        }
    }, [
        discardRecording,
        mutationBasePath,
        onQuickSubmitTranscript,
        onSubmitProgressChange,
        questionIndex,
        questionSlotId,
        recording,
    ]);

    const submitRecoveredTranscript = useCallback(async () => {
        if (!transcriptDraft || !transcriptText.trim()) return;
        const isQuickSubmitRecovery = transcriptDraft.submissionPath === "quick_submit";
        if (isQuickSubmitRecovery ? !onQuickSubmitTranscript : !onReviewedSubmitTranscript) return;
        setPhase("submitting");
        setError(null);
        onSubmitProgressChange?.(true);
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
        } finally {
            onSubmitProgressChange?.(false);
        }
    }, [
        discardRecording,
        onQuickSubmitTranscript,
        onReviewedSubmitTranscript,
        onSubmitProgressChange,
        transcriptDraft,
        transcriptText,
    ]);

    const isQuickSubmitRecovery = transcriptDraft?.submissionPath === "quick_submit";

    return (
        <div className={`session-voice-answer ${styles.root}`} data-phase={phase}>
            {recording ? (
                <audio
                    ref={audioRef}
                    className={styles.playbackAudio}
                    preload="metadata"
                    src={recording.playbackUrl}
                    onPause={() => setIsPlaybackActive(false)}
                    onPlay={() => setIsPlaybackActive(true)}
                    onEnded={() => setIsPlaybackActive(false)}
                >
                    Your browser does not support audio playback.
                </audio>
            ) : null}

            {phase === "notice" ? (
                <div className={`session-voice-answer__notice ${styles.notice}`}>
                    <div className={styles.recordingHeader}>
                        <span>Tap to record; tap again to stop.</span>
                        <span aria-hidden="true">0:00</span>
                    </div>
                    <div className={`${styles.waveform} ${styles.waveformIdle}`} aria-hidden="true">
                        {Array.from({ length: 16 }, (_, index) => <span key={index} />)}
                    </div>
                    <div className={styles.instrument}>
                        <button
                            className={styles.recordControl}
                            type="button"
                            onClick={startRecording}
                            aria-label="Start recording"
                        >
                            <Mic size={30} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            ) : null}

            {phase === "requesting_permission" ? (
                <VoiceProgress>Waiting for microphone permission...</VoiceProgress>
            ) : null}

            {phase === "recording" ? (
                <div className={`session-voice-answer__recording ${styles.recording}`}>
                    <span className="sr-only" role="status" aria-live="polite">Recording started.</span>
                    <div className={styles.recordingHeader}>
                        <span>
                            <strong>Recording</strong>
                        </span>
                        <span aria-hidden="true">{formatDuration(elapsedMs)}</span>
                    </div>
                    <div ref={waveformRef} className={styles.waveform} aria-hidden="true">
                        {Array.from({ length: 16 }, (_, index) => (
                            <span key={index} data-voice-level />
                        ))}
                    </div>
                    <div className={styles.instrument}>
                        <button
                            className={`${styles.recordControl} ${styles.stopControl}`}
                            type="button"
                            onClick={stopRecording}
                            aria-label="Stop recording"
                        >
                            <Square size={24} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            ) : null}

            {phase === "recorded" && recording ? (
                <div className={`session-voice-answer__recorded ${styles.recorded}`}>
                    <div className={styles.readyState}>
                        <div className={styles.readySummary}>
                            <span className={styles.readyIcon}>
                                <CheckCircle2 size={20} aria-hidden="true" />
                            </span>
                            <div>
                                <strong>Recording captured</strong>
                                <span>{formatDuration(recording.durationMs)}</span>
                            </div>
                        </div>
                        <Button
                            emphasis="secondary"
                            density="compact"
                            shape="pill"
                            type="button"
                            onClick={() => void togglePlayback()}
                        >
                            {isPlaybackActive ? (
                                <Pause size={15} aria-hidden="true" />
                            ) : (
                                <Play size={15} aria-hidden="true" />
                            )}
                            {isPlaybackActive ? "Pause" : "Replay"}
                        </Button>
                    </div>
                    <div className={`session-voice-answer__actions ${styles.actions}`}>
                        <Button
                            emphasis="primary"
                            density="comfortable"
                            shape="pill"
                            type="button"
                            disabled={!onQuickSubmitTranscript}
                            onClick={() => void transcribe("submit_answer")}
                        >
                            Submit answer
                        </Button>
                        <Button emphasis="secondary" density="comfortable" shape="pill" type="button" onClick={() => void startRecording()}>
                            <RotateCcw size={16} aria-hidden="true" />
                            Retry
                        </Button>
                        <Button
                            className={`session-voice-answer__review-action ${styles.reviewAction}`}
                            emphasis="secondary"
                            density="comfortable"
                            shape="pill"
                            type="button"
                            onClick={() => void transcribe("review_transcript")}
                        >
                            Review
                        </Button>
                    </div>
                </div>
            ) : null}

            {phase === "transcribing_review" ? <VoiceProgress>Preparing your transcript...</VoiceProgress> : null}

            {phase === "review" && transcriptDraft ? (
                <div className={`session-voice-answer__review ${styles.review}`}>
                    <div className={styles.reviewHeader}>
                        <span>{isQuickSubmitRecovery ? "Your transcript is ready" : "Review your answer"}</span>
                        {recording ? (
                            <Button
                                emphasis="secondary"
                                density="compact"
                                shape="pill"
                                type="button"
                                onClick={() => void togglePlayback()}
                            >
                                {isPlaybackActive ? (
                                    <Pause size={15} aria-hidden="true" />
                                ) : (
                                    <Play size={15} aria-hidden="true" />
                                )}
                                {isPlaybackActive ? "Pause" : "Replay"}
                            </Button>
                        ) : null}
                    </div>
                    <label>
                        <span className="sr-only">
                            {isQuickSubmitRecovery ? "Your transcript is ready" : "Review your transcript"}
                        </span>
                        <textarea
                            rows={7}
                            value={transcriptText}
                            readOnly={isQuickSubmitRecovery}
                            onChange={(event) => setTranscriptText(event.target.value)}
                        />
                    </label>
                    <div className={`session-voice-answer__actions ${styles.actions} ${styles.reviewActions}`}>
                        <Button emphasis="secondary" density="comfortable" shape="pill" type="button" onClick={() => void startRecording()}>
                            <RotateCcw size={16} aria-hidden="true" />
                            Retry
                        </Button>
                        <Button
                            emphasis="primary"
                            density="comfortable"
                            shape="pill"
                            type="button"
                            disabled={!transcriptText.trim() || (isQuickSubmitRecovery
                                ? !onQuickSubmitTranscript
                                : !onReviewedSubmitTranscript)}
                            onClick={() => void submitRecoveredTranscript()}
                        >
                            {isQuickSubmitRecovery ? "Continue submitting answer" : "Submit answer"}
                        </Button>
                    </div>
                </div>
            ) : null}

            {phase === "failed" && error ? (
                <div className={`session-voice-answer__failure ${styles.failure}`} role="alert">
                    <AlertCircle size={20} aria-hidden="true" />
                    <p>{error.publicMessage}</p>
                    <div className={`session-voice-answer__actions ${styles.actions}`}>
                        {recording && error.retryable ? (
                            <Button emphasis="secondary" density="comfortable" shape="pill" type="button" onClick={() => void transcribe(lastTranscriptionIntentRef.current)}>
                                Try again
                            </Button>
                        ) : (
                            <Button emphasis="secondary" density="comfortable" shape="pill" type="button" onClick={() => void startRecording()}>
                                Record again
                            </Button>
                        )}
                        <Button emphasis="secondary" density="comfortable" shape="pill" type="button" onClick={onSwitchToText}>
                            Type answer
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function VoiceProgress({ children }: { children: string }) {
    return (
        <div className={styles.progress} role="status" aria-live="polite">
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
