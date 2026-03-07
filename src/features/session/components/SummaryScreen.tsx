import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button"
import { RotateCcw, Loader2 } from "lucide-react"
import { useSession } from "../context/SessionContext"
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/cn";
import { captureFeedbackAction } from "@/app/actions/feedback";
import { ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
import { SectionHeader } from "@/components/patterns/SectionHeader";

const STOCK_NARRATIVES = [
    "The candidate demonstrated high proficiency and readiness for the role across all evaluated questions.",
    "Strong performance with minor areas for refinement; the candidate shows solid potential.",
    "The candidate would benefit from additional practice in several key competency areas.",
    "The session is incomplete or the responses were too brief to establish a definitive readiness level.",
    "No readiness assessment available yet."
];

export default function SummaryScreen() {
    const { session, createNewSession, refresh } = useSession();
    const router = useRouter();

    const hasNarrative = session?.summaryNarrative && !STOCK_NARRATIVES.includes(session.summaryNarrative);

    const [isCreating, setIsCreating] = useState(false);
    const [survey, setSurvey] = useState<Record<string, string | number>>({});
    const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

    // Polling for summary narrative
    useEffect(() => {
        if (hasNarrative || isCreating) return;

        console.log("[SummaryScreen] Narrative missing, starting polling...");
        const interval = setInterval(() => {
            refresh().catch(err => console.error("[SummaryScreen] Refresh failed:", err));
        }, 3000);

        return () => clearInterval(interval);
    }, [hasNarrative, isCreating, refresh]);

    const handleSurveySelect = async (key: string, val: string | number) => {
        setSurvey(prev => ({ ...prev, [key]: val }));
        setSubmitted(prev => ({ ...prev, [key]: true }));

        try {
            await captureFeedbackAction({
                sessionId: session?.id,
                type: `session_completion_${key}`,
                rating: typeof val === 'number' ? val : undefined,
                comment: typeof val === 'string' ? val : undefined,
                metadata: { question: key }
            });
        } catch (err) {
            console.error('Failed to capture survey response', err);
        }
    };

    const handlePracticeAgain = async () => {
        if (isCreating) return;
        setIsCreating(true);
        try {
            const role = session?.role || "Product Manager";
            const result = await createNewSession(role, session?.id);
            if (result?.candidateToken) {
                router.push(`/s/${result.candidateToken}`);
            }
        } finally {
            setIsCreating(false);
        }
    };

    const parseDebrief = (text: string) => {
        if (!text) return [];
        const parts = text.split(/(?=### )/g).filter(p => p.trim() !== '');

        if (parts.length === 1 && !parts[0].trim().startsWith('###')) {
            return [{ title: "Session Debrief", content: text }];
        }

        return parts.map(part => {
            const lines = part.trim().split('\n');
            const titleLine = lines[0];
            const title = titleLine.replace(/^###\s*/, '').replace(/\*+/g, '').trim();
            const content = lines.slice(1).join('\n').trim();
            return { title, content };
        });
    };

    return (
        <div className="relative w-full flex flex-col items-center justify-center font-sans text-foreground bg-gradient-to-br from-brand-glass-start to-brand-glass-end min-h-[100dvh]">
            <div className="absolute inset-0 bg-white/40 dark:bg-black/20 backdrop-blur-md pointer-events-none" />
            <div className="relative z-10 w-full max-w-4xl flex flex-col items-center text-center space-y-12 px-6 py-12 md:px-12">

                {/* Logo & Headline Section */}
                <div className="flex flex-col items-center gap-1 w-full">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="relative w-24 h-24 mb-6"
                    >
                        <Image
                            src="/r2w-logo.webp"
                            alt="Ready2Work Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className="w-full max-w-xl mx-auto"
                    >
                        <SectionHeader
                            title="Session Complete!"
                            size="lg"
                            className="flex-col items-center text-center sm:flex-col sm:items-center sm:justify-center"
                            description="Great job practicing. Here's your debrief based on your performance."
                        />
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
                                className="w-full text-left bg-card rounded-3xl p-8 md:p-10 shadow-raised-2 border border-border"
                            >
                                <h3 className="text-2xl font-black mb-3 text-text-primary pb-4 border-b border-border/60">
                                    {section.title}
                                </h3>
                                <div className="prose max-w-none prose-p:text-text-secondary prose-p:leading-relaxed prose-p:text-lg prose-li:text-lg prose-strong:text-text-primary">
                                    <ReactMarkdown components={{
                                        strong: ({ className, ...props }) => <strong className={cn("font-bold text-text-primary", className)} {...props} />,
                                        p: ({ className, ...props }) => <p className={cn("mb-5 last:mb-0", className)} {...props} />,
                                        li: ({ className, ...props }) => <li className={cn("mb-5 last:mb-0", className)} {...props} />
                                    }}>
                                        {section.content}
                                    </ReactMarkdown>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full flex flex-col items-center justify-center p-12 space-y-4"
                    >
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <p className="text-text-muted font-medium">Analyzing your responses and generating debrief...</p>
                    </motion.div>
                )}

                {/* End of Session Survey */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="w-full max-w-2xl bg-surface-subtle border shadow-flat rounded-2xl p-8 md:p-12 space-y-10"
                >
                    <div className="text-center space-y-2">
                        <SectionHeader
                            title="How was your session?"
                            className="flex-col items-center text-center sm:flex-col sm:items-center sm:justify-center"
                            description={<span className="italic">Your feedback helps us improve the coaching experience.</span>}
                        />
                    </div>

                    <div className="space-y-12">
                        {/* 1. Confidence Delta */}
                        <div className="space-y-4">
                            <p className="text-lg font-bold text-text-primary text-center">
                                I feel more prepared after this session.
                            </p>
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                        key={val}
                                        onClick={() => handleSurveySelect('confidence_delta', val)}
                                        className={cn(
                                            "w-12 h-12 rounded-2xl border-2 flex items-center justify-center font-bold text-lg transition-all duration-300",
                                            survey.confidence_delta === val
                                                ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-110"
                                                : "bg-surface-base border-border text-text-muted hover:border-primary/50 hover:text-primary"
                                        )}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Psychological Safety */}
                        <div className="space-y-4">
                            <p className="text-lg font-bold text-text-primary text-center">
                                I felt safe to focus on my growth during this session.
                            </p>
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                        key={val}
                                        onClick={() => handleSurveySelect('psychological_safety', val)}
                                        className={cn(
                                            "w-12 h-12 rounded-2xl border-2 flex items-center justify-center font-bold text-lg transition-all duration-300",
                                            survey.psychological_safety === val
                                                ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-110"
                                                : "bg-surface-base border-border text-text-muted hover:border-primary/50 hover:text-primary"
                                        )}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Repeat Intent */}
                        <div className="space-y-4">
                            <p className="text-lg font-bold text-text-primary text-center">
                                I would use this again to prepare for a different role.
                            </p>
                            <div className="flex justify-center gap-4">
                                <button
                                    onClick={() => handleSurveySelect('repeat_intent', 'yes')}
                                    className={cn(
                                        "flex-1 md:flex-none px-8 py-3 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all duration-300",
                                        survey.repeat_intent === 'yes'
                                            ? "bg-green-600 border-green-600 text-white shadow-lg"
                                            : "bg-surface-base border-border text-text-secondary hover:border-green-300 hover:text-green-600"
                                    )}
                                >
                                    <ThumbsUp size={18} /> Yes
                                </button>
                                <button
                                    onClick={() => handleSurveySelect('repeat_intent', 'no')}
                                    className={cn(
                                        "flex-1 md:flex-none px-8 py-3 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all duration-300",
                                        survey.repeat_intent === 'no'
                                            ? "bg-text-primary border-text-primary text-text-inverse shadow-lg"
                                            : "bg-surface-base border-border text-text-secondary hover:border-text-primary hover:text-text-primary"
                                    )}
                                >
                                    <ThumbsDown size={18} /> No
                                </button>
                            </div>
                        </div>
                    </div>

                    {Object.keys(submitted).length > 0 && (
                        <div className="pt-4 flex items-center justify-center gap-2 text-green-600 font-bold text-sm animate-in fade-in slide-in-from-bottom-2">
                            <CheckCircle2 size={16} />
                            Feedback captured. Thank you!
                        </div>
                    )}
                </motion.div>

                {/* Path Selection Area (Notice + Separator + Action) */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9, duration: 0.8 }}
                    className="w-full max-w-2xl flex flex-col items-center gap-10"
                >
                    <div className="w-full text-center space-y-3">
                        <p className="text-text-secondary text-lg md:text-xl font-medium">
                            Your completion progress has been shared with your recruiter.
                        </p>
                        <p className="text-text-muted text-base">
                            You may now safely close this window.
                        </p>
                    </div>

                    <div className="w-full flex items-center gap-4">
                        <div className="h-px flex-1 bg-border/60" />
                        <span className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">OR</span>
                        <div className="h-px flex-1 bg-border/60" />
                    </div>

                    <div className="w-full">
                        <Button
                            size="lg"
                            onClick={handlePracticeAgain}
                            disabled={isCreating}
                            className="w-full h-16 rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-lg hover:bg-blue-700 hover:scale-[1.01] transition-all flex items-center justify-center gap-3"
                        >
                            {isCreating ? <Loader2 className="animate-spin" size={24} /> : <RotateCcw size={24} />}
                            Practice Again
                        </Button>
                    </div>
                </motion.div>

                {/* Tagline Lockup (Aligned with Landing) */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="flex flex-row items-center justify-center gap-[0.4rem] text-muted-foreground/60 font-medium tracking-wide whitespace-nowrap pt-8"
                >
                    <span className="uppercase text-micro sm:text-xs tracking-widest translate-y-px">
                        Workforce Readiness Powered By
                    </span>
                    <div className="relative h-4 w-16 sm:h-5 sm:w-20 flex-shrink-0">
                        <Image
                            src="/rangam-logo.webp"
                            alt="Rangam"
                            fill
                            className="object-contain opacity-50"
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
