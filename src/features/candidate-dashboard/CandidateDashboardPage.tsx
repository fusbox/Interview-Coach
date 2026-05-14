import Link from "next/link";
import type React from "react";
import { ArrowRight, Briefcase, CalendarClock, CheckCircle2, History, PlayCircle, RotateCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CandidateDashboardItem, CandidateDashboardModel } from "@/lib/server/candidate";

type CandidateDashboardPageProps = {
    dashboard: CandidateDashboardModel;
};

export function CandidateDashboardPage({ dashboard }: CandidateDashboardPageProps) {
    const hasPractice = dashboard.stats.totalPracticeCount > 0;

    return (
        <main className="candidate-design-system min-h-screen bg-surface-base text-text-primary">
            <section className="border-b border-[rgb(var(--candidate-border)/0.78)] bg-gradient-to-br from-brand-glass-start via-surface-base to-white">
                <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-10 md:px-10 md:py-14 lg:grid-cols-[minmax(0,1fr)_24rem]">
                    <div className="space-y-6">
                        <Link href="/" className="inline-flex text-sm font-semibold text-primary hover:underline">
                            Back to overview
                        </Link>
                        <div className="space-y-5">
                            <h1 className="font-display text-5xl font-bold leading-none text-text-primary md:text-6xl">
                                Welcome back, {dashboard.candidate.displayName}.
                            </h1>
                            <p className="max-w-4xl text-lg leading-8 text-text-secondary">
                                Return to an unfinished practice, review what changed, or start a focused round for the next interview.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <StatCard label="Practice rounds" value={dashboard.stats.totalPracticeCount} />
                            <StatCard label="Active" value={dashboard.stats.activeCount} />
                            <StatCard label="Completed" value={dashboard.stats.completedCount} />
                        </div>
                    </div>

                    <section
                        aria-label="Next practice step"
                        className="surface-sky flex flex-col justify-between border border-[rgb(var(--candidate-border)/0.78)] p-6"
                    >
                        <div className="space-y-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-flat">
                                <Sparkles size={22} aria-hidden="true" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">
                                    Next practice step
                                </p>
                                <h2 id="next-practice-step-heading" className="mt-3 font-display text-3xl font-bold leading-tight text-text-primary">
                                    {dashboard.nextBestAction.title}
                                </h2>
                            </div>
                            <p className="text-sm leading-7 text-text-secondary">
                                {dashboard.nextBestAction.body}
                            </p>
                        </div>
                        <Button asChild emphasis="primary" density="hero" shape="app" label="strong" className="mt-6 w-full">
                            <Link href={dashboard.nextBestAction.href}>
                                {dashboard.nextBestAction.actionLabel}
                                <ArrowRight size={18} className="ml-2" aria-hidden="true" />
                            </Link>
                        </Button>
                    </section>
                </div>
            </section>

            <section className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-10 md:px-10 md:py-12 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-8">
                    {!hasPractice ? (
                        <section aria-label="Empty dashboard" className="rounded-3xl border border-border bg-white p-6 shadow-flat md:p-8">
                            <div className="flex max-w-3xl flex-col gap-5 sm:flex-row sm:items-start">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                    <PlayCircle size={24} aria-hidden="true" />
                                </span>
                                <div>
                                    <h2 className="font-display text-3xl font-bold text-text-primary">Start simply.</h2>
                                    <p className="mt-3 text-base leading-7 text-text-secondary">
                                        Choose the role first. Add a resume, job description, or coaching preferences only when they help.
                                    </p>
                                    <Button asChild emphasis="primary" density="comfortable" shape="app" label="strong" className="mt-5">
                                        <Link href="/practice">Start a practice session</Link>
                                    </Button>
                                </div>
                            </div>
                        </section>
                    ) : null}

                    <DashboardSection
                        id="continue-practice-heading"
                        title="Continue where you left off"
                        description="Active drafts and in-progress sessions stay ready without turning the dashboard into analytics noise."
                        emptyText="No active practice sessions."
                        items={dashboard.activeItems}
                        actionLabel="Resume practice"
                        variant="active"
                    />
                    <DashboardSection
                        id="practice-history-heading"
                        title="Practice history"
                        description="Completed summaries stay easy to revisit when you want to repeat a role or focus one improvement."
                        emptyText="No completed summaries yet."
                        items={dashboard.completedItems}
                        actionLabel="Review summary"
                        variant="completed"
                    />
                </div>

                <aside className="space-y-4">
                    <div className="surface-sky border border-[rgb(var(--candidate-border)/0.78)] p-5">
                        <h2 className="text-sm font-bold text-text-primary">Dashboard state</h2>
                        <ul className="mt-4 space-y-4">
                            <SideNote icon={<Briefcase size={18} />} label="Roles stay separate" body="Each setup, session, and summary keeps its own target role context." />
                            <SideNote icon={<History size={18} />} label="Pick back up" body="Use the active list when you left a session or setup unfinished." />
                            <SideNote icon={<RotateCcw size={18} />} label="Repeat with intent" body="Completed sessions point back to a fresh practice when you want another pass." />
                        </ul>
                    </div>
                </aside>
            </section>
        </main>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border border-border bg-white/90 p-5 shadow-flat">
            <p className="text-sm font-semibold text-text-secondary">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-text-primary">{value}</p>
        </div>
    );
}

