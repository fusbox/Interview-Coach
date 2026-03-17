import * as React from "react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";
import { FeedbackPill } from "./FeedbackPill";
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
    scaleType?: 'emoji' | 'numeric';
    successText?: string;
    lowLabel?: string;
    highLabel?: string;
}

export function FeedbackCard({
    title,
    type,
    metadata = {},
    className,
    onSuccess,
    scaleType = 'emoji',
    successText = 'Saved',
    lowLabel,
    highLabel
}: FeedbackCardProps) {
    const [rating, setRating] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-hide success checkmark after 1.5s
    useEffect(() => {
        if (showSuccess) {
            const timer = setTimeout(() => setShowSuccess(false), 1500);
            return () => clearTimeout(timer);
        }
    }, [showSuccess]);

    const handleRate = async (val: number) => {
        setRating(val);
        setIsSubmitting(true);
        setError(null);
        setShowSuccess(false);

        try {
            const res = await captureFeedbackAction({
                type,
                rating: val,
                metadata
            });

            if (res.success) {
                setShowSuccess(true);
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
            "relative flex flex-wrap items-center justify-between gap-4 md:gap-6 p-5 md:p-6 rounded-[2rem] border transition-all duration-500",
            "bg-purple-50/50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800/30 shadow-sm hover:shadow-md",
            className
        )}>
            <span className="text-base md:text-lg font-bold text-purple-900/80 dark:text-purple-100/80">
                {title}
            </span>
            <div className="flex flex-col items-center gap-3">
                <div className="relative flex flex-col items-center gap-2">
                    <div className="flex gap-1.5 md:gap-2">
                        {EMOJI_SCALE.map(({ val, emoji }) => (
                            <button
                                key={val}
                                onClick={() => handleRate(val)}
                                disabled={isSubmitting}
                                className={cn(
                                    "w-12 h-12 md:w-14 md:h-14 rounded-2xl border-2 flex items-center justify-center transition-all duration-300",
                                    scaleType === 'emoji' ? "text-3xl" : "text-xl font-black font-display",
                                    rating === val
                                        ? "bg-white dark:bg-purple-900 border-purple-400/50 shadow-lg scale-110 saturate-100 opacity-100 text-purple-600"
                                        : "bg-transparent border-transparent text-text-muted hover:border-purple-200 hover:scale-105 saturate-80 opacity-80 hover:saturate-100 hover:opacity-100",
                                    (isSubmitting || showSuccess) && "pointer-events-none"
                                )}
                                title={`Rate ${val}/5`}
                            >
                                {scaleType === 'emoji' ? emoji : val}
                            </button>
                        ))}

                        <FeedbackPill isVisible={showSuccess} text={successText} />
                    </div>
                    
                    {(lowLabel || highLabel) && (
                        <div className="flex justify-between w-full px-1 text-[10px] font-bold uppercase tracking-widest text-purple-900/40 dark:text-purple-100/40">
                            <span>{lowLabel}</span>
                            <span>{highLabel}</span>
                        </div>
                    )}
                </div>
                {error && (
                    <p className="text-destructive text-[10px] font-bold uppercase tracking-widest animate-in fade-in slide-in-from-top-1">
                        {error}
                    </p>
                )}
            </div>

            {isSubmitting && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-base/20 backdrop-blur-[1px] rounded-[2rem]">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            )}
        </div>
    );
}
