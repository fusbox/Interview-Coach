import React from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button"
import { Clock, ShieldCheck } from "lucide-react"
import { audioEngine } from '@/features/audio/audio-engine';
import { useSession } from '../context/SessionContext';

interface LandingScreenProps {
    onStart: () => void;
    role?: string;
}

export default function LandingScreen({ onStart, role = "Candidate" }: LandingScreenProps) {
    const { session } = useSession();
    const firstQuestion = session?.questions?.[0];
    return (
        <div className="min-h-[100dvh] w-full bg-background font-sans text-foreground selection:bg-primary/10 selection:text-primary overflow-y-auto">
            <div className="w-full max-w-xl mx-auto px-6 py-12 md:py-24 space-y-8 flex flex-col min-h-[100dvh]">

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
                <div className="space-y-6 text-left">
                    <h1 className="text-2xl md:text-4xl font-medium tracking-tight text-primary leading-tight">
                        {role} Interview Practice
                    </h1>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Let&rsquo;s get you ready for your next big opportunity.
                    </p>
                </div>

                {/* Key Points - Vertically Distributed with generous spacing if needed, but grid gap-6 works well */}
                <div className="grid gap-6 text-left">
                    <div className="flex items-start gap-4 p-6 rounded-xl bg-muted/50 border border-border/50">
                        <Clock className="w-6 h-6 text-primary mt-1 shrink-0" />
                        <div className="space-y-2">
                            <h3 className="font-medium text-lg text-foreground">No Time Limit</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Take your time to think. This is a safe space to practice, not a test.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-6 rounded-xl bg-muted/50 border border-border/50">
                        <ShieldCheck className="w-6 h-6 text-primary mt-1 shrink-0" />
                        <div className="space-y-2">
                            <h3 className="font-medium text-lg text-foreground">Private Feedback</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Your answers are analyzed by AI to give you instant, private coaching tips.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1" />

                {/* CTA - Stick to bottom */}
                <div className="pt-4 pb-2 sticky bottom-0 bg-background/95 backdrop-blur-sm border-t md:border-t-0 md:bg-transparent">
                    <Button
                        size="lg"
                        onClick={() => {
                            audioEngine.unlock().then(() => {
                                if (firstQuestion) {
                                    audioEngine.prefetch(firstQuestion.id, firstQuestion.text);
                                }
                            });
                            onStart();
                        }}
                        className="w-full py-6 text-lg rounded-xl transition-all duration-200 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground hover:-translate-y-0.5 h-auto"
                    >
                        Start Practice Session
                    </Button>
                    <p className="text-xs text-muted-foreground mt-4 text-center md:text-left">
                        By starting, you agree to our practice terms.
                    </p>
                </div>
            </div>
        </div>
    )
}
