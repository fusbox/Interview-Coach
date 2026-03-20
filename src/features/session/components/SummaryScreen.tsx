import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button"
import { RotateCcw, Loader2 } from "lucide-react"
import { useSession } from "../context/SessionContext"
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/cn";

import { SectionHeader } from "@/components/patterns/SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { IconBadge } from "@/components/patterns/IconBadge";
import { ContentCard } from "@/components/patterns/ContentCard";
import { useSummaryPolling } from "../hooks/useSummaryPolling";
import { SessionSurvey } from "./SessionSurvey";
import { getIconForTitle, parseDebrief } from "./SummaryUtilities";

const STOCK_NARRATIVES = [
    "The candidate demonstrated high proficiency and readiness for the role across all evaluated questions.",
    "Strong performance with minor areas for refinement; the candidate shows solid potential.",
    "The candidate would benefit from additional practice in several key competency areas.",
    "Excellent communication and problem-solving skills evident throughout the session.",
    "The candidate provided thorough and structured responses, indicating strong competency."
];

export default function SummaryScreen() {
    const { session, createNewSession, refresh } = useSession();
    const router = useRouter();

    const hasNarrative = session?.summaryNarrative && !STOCK_NARRATIVES.includes(session.summaryNarrative);

    // Dynamic Greeting Logic (Replicated from LandingScreen)
    const titleText = useMemo(() => {
        const defaultTitle = "Session Complete!";
        if (!session?.enteredInitials || !session?.candidate?.firstName || !session?.candidate?.lastName) {
            return defaultTitle;
        }

        const expectedInitials = `${session.candidate.firstName[0]}${session.candidate.lastName[0]}`.toUpperCase();
        if (session.enteredInitials.toUpperCase() === expectedInitials) {
            return `Great practice round, ${session.candidate.firstName}!`;
        }
        return defaultTitle;
    }, [session?.enteredInitials, session?.candidate?.firstName, session?.candidate?.lastName]);

    const descriptionText = hasNarrative 
        ? "Here's your feedback summary. You'll also receive an email of this report."
        : "One moment while I create your feedback summary";

    const [isCreating, setIsCreating] = useState(false);

    // Phase 2: Extracted Polling Hook
    useSummaryPolling({
        hasNarrative: !!hasNarrative,
        isCreating,
        refresh
    });

    const handlePracticeAgain = async () => {
        if (isCreating) return;
        setIsCreating(true);
        try {
            const role = session?.role || "General Interview";
            const result = await createNewSession(role, session?.id);
            if (result?.candidateToken) {
                router.push(`/s/${result.candidateToken}`);
            }
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="relative w-full flex flex-col items-center justify-center font-sans text-foreground bg-gradient-to-br from-brand-glass-start to-brand-glass-end min-h-[100dvh]">
            <div className="absolute inset-0 bg-white/40 dark:bg-black/20 backdrop-blur-md pointer-events-none" />
            <div className="relative z-10 w-full max-w-4xl flex flex-col items-center text-center space-y-12 px-6 py-12 md:px-12">

                {/* Logo & Headline Section */}
                <div className="flex flex-col items-start gap-1 w-full">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="relative h-12 w-auto mb-6 shrink-0"
                    >
                        <Image
                            src="/rangam-logo.webp"
                            alt="Rangam"
                            width={200}
                            height={48}
                            className="h-12 w-auto object-contain"
                            style={{ width: 'auto', height: 'auto' }}
                            priority
                            unoptimized
                        />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className="w-full space-y-4 text-left"
                    >
                        <h1 className="text-2xl md:text-3xl font-bold text-primary leading-tight font-display">
                            {titleText}
                        </h1>
                        <p className="text-lg text-text-secondary leading-relaxed">
                            {descriptionText}
                        </p>
                    </motion.div>
                </div>

                {/* Markdown Summary Render Render as Cards */}
                {session?.summaryNarrative && !STOCK_NARRATIVES.includes(session.summaryNarrative) ? (
                    <div className="w-full flex flex-col gap-6">
                        {parseDebrief(session.summaryNarrative).map((section, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 + (idx * 0.1), duration: 0.8 }}
                            >
                                <ContentCard density="spacious" className="w-full">
                                    <div className="mb-3 flex items-center gap-4 border-b border-border/60 pb-4">
                                        <IconBadge {...getIconForTitle(section.title)} size="sm" />
                                        <h3 className="text-2xl font-bold text-text-primary">
                                            {section.title}
                                        </h3>
                                    </div>
                                    <div className="prose max-w-none prose-p:text-text-secondary prose-p:leading-relaxed prose-p:text-lg prose-li:text-lg prose-strong:text-text-primary">
                                        <ReactMarkdown components={{
                                            strong: ({ className, ...props }) => <strong className={cn("font-bold text-text-primary", className)} {...props} />,
                                            p: ({ className, ...props }) => <p className={cn("mb-5 last:mb-0", className)} {...props} />,
                                            li: ({ className, ...props }) => <li className={cn("mb-5 last:mb-0", className)} {...props} />
                                        }}>
                                            {section.content}
                                        </ReactMarkdown>
                                    </div>
                                </ContentCard>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="w-full flex flex-col gap-6" aria-busy="true" aria-live="polite">
                        {/* Executive Summary Skeleton */}
                        <ContentCard density="spacious" className="w-full">
                            <Skeleton className="h-8 w-48 mb-6" />
                            <div className="space-y-3">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                        </ContentCard>

                        {/* Core Strengths Skeleton */}
                        <ContentCard density="spacious" className="w-full">
                            <Skeleton className="h-8 w-40 mb-6" />
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

                        {/* Primary Growth Area Skeleton */}
                        <ContentCard density="spacious" className="w-full">
                            <Skeleton className="h-8 w-56 mb-6" />
                            <div className="space-y-3">
                                <Skeleton className="h-5 w-1/3" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        </ContentCard>

                        {/* Readiness & Next Steps Skeleton */}
                        <ContentCard density="spacious" className="w-full">
                            <Skeleton className="h-8 w-52 mb-6" />
                            <Skeleton className="h-4 w-3/4" />
                        </ContentCard>
                    </div>
                )}

                {/* End of Session Survey */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="w-full max-w-2xl bg-transparent border-none shadow-none p-0 space-y-10"
                >
                    <div className="text-center space-y-2">
                        <SectionHeader
                            title="How was your session?"
                            className="flex-col items-center text-center sm:flex-col sm:items-center sm:justify-center"
                            description={<span className="italic">Your feedback helps us improve the coaching experience.</span>}
                        />
                    </div>

                    <SessionSurvey sessionId={session?.id} />

                </motion.div>

                {/* Action Area */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9, duration: 0.8 }}
                    className="w-full max-w-2xl flex flex-col items-center"
                >
                    <div className="w-full">
                        <Button
                            emphasis="primary"
                            density="hero"
                            shape="app"
                            label="strong"
                            onClick={handlePracticeAgain}
                            disabled={isCreating}
                            className="w-full h-16 gap-3 text-lg shadow-floating"
                        >
                            {isCreating ? <Loader2 className="animate-spin" size={24} /> : <RotateCcw size={24} />}
                            Practice Again
                        </Button>
                    </div>
                </motion.div>

                {/* Footer Notes (Moved to bottom) */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    transition={{ delay: 1.2, duration: 1 }}
                    className="w-full max-w-2xl text-center space-y-2 pb-4"
                >
                    <p className="text-text-secondary text-sm font-medium">
                        Your completion progress has been shared with your recruiter.
                    </p>
                    <p className="text-text-muted text-xs">
                        You may now safely close this window.
                    </p>
                </motion.div>

                {/* Tagline Lockup (Aligned with Landing) */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="flex flex-row items-center justify-center gap-[0.4rem] text-muted-foreground font-medium tracking-wide whitespace-nowrap pt-8"
                >
                    <span className="uppercase text-micro sm:text-xs tracking-widest translate-y-px">
                        Workforce Readiness Powered By
                    </span>
                    <div className="relative h-4 w-16 sm:h-5 sm:w-20 flex-shrink-0">
                        <Image
                            src="/rangam-logo.webp"
                            alt="Rangam"
                            fill
                            sizes="(max-width: 640px) 64px, 80px"
                            className="object-contain opacity-80"
                            unoptimized
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
