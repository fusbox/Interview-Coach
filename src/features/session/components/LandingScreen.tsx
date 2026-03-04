import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button"
import { Clock, ShieldCheck, Sparkles } from "lucide-react"
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

                {/* Header */}
                <div className="space-y-4 text-left">
                    <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-primary leading-tight font-display">
                        Let&rsquo;s get you ready for your next interview.
                    </h1>
                    <div className="space-y-4 text-lg text-muted-foreground leading-relaxed">
                        <p>
                            You&rsquo;ll answer a series of interview-style questions tailored to your role.
                        </p>
                        <p>
                            After each answer, you&rsquo;ll receive private, AI-generated coaching to help you refine and strengthen your response.
                        </p>
                    </div>
                </div>

                {/* Key Points */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
                            <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-slate-900">No Time Limit</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Take your time. Thoughtful answers lead to better feedback.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-slate-900">Private Coaching Feedback</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Your answers are analyzed to provide personalized improvement suggestions. Coaching insights are visible only to you.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-indigo-900 text-lg">This space is for skill-building &mdash; not evaluation.</h3>
                        </div>
                    </div>
                </div>

                {/* Baseline Question */}
                <div className="pt-4 space-y-6">
                    <div className="space-y-2">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">Before we start:</h4>
                        <p className="text-lg font-medium text-slate-900">How prepared do you feel for your upcoming interview?</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 max-w-sm">
                        {[1, 2, 3, 4, 5].map((val) => (
                            <button
                                key={val}
                                onClick={() => handleRatingSelect(val)}
                                className={cn(
                                    "w-12 h-12 rounded-xl border-2 flex items-center justify-center font-bold text-lg transition-all duration-200",
                                    rating === val
                                        ? "bg-primary border-primary text-white shadow-lg scale-110"
                                        : "bg-white border-slate-200 text-slate-400 hover:border-primary/30 hover:text-primary"
                                )}
                            >
                                {val}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-between max-w-sm px-1 text-[10px] font-bold uppercase tracking-tighter text-slate-400">
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
                            "w-full py-6 text-lg rounded-xl transition-all duration-200 shadow-xl font-bold h-auto",
                            rating
                                ? "bg-primary hover:bg-primary/90 text-primary-foreground hover:-translate-y-0.5"
                                : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        )}
                    >
                        {isSubmitting ? "Generating Session..." : "Begin First Question"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
