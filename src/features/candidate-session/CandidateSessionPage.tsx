import Link from "next/link";
import type React from "react";
import { ArrowRight, Play, Sparkles, X } from "lucide-react";

import { SessionPromptShell } from "@/components/patterns/SessionPromptShell";
import { Button } from "@/components/ui/button";
import { isFeedbackFlowAnalysisReady } from "@/lib/domain/analysis-readiness";
import type { AnalysisResult } from "@/lib/domain/types";
import type { LoadedCandidateSession } from "@/lib/server/candidate";
import { CandidateActiveQuestionWorkspace } from "./CandidateActiveQuestionWorkspace";
import { CandidateQuestionPlaybackButton } from "./CandidateQuestionPlaybackButton";
import { CandidateSessionAudioController } from "./CandidateSessionAudioController";
import { CandidateSessionDebugOverlay } from "./CandidateSessionDebugOverlay";
import { CandidateSessionEntryScreen } from "./CandidateSessionEntryScreen";
import { FeedbackDrawer } from "@/features/session/components/FeedbackDrawer";
import { getQuestionCategoryPresentation } from "@/features/session/components/question-category-presentation";
import {
    advanceCandidateSessionAction,
    analyzeCandidateAnswerAction,
    pauseCandidateSessionAction,
    resumeCandidateSessionAction,
    retryCandidateQuestionAction,
    startCandidateSessionAction,
} from "./actions";

type CandidateSessionPageProps = {
    loadedSession: LoadedCandidateSession;
};

