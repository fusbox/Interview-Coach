import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ClipboardList, LayoutDashboard } from "lucide-react";

import { ContentCard } from "@/components/patterns/ContentCard";
import { IconBadge } from "@/components/patterns/IconBadge";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { CandidateDisclosureFooter } from "@/components/shell/CandidateDisclosureFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { CandidateSummaryModel } from "@/lib/server/candidate";
import { SessionSurvey } from "@/features/session/components/SessionSurvey";
import { getIconForTitle, parseDebrief } from "@/features/session/components/SummaryUtilities";
import { CandidateSummaryFinalizer } from "./CandidateSummaryFinalizer";

type CandidateSummaryPageProps = {
    summary: CandidateSummaryModel;
};

const summaryNavLinkClasses = [
    "summary-nav-link",
    "w-full min-w-[13rem] gap-2 border border-primary/15 bg-white/85 px-5 text-text-secondary shadow-flat",
    "hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-raised-1",
    "focus-visible:ring-primary/40 sm:w-auto",
].join(" ");

export function CandidateSummaryPage({ summary }: CandidateSummaryPageProps) {
    const narrative = summary.summaryNarrative || undefined;
    const hasNarrative = Boolean(narrative);
    const titleText = `Great practice round, ${summary.candidateFirstName || "there"}!`;
    const descriptionText = hasNarrative
        ? "Here's your feedback summary."
        : "One moment while I create your feedback summary";

    return (
        <main className="candidate-design-system relative flex min-h-[100dvh] w-full flex-col items-center bg-gradient-to-br from-brand-glass-start to-brand-glass-end text-text-primary">
            <CandidateSummaryFinalizer
                sessionId={summary.sessionId}
                enabled={!hasNarrative && summary.status === "COMPLETED"}
            />
            <div className="absolute inset-0 bg-white/40 backdrop-blur-md" />
            <div className="relative z-10 flex w-full max-w-4xl flex-col items-center space-y-12 px-6 py-12 md:px-12">
                <header className="flex w-full flex-col items-start gap-1">
                    <div className="relative mb-6 h-12 w-auto shrink-0">
                        <Image
                            src="/TA-logo.webp"
                            alt="TalentArbor"
                            width={200}
                            height={58}
                            className="object-contain"
                            priority
                            unoptimized
                        />
                    </div>
                    <div className="w-full space-y-4 text-left">
                        <h1 className="font-display text-2xl font-bold leading-tight text-primary md:text-3xl">
                            {titleText}
                        </h1>
                        <p className="text-lg leading-relaxed text-text-secondary">
                            {descriptionText}
                        </p>
                    </div>
                </header>

                {hasNarrative ? (
                    <div className="flex w-full flex-col gap-6">
                        {parseDebrief(narrative).map((section) => (
                            <ContentCard key={section.title} density="spacious" className="w-full">
                                <div className="mb-3 flex items-center gap-4 border-b border-border/60 pb-4">
                                    <IconBadge {...getIconForTitle(section.title)} size="sm" />
                                    <h2 className="text-2xl font-bold text-text-primary">
                                        {section.title}
                                    </h2>
                                </div>
                                <div className="prose max-w-none prose-p:text-lg prose-p:leading-relaxed prose-p:text-text-secondary prose-li:text-lg prose-strong:text-text-primary">
                                    <ReactMarkdown
                                        components={{
                                            strong: ({ className, ...props }) => (
                                                <strong className={cn("font-bold text-text-primary", className)} {...props} />
                                            ),
                                            p: ({ className, ...props }) => (
                                                <p className={cn("mb-5 last:mb-0", className)} {...props} />
                                            ),
                                            li: ({ className, ...props }) => (
                                                <li className={cn("mb-5 last:mb-0", className)} {...props} />
                                            ),
                                        }}
                                    >
                                        {section.content}
                                    </ReactMarkdown>
                                </div>
                            </ContentCard>
                        ))}
                    </div>
                ) : (
                    <DebriefSkeleton />
                )}

                <section className="w-full max-w-2xl space-y-10 bg-transparent p-0">
                    <div className="space-y-2 text-center">
                        <SectionHeader
                            title="How was your session?"
                            className="flex-col items-center text-center sm:flex-col sm:items-center sm:justify-center"
                            description={<span className="italic">Your feedback helps us improve the coaching experience.</span>}
                        />
                    </div>
                    <SessionSurvey sessionId={summary.sessionId} />
                </section>

                <section className="flex w-full max-w-2xl justify-center">
                    <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2 sm:items-center">
                        <Button
                            asChild
                            emphasis="secondary"
                            density="comfortable"
                            shape="pill"
                            label="strong"
                            className={summaryNavLinkClasses}
                        >
                            <Link href="/dashboard">
                                <LayoutDashboard size={18} />
                                Back to Dashboard
                            </Link>
                        </Button>
                        <Button
                            asChild
                            emphasis="secondary"
                            density="comfortable"
                            shape="pill"
                            label="strong"
                            className={summaryNavLinkClasses}
                        >
                            <Link href="/practice">
                                <ClipboardList size={18} />
                                Back to Practice Setup
                            </Link>
                        </Button>
                    </div>
                </section>

                <CandidateDisclosureFooter>
                    This summary is saved for your review in your candidate dashboard. Practice summaries are not shared
                    with recruiters, employers, or hiring-decision users.
                </CandidateDisclosureFooter>
            </div>
        </main>
    );
}

function DebriefSkeleton() {
    return (
        <div className="flex w-full flex-col gap-6" aria-busy="true" aria-live="polite" aria-label="Feedback summary is loading">
            <ContentCard density="spacious" className="w-full">
                <Skeleton className="mb-6 h-8 w-48" />
                <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            </ContentCard>

            <ContentCard density="spacious" className="w-full">
                <Skeleton className="mb-6 h-8 w-40" />
                <div className="space-y-8">
                    <div className="space-y-3">
                        <Skeleton className="h-5 w-1/3" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                    </div>
                    <div className="space-y-3">
                        <Skeleton className="h-5 w-1/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                </div>
            </ContentCard>

            <ContentCard density="spacious" className="w-full">
                <Skeleton className="mb-6 h-8 w-56" />
                <div className="space-y-3">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </ContentCard>
        </div>
    );
}
