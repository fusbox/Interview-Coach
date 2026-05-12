import Link from "next/link";

import type { CandidateSummaryModel } from "@/lib/server/candidate";

type CandidateSummaryPageProps = {
    summary: CandidateSummaryModel;
};

export function CandidateSummaryPage({ summary }: CandidateSummaryPageProps) {
    return (
        <main className="candidate-design-system min-h-screen bg-surface-base text-text-primary">
            <section className="border-b border-border bg-gradient-to-br from-brand-glass-start via-surface-base to-white">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 md:px-10 md:py-14">
                    <Link href="/dashboard" className="text-sm font-semibold text-primary hover:underline">
                        Back to dashboard
                    </Link>
                    <div className="max-w-5xl space-y-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">
                            Candidate session summary
                        </p>
                        <h1 className="font-display text-4xl font-bold leading-tight text-text-primary md:text-6xl">
                            {summary.role} summary
                        </h1>
                        <p className="max-w-4xl text-base leading-7 text-text-secondary md:text-lg">
                            {summary.summaryNarrative}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <span className="rounded-full border border-border bg-white px-4 py-2 text-sm font-bold text-text-primary shadow-flat">
                            {summary.answeredCount} of {summary.questionCount} answered
                        </span>
                        <span className="rounded-full border border-border bg-white px-4 py-2 text-sm font-bold text-text-primary shadow-flat">
                            {summary.status}
                        </span>
                    </div>
                </div>
            </section>

            <section className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-10 md:px-10 md:py-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-5">
                    <h2 className="font-display text-3xl font-bold text-text-primary">Answers to review</h2>
                    {summary.answers.length > 0 ? (
                        <div className="grid gap-4">
                            {summary.answers.map((answer) => (
                                <article key={answer.questionId} className="rounded-2xl border border-border bg-white p-5 shadow-flat">
                                    <div className="space-y-3">
                                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{answer.category}</p>
                                        <h3 className="text-xl font-bold text-text-primary">{answer.questionText}</h3>
                                        <p className="whitespace-pre-wrap text-sm leading-7 text-text-secondary">{answer.transcript}</p>
                                        {answer.recommendation ? (
                                            <div className="rounded-2xl border border-border bg-surface-sky p-4">
                                                <p className="text-sm font-bold text-text-primary">What to strengthen</p>
                                                <p className="mt-2 text-sm leading-6 text-text-secondary">{answer.recommendation}</p>
                                            </div>
                                        ) : null}
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="rounded-2xl border border-border bg-white p-5 text-sm leading-6 text-text-secondary shadow-flat">
                            No submitted answers are available yet.
                        </p>
                    )}
                </div>

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-border bg-white p-5 shadow-flat">
                        <h2 className="text-sm font-bold text-text-primary">Next step</h2>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            Use this summary to choose one answer pattern to practice again.
                        </p>
                    </div>
                    <Link
                        href="/practice"
                        className="inline-flex w-full justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-flat transition hover:bg-primary-hover"
                    >
                        Practice again
                    </Link>
                </aside>
            </section>
        </main>
    );
}
