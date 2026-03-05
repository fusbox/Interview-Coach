import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button"
import { Clock, ShieldCheck } from "lucide-react"
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { audioEngine } from '@/features/audio/audio-engine';
import { useSession } from '../context/SessionContext';
import { cn } from '@/lib/cn';
import { captureFeedbackAction } from '@/app/actions/feedback';

interface LandingScreenProps {
    onStart: () => void;
    role?: string;
}

export default function LandingScreen({ onStart, role = "Candidate" }: LandingScreenProps) {
    const { session } = useSession();
    const firstQuestion = session?.questions?.[0];
    const [rating, setRating] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        // Auto-capture on tap
        try {
            await captureFeedbackAction({
                sessionId: session?.id,
                type: 'candidate_baseline',
                rating: val,
                metadata: { role }
            });
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
        <div className="min-h-[100dvh] w-full bg-background font-sans text-foreground selection:bg-primary/10 selection:text-primary overflow-y-auto">
            <div className="w-full max-w-xl mx-auto px-6 py-12 md:py-24 space-y-12 flex flex-col min-h-[100dvh]">

                {/* 1. Logo Area */}
                <div className="flex justify-between items-center shrink-0">
                    <Image
                        src="/rangam-logo.webp"
                        alt="Rangam"
                        width={200}
                        height={48}
                        className="h-12 w-auto object-contain"
                        priority
                    />
                </div>

                {/* 2. Primary Heading */}
                <div className="w-full">
                    <SectionHeader
                        title="Let's get you ready for your interview."
                        size="lg"
                        className="text-primary font-bold"
                    />
                </div>

                {/* 3. Introductory Copy */}
                <div className="space-y-6 text-lg text-text-secondary leading-relaxed text-left">
                    <p>
                        You&rsquo;ll answer a series of interview-style questions tailored to your role.
                    </p>
                </div>

                {/* Key Points */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-start gap-4 p-5 rounded-2xl bg-surface-subtle border shadow-flat">
                        <div className="w-10 h-10 rounded-xl bg-surface-base border shadow-flat flex items-center justify-center shrink-0">
                            <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-text-primary">No Time Limit</h3>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                Take your time. Thoughtful answers lead to better feedback.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-5 rounded-2xl bg-surface-subtle border shadow-flat">
                        <div className="w-10 h-10 rounded-xl bg-surface-base border shadow-flat flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-bold text-text-primary">Private Coaching Feedback</h3>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                After each answer, your coach looks at <strong className="text-text-primary">what you said</strong> and <strong className="text-text-primary">how you structured it</strong>&mdash;things like clarity, specificity, and relevance to the role.
                            </p>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                Feedback is based on the substance of your ideas, not on accent, speaking style, or delivery polish. There are no scores or rankings&mdash;just concrete suggestions framed as things to try, never as penalties.
                            </p>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                Coaching insights are visible <strong className="text-text-primary">only to you</strong>.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-center px-6 h-16 bg-surface-subtle rounded-2xl border shadow-raised-1 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />
                        <h3 className="text-primary font-bold text-lg m-0">This space is for skill-building &mdash; not evaluation.</h3>
                    </div>
                </div>

                {/* Baseline Question */}
                <div className="pt-4 space-y-6">
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Before we start:</h4>
                        <p className="text-lg font-medium text-text-primary text-left">How prepared do you feel for your upcoming interview?</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 w-full">
                        {[1, 2, 3, 4, 5].map((val) => (
                            <button
                                key={val}
                                onClick={() => handleRatingSelect(val)}
                                className={cn(
                                    "w-12 h-12 rounded-xl border-2 flex items-center justify-center font-bold text-lg transition-all duration-base ease-standard",
                                    rating === val
                                        ? "bg-primary border-primary text-white shadow-raised-2 scale-110"
                                        : "bg-surface-base border-border text-text-muted hover:border-primary/30 hover:text-primary"
                                )}
                            >
                                {val}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-between w-full px-1 text-[10px] font-bold uppercase tracking-tighter text-text-muted">
                        <span>Not prepared</span>
                        <span>Very prepared</span>
                    </div>
                </div>

                <div className="flex-1" />

                {/* CTA */}
                <div className="pt-8 pb-4 sticky bottom-0 bg-background/95 backdrop-blur-sm border-t md:border-t-0 md:bg-transparent">
                    <Button
                        size="lg"
                        onClick={handleBegin}
                        disabled={isSubmitting}
                        className={cn(
                            "w-full py-6 text-lg rounded-xl transition-all shadow-floating font-bold h-auto",
                            rating
                                ? "bg-primary hover:bg-primary/90 text-primary-foreground hover:-translate-y-0.5"
                                : "bg-surface-subtle text-text-muted cursor-not-allowed"
                        )}
                    >
                        {isSubmitting ? "Generating Session..." : "Begin First Question"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