function DashboardSection({
    id,
    title,
    description,
    emptyText,
    items,
    actionLabel,
    variant,
}: {
    id: string;
    title: string;
    description: string;
    emptyText: string;
    items: CandidateDashboardItem[];
    actionLabel: string;
    variant: "active" | "completed";
}) {
    return (
        <section aria-labelledby={id} className="space-y-4">
            <div className="flex flex-col gap-2">
                <h2 id={id} className="font-display text-3xl font-bold text-text-primary md:text-4xl">
                    {title}
                </h2>
                <p className="max-w-4xl text-sm leading-7 text-text-secondary">{description}</p>
            </div>
            {items.length > 0 ? (
                <div className="grid gap-4">
                    {items.map((item) => (
                        <DashboardItemCard key={item.practiceDraftId} item={item} actionLabel={actionLabel} variant={variant} />
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

function DashboardItemCard({
    item,
    actionLabel,
    variant,
}: {
    item: CandidateDashboardItem;
    actionLabel: string;
    variant: "active" | "completed";
}) {
    const signal = item.coachingSnippet || item.summarySnippet;

    return (
        <article className="rounded-3xl border border-border bg-white p-5 shadow-flat md:p-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
                            {variant === "active" ? <PlayCircle size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                            {item.statusLabel}
                        </span>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary">
                            <CalendarClock size={16} aria-hidden="true" />
                            {item.lastActivityLabel}
                        </span>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-text-primary">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">{item.progressLabel}</p>
                    </div>
                    {signal ? (
                        <div className="rounded-2xl border border-primary/15 bg-surface-sky p-4">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">
                                Useful note
                            </p>
                            <p className="mt-2 text-sm leading-6 text-text-secondary">{signal}</p>
                        </div>
                    ) : null}
                </div>
                <div className="flex flex-wrap gap-3 lg:justify-end">
                    <Button asChild emphasis="secondary" density="comfortable" shape="app" label="strong" className="w-full sm:w-auto">
                        <Link href={item.href}>{actionLabel}</Link>
                    </Button>
                    {item.repeatHref ? (
                        <Button asChild emphasis="primary" density="comfortable" shape="app" label="strong" className="w-full sm:w-auto">
                            <Link href={item.repeatHref}>Practice again</Link>
                        </Button>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

function SideNote({ icon, label, body }: { icon: React.ReactNode; label: string; body: string }) {
    return (
        <li className="grid grid-cols-[2.25rem_1fr] gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-primary shadow-flat">
                {icon}
            </span>
            <span>
                <span className="block text-sm font-bold text-text-primary">{label}</span>
                <span className="mt-1 block text-sm leading-6 text-text-secondary">{body}</span>
            </span>
        </li>
    );
}
