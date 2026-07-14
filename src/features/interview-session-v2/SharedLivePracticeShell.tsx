"use client";

import {
    Keyboard,
    LogOut,
    Mic,
    Pause,
    Play,
    SendHorizontal,
    Volume2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import {
    getSessionQuestionAudioPrefetchTargets,
    type SessionQuestionAudioLifecycle,
} from "./session-question-audio-contract";
import type { SessionRuntimeFacts } from "./session-runtime-facts";

export type SharedLivePracticeShellProps = {
    facts: SessionRuntimeFacts;
    answerMode: "text" | "voice";
    draftText: string;
    isSubmitting?: boolean;
    statusMessage?: string | null;
    feedbackContent?: ReactNode;
    exitHref?: string;
    exitLabel?: string;
    questionAudio?: SessionQuestionAudioLifecycle;
    questionPlaybackControl?: {
        isPlaying: boolean;
        isLoading: boolean;
        onToggle: () => void;
    };
    onAnswerModeChange?: (mode: "text" | "voice") => void;
    onDraftChange: (text: string) => void;
    onSubmit: () => void;
};

export function SharedLivePracticeShell({
    facts,
    answerMode,
    draftText,
    isSubmitting = false,
    statusMessage,
    feedbackContent,
    exitHref,
    exitLabel,
    questionAudio,
    questionPlaybackControl,
    onAnswerModeChange,
    onDraftChange,
    onSubmit,
}: SharedLivePracticeShellProps) {
    const currentQuestion = facts.questions[facts.currentQuestionIndex] ?? null;
    const questionPosition = currentQuestion ? facts.currentQuestionIndex + 1 : 0;
    const questionTotal = facts.questions.length;
    const progressPercentage = questionTotal > 0
        ? Math.round((questionPosition / questionTotal) * 100)
        : 0;
    const resolvedExitHref = exitHref ?? (
        facts.completionBehavior.kind === "candidate_dashboard"
            ? facts.completionBehavior.dashboardHref
            : undefined
    );
    const resolvedExitLabel = exitLabel ?? (
        facts.completionBehavior.kind === "candidate_dashboard"
            ? "Return to dashboard"
            : "Return to invitation"
    );

    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [currentQuestion?.questionKey]);

    useEffect(() => {
        if (!questionAudio || !currentQuestion) {
            return;
        }

        const targets = getSessionQuestionAudioPrefetchTargets(facts);
        targets.forEach((target) => questionAudio.prefetch(target));
        void questionAudio.playOnce(targets[0]);

        return () => questionAudio.stop?.();
    }, [currentQuestion, facts, questionAudio]);

    if (!currentQuestion) {
        return (
            <main className="candidate-design-system session-live-shell session-live-shell--missing">
                <section className="session-live-shell__missing" role="status">
                    <p className="type-eyebrow">Practice space</p>
                    <h1>Your questions are not available yet.</h1>
                    {resolvedExitHref ? (
                        <a className="candidate-button candidate-button--secondary" href={resolvedExitHref}>
                            <LogOut size={16} aria-hidden="true" />
                            {resolvedExitLabel}
                        </a>
                    ) : null}
                </section>
            </main>
        );
    }

    return (
        <main className="candidate-design-system session-live-shell">
            <header className="session-live-shell__header">
                <div className="session-live-shell__header-row app-grid">
                    <div className="session-live-shell__identity">
                        <p title={facts.targetRole}>{facts.targetRole}</p>
                        <span>Question {questionPosition} of {questionTotal}</span>
                    </div>
                    <div className="session-live-shell__header-actions">
                        <span>{progressPercentage}% complete</span>
                        {resolvedExitHref ? (
                            <a href={resolvedExitHref} aria-label={resolvedExitLabel}>
                                <span>{resolvedExitLabel}</span>
                                <LogOut size={18} aria-hidden="true" />
                            </a>
                        ) : null}
                    </div>
                    <div
                        className="session-live-shell__progress"
                        role="progressbar"
                        aria-label="Practice round progress"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progressPercentage}
                    >
                        <span style={{ width: `${progressPercentage}%` }} />
                    </div>
                </div>
            </header>

            <div className="session-live-shell__workspace app-grid">
                <section className="session-live-shell__question" aria-labelledby="session-live-question-title">
                    <div className="session-live-shell__question-meta">
                        <p className="type-eyebrow">{formatCategory(currentQuestion.category)}</p>
                        {questionPlaybackControl ? (
                            <button
                                type="button"
                                disabled={questionPlaybackControl.isLoading}
                                onClick={questionPlaybackControl.onToggle}
                                aria-label={questionPlaybackControl.isPlaying ? "Stop reading question" : "Read question aloud"}
                            >
                                {questionPlaybackControl.isPlaying ? (
                                    <Pause size={18} aria-hidden="true" />
                                ) : questionPlaybackControl.isLoading ? (
                                    <Volume2 size={18} aria-hidden="true" />
                                ) : (
                                    <Play size={18} aria-hidden="true" />
                                )}
                            </button>
                        ) : null}
                    </div>
                    <h1 id="session-live-question-title">{currentQuestion.questionText}</h1>
                </section>

                <section className="session-live-shell__answer" aria-labelledby="session-live-answer-title">
                    <div className="session-live-shell__answer-header">
                        <div>
                            <p className="type-eyebrow">Your response</p>
                            <h2 id="session-live-answer-title">Answer in the way that works for you.</h2>
                        </div>
                        <div className="session-live-shell__modes" aria-label="Answer mode">
                            <button
                                type="button"
                                aria-pressed={answerMode === "text"}
                                onClick={() => onAnswerModeChange?.("text")}
                            >
                                <Keyboard size={16} aria-hidden="true" />
                                Type
                            </button>
                            <button
                                type="button"
                                aria-pressed={answerMode === "voice"}
                                disabled
                                title="Voice answers are not connected yet"
                            >
                                <Mic size={16} aria-hidden="true" />
                                Record
                            </button>
                        </div>
                    </div>

                    <label className="session-live-shell__field">
                        <span>Type your answer</span>
                        <textarea
                            value={draftText}
                            onChange={(event) => onDraftChange(event.target.value)}
                            rows={8}
                            placeholder="Start your answer here."
                        />
                    </label>

                    <footer className="session-live-shell__answer-footer">
                        <p aria-live="polite">
                            {statusMessage ?? "Your draft saves as you write."}
                        </p>
                        <button
                            className="candidate-button candidate-button--primary"
                            type="button"
                            disabled={!draftText.trim() || isSubmitting}
                            onClick={onSubmit}
                        >
                            <SendHorizontal size={17} aria-hidden="true" />
                            {isSubmitting ? "Submitting..." : "Submit answer"}
                        </button>
                    </footer>
                </section>

                {feedbackContent}
            </div>
        </main>
    );
}

function formatCategory(category: string) {
    return category
        .split("_")
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(" ");
}
