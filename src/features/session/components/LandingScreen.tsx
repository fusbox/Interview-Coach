import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button"
import { motion } from 'framer-motion';

import { Clock, ShieldCheck } from "lucide-react"
import { audioEngine } from '@/features/audio/audio-engine';
import { useSession } from '../context/SessionContext';
import { cn } from '@/lib/cn';
import { captureFeedbackAction } from '@/app/actions/feedback';
import { FeedbackPill } from '@/components/patterns/FeedbackPill';

import { Variants } from 'framer-motion';
import { EMOJI_SCALE } from '@/components/patterns/FeedbackCard';

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

interface LandingScreenProps {
    onStart: () => void;
    role?: string;
}

export default function LandingScreen({ onStart, role = "Candidate" }: LandingScreenProps) {
    const { session } = useSession();
    const firstQuestion = session?.questions?.[0];
    const [rating, setRating] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showCopySuccess, setShowCopySuccess] = useState(false);

    // Dynamic Greeting Logic
    const welcomeText = useMemo(() => {
        const defaultWelcome = "Let’s get you ready for your interview.";
        if (!session?.enteredInitials || !session?.candidate?.firstName || !session?.candidate?.lastName) {
            return defaultWelcome;
        }

        const expectedInitials = `${session.candidate.firstName[0]}${session.candidate.lastName[0]}`.toUpperCase();
        if (session.enteredInitials.toUpperCase() === expectedInitials) {
            return `Hi ${session.candidate.firstName}, let’s get you ready for your interview.`;
        }
        return defaultWelcome;
    }, [session?.enteredInitials, session?.candidate?.firstName, session?.candidate?.lastName]);

    // Silent Prefetch for Practice Again
    // If the audioEngine is already unlocked from a previous session, this gracefully
    // fetches and caches Q1's audio while the user reads the landing screen.
    useEffect(() => {
        if (firstQuestion) {
            audioEngine.prefetch(firstQuestion.id, firstQuestion.text);
        }
    }, [firstQuestion]);

    const handleRatingSelect = async (val: number) => {
        setRating(val);
        setShowSuccess(false);
        // Auto-capture on tap
        try {
            await captureFeedbackAction({
                sessionId: session?.id,
                type: 'candidate_baseline',
                rating: val,
                metadata: { role }
            });
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        } catch (err) {
            console.error('Failed to capture baseline feedback', err);
        }
    };

    const handleBegin = () => {
        setIsSubmitting(true);
        audioEngine.unlock().then(() => {
            if (firstQuestion) {
                audioEngine.prefetch(firstQuestion.id, firstQuestion.text);
            }
        });
        onStart();
    };

    return (
        <div className="relative w-full flex flex-col flex-1 font-sans text-foreground bg-gradient-to-br from-brand-glass-start to-brand-glass-end">
            <div className="absolute inset-0 bg-surface-base/40 dark:bg-surface-base/10 backdrop-blur-md pointer-events-none" />

            <motion.div
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={{
                    hidden: { opacity: 0 },
                    visible: {
                        opacity: 1,
                        transition: { staggerChildren: 0.15 }
                    }
                }}
                className="relative z-10 w-full flex-1 max-w-xl mx-auto px-6 py-6 md:py-8 space-y-6 flex flex-col min-h-screen md:min-h-full"
            >
                {/* 1. Logo Area */}
                <motion.div variants={fadeUp} className="flex justify-between items-center shrink-0">
                    <Image
                        src="/rangam-logo.webp"
                        alt="Rangam"
                        width={180}
                        height={40}
                        className="h-10 w-auto object-contain"
                        style={{ width: 'auto', height: 'auto' }}
                        priority
                    />
                </motion.div>

                {/* 2. Welcome Message & Intro Copy */}
                <motion.div variants={fadeUp} className="space-y-4 text-left">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary leading-tight font-display">
                        {welcomeText}
                    </h1>
                    <p className="text-lg text-text-secondary leading-relaxed">
                        You&apos;ll answer a series of interview-style questions tailored to your target role: <strong className="font-bold text-text-primary">{role}</strong>.
                    </p>
                </motion.div>

                {/* Key Points */}
                <motion.div variants={fadeUp} className="w-full space-y-4 flex flex-col relative z-10">
                    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-surface-base border border-border/50 shadow-sm transition-all duration-base">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-state-info/10 border border-state-info/20 shadow-flat flex items-center justify-center shrink-0">
                                <Clock className="w-5 h-5 text-state-info" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-text-primary">No Time Limit</h3>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    Take your time. Thoughtful answers lead to better feedback.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-state-info/5 rounded-xl relative border-l-4 border-state-info/50 w-full animate-in fade-in slide-in-from-top-1 duration-slow">
                            <p className="text-sm text-text-secondary leading-relaxed">
                                Need to step away?{" "}
                                <span className="relative inline-block">
                                    <button
                                        onClick={() => {
                                            const url = window.location.href;
                                            navigator.clipboard.writeText(url);
                                            setShowCopySuccess(true);
                                            setTimeout(() => setShowCopySuccess(false), 2000);
                                        }}
                                        className="text-primary font-bold hover:underline"
                                    >
                                        Copy your practice link.
                                    </button>
                                    <FeedbackPill isVisible={showCopySuccess} text="Link Copied" />
                                </span>
                                {" "}You&apos;ll pick up where you left off when you return.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-5 rounded-2xl bg-surface-base border border-border/50 shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-950 border border-purple-100 dark:border-purple-900 shadow-flat flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-bold text-text-primary">Private Coaching Feedback</h3>
                            <div className="space-y-4">
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    After each answer, your coach looks at <strong className="font-bold text-text-primary">what you said</strong> and <strong className="font-bold text-text-primary">how you structured it - things like clarity, specificity, and relevance to the role.</strong>
                                </p>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    Feedback is based on the substance of your response, not on accent, speaking style, or delivery polish. There are no scores or rankings, just concrete suggestions framed as things to try.
                                </p>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    Coaching insights are visible <strong className="font-bold text-text-primary">only to you.</strong>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center px-6 py-4 md:py-0 md:h-16 bg-gradient-to-r from-brand-deep to-brand-deep/80 rounded-2xl border border-brand-deep/30 shadow-raised-1 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-orange" />
                        <h3 className="text-white font-bold text-lg m-0 drop-shadow-sm leading-tight md:leading-normal">This space is for skill-building &mdash; not evaluation.</h3>
                    </div>

                    {/* Baseline Question */}
                    <div className="pt-4 space-y-6">
                        <div className="flex flex-col items-start gap-1">
                            <h4 className="text-micro font-bold uppercase tracking-widest text-text-muted">Before we start:</h4>
                            <div className="flex items-center justify-between w-full">
                                <p className="text-lg font-medium text-text-primary text-left">How prepared do you feel for your upcoming interview?</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 w-full">
                            {EMOJI_SCALE.map(({ val, emoji }) => (
                                <div key={val} className="relative flex-1 max-w-[64px]">
                                    <button
                                        onClick={() => handleRatingSelect(val)}
                                        className={cn(
                                            "w-full aspect-square rounded-2xl border-2 flex items-center justify-center text-3xl transition-all duration-300",
                                            rating === val
                                                ? "bg-surface-base dark:bg-brand-deep/10 border-primary/50 shadow-lg scale-110 saturate-100 opacity-100"
                                                : "bg-transparent border-border text-text-muted hover:border-primary/30 hover:scale-105 saturate-80 opacity-80 hover:saturate-100 hover:opacity-100"
                                        )}
                                        title={`Rate ${val}/5`}
                                    >
                                        {emoji}
                                    </button>
                                    <FeedbackPill isVisible={showSuccess && rating === val} text="Saved" />
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between w-full px-1 text-micro font-bold uppercase tracking-tighter text-text-muted">
                            <span>Not prepared</span>
                            <span>Very prepared</span>
                        </div>
                    </div>
                </motion.div>


                {/* CTA */}
                <motion.div variants={fadeUp} className="pb-8 pt-4 mt-auto">
                    <Button
                        size="lg"
                        onClick={handleBegin}
                        disabled={isSubmitting || !rating}
                        className={cn(
                            "w-full py-6 text-lg rounded-2xl transition-all shadow-floating font-bold h-auto",
                            rating
                                ? "bg-primary hover:bg-primary/90 text-primary-foreground hover:-translate-y-0.5"
                                : "bg-surface-subtle text-text-muted cursor-not-allowed"
                        )}
                    >
                        {isSubmitting ? "Generating Session..." : "Begin First Question"}
                    </Button>
                </motion.div>
            </motion.div>
        </div >
    )
}
