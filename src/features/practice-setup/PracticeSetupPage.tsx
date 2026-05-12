import Link from "next/link";

import type { RestoredPracticeSetupDraft } from "@/lib/server/candidate";

import { PracticeSetupForm } from "./PracticeSetupForm";

const setupNotes = [
    "Target role is the only required field for the first pass.",
    "Job description and resume text will help tailor future generated questions.",
    "Your setup will move to server-backed drafts in the next persistence slice.",
];

type PracticeSetupPageProps = {
    restoredDraft?: RestoredPracticeSetupDraft | null;
};

export function PracticeSetupPage({ restoredDraft = null }: PracticeSetupPageProps) {
    const availableDrafts = restoredDraft?.availableDrafts ?? [];

    return (
        <main className="candidate-design-system min-h-screen bg-surface-base text-text-primary">
            <section className="border-b border-border bg-gradient-to-br from-brand-glass-start via-surface-base to-white">
                <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-10 md:px-10 md:py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(24rem,0.75fr)]">
                    <div className="space-y-6">
                        <Link href="/" className="inline-flex text-sm font-semibold text-primary hover:underline">
                            Back to overview
                        </Link>
                        <div className="space-y-5">
                            <h1 className="font-display text-5xl font-bold leading-none text-text-primary md:text-6xl">
                                Set up your practice.
                            </h1>
                            <p className="max-w-3xl text-lg leading-8 text-text-secondary">
                                Start with the role you want, add context only when it helps, and keep the setup light enough to get into the interview quickly.
                            </p>
                        </div>
                    </div>

                    <aside className="surface-sky border border-[rgb(var(--candidate-border)/0.78)] p-6">
                        <h2 className="text-sm font-bold text-text-primary">What happens next</h2>
                        <ul className="mt-4 space-y-4">
                            {setupNotes.map((note) => (
                                <li key={note} className="grid grid-cols-[0.75rem_1fr] gap-3">
                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-orange" />
                                    <span className="text-sm leading-6 text-text-secondary">{note}</span>
                                </li>
                            ))}
                        </ul>
                    </aside>
                </div>
            </section>

            <section className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-10 md:px-10 md:py-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <PracticeSetupForm
                    initialValues={restoredDraft?.initialValues ?? null}
                    practiceDraftId={restoredDraft?.practiceDraftId ?? null}
                />

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-border bg-white p-5 shadow-flat">
                        <h2 className="text-sm font-bold text-text-primary">Personalization</h2>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            Personalization intake will plug into this setup later without changing the route boundary.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white p-5 shadow-flat">
                        <h2 className="text-sm font-bold text-text-primary">Draft state</h2>
                        {availableDrafts.length > 0 ? (
                            <ul className="mt-3 space-y-3">
                                {availableDrafts.map((draft) => (
                                    <li key={draft.practiceDraftId}>
                                        <Link
                                            href={`/practice?draftId=${encodeURIComponent(draft.practiceDraftId)}`}
                                            className="block rounded-xl border border-border bg-surface-subtle px-3 py-3 text-sm transition hover:border-primary/40 hover:bg-white"
                                        >
                                            <span className="block font-bold text-text-primary">{draft.draftLabel}</span>
                                            <span className="mt-1 block text-xs font-semibold uppercase tracking-normal text-text-muted">
                                                {formatDraftDate(draft.lastActivityAt)}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-2 text-sm leading-6 text-text-secondary">
                                Your latest editable setup will appear here when a draft is available.
                            </p>
                        )}
                    </div>
                </aside>
            </section>
        </main>
    );
}

function formatDraftDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Recently updated";
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}