export function CandidateSessionPage({ loadedSession }: CandidateSessionPageProps) {
    const { session } = loadedSession;
    const totalQuestions = session.questions.length;
    const displayQuestionIndex = totalQuestions > 0 ? Math.min(Math.max(session.currentQuestionIndex, 0), totalQuestions - 1) : 0;
    const currentQuestion = session.questions[displayQuestionIndex] ?? null;
    const nextQuestion = session.questions[displayQuestionIndex + 1] ?? null;
    const questionPosition = session.status === "COMPLETED" ? totalQuestions : displayQuestionIndex + 1;
    const progressPercentage = session.status === "COMPLETED"
        ? 100
        : totalQuestions > 0
            ? Math.round((Math.max(questionPosition, 1) / totalQuestions) * 100)
            : 0;
    const nextQuestionIndex = displayQuestionIndex + 1;
    const isLastQuestion = nextQuestionIndex >= totalQuestions;
    const nextStatus = isLastQuestion ? "COMPLETED" : "IN_SESSION";
    const currentAnswer = currentQuestion ? session.answers[currentQuestion.id] : undefined;
    const hasSubmittedCurrentAnswer = Boolean(currentAnswer?.submittedAt);
    const currentAnalysis = currentAnswer?.analysis;
    const hasUsableFeedbackFlowAnalysis = isFeedbackFlowAnalysisReady(currentAnalysis);
    const currentQuestionCategory = currentQuestion ? getQuestionCategoryPresentation(currentQuestion.category) : null;
    async function startAction() {
        "use server";
        await startCandidateSessionAction(session.id);
    }

    async function advanceAction() {
        "use server";
        await advanceCandidateSessionAction(session.id, nextQuestionIndex, nextStatus);
    }

    async function pauseAction() {
        "use server";
        await pauseCandidateSessionAction(session.id);
    }

    async function resumeAction() {
        "use server";
        await resumeCandidateSessionAction(session.id);
    }

    async function retryQuestionAction() {
        "use server";
        if (!currentQuestion) {
            return;
        }
        await retryCandidateQuestionAction(session.id, currentQuestion.id);
    }

    async function analyzeAnswerAction() {
        "use server";
        if (!currentQuestion) {
            return;
        }
        await analyzeCandidateAnswerAction(session.id, currentQuestion.id);
    }

    return (
        <main className="candidate-design-system flex min-h-screen flex-col bg-background text-text-primary">
            <CandidateSessionDebugOverlay
                initialEngagedSeconds={session.engagedTimeSeconds}
                analysisPrompt={currentAnalysis?.__debugPrompt}
            />
            <CandidateSessionAudioController
                sessionId={session.id}
                currentQuestion={currentQuestion}
                nextQuestion={nextQuestion}
                shouldAutoPlayCurrent={session.status === "IN_SESSION"}
            />
            {session.status === "NOT_STARTED" ? (
                <CandidateSessionEntryScreen
                    role={session.role}
                    sessionId={session.id}
                    firstQuestion={currentQuestion}
                    startAction={startAction}
                />
            ) : (
                <>
            <header role="banner" className="sticky top-0 z-20 shrink-0 overflow-hidden border-b border-border bg-white/70 backdrop-blur-md">
                <div className="mx-auto w-full max-w-4xl px-4 py-4 pb-3 md:px-6 lg:px-10">
                    <div className="mb-3 flex items-end justify-between gap-4">
                        <div className="flex max-w-[58%] flex-col items-start gap-1">
                            <h1 className="w-full truncate text-sm font-semibold leading-none text-text-primary md:text-base">
                                {session.role}
                            </h1>
                            <span className="text-xs font-bold uppercase tracking-widest text-text-secondary tabular-nums">
                                Question {Math.max(questionPosition, 1)} of {Math.max(totalQuestions, 1)}
                            </span>
                        </div>

                        <div className="flex items-center gap-3 md:gap-6">
                            <span className="whitespace-nowrap text-xs font-bold text-primary md:text-sm">
                                {progressPercentage}% Complete
                            </span>
                            <div className="h-4 w-px bg-border" />
                            {session.status === "PAUSED" ? (
                                <form action={resumeAction}>
                                    <HeaderButton icon={<Play size={16} />} label="Resume session" />
                                </form>
                            ) : session.status === "COMPLETED" ? (
                                <Button asChild variant="ghost" density="compact" shape="pill" label="strong">
                                    <Link href={`/summary/${session.id}`}>Review summary</Link>
                                </Button>
                            ) : (
                                <form action={pauseAction}>
                                    <HeaderButton icon={<X size={16} />} label="Exit session" />
                                </form>
                            )}
                        </div>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle shadow-inner">
                        <div
                            className="h-full rounded-full bg-primary shadow-raised-1 transition-all duration-700 ease-standard"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>
            </header>

            <section className="flex flex-1 flex-col overflow-hidden">
                {session.status === "COMPLETED" ? (
                    <SessionCompleteState sessionId={session.id} role={session.role} />
                ) : session.status === "PAUSED" ? (
                    <SessionPausedState resumeAction={resumeAction} role={session.role} />
                ) : currentQuestion ? (
                    !hasSubmittedCurrentAnswer ? (
                        <CandidateActiveQuestionWorkspace
                            sessionId={session.id}
                            role={session.role}
                            resumeText={session.candidate?.resumeText}
                            currentQuestion={currentQuestion}
                            nextQuestion={nextQuestion}
                            isLastQuestion={isLastQuestion}
                            advanceAction={advanceAction}
                            retryQuestionAction={retryQuestionAction}
                        />
                    ) : (
                        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 md:px-6 lg:px-10">
                            <section className="flex min-h-0 flex-col">
                                <SessionPromptShell
                                    className="min-h-[18rem] opacity-80"
                                    footer={
                                        <div className="flex min-h-12 flex-wrap items-center justify-between gap-3">
                                            <div className="flex flex-wrap gap-3">
                                                <span className="inline-flex items-center gap-2 rounded-xl border border-brand-deep bg-brand-deep px-3 py-2 text-sm font-semibold text-text-inverse shadow-lg">
                                                    Coach&apos;s Lens
                                                </span>
                                                <span className="inline-flex items-center gap-2 rounded-xl border border-state-info/20 bg-state-info/10 px-3 py-2 text-sm font-semibold text-state-info">
                                                    {currentQuestionCategory?.label}
                                                </span>
                                            </div>
                                            <CandidateQuestionPlaybackButton sessionId={session.id} question={currentQuestion} />
                                        </div>
                                    }
                                >
                                    <div className="space-y-8">
                                        <div className="space-y-3">
                                            <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">
                                                Interview prompt
                                            </p>
                                            <h2 className="font-display text-3xl font-bold leading-tight text-text-primary md:text-5xl">
                                                {currentQuestion.text}
                                            </h2>
                                        </div>
                                    </div>
                                </SessionPromptShell>

                                {hasUsableFeedbackFlowAnalysis ? (
                                    <CandidateSubmittedFeedbackReview
                                        sessionId={session.id}
                                        transcript={currentAnswer?.transcript}
                                        analysis={currentAnalysis}
                                        retryQuestionAction={retryQuestionAction}
                                        advanceAction={advanceAction}
                                        isLastQuestion={isLastQuestion}
                                    />
                                ) : (
                                    <FeedbackRecoveryState
                                        analyzeAnswerAction={analyzeAnswerAction}
                                        transcript={currentAnswer?.transcript}
                                    />
                                )}
                            </section>
                        </div>
                    )
                ) : (
                    <div className="mx-auto flex w-full max-w-4xl flex-1 items-center px-6 py-12">
                        <SessionPromptShell>
                            <div className="space-y-3">
                                <h2 className="font-display text-3xl font-bold text-text-primary">Questions are not ready yet.</h2>
                                <p className="text-base leading-7 text-text-secondary">
                                    Return to practice setup and try generating the session again.
                                </p>
                            </div>
                        </SessionPromptShell>
                    </div>
                )}
            </section>
                </>
            )}
        </main>
    );
}
function HeaderButton({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <Button type="submit" variant="ghost" density="compact" shape="pill" label="strong" className="gap-2 text-text-muted hover:text-text-primary">
            <span className="hidden md:inline">{label}</span>
            {icon}
        </Button>
    );
}

