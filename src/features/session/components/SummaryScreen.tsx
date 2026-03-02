import { useState } from "react";
import { Button } from "@/components/ui/button"
import { RotateCcw, Loader2 } from "lucide-react"
import { useSession } from "../context/SessionContext"
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/cn";

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

    return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-6 md:p-12">
            <div className="w-full max-w-2xl flex flex-col items-center text-center space-y-12">

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

                {/* Markdown Summary Render */}
                {session?.summaryNarrative && !STOCK_NARRATIVES.includes(session.summaryNarrative) ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                        className="w-full text-left bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-12 shadow-xl border border-slate-200 dark:border-white/10"
                    >
                        <div className="prose prose-slate dark:prose-invert max-w-none prose-h3:text-2xl prose-h3:font-black prose-h3:mb-4 prose-h3:text-slate-900 dark:prose-h3:text-white prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-lg prose-li:text-lg prose-strong:text-slate-900 dark:prose-strong:text-white">
                            <ReactMarkdown components={{
                                strong: ({ className, ...props }) => <strong className={cn("font-bold text-slate-900 dark:text-white", className)} {...props} />,
                            }}>
                                {session.summaryNarrative}
                            </ReactMarkdown>
                        </div>
                    </motion.div>
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

                {/* Primary Action */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                    className="w-full max-w-sm"
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
