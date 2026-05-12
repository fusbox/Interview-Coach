import Link from "next/link";

import type { LoadedCandidateSession } from "@/lib/server/candidate";
import {
    advanceCandidateSessionAction,
    pauseCandidateSessionAction,
    resumeCandidateSessionAction,
    startCandidateSessionAction,
} from "./actions";

type CandidateSessionPageProps = {
    loadedSession: LoadedCandidateSession;
};

export function CandidateSessionPage({ loadedSession }: CandidateSessionPageProps) {
    const { session } = loadedSession;
    const currentQuestion = session.questions[session.currentQuestionIndex] ?? session.questions[0] ?? null;
    const totalQuestions = session.questions.length;
    const questionPosition = currentQuestion ? session.questions.findIndex((question) => question.id === currentQuestion.id) + 1 : 0;
    const nextQuestionIndex = session.currentQuestionIndex + 1;
    const isLastQuestion = nextQuestionIndex >= totalQuestions;
    const nextStatus = isLastQuestion ? "COMPLETED" : "IN_SESSION";

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

    return (
        <main className="candidate-design-system min-h-screen bg-surface-base text-text-primary">
            <section className="border-b border-border bg-gradient-to-br from-brand-glass-start via-surface-base to-white">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-10 md:px-10 md:py-14">
                    <Link href="/dashboard" className="text-sm font-semibold text-primary hover:underline">
                        Back to dashboard
                    </Link>
                    <div className="max-w-5xl space-y-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">
                            Candidate practice session
                        </p>
                        <h1 className="font-display text-4xl font-bold leading-tight text-text-primary md:text-6xl">
                            {session.role}
                        </h1>
                        {session.jobDescription ? (
                            <p className="max-w-4xl text-base leading-7 text-text-secondary md:text-lg">
                                {session.jobDescription}
                            </p>
                        ) : null}
                    </div>
                </div>
            </section>

            <section className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-10 md:px-10 md:py-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <article className="rounded-2xl border border-border bg-white p-6 shadow-flat md:p-8">
                    {currentQuestion ? (
                        <div className="space-y-5">
                            <p className="text-sm font-bold text-primary">
                                Question {questionPosition} of {totalQuestions}
                            </p>
                            <h2 className="font-display text-3xl font-bold leading-tight text-text-primary">
                                {currentQuestion.text}
                            </h2>
                            <p className="text-sm font-semibold text-text-secondary">
                                {currentQuestion.category}
                            </p>
                            {session.status === "NOT_STARTED" ? (
                                <form action={startAction}>
                                    <button
                                        type="submit"
                                        className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-flat transition hover:bg-primary-hover"
                                    >
                                        Start practice
                                    </button>
                                </form>
                            ) : null}
                            {session.status === "IN_SESSION" ? (
                                <div className="flex flex-wrap gap-3">
                                    <form action={advanceAction}>
                                        <button
                                            type="submit"
                                            className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-flat transition hover:bg-primary-hover"
                                        >
                                            {isLastQuestion ? "Finish session" : "Next question"}
                                        </button>
                                    </form>
                                    <form action={pauseAction}>
                                        <button
                                            type="submit"
                                            className="rounded-full border border-border bg-white px-5 py-3 text-sm font-bold text-text-primary shadow-flat transition hover:border-primary"
                                        >
                                            Pause
                                        </button>
                                    </form>
                                </div>
                            ) : null}
                            {session.status === "PAUSED" ? (
                                <form action={resumeAction}>
                                    <button
                                        type="submit"
                                        className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-flat transition hover:bg-primary-hover"
                                    >
                                        Resume
                                    </button>
                                </form>
                            ) : null}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <h2 className="font-display text-3xl font-bold text-text-primary">Questions are not ready yet.</h2>
                            <p className="text-base leading-7 text-text-secondary">
                                Return to practice setup and try generating the session again.
                            </p>
                        </div>
                    )}
                </article>

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-border bg-white p-5 shadow-flat">
                        <h2 className="text-sm font-bold text-text-primary">Session state</h2>
                        <dl className="mt-4 space-y-3 text-sm text-text-secondary">
                            <div>
                                <dt className="font-semibold text-text-primary">Status</dt>
                                <dd>{session.status}</dd>
                            </div>
                            <div>
                                <dt className="font-semibold text-text-primary">Draft</dt>
                                <dd>{loadedSession.practiceDraftId}</dd>
                            </div>
                        </dl>
                    </div>
                    <div className="rounded-2xl border border-border bg-white p-5 shadow-flat">
                        <h2 className="text-sm font-bold text-text-primary">Next implementation pass</h2>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            Answering, retries, and progress mutations will wire into this persisted session surface next.
                        </p>
                    </div>
                </aside>
            </section>
        </main>
    );
}