function FeedbackRecoveryState({
    analyzeAnswerAction,
    transcript,
}: {
    analyzeAnswerAction: () => Promise<void>;
    transcript?: string;
}) {
    return (
        <SessionPromptShell className="mt-6">
            <div className="space-y-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-text-inverse shadow-raised-2">
                    <Sparkles size={22} />
                </div>
                <div className="space-y-3">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">
                        Feedback recovery
                    </p>
                    <h3 className="font-display text-4xl font-bold leading-tight text-text-primary md:text-6xl">
                        Finish preparing your coaching.
                    </h3>
                    <p className="max-w-2xl text-base leading-7 text-text-secondary">
                        Your answer was saved, but this session needs a fresh feedback pass before it can show the current coaching cards.
                    </p>
                </div>

                {transcript ? (
                    <details className="rounded-2xl border border-border/60 bg-surface-base/70 p-4 text-sm text-text-secondary">
                        <summary className="cursor-pointer font-bold text-text-primary">Review saved answer</summary>
                        <p className="mt-3 whitespace-pre-wrap leading-6">{transcript}</p>
                    </details>
                ) : null}

                <form action={analyzeAnswerAction}>
                    <Button type="submit" emphasis="primary" density="hero" shape="app" label="strong">
                        Regenerate feedback
                        <ArrowRight size={18} className="ml-2" />
                    </Button>
                </form>
            </div>
        </SessionPromptShell>
    );
}

function CandidateSubmittedFeedbackReview({
    sessionId,
    transcript,
    analysis,
    retryQuestionAction,
    advanceAction,
    isLastQuestion,
}: {
    sessionId: string;
    transcript?: string;
    analysis: AnalysisResult;
    retryQuestionAction: () => Promise<void>;
    advanceAction: () => Promise<void>;
    isLastQuestion: boolean;
}) {
    return (
        <FeedbackDrawer
            isOpen={true}
            analysis={analysis}
            onNext={advanceAction}
            onRetry={retryQuestionAction}
            isLastQuestion={isLastQuestion}
            transcript={transcript}
            audioBlob={null}
            sessionId={sessionId}
            showCoachSignal
        />
    );
}

function SessionPausedState({ role, resumeAction }: { role: string; resumeAction: () => Promise<void> }) {
    return (
        <div className="mx-auto flex w-full max-w-4xl flex-1 items-center px-6 py-12">
            <SessionPromptShell>
                <div className="space-y-5">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Practice saved</p>
                    <h2 className="font-display text-4xl font-bold leading-tight text-text-primary md:text-6xl">
                        Pick back up when you are ready.
                    </h2>
                    <p className="text-base leading-7 text-text-secondary">
                        Your {role} practice session is paused with your current progress saved.
                    </p>
                    <form action={resumeAction}>
                        <Button type="submit" emphasis="primary" density="hero" shape="app" label="strong">
                            Resume session
                            <Play size={18} className="ml-2" />
                        </Button>
                    </form>
                </div>
            </SessionPromptShell>
        </div>
    );
}

function SessionCompleteState({ sessionId, role }: { sessionId: string; role: string }) {
    return (
        <div className="mx-auto flex w-full max-w-4xl flex-1 items-center px-6 py-12">
            <SessionPromptShell>
                <div className="space-y-5">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Session complete</p>
                    <h2 className="font-display text-4xl font-bold leading-tight text-text-primary md:text-6xl">
                        Review what to strengthen next.
                    </h2>
                    <p className="text-base leading-7 text-text-secondary">
                        Your {role} practice session is complete. The summary turns your answers into useful next steps.
                    </p>
                    <Button asChild emphasis="primary" density="hero" shape="app" label="strong">
                        <Link href={`/summary/${sessionId}`}>
                            Review summary
                            <ArrowRight size={18} className="ml-2" />
                        </Link>
                    </Button>
                </div>
            </SessionPromptShell>
        </div>
    );
}
