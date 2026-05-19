"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Keyboard, Lightbulb, Loader2, Mic, Pause, Play, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { answerTextareaClassName } from "@/components/patterns/FormField";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { SessionPromptShell } from "@/components/patterns/SessionPromptShell";
import { Button } from "@/components/ui/button";
import { audioEngine } from "@/features/audio/audio-engine";
import AudioVisualizer from "@/features/audio/components/AudioVisualizer";
import { useAudioRecording } from "@/features/audio/hooks/useAudioRecording";
import { useTextToSpeech } from "@/features/audio/hooks/useTextToSpeech";
import { CategoryTooltip } from "@/features/session/components/CategoryTooltip";
import { CoachLensDropdown } from "@/features/session/components/CoachLensDropdown";
import { FeedbackDrawer } from "@/features/session/components/FeedbackDrawer";
import { MultiStepLoader } from "@/features/session/components/MultiStepLoader";
import { useSmartHints } from "@/features/session/hooks/useSmartHints";
import { useStrongResponse } from "@/features/session/hooks/useStrongResponse";
import { cn } from "@/lib/cn";
import type { AnalysisResult, Question } from "@/lib/domain/types";

type CandidateActiveQuestionWorkspaceProps = {
    sessionId: string;
    role: string;
    currentQuestion: Question;
    nextQuestion: Question | null;
    isLastQuestion: boolean;
    advanceAction: () => Promise<void>;
    retryQuestionAction: () => Promise<void>;
};

type SubmittedFeedbackState = {
    analysis: AnalysisResult;
    transcript: string;
    audioBlob: Blob | null;
};

