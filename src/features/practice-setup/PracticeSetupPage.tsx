import Link from "next/link";
import { ArrowRight, Briefcase, FileText, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

const setupNotes = [
    "Target role is the only required field for the first pass.",
    "Job description and resume text will help tailor future generated questions.",
    "Your setup will move to server-backed drafts in the next persistence slice.",
];

export function PracticeSetupPage() {
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
                <form className="space-y-6 rounded-2xl border border-border bg-white p-6 shadow-flat" aria-label="Practice setup form">
                    <div className="space-y-2">
                        <label htmlFor="target-role" className="flex items-center gap-2 text-sm font-bold text-text-primary">
                            <Briefcase className="h-4 w-4 text-primary" />
                            Target role
                        </label>
                        <input
                            id="target-role"
                            name="targetRole"
                            required
                            placeholder="Warehouse lead, QA analyst, customer success manager..."
                            className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="job-description" className="flex items-center gap-2 text-sm font-bold text-text-primary">
                            <FileText className="h-4 w-4 text-primary" />
                            Job description
                        </label>
                        <textarea
                            id="job-description"
                            name="jobDescription"
                            rows={7}
                            placeholder="Paste the role description if it will make practice more relevant."
                            className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-base leading-7 text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="resume-text" className="flex items-center gap-2 text-sm font-bold text-text-primary">
                            <FileText className="h-4 w-4 text-primary" />
                            Resume text
                        </label>
                        <textarea
                            id="resume-text"
                            name="resumeText"
                            rows={7}
                            placeholder="Paste resume text when you want questions to reflect your background."
                            className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-base leading-7 text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    <div className="rounded-2xl border border-dashed border-border bg-surface-subtle p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Upload className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-text-primary">Resume file upload is coming next.</p>
                                <p className="mt-1 text-sm leading-6 text-text-secondary">
                                    This first slice keeps pasted text available while preserving the upload path for the resume pipeline.
                                </p>
                            </div>
                        </div>
                    </div>

                    <Button type="submit" density="hero" shape="pill" label="strong" className="w-full sm:w-auto">
                        Start generating questions
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </form>

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-border bg-white p-5 shadow-flat">
                        <h2 className="text-sm font-bold text-text-primary">Personalization</h2>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            Personalization intake will plug into this setup later without changing the route boundary.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white p-5 shadow-flat">
                        <h2 className="text-sm font-bold text-text-primary">Draft state</h2>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            The next backend slice will persist setup data so refreshes and returns can resume from server state.
                        </p>
                    </div>
                </aside>
            </section>
        </main>
    );
}
