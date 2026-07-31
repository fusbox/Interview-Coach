"use client";

import {
    AlertCircle,
    ArrowRight,
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
    Square,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { CutoutSurface } from "@/components/ui/cutout-surface";
import { IconButton } from "@/components/ui/icon-button";
import { Surface, type SurfaceState } from "@/components/ui/surface";

import { PostAnswerCoachingProgress } from "./PostAnswerCoachingProgress";
import { QuestionAssistanceDisclosure } from "./QuestionAssistanceDisclosure";
import {
    getSessionAnswerMutationPresentation,
    type SessionAnswerMutationPhase,
} from "./session-answer-mutation-contract";
import type {
    SessionQuestionAudioLifecycle,
} from "./session-question-audio-contract";
import type { SessionRuntimeFacts } from "./session-runtime-facts";
import styles from "./SharedLivePracticeShell.module.css";

export type SharedLivePracticeShellProps = {
    facts: SessionRuntimeFacts;
    answerMode: "text" | "voice";
    availableAnswerModes?: ReadonlyArray<"text" | "voice">;
    draftText: string;
    submittedAnswerText?: string;
    answerMutationPhase?: SessionAnswerMutationPhase;
    isVoiceSubmitPreparing?: boolean;
    feedbackContent?: ReactNode;
    voiceAnswerContent?: ReactNode;
    exitHref?: string;
    exitLabel?: string;
    isExitPending?: boolean;
    questionAudio?: SessionQuestionAudioLifecycle;
    questionPlaybackControl?: {
        isPlaying: boolean;
        isLoading: boolean;
        onToggle: () => void;
    };
    answerModeChangeDisabled?: boolean;
    interactionGateActive?: boolean;
    onAnswerModeChange?: (mode: "text" | "voice") => void;
    onExit?: () => void;
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
    submittedAnswerText = draftText,
    answerMutationPhase = "idle",
    isVoiceSubmitPreparing = false,
    feedbackContent,
    voiceAnswerContent,
    exitHref,
    exitLabel,
    isExitPending = false,
    questionAudio,
    questionPlaybackControl,
    answerModeChangeDisabled = false,
    interactionGateActive = false,
    onAnswerModeChange,
    onExit,
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
    const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);
    const questionSurfaceRef = useRef<HTMLDivElement | null>(null);
    const currentQuestion = facts.questions[facts.currentQuestionIndex] ?? null;
    const nextQuestion = facts.questions[facts.currentQuestionIndex + 1] ?? null;
    const audioSessionId = facts.sessionId;
    const currentAudioQuestionKey = currentQuestion?.questionKey ?? null;
    const currentAudioQuestionText = currentQuestion?.questionText ?? null;
    const nextAudioQuestionKey = nextQuestion?.questionKey ?? null;
    const nextAudioQuestionText = nextQuestion?.questionText ?? null;
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
            : undefined
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
    const showAnswerStatus = Boolean(answerStatusMessage);
    const showAnswerModeControls = availableAnswerModes.length > 1
        && !answerPresentation.isAnswerLocked;
    const showSubmittedAnswer = answerPresentation.isAnswerLocked;
    const isAnswerAwaitingAcceptance = answerMutationPhase === "submitting";
    const lockedAnswerLabel = isAnswerAwaitingAcceptance ? "Saving answer" : "Answer saved";
    const isInvitedSession = facts.audience === "invited_candidate";
    const composerState = toSurfaceState(answerStatusTone, answerPresentation.isBusy);

    useEffect(() => {
        window.scrollTo({ top: 0 });
        questionHeadingRef.current?.focus();
    }, [currentQuestion?.questionKey]);

    useEffect(() => {
        if (!questionAudio || !currentAudioQuestionKey || !currentAudioQuestionText) {
            return;
        }

        const targets = [{
            sessionId: audioSessionId,
            questionKey: currentAudioQuestionKey,
            questionText: currentAudioQuestionText,
        }, ...(nextAudioQuestionKey && nextAudioQuestionText ? [{
            sessionId: audioSessionId,
            questionKey: nextAudioQuestionKey,
            questionText: nextAudioQuestionText,
        }] : [])];
        targets.forEach((target) => questionAudio.prefetch(target));
        void questionAudio.playOnce(targets[0]);

        return () => questionAudio.stop?.();
    }, [
        audioSessionId,
        currentAudioQuestionKey,
        currentAudioQuestionText,
        nextAudioQuestionKey,
        nextAudioQuestionText,
        questionAudio,
    ]);

    if (!currentQuestion) {
        return (
            <main className={styles.missingShell}>
                <Surface
                    as="section"
                    className={styles.missing}
                    prominence="calm"
                    role="status"
                >
                    <p className="type-eyebrow">Practice space</p>
                    <h1>Your questions are not available yet.</h1>
                    {resolvedExitHref && resolvedExitLabel ? (
                        <Button
                            href={resolvedExitHref}
                            emphasis="secondary"
                            density="comfortable"
                            shape="app"
                        >
                            <LayoutDashboard size={17} aria-hidden="true" />
                            {resolvedExitLabel}
                        </Button>
                    ) : null}
                </Surface>
            </main>
        );
    }

    const assistanceEndpoint = facts.audience === "invited_candidate"
        ? `/candidate/invited/session/${encodeURIComponent(facts.sessionId)}/question-assistance`
        : `/candidate/session/${encodeURIComponent(facts.sessionId)}/question-assistance`;
    const assistanceControls = !showSubmittedAnswer ? (
        <QuestionAssistanceDisclosure
            key={currentQuestion.questionKey}
            anchorRef={questionSurfaceRef}
            disabled={interactionGateActive || answerModeChangeDisabled || answerPresentation.isBusy}
            endpoint={assistanceEndpoint}
            questionKey={currentQuestion.questionKey}
        />
    ) : undefined;
    const answerModeControls = showAnswerModeControls && !interactionGateActive ? (
        <div className={styles.modeControls} role="group" aria-label="Answer mode">
            {availableAnswerModes.map((mode) => (
                <IconButton
                    key={mode}
                    label={mode === "text" ? "Type" : "Record"}
                    title={mode === "text" ? "Type answer" : "Record answer"}
                    tone="primary"
                    pressed={answerMode === mode}
                    disabled={answerModeChangeDisabled || !onAnswerModeChange}
                    onClick={() => onAnswerModeChange?.(mode)}
                >
                    {mode === "text" ? (
                        <Keyboard size={17} aria-hidden="true" />
                    ) : (
                        <Mic size={17} aria-hidden="true" />
                    )}
                </IconButton>
            ))}
        </div>
    ) : undefined;
    const playbackLabel = questionPlaybackControl?.isPlaying
        ? "Stop reading question"
        : questionPlaybackControl?.isLoading
            ? "Loading question audio"
            : "Read question aloud";

    return (
        <>
            <main className={styles.shell} data-interaction-gated={interactionGateActive || undefined}>
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div className={styles.headerTop}>
                        <div className={styles.identity}>
                            <p title={facts.targetRole}>{facts.targetRole}</p>
                            <span>Question {questionPosition} of {questionTotal}</span>
                        </div>
                        <div className={styles.headerActions}>
                            {onExit && resolvedExitLabel ? (
                                <Button
                                    className={styles.exitButton}
                                    emphasis="secondary"
                                    density="compact"
                                    shape="pill"
                                    loading={isExitPending}
                                    disabled={interactionGateActive || isExitPending}
                                    onClick={onExit}
                                    aria-label={resolvedExitLabel}
                                >
                                    <span className={styles.exitText}>
                                        {isExitPending
                                            ? "Saving..."
                                            : isInvitedSession
                                                ? "Pause"
                                                : "Dashboard"}
                                    </span>
                                    {isInvitedSession ? (
                                        <Pause size={17} aria-hidden="true" />
                                    ) : (
                                        <LayoutDashboard size={17} aria-hidden="true" />
                                    )}
                                </Button>
                            ) : resolvedExitHref && resolvedExitLabel ? (
                                <Button
                                    className={styles.exitButton}
                                    href={resolvedExitHref}
                                    emphasis="secondary"
                                    density="compact"
                                    shape="pill"
                                    aria-label={resolvedExitLabel}
                                >
                                    <span className={styles.exitText}>Dashboard</span>
                                    <LayoutDashboard size={17} aria-hidden="true" />
                                </Button>
                            ) : null}
                        </div>
                    </div>
                    <div
                        className={styles.progress}
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

            <div className={styles.workspace}>
                <CutoutSurface
                    ref={questionSurfaceRef}
                    className={styles.question}
                    tone="question"
                    cutout="top-end"
                    notch={assistanceControls}
                    notchLabel={assistanceControls ? "Question assistance" : undefined}
                    aria-labelledby="session-live-question-title"
                >
                    <section className={styles.questionBody}>
                        <div className={styles.questionMeta}>
                            <p className={styles.category}>{formatCategory(currentQuestion.category)}</p>
                        </div>
                        <h1
                            id="session-live-question-title"
                            ref={questionHeadingRef}
                            tabIndex={-1}
                        >
                            {currentQuestion.questionText}
                        </h1>
                        {questionPlaybackControl ? (
                            <IconButton
                                className={styles.audioControl}
                                label={playbackLabel}
                                title={playbackLabel}
                                tone="primary"
                                pressed={questionPlaybackControl.isPlaying}
                                disabled={interactionGateActive || questionPlaybackControl.isLoading}
                                onClick={questionPlaybackControl.onToggle}
                            >
                                {questionPlaybackControl.isPlaying ? (
                                    <Square size={15} aria-hidden="true" />
                                ) : questionPlaybackControl.isLoading ? (
                                    <Loader2 className={styles.spinner} size={17} aria-hidden="true" />
                                ) : (
                                    <Play size={17} aria-hidden="true" />
                                )}
                            </IconButton>
                        ) : questionAudio ? (
                            <p className={styles.audioFallback}>
                                Audio is unavailable. Use the question shown here.
                            </p>
                        ) : null}
                    </section>
                </CutoutSurface>

                <CutoutSurface
                    className={styles.composer}
                    tone="composer"
                    cutout="bottom-start"
                    notch={answerModeControls}
                    notchLabel={answerModeControls ? "Answer mode" : undefined}
                    state={composerState}
                    aria-labelledby="session-live-answer-title"
                    aria-busy={answerPresentation.isBusy}
                    data-answer-state={showSubmittedAnswer ? "submitted" : "draft"}
                    data-answer-mode={answerMode}
                >
                    {interactionGateActive ? (
                        <div className={styles.composerGateSurface} aria-hidden="true" />
                    ) : null}
                    <section className={styles.composerContent}>
                        <div className={styles.answerHeader} data-voice={answerMode === "voice"}>
                            <h2 id="session-live-answer-title">Your answer</h2>
                        </div>

                        {showSubmittedAnswer ? (
                            feedbackContent ? (
                                <details className={`${styles.submittedAnswer} ${styles.submittedDisclosure}`}>
                                    <summary>
                                        <span>
                                            <CheckCircle2 size={16} aria-hidden="true" />
                                            Review your saved answer
                                        </span>
                                        <ChevronDown size={17} aria-hidden="true" />
                                    </summary>
                                    <p>{submittedAnswerText}</p>
                                </details>
                            ) : (
                                <div
                                    className={styles.submittedAnswer}
                                    aria-label={isAnswerAwaitingAcceptance
                                        ? "Answer being saved"
                                        : "Submitted answer"}
                                >
                                    <div>
                                        {isAnswerAwaitingAcceptance ? (
                                            <Loader2 className={styles.spinner} size={16} aria-hidden="true" />
                                        ) : (
                                            <CheckCircle2 size={16} aria-hidden="true" />
                                        )}
                                        <span>{lockedAnswerLabel}</span>
                                    </div>
                                    {submittedAnswerText ? <p>{submittedAnswerText}</p> : null}
                                </div>
                            )
                        ) : answerMode === "voice" && voiceAnswerContent ? (
                            voiceAnswerContent
                        ) : (
                            <label className={styles.field}>
                                <textarea
                                    value={draftText}
                                    onChange={(event) => onDraftChange(event.target.value)}
                                    onBlur={onDraftBlur}
                                    aria-label="Type your answer"
                                    aria-describedby={showAnswerStatus ? "session-live-answer-status" : undefined}
                                    rows={8}
                                    placeholder="Type your answer here."
                                />
                            </label>
                        )}

                        {answerMode === "voice" && !showSubmittedAnswer ? null : (
                            <footer className={styles.answerFooter}>
                                {showAnswerStatus ? (
                                    <div
                                        id="session-live-answer-status"
                                        className={styles.answerStatus}
                                        data-tone={answerStatusTone}
                                        role={answerStatusTone === "error" ? "alert" : "status"}
                                        aria-live={answerStatusTone === "error" ? "assertive" : "polite"}
                                    >
                                        <span aria-hidden="true">
                                            {answerStatusTone === "progress" ? (
                                                <Loader2 className={styles.spinner} size={16} />
                                            ) : answerStatusTone === "success" ? (
                                                <CheckCircle2 size={16} />
                                            ) : answerStatusTone === "error" ? (
                                                <AlertCircle size={16} />
                                            ) : null}
                                        </span>
                                        <p>{answerStatusMessage}</p>
                                        {answerPresentation.canRetryDraftSave && onRetryDraftSave ? (
                                            <Button
                                                className={styles.retrySave}
                                                emphasis="link"
                                                density="compact"
                                                onClick={onRetryDraftSave}
                                            >
                                                Try saving again
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : null}
                                {answerPresentation.primaryAction || answerPresentation.secondaryAction ? (
                                    <div className={styles.answerActions}>
                                        {answerPresentation.secondaryAction === "continue_without_coaching" ? (
                                            <Button
                                                emphasis="secondary"
                                                density="comfortable"
                                                shape="app"
                                                disabled={!onContinueWithoutCoaching || isContinuingWithoutCoaching}
                                                loading={isContinuingWithoutCoaching}
                                                onClick={onContinueWithoutCoaching}
                                            >
                                                <ArrowRight size={17} aria-hidden="true" />
                                                {isContinuingWithoutCoaching
                                                    ? "Finishing practice..."
                                                    : continueWithoutCoachingLabel}
                                            </Button>
                                        ) : null}
                                        {answerPresentation.primaryAction ? (
                                            <Button
                                                emphasis="primary"
                                                density="comfortable"
                                                shape="app"
                                                loading={answerPresentation.isBusy || isContinuingWithoutCoaching}
                                                disabled={
                                                    (primaryRequiresDraft && !draftText.trim())
                                                    || answerPresentation.isBusy
                                                    || isContinuingWithoutCoaching
                                                    || !answerPrimaryHandler
                                                }
                                                onClick={answerPrimaryHandler}
                                            >
                                                {answerPresentation.primaryAction === "continue_without_coaching"
                                                    && isContinuingWithoutCoaching
                                                    ? "Finishing practice..."
                                                    : answerPrimaryLabel}
                                                {answerPresentation.primaryAction === "retry_analysis"
                                                    || answerPresentation.primaryAction === "check_analysis"
                                                    || answerPresentation.primaryAction === "restore_analysis" ? (
                                                    <RefreshCw size={17} aria-hidden="true" />
                                                ) : answerPresentation.primaryAction === "continue_without_coaching" ? (
                                                    <ArrowRight size={17} aria-hidden="true" />
                                                ) : (
                                                    <SendHorizontal size={17} aria-hidden="true" />
                                                )}
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </footer>
                        )}
                    </section>
                </CutoutSurface>

                {feedbackContent}

                <p className={styles.visibility}>
                    {isInvitedSession
                        ? "Your submitted answers may be visible to the recruiter who invited you."
                        : "Private coaching is not shared with recruiters."}
                </p>
            </div>
            </main>
            <PostAnswerCoachingProgress
                phase={answerMutationPhase}
                answerMode={answerMode}
                isVoiceSubmitPreparing={isVoiceSubmitPreparing}
            />
        </>
    );
}

function toSurfaceState(
    tone: "neutral" | "progress" | "success" | "error",
    isBusy: boolean,
): SurfaceState {
    if (isBusy || tone === "progress") {
        return "loading";
    }
    if (tone === "success") {
        return "success";
    }
    if (tone === "error") {
        return "critical";
    }
    return "default";
}

function formatCategory(category: string) {
    return category
        .split("_")
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(" ");
}
