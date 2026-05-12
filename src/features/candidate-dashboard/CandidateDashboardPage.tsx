import Link from "next/link";

import type { CandidateDashboardItem, CandidateDashboardModel } from "@/lib/server/candidate";

type CandidateDashboardPageProps = {
    dashboard: CandidateDashboardModel;
};

export function CandidateDashboardPage({ dashboard }: CandidateDashboardPageProps) {
    const hasPractice = dashboard.stats.totalPracticeCount > 0;

    return (
        <main className="candidate-design-system min-h-screen bg-surface-base text-text-primary">
            <section className="border-b border-border bg-gradient-to-br from-brand-glass-start via-surface-base to-white">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 md:px-10 md:py-14">
                    <Link href="/" className="text-sm font-semibold text-primary hover:underline">
                        Back to overview
                    </Link>
                    <div className="max-w-5xl space-y-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">
                            Candidate dashboard
                        </p>
                        <h1 className="font-display text-4xl font-bold leading-tight text-text-primary md:text-6xl">
                            Welcome back, {dashboard.candidate.displayName}.
                        </h1>
                        <p className="max-w-4xl text-base leading-7 text-text-secondary md:text-lg">
                            Pick up active practice, review completed sessions, or start a new round when you are ready.
                        </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                        <StatCard label="Practice rounds" value={dashboard.stats.totalPracticeCount} />
                        <StatCard label="Active" value={dashboard.stats.activeCount} />
                        <StatCard label="Completed" value={dashboard.stats.completedCount} />
                    </div>
                </div>
            </section>

            <section className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-10 md:px-10 md:py-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-8">
                    {!hasPractice ? (
                        <div className="rounded-2xl border border-border bg-white p-6 shadow-flat md:p-8">
                            <h2 className="font-display text-3xl font-bold text-text-primary">No practice yet.</h2>
                            <p className="mt-3 max-w-2xl text-base leading-7 text-text-secondary">
                                Start with a target role, add context only if it helps, and your dashboard will keep the next step ready here.
                            </p>
                            <Link
                                href="/practice"
                                className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-flat transition hover:bg-primary-hover"
                            >
                                Start a practice session
                            </Link>
                        </div>
                    ) : null}

                    <DashboardSection
                        title="Active practice"
                        emptyText="No active practice sessions."
                        items={dashboard.activeItems}
                        actionLabel="Resume practice"
                    />
                    <DashboardSection
                        title="Completed sessions"
                        emptyText="No completed summaries yet."
                        items={dashboard.completedItems}
                        actionLabel="Review summary"
                    />
                </div>

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-border bg-white p-5 shadow-flat">
                        <h2 className="text-sm font-bold text-text-primary">Next best action</h2>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            {dashboard.activeItems.length > 0
                                ? "Resume the most recent active practice before starting a new one."
                                : "Start a new practice session when you have a role in mind."}
                        </p>
                    </div>
                    <Link
                        href="/practice"
                        className="inline-flex w-full justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-flat transition hover:bg-primary-hover"
                    >
                        New practice
                    </Link>
                </aside>
            </section>
        </main>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border border-border bg-white p-5 shadow-flat">
            <p className="text-sm font-semibold text-text-secondary">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-text-primary">{value}</p>
        </div>
    );
}

function DashboardSection({
    title,
    emptyText,
    items,
    actionLabel,
}: {
    title: string;
    emptyText: string;
    items: CandidateDashboardItem[];
    actionLabel: string;
}) {
    return (
        <section className="space-y-4">
            <h2 className="font-display text-3xl font-bold text-text-primary">{title}</h2>
            {items.length > 0 ? (
                <div className="grid gap-4">
                    {items.map((item) => (
                        <article key={item.practiceDraftId} className="rounded-2xl border border-border bg-white p-5 shadow-flat">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{item.statusLabel}</p>
                                    <h3 className="text-xl font-bold text-text-primary">{item.title}</h3>
                                    <p className="text-sm leading-6 text-text-secondary">{item.progressLabel}</p>
                                    <p className="text-sm leading-6 text-text-secondary">Last activity: {item.lastActivityLabel}</p>
                                    {item.summarySnippet ? (
                                        <p className="max-w-3xl text-sm leading-6 text-text-secondary">{item.summarySnippet}</p>
                                    ) : null}
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-3">
                                    <Link
                                        href={item.href}
                                        className="inline-flex justify-center rounded-full border border-border bg-white px-5 py-3 text-sm font-bold text-text-primary shadow-flat transition hover:border-primary"
                                    >
                                        {actionLabel}
                                    </Link>
                                    {item.repeatHref ? (
                                        <Link
                                            href={item.repeatHref}
                                            className="inline-flex justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-flat transition hover:bg-primary-hover"
                                        >
                                            Practice again
                                        </Link>
                                    ) : null}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <p className="rounded-2xl border border-border bg-white p-5 text-sm leading-6 text-text-secondary shadow-flat">
                    {emptyText}
                </p>
            )}
        </section>
    );
}
