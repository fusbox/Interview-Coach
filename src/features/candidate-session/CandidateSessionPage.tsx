import Link from "next/link";
import type React from "react";
import { ArrowRight, FileText, Lightbulb, Play, RotateCcw, Sparkles, X } from "lucide-react";

import { SessionPromptShell } from "@/components/patterns/SessionPromptShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { AnalysisResult } from "@/lib/domain/types";
import type { LoadedCandidateSession } from "@/lib/server/candidate";
import { CandidateSessionDebugOverlay } from "./CandidateSessionDebugOverlay";
import {
    advanceCandidateSessionAction,
    analyzeCandidateAnswerAction,
    pauseCandidateSessionAction,
    resumeCandidateSessionAction,
    retryCandidateQuestionAction,
    startCandidateSessionAction,
    submitCandidateAnswerAction,
} from "./actions";

type CandidateSessionPageProps = {
    loadedSession: LoadedCandidateSession;
};

export function CandidateSessionPage({ loadedSession }: CandidateSessionPageProps) {
    const { session } = loadedSession;
    const currentQuestion = session.questions[session.currentQuestionIndex] ?? session.questions[0] ?? null;
    const totalQuestions = session.questions.length;
    const questionPosition = currentQuestion ? session.questions.findIndex((question) => question.id === currentQuestion.id) + 1 : 0;
    const progressPercentage = totalQuestions > 0 ? Math.round((Math.max(questionPosition, 1) / totalQuestions) * 100) : 0;
    const nextQuestionIndex = session.currentQuestionIndex + 1;
    const isLastQuestion = nextQuestionIndex >= totalQuestions;
    const nextStatus = isLastQuestion ? "COMPLETED" : "IN_SESSION";
    const currentAnswer = currentQuestion ? session.answers[currentQuestion.id] : undefined;
    const hasSubmittedCurrentAnswer = Boolean(currentAnswer?.submittedAt);
    const currentAnalysis = currentAnswer?.analysis;
    const canAdvance = hasSubmittedCurrentAnswer && ["IN_SESSION", "AWAITING_EVALUATION", "REVIEWING"].includes(session.status);

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

    async function submitAnswerAction(formData: FormData) {
        "use server";
        if (!currentQuestion) {
            return;
        }
        await submitCandidateAnswerAction(session.id, currentQuestion.id, formData);
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
                                    <HeaderButton icon={<X size={16} />} label="Pause session" />
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
                    <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-10">
                        <section className="flex min-h-0 flex-col">
                            <SessionPromptShell
                                className={cn(
                                    "min-h-[18rem]",
                                    currentAnalysis ? "opacity-80" : "opacity-100",
                                )}
                                footer={
                                    <div className="flex min-h-12 flex-wrap items-center justify-between gap-3">
                                        <div className="flex flex-wrap gap-3">
                                            <CoachChip icon={<Lightbulb size={18} />} label="Coach's Lens" active={Boolean(currentAnalysis)} />
                                            <CoachChip icon={<Sparkles size={18} />} label={currentQuestion.category} />
                                        </div>
                                        {session.status === "NOT_STARTED" ? (
                                            <form action={startAction}>
                                                <Button type="submit" emphasis="primary" density="comfortable" shape="app" label="strong">
                                                    Start practice
                                                    <ArrowRight size={16} className="ml-2" />
                                                </Button>
                                            </form>
                                        ) : null}
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
                                    {session.jobDescription ? (
                                        <p className="max-w-3xl text-base leading-7 text-text-secondary">
                                            Practice for: {session.jobDescription}
                                        </p>
                                    ) : null}
                                </div>
                            </SessionPromptShell>

                            <div className="mt-6 flex flex-1 flex-col justify-center rounded-3xl border border-border bg-surface-base/80 p-4 shadow-flat md:p-6">
                                {session.status === "AWAITING_EVALUATION" && !hasSubmittedCurrentAnswer ? (
                                    <div className="space-y-3 py-12 text-center">
                                        <p className="font-display text-3xl font-bold text-text-primary">Reviewing your response...</p>
                                        <p className="text-sm leading-6 text-text-secondary">
                                            The coach is preparing feedback. Refreshing this page will keep your place.
                                        </p>
                                    </div>
                                ) : !hasSubmittedCurrentAnswer ? (
                                    <form action={submitAnswerAction} className="space-y-4">
                                        <label htmlFor="answerText" className="block text-sm font-black uppercase tracking-widest text-text-muted">
                                            Type your answer
                                        </label>
                                        <textarea
                                            id="answerText"
                                            name="answerText"
                                            rows={8}
                                            defaultValue={currentAnswer?.draft || currentAnswer?.transcript || ""}
                                            className="min-h-64 w-full resize-y rounded-3xl border border-border bg-white px-5 py-4 text-base leading-7 text-text-primary shadow-inner outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                                            placeholder="Type the answer you would give in the interview."
                                        />
                                        <div className="flex justify-end">
                                            <Button type="submit" emphasis="primary" density="hero" shape="app" label="strong">
                                                Submit answer
                                                <ArrowRight size={18} className="ml-2" />
                                            </Button>
                                        </div>
                                    </form>
                                ) : (
                                    <SavedAnswerPanel
                                        transcript={currentAnswer?.transcript}
                                        analysis={currentAnalysis}
                                        analyzeAnswerAction={analyzeAnswerAction}
                                        retryQuestionAction={retryQuestionAction}
                                        advanceAction={advanceAction}
                                        canAdvance={canAdvance}
                                        isLastQuestion={isLastQuestion}
                                    />
                                )}
                            </div>
                        </section>

                        <aside className="space-y-4">
                            <div className="rounded-3xl border border-border bg-white p-5 shadow-flat">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">
                                    Coach&apos;s Lens
                                </p>
                                <div className="mt-4 space-y-3 text-sm leading-6 text-text-secondary">
                                    <p>
                                        Answer the prompt naturally, then use coaching to decide whether to retry or keep moving.
                                    </p>
                                    <p>
                                        Your place is saved as you move through the interview.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-border bg-surface-sky p-5 shadow-flat">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">
                                    Session status
                                </p>
                                <dl className="mt-4 space-y-3 text-sm text-text-secondary">
                                    <div>
                                        <dt className="font-semibold text-text-primary">State</dt>
                                        <dd>{formatStatus(session.status)}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-semibold text-text-primary">Saved draft</dt>
                                        <dd className="break-all">{loadedSession.practiceDraftId}</dd>
                                    </div>
                                </dl>
                            </div>
                        </aside>
                    </div>
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

function CoachChip({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
                active
                    ? "border-brand-deep bg-brand-deep text-text-inverse shadow-lg"
                    : "border-state-info/20 bg-state-info/10 text-state-info",
            )}
        >
            {icon}
            {label}
        </span>
    );
}

function SavedAnswerPanel({
    transcript,
    analysis,
    analyzeAnswerAction,
    retryQuestionAction,
    advanceAction,
    canAdvance,
    isLastQuestion,
}: {
    transcript?: string;
    analysis?: AnalysisResult;
    analyzeAnswerAction: () => Promise<void>;
    retryQuestionAction: () => Promise<void>;
    advanceAction: () => Promise<void>;
    canAdvance: boolean;
    isLastQuestion: boolean;
}) {
    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="rounded-3xl border border-border/70 bg-white p-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileText size={20} />
                    </div>
                    <p className="text-sm font-black uppercase tracking-widest text-text-muted">
                        Your saved answer
                    </p>
                </div>
                <p className="mt-5 whitespace-pre-wrap text-base leading-7 text-text-secondary">
                    {transcript || "No answer text was saved."}
                </p>
            </section>

            <section className="rounded-3xl border border-border/70 bg-white p-5">
                <p className="text-sm font-black uppercase tracking-widest text-text-muted">
                    Coach&apos;s Lens
                </p>
                {analysis ? (
                    <div className="mt-5 space-y-5">
                        {analysis.ack ? (
                            <p className="text-base leading-7 text-text-secondary">{analysis.ack}</p>
                        ) : null}
                        {analysis.contentPulse ? (
                            <div className="rounded-2xl border border-primary/15 bg-surface-sky p-4">
                                <h3 className="text-xl font-bold text-text-primary">
                                    {analysis.contentPulse.headline}
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-text-secondary">
                                    {analysis.contentPulse.body}
                                </p>
                            </div>
                        ) : null}
                        {analysis.recommendation ? (
                            <p className="text-lg font-semibold leading-7 text-text-primary">
                                {analysis.recommendation}
                            </p>
                        ) : null}
                    </div>
                ) : (
                    <div className="mt-5 space-y-4">
                        <p className="text-base leading-7 text-text-secondary">
                            Get focused coaching before you decide whether to retry or continue.
                        </p>
                        <form action={analyzeAnswerAction}>
                            <Button type="submit" emphasis="primary" density="comfortable" shape="app" label="strong">
                                Get coaching
                            </Button>
                        </form>
                    </div>
                )}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    {canAdvance ? (
                        <form action={advanceAction}>
                            <Button type="submit" emphasis="primary" density="comfortable" shape="app" label="strong" className="w-full sm:w-auto">
                                {isLastQuestion ? "Finish session" : "Continue to next question"}
                                <ArrowRight size={16} className="ml-2" />
                            </Button>
                        </form>
                    ) : null}
                    <form action={retryQuestionAction}>
                        <Button type="submit" emphasis="secondary" density="comfortable" shape="app" label="strong" className="w-full sm:w-auto">
                            <RotateCcw size={16} className="mr-2" />
                            Retry question
                        </Button>
                    </form>
                </div>
            </section>
        </div>
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

function formatStatus(status: string): string {
    return status
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
