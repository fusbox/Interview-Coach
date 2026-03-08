import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { CheckCircle2, Loader2 } from "lucide-react";
import { captureFeedbackAction } from "@/app/actions/feedback";

export const EMOJI_SCALE = [
    { val: 1, emoji: "🙁" },
    { val: 2, emoji: "😐" },
    { val: 3, emoji: "🙂" },
    { val: 4, emoji: "😊" },
    { val: 5, emoji: "🤩" }
];

interface FeedbackCardProps {
    title: string;
    type: string;
    metadata?: Record<string, string | number | boolean | undefined>;
    className?: string;
    onSuccess?: () => void;
}

export function FeedbackCard({
    title,
    type,
    metadata = {},
    className,
    onSuccess
}: FeedbackCardProps) {
    const [rating, setRating] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRate = async (val: number) => {
        setRating(val);
        setIsSubmitting(true);
        setError(null);

        try {
            const res = await captureFeedbackAction({
                type,
                rating: val,
                metadata
            });

            if (res.success) {
                setIsSubmitted(true);
                onSuccess?.();
            } else {
                throw new Error("Failed to capture feedback");
            }
        } catch (err) {
            console.error("[FeedbackCard] Error:", err);
            setError("Could not save feedback. Please try again.");
            setRating(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={cn(
            "flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-[2rem] border transition-all duration-500",
            isSubmitted
                ? "bg-state-success/5 border-state-success/20 shadow-flat"
                : "bg-purple-50/50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800/30 shadow-sm hover:shadow-md",
            className
        )}>
            {!isSubmitted ? (
                <>
                    <span className="text-lg font-bold text-purple-900/80 dark:text-purple-100/80 tracking-tight">
                        {title}
                    </span>
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex gap-1.5 md:gap-2">
                            {EMOJI_SCALE.map(({ val, emoji }) => (
                                <button
                                    key={val}
                                    onClick={() => handleRate(val)}
                                    disabled={isSubmitting}
                                    className={cn(
                                        "w-12 h-12 md:w-14 md:h-14 rounded-2xl border-2 flex items-center justify-center text-3xl transition-all duration-300",
                                        rating === val
                                            ? "bg-white dark:bg-purple-900 border-purple-400/50 shadow-lg scale-110 saturate-100 opacity-100"
                                            : "bg-transparent border-transparent text-text-muted hover:border-purple-200 hover:scale-105 saturate-50 opacity-60 hover:saturate-100 hover:opacity-100",
                                        isSubmitting && "pointer-events-none"
                                    )}
                                    title={`Rate ${val}/5`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        {error && (
                            <p className="text-destructive text-[10px] font-bold uppercase tracking-widest animate-in fade-in slide-in-from-top-1">
                                {error}
                            </p>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex items-center justify-center gap-3 w-full py-2 animate-in fade-in slide-in-from-left-4">
                    <CheckCircle2 className="w-6 h-6 text-state-success" />
                    <span className="text-lg font-bold text-state-success tracking-tight">
                        Thanks for your feedback!
                    </span>
                </div>
            )}

            {isSubmitting && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/20 dark:bg-black/20 backdrop-blur-[1px] rounded-[2rem]">
                    <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                </div>
            )}
        </div>
    );
}
