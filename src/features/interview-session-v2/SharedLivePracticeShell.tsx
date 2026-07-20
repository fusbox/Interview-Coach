"use client";

import {
    ArrowRight,
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    Keyboard,
    LayoutDashboard,
    Loader2,
    Mic,
    Pause,
    Play,
    RefreshCw,
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
import {
    getSessionAnswerMutationPresentation,
    type SessionAnswerMutationPhase,
} from "./session-answer-mutation-contract";

export type SharedLivePracticeShellProps = {
    facts: SessionRuntimeFacts;
    answerMode: "text" | "voice";
    availableAnswerModes?: ReadonlyArray<"text" | "voice">;
    draftText: string;
    answerMutationPhase?: SessionAnswerMutationPhase;
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
    onDraftBlur?: () => void;
    onRetryDraftSave?: () => void;
    onRetryAnalysis?: () => void;
    onContinueWithoutCoaching?: () => void;
    continueWithoutCoachingLabel?: string;
    isContinuingWithoutCoaching?: boolean;
    continueWithoutCoachingError?: string | null;
    onSubmit: () => void;
};

export function SharedLivePracticeShell({
    facts,
    answerMode,
    availableAnswerModes = [answerMode],
    draftText,
    answerMutationPhase = "idle",
    feedbackContent,
    exitHref,
    exitLabel,
    questionAudio,
    questionPlaybackControl,
    onAnswerModeChange,
    onDraftChange,
    onDraftBlur,
    onRetryDraftSave,
    onRetryAnalysis,
    onContinueWithoutCoaching,
    continueWithoutCoachingLabel = "Continue without coaching",
    isContinuingWithoutCoaching = false,
    continueWithoutCoachingError = null,
    onSubmit,
}: SharedLivePracticeShellProps) {
    const currentQuestion = facts.questions[facts.currentQuestionIndex] ?? null;
    const questionPosition = currentQuestion ? facts.currentQuestionIndex + 1 : 0;
    const questionTotal = facts.questions.length;
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
    const answerPresentation = getSessionAnswerMutationPresentation(answerMutationPhase);
    const answerPrimaryHandler = answerPresentation.primaryAction === "continue_without_coaching"
        ? onContinueWithoutCoaching
        : answerPresentation.primaryAction === "retry_analysis"
            || answerPresentation.primaryAction === "check_analysis"
            || answerPresentation.primaryAction === "restore_analysis"
            ? onRetryAnalysis
            : onSubmit;
    const answerPrimaryLabel = answerPresentation.primaryAction === "continue_without_coaching"
        ? continueWithoutCoachingLabel
        : answerPresentation.primaryLabel;
    const primaryRequiresDraft = answerPresentation.primaryAction === "submit"
        || answerPresentation.primaryAction === "retry_submit";
    const answerStatusTone = continueWithoutCoachingError ? "error" : answerPresentation.tone;
    const answerStatusMessage = continueWithoutCoachingError ?? answerPresentation.message;
    const showAnswerModeControls = availableAnswerModes.length > 1;
    const showSubmittedAnswer = answerPresentation.isAnswerLocked;

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
                            <LayoutDashboard size={16} aria-hidden="true" />
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
                        {resolvedExitHref ? (
                            <a href={resolvedExitHref} aria-label={resolvedExitLabel}>
                                <span>{resolvedExitLabel}</span>
                                <LayoutDashboard size={18} aria-hidden="true" />
                            </a>
                        ) : null}
                    </div>
                    <div
                        className="session-live-shell__progress"
                        role="progressbar"
                        aria-label="Practice round progress"
                        aria-valuemin={1}
                        aria-valuemax={questionTotal}
                        aria-valuenow={questionPosition}
                        aria-valuetext={`Question ${questionPosition} of ${questionTotal}`}
                    >
                        {facts.questions.map((question, index) => (
                            <span
                                key={question.questionKey}
                                data-state={index < facts.currentQuestionIndex
                                    ? "complete"
                                    : index === facts.currentQuestionIndex
                                        ? "current"
                                        : "upcoming"}
                            />
                        ))}
                    </div>
                </div>
            </header>

            <div className="session-live-shell__workspace app-grid">
                <section className="session-live-shell__question" aria-labelledby="session-live-question-title">
                    <div className="session-live-shell__question-meta">
                        <p className="session-live-shell__category">{formatCategory(currentQuestion.category)}</p>
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
                                <span>{questionPlaybackControl.isPlaying ? "Stop reading" : "Read aloud"}</span>
                            </button>
                        ) : null}
                    </div>
                    <h1 id="session-live-question-title">{currentQuestion.questionText}</h1>
                </section>

                <section
                    className="session-live-shell__answer"
                    aria-labelledby="session-live-answer-title"
                    aria-busy={answerPresentation.isBusy}
                    data-state={showSubmittedAnswer ? "submitted" : "draft"}
                >
                    <div className="session-live-shell__answer-header">
                        <h2 id="session-live-answer-title">Your response</h2>
                        {showAnswerModeControls ? (
                            <div className="session-live-shell__modes" aria-label="Answer mode">
                                {availableAnswerModes.map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        aria-pressed={answerMode === mode}
                                        onClick={() => onAnswerModeChange?.(mode)}
                                    >
                                        {mode === "text" ? (
                                            <Keyboard size={16} aria-hidden="true" />
                                        ) : (
                                            <Mic size={16} aria-hidden="true" />
                                        )}
                                        {mode === "text" ? "Type" : "Record"}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    {showSubmittedAnswer ? (
                        feedbackContent ? (
                            <details className="session-live-shell__submitted-answer is-collapsible">
                                <summary>
                                    <span>
                                        <CheckCircle2 size={16} aria-hidden="true" />
                                        Review your saved answer
                                    </span>
                                    <ChevronDown size={17} aria-hidden="true" />
                                </summary>
                                <p>{draftText}</p>
                            </details>
                        ) : (
                            <div className="session-live-shell__submitted-answer" aria-label="Submitted answer">
                                <div>
                                    <CheckCircle2 size={16} aria-hidden="true" />
                                    <span>Answer saved</span>
                                </div>
                                <p>{draftText}</p>
                            </div>
                        )
                    ) : (
                        <label className="session-live-shell__field">
                            <span>Type your answer</span>
                            <textarea
                                value={draftText}
                                onChange={(event) => onDraftChange(event.target.value)}
                                onBlur={onDraftBlur}
                                aria-describedby="session-live-answer-status"
                                rows={8}
                                placeholder="Type your answer here."
                            />
                        </label>
                    )}

                    <footer className="session-live-shell__answer-footer">
                        <div
                            id="session-live-answer-status"
                            className="session-live-shell__answer-status"
                            data-tone={answerStatusTone}
                            role={answerStatusTone === "error" ? "alert" : "status"}
                            aria-live={answerStatusTone === "error" ? "assertive" : "polite"}
                        >
                            <span aria-hidden="true">
                                {answerStatusTone === "progress" ? (
                                    <Loader2 className="session-live-shell__status-spinner" size={16} />
                                ) : answerStatusTone === "success" ? (
                                    <CheckCircle2 size={16} />
                                ) : answerStatusTone === "error" ? (
                                    <AlertCircle size={16} />
                                ) : null}
                            </span>
                            <p>{answerStatusMessage}</p>
                            {answerPresentation.canRetryDraftSave && onRetryDraftSave ? (
                                <button type="button" onClick={onRetryDraftSave}>
                                    Try saving again
                                </button>
                            ) : null}
                        </div>
                        {answerPresentation.primaryAction || answerPresentation.secondaryAction ? (
                            <div className="session-live-shell__answer-actions">
                                {answerPresentation.secondaryAction === "continue_without_coaching" ? (
                                    <button
                                        className="candidate-button candidate-button--secondary"
                                        type="button"
                                        disabled={!onContinueWithoutCoaching || isContinuingWithoutCoaching}
                                        onClick={onContinueWithoutCoaching}
                                    >
                                        <ArrowRight size={17} aria-hidden="true" />
                                        {isContinuingWithoutCoaching ? "Finishing practice..." : continueWithoutCoachingLabel}
                                    </button>
                                ) : null}
                                {answerPresentation.primaryAction ? (
                                    <button
                                        className="candidate-button candidate-button--primary"
                                        type="button"
                                        disabled={
                                            (primaryRequiresDraft && !draftText.trim())
                                            || answerPresentation.isBusy
                                            || isContinuingWithoutCoaching
                                            || !answerPrimaryHandler
                                        }
                                        onClick={answerPrimaryHandler}
                                    >
                                        {answerPresentation.primaryAction === "retry_analysis"
                                            || answerPresentation.primaryAction === "check_analysis"
                                            || answerPresentation.primaryAction === "restore_analysis" ? (
                                            <RefreshCw size={17} aria-hidden="true" />
                                        ) : answerPresentation.primaryAction === "continue_without_coaching" ? (
                                            <ArrowRight size={17} aria-hidden="true" />
                                        ) : (
                                            <SendHorizontal size={17} aria-hidden="true" />
                                        )}
                                        {answerPresentation.primaryAction === "continue_without_coaching"
                                            && isContinuingWithoutCoaching
                                            ? "Finishing practice..."
                                            : answerPrimaryLabel}
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
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
