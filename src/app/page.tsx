import Image from "next/image";
import Link from "next/link";
import { Briefcase, ClipboardList, FileText, HelpingHand, Search, Sparkles } from "lucide-react";

import { CandidateDisclosureFooter } from "@/components/shell/CandidateDisclosureFooter";
import { Button } from "@/components/ui/button";

const practiceHighlights = [
    {
        title: "Start with the role you want",
        body: "Begin with the job you are preparing for, then add a job description only if it will help the practice feel more relevant.",
        icon: Briefcase,
    },
    {
        title: "Include your resume when it helps",
        body: "Paste resume text when you want questions and coaching to reflect your background more closely.",
        icon: FileText,
    },
    {
        title: "Coaching that guides, not judges",
        body: "Get guidance that helps you understand the question, answer with more clarity, and leave knowing what to work on next.",
        icon: HelpingHand,
    },
];

const dashboardBenefits = [
    "Pick back up if you started a practice setup and did not finish it.",
    "Review past summaries and quickly see what to practice next.",
    "Keep your practice history in one place without turning it into a noisy analytics screen.",
];

const sessionFlow = [
    {
        step: "1",
        title: "Choose the role",
        body: "Start with your target job and add a description only if it makes practice more useful.",
    },
    {
        step: "2",
        title: "Add background if helpful",
        body: "Keep setup light, or include your resume so questions better reflect your experience.",
    },
    {
        step: "3",
        title: "Practice the interview",
        body: "Answer questions, talk through your thinking, and focus on the conversation instead of a score.",
    },
    {
        step: "4",
        title: "Review what to improve",
        body: "Finish with a summary of what is working, what to strengthen, and what to practice next.",
    },
];

const startPracticeHref = "/auth/talentarbor/start?next=/practice";
const dashboardHref = "/auth/talentarbor/start?next=/dashboard";

