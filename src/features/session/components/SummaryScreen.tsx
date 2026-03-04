import { useState } from "react";
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

const STOCK_NARRATIVES = [
    "The candidate demonstrated high proficiency and readiness for the role across all evaluated questions.",
    "Strong performance with minor areas for refinement; the candidate shows solid potential.",
    "The candidate would benefit from additional practice in several key competency areas.",
    "The session is incomplete or the responses were too brief to establish a definitive readiness level.",
    "No readiness assessment available yet."
];

export default function SummaryScreen() {
    const { session, createNewSession } = useSession();
    const router = useRouter();

    const [isCreating, setIsCreating] = useState(false);
    const [survey, setSurvey] = useState<Record<string, string | number>>({});
    const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

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
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-6 md:p-12">
            <div className="w-full max-w-4xl flex flex-col items-center text-center space-y-12">

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
                        className="space-y-4 w-full"
                    >
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-display tracking-tight text-slate-900">
                            Session Complete!
                        </h1>
                        <p className="text-lg md:text-xl text-muted-foreground/80 max-w-md mx-auto leading-relaxed">
                            Great job practicing. Here&apos;s your debrief based on your performance.
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
                                className="w-full text-left bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-10 shadow-xl border border-slate-200 dark:border-white/10"
                            >
                                <h3 className="text-2xl font-black mb-6 text-slate-900 dark:text-white pb-4 border-b border-slate-100 dark:border-slate-800/60">
                                    {section.title}
                                </h3>
                                <div className="prose prose-slate dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-lg prose-li:text-lg prose-strong:text-slate-900 dark:prose-strong:text-white">
                                    <ReactMarkdown components={{
                                        strong: ({ className, ...props }) => <strong className={cn("font-bold text-slate-900 dark:text-white", className)} {...props} />,
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
                        <p className="text-slate-500 font-medium">Analyzing your responses and generating debrief...</p>
                    </motion.div>
                )}

                {/* End of Session Survey */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="w-full max-w-2xl bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 md:p-12 space-y-10"
                >
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-slate-900 font-display">How was your session?</h3>
                        <p className="text-slate-500 font-medium italic">Your feedback helps us improve the coaching experience.</p>
                    </div>

                    <div className="space-y-12">
                        {/* 1. Confidence Delta */}
                        <div className="space-y-4">
                            <p className="text-lg font-bold text-slate-800 text-center md:text-left">
                                &ldquo;I feel more prepared after this session.&rdquo;
                            </p>
                            <div className="flex justify-center md:justify-start gap-2">
                                {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                        key={val}
                                        onClick={() => handleSurveySelect('confidence_delta', val)}
                                        className={cn(
                                            "w-12 h-12 rounded-2xl border-2 flex items-center justify-center font-bold text-lg transition-all duration-300",
                                            survey.confidence_delta === val
                                                ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-110"
                                                : "bg-white border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-600"
                                        )}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Psychological Safety */}
                        <div className="space-y-4">
                            <p className="text-lg font-bold text-slate-800 text-center md:text-left">
                                &ldquo;I felt safe to focus on my growth during this session.&rdquo;
                            </p>
                            <div className="flex justify-center md:justify-start gap-2">
                                {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                        key={val}
                                        onClick={() => handleSurveySelect('psychological_safety', val)}
                                        className={cn(
                                            "w-12 h-12 rounded-2xl border-2 flex items-center justify-center font-bold text-lg transition-all duration-300",
                                            survey.psychological_safety === val
                                                ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-110"
                                                : "bg-white border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-600"
                                        )}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Repeat Intent */}
                        <div className="space-y-4">
                            <p className="text-lg font-bold text-slate-800 text-center md:text-left">
                                &ldquo;I would use this again to prepare for a different role.&rdquo;
                            </p>
                            <div className="flex justify-center md:justify-start gap-4">
                                <button
                                    onClick={() => handleSurveySelect('repeat_intent', 'yes')}
                                    className={cn(
                                        "flex-1 md:flex-none px-8 py-3 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all duration-300",
                                        survey.repeat_intent === 'yes'
                                            ? "bg-green-600 border-green-600 text-white shadow-lg"
                                            : "bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-600"
                                    )}
                                >
                                    <ThumbsUp size={18} /> Yes
                                </button>
                                <button
                                    onClick={() => handleSurveySelect('repeat_intent', 'no')}
                                    className={cn(
                                        "flex-1 md:flex-none px-8 py-3 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all duration-300",
                                        survey.repeat_intent === 'no'
                                            ? "bg-slate-900 border-slate-900 text-white shadow-lg"
                                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-800 hover:text-slate-900"
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

                {/* Primary Action */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.0, duration: 0.8, ease: "easeOut" }}
                    className="w-full max-w-sm pt-8"
                >
                    <Button
                        size="lg"
                        className="w-full h-14 text-lg rounded-full shadow-lg shadow-blue-900/20 bg-blue-600 hover:bg-blue-700 hover:shadow-blue-900/40 hover:-translate-y-0.5 transition-all gap-3 text-white font-bold"
                        onClick={handlePracticeAgain}
                    >
                        <RotateCcw className="w-5 h-5" /> Practice Again
                    </Button>
                </motion.div>

                {/* Tagline Lockup (Aligned with Landing) */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="flex flex-row items-center justify-center gap-[0.4rem] text-muted-foreground/60 font-medium tracking-wide whitespace-nowrap pt-8"
                >
                    <span className="uppercase text-[10px] sm:text-xs tracking-[0.1em] translate-y-[1px]">
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
