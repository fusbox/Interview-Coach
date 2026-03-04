import React, { useState } from 'react';
import { audioEngine } from '@/features/audio/audio-engine';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { useSession } from '../context/SessionContext';

export default function InitialsScreen() {
    const { session, submitInitials } = useSession();
    const firstQuestion = session?.questions?.[0];
    const [initials, setInitials] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isStarting, setIsStarting] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Only allow letters, max 2 chars
        const val = e.target.value
            .toUpperCase()
            .replace(/[^A-Z]/g, '')
            .slice(0, 2);
        setInitials(val);
    };

    const handleBegin = async () => {
        if (initials.length > 0) {
            setIsStarting(true);
            // Unlock AudioContext on this user gesture, then immediately prefetch Q1
            // so audio is buffered before the session screen mounts.
            audioEngine.unlock().then(() => {
                if (firstQuestion) {
                    audioEngine.prefetch(firstQuestion.id, firstQuestion.text);
                }
            });
            try {
                await submitInitials(initials);
            } catch (err) {
                console.error('Failed to submit initials', err);
                setIsStarting(false);
            }
        }
    };

    return (
        <div className="min-h-[100dvh] w-full bg-background font-sans text-foreground selection:bg-primary/10 selection:text-primary overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="w-full max-w-xl mx-auto px-6 py-12 md:py-24 space-y-8 flex flex-col min-h-[100dvh]"
            >
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
                <div className="space-y-4 text-left">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary leading-tight font-display">
                        Practice for Your Upcoming Interview
                    </h1>
                </div>

                {/* 3. Introductory Copy & 4. Reassurance */}
                <div className="space-y-6 text-lg text-muted-foreground leading-relaxed text-left">
                    <p>
                        You&rsquo;ve been invited to practice interview questions related to the role you applied for.
                    </p>
                    <p>
                        This is a guided practice experience designed to help you strengthen your answers before your next interview.
                    </p>
                    <p>
                        You can pause at any time and return using this same link.
                    </p>

                    <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />
                        <h3 className="text-slate-900 font-bold text-base">This is practice &mdash; not a live interview.</h3>
                        <div className="space-y-3">
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Your responses are used to generate coaching insights to help you improve.
                            </p>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                The person who shared this link may review your responses to support your preparation.
                            </p>
                            <p className="text-sm font-medium text-slate-900 leading-relaxed">
                                Only you can see the AI coaching feedback generated during practice.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 6. Initials Input */}
                <div className="space-y-2">
                    <label htmlFor="initials-input" className="block text-lg font-medium text-foreground">
                        Enter your initials to begin
                    </label>
                    <div className="relative group">
                        <input
                            id="initials-input"
                            type="text"
                            value={initials}
                            onChange={handleInputChange}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder="(e.g. AB)"
                            className={cn(
                                'w-full px-4 py-4 text-2xl tracking-widest font-medium bg-muted/50 border rounded-xl outline-none transition-all duration-200',
                                'placeholder:text-muted-foreground/70 placeholder:font-normal placeholder:tracking-normal',
                                isFocused
                                    ? 'border-primary ring-4 ring-primary/10'
                                    : 'border-border hover:border-input'
                            )}
                        />
                        {/* Feedback Text */}
                        <p className="mt-1 text-sm text-muted-foreground">
                            Used to confirm the link was opened by the intended recipient.
                            <br />
                            <span className="text-[10px] opacity-70 uppercase tracking-wider font-bold">(No account setup required.)</span>
                        </p>
                    </div>
                </div>

                <div className="flex-1" />

                {/* 7. Primary CTA - Anchored Bottom */}
                <div className="pt-4 pb-2 sticky bottom-0 bg-background/95 backdrop-blur-sm border-t md:border-t-0 md:bg-transparent">
                    <Button
                        onClick={handleBegin}
                        disabled={initials.length === 0 || isStarting}
                        className={cn(
                            'w-full py-6 text-lg rounded-xl transition-all duration-200 shadow-xl h-auto font-bold',
                            initials.length > 0
                                ? 'bg-primary hover:bg-primary/90 text-primary-foreground hover:-translate-y-0.5'
                                : 'bg-muted text-muted-foreground cursor-not-allowed'
                        )}
                    >
                        {isStarting ? 'Starting...' : 'Next'}
                    </Button>
                </div>

                {/* 8. Footer Microcopy - Moving below button or keeping? Usually below button is fine but sticky makes it tricky. Let's keep it below button in the scroll flow if sticking. */}
                <div className="text-left pb-0">
                    <p className="text-sm text-muted-foreground">
                        You can return to this session anytime using the same link.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