export default function Home() {
    return (
        <main className="candidate-design-system min-h-screen bg-surface-base text-text-primary">
            <section className="border-b border-border bg-gradient-to-br from-brand-glass-start via-surface-base to-white">
                <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-8 md:px-10 md:py-10">
                    <div className="flex justify-center">
                        <Image
                            src="/TA-logo.webp"
                            alt="Talent Arbor"
                            width={300}
                            height={70}
                            className="h-14 w-auto object-contain md:h-16"
                            priority
                            unoptimized
                        />
                    </div>

                    <div className="mx-auto flex max-w-6xl flex-col justify-center gap-9 py-10 text-center md:py-12">
                        <div className="space-y-6">
                            <p className="text-micro font-bold uppercase text-text-muted">Interview Coach</p>
                            <h1 className="font-display text-5xl font-bold leading-none text-text-primary md:text-6xl lg:text-7xl">
                                Interview practice that gets you in quickly and guides you forward.
                            </h1>
                        </div>

                        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                            <Button asChild density="hero" shape="pill" label="strong" className="w-full sm:w-auto">
                                <Link href={startPracticeHref}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Start practicing
                                </Link>
                            </Button>
                            <Button asChild density="hero" shape="pill" emphasis="secondary" label="strong" className="w-full sm:w-auto">
                                <Link href={dashboardHref}>Review dashboard</Link>
                            </Button>
                        </div>

                        <div className="grid gap-5 border-t border-border pt-8 text-left md:grid-cols-3">
                            {practiceHighlights.map(({ title, body, icon: Icon }) => (
                                <div
                                    key={title}
                                    className="grid grid-cols-[auto_1fr] gap-4 border-b border-border pb-5 last:border-b-0 md:block md:border-b-0 md:border-l md:pl-6 md:first:border-l-0 md:first:pl-0"
                                >
                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="md:mt-4">
                                        <h2 className="text-sm font-bold text-text-primary">{title}</h2>
                                        <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-b border-border">
                <div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-12 md:px-10 md:py-16">
                    <div className="space-y-4">
                        <div className="flex items-stretch gap-3">
                            <div className="w-1 shrink-0 rounded-full bg-primary" />
                            <h2 className="font-display text-4xl font-bold leading-tight text-text-primary md:text-5xl">
                                Beyond scores, coaching that helps you <span className="text-primary">grow.</span>
                            </h2>
                        </div>
                        <p className="pl-4 text-lg leading-8 text-text-secondary">
                            This practice is designed to help you understand what a question is really testing, shape a stronger response, and leave with useful guidance instead of a pass-or-fail label.
                        </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="border-t border-border pt-5">
                            <div className="flex items-center gap-3 text-primary">
                                <Search className="h-4 w-4" />
                                <span className="text-sm font-semibold text-text-primary">What they&apos;re looking for</span>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-text-secondary">
                                The coach is designed to understand what each question is really testing, so it can help you respond with stronger examples, clearer structure, and better judgment.
                            </p>
                        </div>
                        <div className="border-t border-border pt-5">
                            <div className="flex items-center gap-3 text-primary">
                                <ClipboardList className="h-4 w-4" />
                                <span className="text-sm font-semibold text-text-primary">Useful, honest guidance</span>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-text-secondary">
                                You should leave understanding what helped, what weakened the answer, and what to practice next, without being reduced to a label.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-b border-border">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12 md:px-10 md:py-16">
                    <div className="space-y-4">
                        <div className="flex items-stretch gap-3">
                            <div className="w-1 shrink-0 rounded-full bg-primary" />
                            <h2 className="font-display text-4xl font-bold leading-tight text-text-primary md:text-5xl">
                                A dashboard that keeps the next practice step <span className="text-primary">clear.</span>
                            </h2>
                        </div>
                        <p className="pl-4 text-lg leading-8 text-text-secondary">
                            Your dashboard should make it easy to return, review what changed, and decide what kind of practice will help most next.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="grid gap-4">
                            {dashboardBenefits.map((item) => (
                                <div key={item} className="grid grid-cols-[0.75rem_1fr] gap-3">
                                    <span className="mt-3 h-1.5 w-1.5 rounded-full bg-brand-orange" />
                                    <p className="text-base leading-8 text-text-secondary">{item}</p>
                                </div>
                            ))}
                        </div>
                        <Button asChild density="hero" shape="pill" emphasis="secondary" label="strong" className="w-full sm:w-auto">
                            <Link href={dashboardHref}>Review dashboard</Link>
                        </Button>
                    </div>
                </div>
            </section>

            <section>
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-9 px-6 py-12 md:px-10 md:py-16">
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-stretch gap-3">
                                <div className="w-1 shrink-0 rounded-full bg-primary" />
                                <h2 className="font-display text-4xl font-bold leading-tight text-text-primary md:text-5xl">
                                    Flexible interview preparation <span className="text-primary">that you control.</span>
                                </h2>
                            </div>
                            <p className="pl-4 text-lg leading-8 text-text-secondary">
                                Set up a practice in one step, or customize it to tailor the experience to your needs.
                            </p>
                        </div>
                        <div className="pl-4">
                            <Button asChild density="hero" shape="pill" label="strong" className="w-full sm:w-auto">
                                <Link href={startPracticeHref}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Start practicing
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {sessionFlow.map(({ step, title, body }) => (
                            <article
                                key={step}
                                className="surface-sky grid gap-4 border border-[rgb(var(--candidate-border)/0.78)] p-5 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-5"
                            >
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange text-sm font-bold text-white shadow-[0_3px_8px_rgba(249,85,0,0.10)]">
                                    {step}
                                </span>
                                <div className="space-y-2">
                                    <h3 className="text-sm font-bold text-text-primary">{title}</h3>
                                    <p className="text-sm leading-7 text-text-secondary">{body}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
            <CandidateDisclosureFooter />
        </main>
    );
}