export function CandidateActiveQuestionWorkspace({
    sessionId,
    role,
    currentQuestion,
    nextQuestion,
    isLastQuestion,
    advanceAction,
    retryQuestionAction,
}: CandidateActiveQuestionWorkspaceProps) {
    const router = useRouter();
    const [mode, setMode] = useState<"voice" | "text">("voice");
    const [answerText, setAnswerText] = useState("");
    const [hintOpen, setHintOpen] = useState(false);
    const [strongResponseOpen, setStrongResponseOpen] = useState(false);
    const [showLoader, setShowLoader] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [liveMessage, setLiveMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [submittedFeedback, setSubmittedFeedback] = useState<SubmittedFeedbackState | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const {
        isRecording,
        isInitializing: isRecordingInitializing,
        audioBlob,
        mediaStream,
        permissionError,
        permissionMessage,
        startRecording,
        stopRecording,
        warmUp,
        resetAudio,
    } = useAudioRecording();
    const {
        isPlaying,
        isLoading: isTtsLoading,
        speak,
        stop: stopSpeaking,
        prefetch,
    } = useTextToSpeech();

    const questionText = currentQuestion.text;
    const { hints, isLoading: hintsLoading } = useSmartHints(currentQuestion, sessionId, undefined, role);
    const {
        data: strongResponse,
        isLoading: strongResponseLoading,
        fetchStrongResponse,
    } = useStrongResponse(currentQuestion.id, currentQuestion.text, sessionId, undefined, role);

    useEffect(() => {
        setHintOpen(false);
        setStrongResponseOpen(false);
        setAnswerText("");
        setErrorMessage(null);
        setSubmittedFeedback(null);
        resetAudio();
        setLiveMessage("Question loaded.");
        // Only reset when the question changes. Microphone warm-up can change
        // resetAudio's identity and should not close the coach lens panels.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentQuestion.id]);

    useEffect(() => {
        prefetch(currentQuestion.id, currentQuestion.text, { sessionId });
        if (nextQuestion) {
            prefetch(nextQuestion.id, nextQuestion.text, { sessionId });
        }
    }, [currentQuestion.id, currentQuestion.text, nextQuestion, prefetch, sessionId]);

    useEffect(() => {
        if (permissionError && permissionMessage) {
            setErrorMessage(permissionMessage);
            setLiveMessage(permissionMessage);
        }
    }, [permissionError, permissionMessage]);

    useEffect(() => {
        if (mode !== "voice" || isRecording || audioBlob) {
            return;
        }

        void warmUp();
    }, [audioBlob, isRecording, mode, warmUp]);

    async function handleTogglePlayback() {
        await audioEngine.unlock();
        if (isPlaying) {
            stopSpeaking();
            setLiveMessage("Question audio stopped.");
            return;
        }

        speak(questionText, currentQuestion.id, { sessionId });
        setLiveMessage("Reading question.");
    }

    async function handleToggleRecording() {
        await audioEngine.unlock();

        if (isRecording) {
            await stopRecording();
            setLiveMessage("Recording stopped.");
            return;
        }

        setErrorMessage(null);
        await startRecording();
        setLiveMessage("Recording started.");
    }

    function switchToTextMode() {
        audioEngine.unlock();
        setMode("text");
        resetAudio();
        setErrorMessage(null);
        setTimeout(() => textareaRef.current?.focus(), 0);
    }

    function switchToVoiceMode() {
        audioEngine.unlock();
        setMode("voice");
        setAnswerText("");
        setErrorMessage(null);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const value = mode === "voice" ? "" : answerText;
        if (mode === "text" && !value.trim()) {
            const message = "Enter an answer before submitting.";
            setErrorMessage(message);
            setLiveMessage(message);
            return;
        }

        if (mode === "voice" && !value.trim() && !audioBlob) {
            const message = "We could not hear your response clearly. Try again or switch to text mode.";
            setErrorMessage(message);
            setLiveMessage(message);
            return;
        }

        setErrorMessage(null);
        setIsSubmitting(true);
        setShowLoader(true);
        setLiveMessage("Answer submitted. Coach analysis is in progress.");

        try {
            const result = await submitAnswerToSharedSessionApi({
                sessionId,
                questionId: currentQuestion.id,
                answerText: value,
                modality: mode,
                audioBlob: mode === "voice" ? audioBlob : null,
            });
            if (result?.analysis) {
                setSubmittedFeedback({
                    analysis: result.analysis,
                    transcript: result.transcript || value,
                    audioBlob: mode === "voice" ? audioBlob : null,
                });
                setShowLoader(false);
                setLiveMessage("Feedback is ready.");
            } else {
                router.refresh();
            }
        } catch {
            setShowLoader(false);
            const message = "There was an error submitting your answer. Please try again.";
            setErrorMessage(message);
            setLiveMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {liveMessage}
            </div>
            <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
                {errorMessage || ""}
            </div>
            <div className="flex-1 w-full flex flex-row overflow-hidden relative">
                <div className="flex-1 flex flex-col items-center transition-all duration-700 ease-in-out overflow-y-auto custom-scrollbar">
                    <div className="w-full max-w-4xl flex flex-col">
                        <div className="grow-0 shrink-0 p-4 md:p-6 lg:p-10 w-full transition-all duration-500 ease-in-out cursor-default">
                            <SessionPromptShell
                                footer={
                                    <div className="flex min-h-12 w-auto items-center gap-2 md:min-h-10 md:gap-4">
                                        <div className="flex flex-1 justify-start gap-4">
                                            <Button
                                                type="button"
                                                onClick={() => {
                                                    audioEngine.unlock();
                                                    setHintOpen((isOpen) => !isOpen);
                                                    setStrongResponseOpen(false);
                                                }}
                                                density="compact"
                                                shape="square"
                                                label="strong"
                                                aria-pressed={hintOpen}
                                                className={cn(
                                                    "shrink-0 gap-2 border",
                                                    hintOpen
                                                        ? "border-brand-deep bg-brand-deep text-text-inverse shadow-lg hover:bg-brand-deep hover:text-text-inverse"
                                                        : "border-state-info/20 bg-state-info/10 text-state-info hover:bg-state-info/20",
                                                )}
                                            >
                                                <Lightbulb size={18} />
                                                <span className="hidden sm:inline">Hints</span>
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={() => {
                                                    audioEngine.unlock();
                                                    void fetchStrongResponse();
                                                    setStrongResponseOpen((isOpen) => !isOpen);
                                                    setHintOpen(false);
                                                }}
                                                density="compact"
                                                shape="square"
                                                label="strong"
                                                aria-pressed={strongResponseOpen}
                                                className={cn(
                                                    "shrink-0 gap-2 border",
                                                    strongResponseOpen
                                                        ? "border-accent-alt bg-accent-alt text-text-inverse shadow-lg hover:bg-accent-alt hover:text-text-inverse"
                                                        : "border-accent-alt/20 bg-accent-alt/10 text-accent-alt hover:bg-accent-alt/20",
                                                )}
                                            >
                                                <Sparkles size={18} />
                                                <span className="hidden sm:inline">Example</span>
                                            </Button>
                                        </div>

                                        <div className="flex flex-none items-center justify-center gap-2 md:gap-3">
                                            <div className="flex gap-1 rounded-full border border-border bg-surface-subtle/50 p-1 shadow-flat">
                                                <Button
                                                    type="button"
                                                    onClick={switchToVoiceMode}
                                                    density="compact"
                                                    shape="pill"
                                                    aria-label="Voice mode"
                                                    aria-pressed={mode === "voice"}
                                                    className={cn(
                                                        "px-3",
                                                        mode === "voice"
                                                            ? "bg-brand-deep text-text-inverse shadow-md ring-1 ring-brand-deep hover:bg-brand-deep hover:text-text-inverse"
                                                            : "bg-surface-base text-state-info shadow-sm hover:bg-state-info hover:text-primary-foreground",
                                                    )}
                                                >
                                                    <Mic size={18} />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    onClick={switchToTextMode}
                                                    density="compact"
                                                    shape="pill"
                                                    aria-label="Text mode"
                                                    aria-pressed={mode === "text"}
                                                    className={cn(
                                                        "px-3",
                                                        mode === "text"
                                                            ? "bg-brand-deep text-text-inverse shadow-md ring-1 ring-brand-deep hover:bg-brand-deep hover:text-text-inverse"
                                                            : "bg-surface-base text-state-info shadow-sm hover:bg-state-info hover:text-primary-foreground",
                                                    )}
                                                >
                                                    <Keyboard size={18} />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex flex-1 justify-end">
                                            <Button
                                                type="button"
                                                onClick={handleTogglePlayback}
                                                disabled={isTtsLoading}
                                                size="icon"
                                                shape="pill"
                                                className={cn(
                                                    isPlaying
                                                        ? "bg-brand-deep text-text-inverse border-brand-deep scale-105 shadow-floating"
                                                        : "bg-surface-subtle/50 text-state-info border-border/50 hover:bg-surface-subtle/80 hover:scale-105",
                                                )}
                                                aria-label={isPlaying ? "Stop reading" : "Read question"}
                                            >
                                                {isPlaying ? <Pause size={18} className="animate-pulse" /> : <Play size={18} />}
                                            </Button>
                                        </div>
                                    </div>
                                }
                            >
                                <div className="flex justify-start mb-6">
                                    <CategoryTooltip category={currentQuestion.category}>
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-deep text-micro font-bold uppercase tracking-wider text-text-inverse cursor-help transition-colors">
                                            {currentQuestion.category.toUpperCase()}
                                        </span>
                                    </CategoryTooltip>
                                </div>

                                <SectionHeader
                                    title={<span className="tracking-normal">{questionText}</span>}
                                    className="mb-10"
                                />

                                {errorMessage ? (
                                    <div className="mb-6 rounded-2xl border border-state-critical/20 bg-state-critical/10 p-4 text-sm font-semibold text-state-critical">
                                        {errorMessage}
                                    </div>
                                ) : null}
                            </SessionPromptShell>
                        </div>

                        {(hintOpen || strongResponseOpen) ? (
                            <div className="px-4 md:px-6 lg:px-10 w-full">
                                <div className="py-2">
                                    <CoachLensDropdown
                                        mode={hintOpen ? "hints" : "example"}
                                        tips={hints}
                                        strongResponse={strongResponse}
                                        isLoading={hintOpen ? hintsLoading : strongResponseLoading}
                                    />
                                </div>
                            </div>
                        ) : null}

                        <div
                            className={cn(
                                "flex-1 flex flex-col items-center p-4 md:p-6 lg:p-10 py-1 md:py-2 w-full min-h-0 relative",
                                mode === "voice" ? "justify-start" : "justify-center",
                            )}
                        >
                            <form onSubmit={handleSubmit} className="w-full">
                                <input type="hidden" name="answerText" value={mode === "voice" ? "" : answerText} aria-label="Answer text" />
                                {mode === "voice" ? (
                                    <div className="w-full flex flex-col items-center gap-8">
                                        <div className="flex flex-col items-center justify-center gap-6">
                                            <div className="relative flex justify-center items-center">
                                                {!audioBlob || isRecording ? (
                                                    <button
                                                        type="button"
                                                        onClick={handleToggleRecording}
                                                        disabled={isRecordingInitializing}
                                                        aria-label="Record answer"
                                                        className={cn(
                                                            "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl",
                                                            isRecording
                                                                ? "bg-rose-50 text-rose-800 border-4 border-rose-200"
                                                                : "bg-brand-deep text-text-inverse hover:bg-brand-deep/90 hover:scale-105",
                                                        )}
                                                    >
                                                        {isRecordingInitializing ? (
                                                            <Loader2 className="animate-spin w-8 h-8" />
                                                        ) : (
                                                            <Mic size={32} className={cn(isRecording && "animate-pulse")} />
                                                        )}
                                                    </button>
                                                ) : (
                                                    <div className="flex gap-4 items-center animate-in fade-in zoom-in duration-300">
                                                        <Button
                                                            type="button"
                                                            onClick={() => {
                                                                resetAudio();
                                                            }}
                                                            emphasis="secondary"
                                                            density="hero"
                                                            shape="app"
                                                            label="strong"
                                                            className="h-14 px-8 text-base"
                                                        >
                                                            Retry
                                                        </Button>
                                                        <Button
                                                            type="submit"
                                                            disabled={isSubmitting}
                                                            emphasis="primary"
                                                            density="hero"
                                                            shape="app"
                                                            label="strong"
                                                            className="h-14 min-w-40 px-10 text-base shadow-lg"
                                                        >
                                                            Submit Recording
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-sm font-semibold text-text-secondary tracking-wide">
                                                {isRecording ? "Listening..." : audioBlob ? "Audio Captured" : "Tap to record; tap again to stop"}
                                            </p>
                                        </div>
                                        <div className="h-48 w-full flex items-center justify-center">
                                            {isRecording ? (
                                                <AudioVisualizer
                                                    stream={mediaStream}
                                                    isRecording={isRecording}
                                                    className="w-full h-full"
                                                />
                                            ) : null}
                                        </div>
                                    </div>
                                ) : (
                                    <textarea
                                        ref={textareaRef}
                                        id="session-answer-text"
                                        name="sessionAnswer"
                                        aria-label="Type your answer"
                                        className={answerTextareaClassName}
                                        placeholder="Type your answer here..."
                                        value={answerText}
                                        onChange={(event) => setAnswerText(event.target.value)}
                                    />
                                )}

                                {mode === "text" ? (
                                    <footer className="mt-6 shrink-0 border-t border-border bg-surface-base/40 px-4 py-4 backdrop-blur-md md:px-6 lg:px-10">
                                        <div className="flex justify-end">
                                            <Button
                                                type="submit"
                                                disabled={!answerText.trim() || isSubmitting}
                                                emphasis="primary"
                                                density="hero"
                                                shape="app"
                                                label="strong"
                                                className="h-16 px-8 text-lg shadow-xl"
                                            >
                                                Submit Answer <ArrowRight className="ml-2 w-5 h-5" />
                                            </Button>
                                        </div>
                                    </footer>
                                ) : null}
                            </form>
                        </div>
                    </div>
                </div>
            </div>
            <MultiStepLoader
                loading={showLoader}
                duration={mode === "voice" ? 2500 : 3000}
                onComplete={() => undefined}
                loadingStates={
                    mode === "voice"
                        ? [
                            { text: "Taking a look..." },
                            { text: "Reviewing answer content..." },
                            { text: "Noting your speaking delivery..." },
                            { text: "Creating feedback..." },
                        ]
                        : [
                            { text: "Taking a look..." },
                            { text: "Reviewing answer content..." },
                            { text: "Creating feedback..." },
                        ]
                }
            />
            <FeedbackDrawer
                isOpen={Boolean(submittedFeedback)}
                analysis={submittedFeedback?.analysis}
                onNext={advanceAction}
                onRetry={retryQuestionAction}
                isLastQuestion={isLastQuestion}
                transcript={submittedFeedback?.transcript}
                audioBlob={submittedFeedback?.audioBlob}
                sessionId={sessionId}
            />
        </>
    );
}

async function submitAnswerToSharedSessionApi(input: {
    sessionId: string;
    questionId: string;
    answerText: string;
    modality: "text" | "voice";
    audioBlob: Blob | null;
}): Promise<{ analysis?: AnalysisResult; transcript?: string } | null> {
    const submitResponse = await fetch(`/api/session/${input.sessionId}/questions/${input.questionId}/submit`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": buildSubmitIdempotencyKey(input),
        },
        body: JSON.stringify({
            text: input.answerText,
            modality: input.modality,
        }),
    });

    if (!submitResponse.ok) {
        throw new Error("Candidate answer submit failed.");
    }

    const audioData = input.audioBlob ? await blobToAudioData(input.audioBlob) : undefined;
    const analysisResponse = await fetch(`/api/session/${input.sessionId}/questions/${input.questionId}/analysis`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ audioData }),
    });

    if (!analysisResponse.ok) {
        throw new Error("Candidate answer analysis failed.");
    }

    const updatedSession = await analysisResponse.json().catch(() => null);
    const answer = updatedSession?.answers?.[input.questionId];

    return {
        analysis: answer?.analysis,
        transcript: answer?.transcript,
    };
}

function buildSubmitIdempotencyKey(input: {
    sessionId: string;
    questionId: string;
    answerText: string;
    modality: "text" | "voice";
}): string {
    let hash = 0;
    const stableInput = `${input.sessionId}:${input.questionId}:${input.modality}:${input.answerText}`;
    for (let index = 0; index < stableInput.length; index += 1) {
        hash = ((hash << 5) - hash + stableInput.charCodeAt(index)) | 0;
    }

    return `submit:${input.sessionId}:${input.questionId}:${Math.abs(hash)}`;
}

async function blobToAudioData(blob: Blob): Promise<{ base64: string; mimeType: string }> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Unable to read recorded audio."));
        reader.readAsDataURL(blob);
    });
    const [, base64 = ""] = dataUrl.split(",");

    return {
        base64,
        mimeType: blob.type,
    };
}
