'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { captureFeedbackAction } from '@/app/actions/feedback';

export function PreparationLiftPrompt({ recruiterEmail }: { recruiterEmail: string }) {
    const [isVisible, setIsVisible] = useState(false);
    const [rating, setRating] = useState<number | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Only show if not previously dismissed/submitted in this session
    useEffect(() => {
        const dismissed = localStorage.getItem('hide_prep_lift_prompt');
        if (!dismissed) {
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleRating = async (r: number) => {
        setRating(r);
        setIsSubmitted(true);
        try {
            await captureFeedbackAction({
                type: 'recruiter_preparation_lift',
                rating: r,
                metadata: { recruiter_email: recruiterEmail }
            });
            // Auto-hide after 3 seconds
            setTimeout(() => {
                setIsVisible(false);
                localStorage.setItem('hide_prep_lift_prompt', 'true');
            }, 3000);
        } catch (err) {
            console.error('Failed to capture preparation lift', err);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('hide_prep_lift_prompt', 'true');
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -20, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -20, height: 0 }}
                    className="overflow-hidden"
                >
                    <div className="mb-8 p-6 bg-surface-subtle border border-border rounded-3xl relative flex flex-col lg:flex-row items-center justify-between gap-6 shadow-flat transition-all duration-base ease-standard">
                        <div className="flex-1 text-center lg:text-left">
                            <h3 className="text-lg font-bold text-text-primary mb-1">
                                Candidate Preparation Signal
                            </h3>
                            <p className="text-text-muted font-medium">
                                In your experience, do candidates seem more prepared after using this tool?
                            </p>
                        </div>

                        {!isSubmitted ? (
                            <div className="flex flex-col items-center lg:items-end gap-3 pr-8">
                                <div className="flex items-center gap-2">
                                    {[1, 2, 3, 4, 5].map((val) => (
                                        <button
                                            key={val}
                                            onClick={() => handleRating(val)}
                                            className={cn(
                                                "w-11 h-11 rounded-2xl border-2 flex items-center justify-center font-bold text-lg transition-all duration-base ease-standard active:scale-95",
                                                rating === val
                                                    ? "bg-primary border-primary text-primary-foreground shadow-raised-1"
                                                    : "bg-surface-base border-border text-text-muted hover:border-primary/50 hover:text-primary"
                                            )}
                                        >
                                            {val}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex justify-between w-full max-w-[240px] text-[10px] font-bold uppercase tracking-wider text-text-disabled">
                                    <span>No noticeable lift</span>
                                    <span>Significant lift</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold animate-in fade-in zoom-in-95 pr-8">
                                <CheckCircle2 size={24} />
                                <span>Feedback saved. Thank you!</span>
                            </div>
                        )}

                        <button
                            onClick={handleDismiss}
                            className="absolute top-4 right-4 p-2 text-indigo-300 hover:text-indigo-600 transition-colors z-10"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
