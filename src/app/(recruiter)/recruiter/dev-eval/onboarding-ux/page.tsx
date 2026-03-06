"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Clock, ShieldCheck, RefreshCw } from "lucide-react";
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { cn } from '@/lib/cn';

// ============================================================================
// ANIMATION VARIANTS (TWEAK THESE!)
// ============================================================================

// How the Initials screen exits
const initialsExitAnim = { opacity: 0, y: -50 };

// How the Landing screen wrapper enters and exits
const landingWrapperVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15, // Space between each child animating in
            delayChildren: 0.2     // Delay before children start animating
        }
    }
};

// How individual elements on the landing screen enter
const fadeUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            damping: 25,
            stiffness: 120
        }
    }
};

// ============================================================================
// PROTOTYPE COMPONENTS
// ============================================================================

function PrototypeInitialsScreen({ onNext }: { onNext: (initials: string) => void }) {
    const [initials, setInitials] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
        setInitials(val);
    };

    return (
        <div className="w-full flex justify-center items-center flex-1 font-sans text-foreground bg-background">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={initialsExitAnim}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="w-full max-w-xl mx-auto px-6 py-6 md:py-8 space-y-6 flex flex-col"
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
                    <p>You&rsquo;ve been invited to practice interview questions related to the role you applied for.</p>
                    <p>This is a guided practice experience designed to help you strengthen your answers before your next interview.</p>
                    <p>You can pause at any time and return using this same link.</p>
                    <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />
                        <h3 className="text-slate-900 font-bold text-base">This is practice &mdash; not a live interview.</h3>
                        <div className="space-y-3">
                            <p className="text-sm text-slate-600 leading-relaxed">Your responses are used to generate coaching insights to help you improve.</p>
                            <p className="text-sm text-slate-600 leading-relaxed">The person who shared this link may review your responses to support your preparation.</p>
                            <p className="text-sm font-medium text-slate-900 leading-relaxed">Only you can see the AI coaching feedback generated during practice.</p>
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
                                'placeholder:text-muted-foreground/70 placeholder:font-normal placeholder:tracking-normal uppercase',
                                isFocused ? 'border-primary ring-4 ring-primary/10' : 'border-border hover:border-input'
                            )}
                        />
                        <p className="mt-1 text-sm text-muted-foreground">
                            Used to confirm the link was opened by the intended recipient.<br />
                            <span className="text-micro opacity-70 uppercase tracking-wider font-bold">(No account setup required.)</span>
                        </p>
                    </div>
                </div>

                {/* 7. Primary CTA */}
                <div className="pt-4 pb-4 mt-auto">
                    <Button
                        onClick={() => onNext(initials)}
                        disabled={initials.length === 0}
                        className={cn(
                            'w-full py-6 text-lg rounded-xl transition-all duration-200 shadow-xl h-auto font-bold',
                            initials.length > 0
                                ? 'bg-primary hover:bg-primary/90 text-primary-foreground hover:-translate-y-0.5'
                                : 'bg-muted text-muted-foreground cursor-not-allowed'
                        )}
                    >
                        Next
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}

function PrototypeLandingScreen({ initials, expectedInitials, firstName }: { initials: string, expectedInitials: string, firstName: string }) {
    const [rating, setRating] = useState<number | null>(null);

    const welcomeText = useMemo(() => {
        if (initials === expectedInitials) {
            return `Hi ${firstName}, let’s get you ready for your interview.`;
        }
        return "Let’s get you ready for your interview.";
    }, [initials, expectedInitials, firstName]);

    return (
        <div className="relative w-full flex flex-col flex-1 font-sans text-foreground bg-gradient-to-br from-brand-glass-start to-brand-glass-end">
            <div className="absolute inset-0 bg-white/40 dark:bg-black/20 backdrop-blur-md pointer-events-none" />

            <motion.div
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={landingWrapperVariants}
                className="relative z-10 w-full flex-1 max-w-xl mx-auto px-6 py-6 md:py-8 space-y-6 flex flex-col min-h-screen md:min-h-full"
            >
                {/* 1. Logo Area */}
                <motion.div variants={fadeUp} className="flex justify-between items-center shrink-0">
                    <Image
                        src="/rangam-logo.webp"
                        alt="Rangam"
                        width={200}
                        height={48}
                        className="h-12 w-auto object-contain"
                        priority
                    />
                </motion.div>

                {/* 2. Primary Heading */}
                <motion.div variants={fadeUp} className="space-y-4 text-left">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary leading-tight font-display">
                        {welcomeText}
                    </h1>
                </motion.div>

                {/* Main Instruction Content */}
                <motion.div variants={fadeUp} className="w-full space-y-8 flex flex-col relative z-10 pt-2">
                    <div className="space-y-6 text-lg text-slate-800 dark:text-slate-200 leading-relaxed text-left">
                        <p>You&rsquo;ll answer a series of interview-style questions tailored to your role.</p>
                    </div>

                    {/* Key Points */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/60 dark:bg-black/40 border border-white/30 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900 border border-blue-200 shadow-flat flex items-center justify-center shrink-0">
                                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-slate-900 dark:text-white">No Time Limit</h3>
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                    Take your time. Thoughtful answers lead to better feedback.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/60 dark:bg-black/40 border border-white/30 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900 border border-purple-200 shadow-flat flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-slate-900 dark:text-white">Private Coaching Feedback</h3>
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                    After each answer, your coach looks at <strong className="text-slate-900 dark:text-white">what you said</strong> and <strong className="text-slate-900 dark:text-white">how you structured it</strong>.
                                </p>
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                    Coaching insights are visible <strong className="text-slate-900 dark:text-white">only to you</strong>.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-center px-6 h-16 bg-gradient-to-r from-blue-600 to-blue-950 rounded-2xl border border-blue-800 shadow-raised-1 overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500" />
                            <h3 className="text-white font-bold text-lg m-0 drop-shadow-sm">This space is for skill-building &mdash; not evaluation.</h3>
                        </div>
                    </div>

                    {/* Baseline */}
                    <div className="pt-4 space-y-6">
                        <div className="space-y-2">
                            <h4 className="text-micro font-bold uppercase tracking-widest text-slate-500">Before we start:</h4>
                            <p className="text-lg font-medium text-slate-900 dark:text-white text-left">How prepared do you feel for your upcoming interview?</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 w-full">
                            {[1, 2, 3, 4, 5].map((val) => (
                                <button
                                    key={val}
                                    onClick={() => setRating(val)}
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
                    </div>
                </motion.div>

                <div className="flex-1" />

                {/* Utility Link */}
                <motion.div variants={fadeUp} className="text-center pt-2">
                    <p className="text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-center gap-1">
                        <span>Need to step away?</span>
                        <button className="text-primary font-bold hover:underline">
                            Copy your practice link
                        </button>
                    </p>
                </motion.div>

                {/* CTA */}
                <motion.div variants={fadeUp} className="pb-8 pt-4 mt-auto">
                    <Button
                        size="lg"
                        className={cn(
                            "w-full py-6 text-lg rounded-xl transition-all shadow-floating font-bold h-auto",
                            rating
                                ? "bg-primary hover:bg-primary/90 text-primary-foreground hover:-translate-y-0.5"
                                : "bg-surface-subtle text-text-muted cursor-not-allowed"
                        )}
                    >
                        Begin First Question
                    </Button>
                </motion.div>
            </motion.div>
        </div>
    );
}


// ============================================================================
// STATE MACHINE WRAPPER
// ============================================================================

export default function OnboardingUXPlayground() {
    const [screen, setScreen] = useState<'initials' | 'landing'>('initials');
    const [enteredInitials, setEnteredInitials] = useState('');

    // Test data
    const expectedFirstName = "Sam";
    const expectedInitials = "SS";

    return (
        <div className="fixed inset-0 z-[100] w-full h-[100dvh] bg-background overflow-hidden flex flex-col">
            <AnimatePresence mode="wait">
                {screen === 'initials' && (
                    <div key="initials-wrapper" className="absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col z-0">
                        <PrototypeInitialsScreen
                            onNext={(initials) => {
                                setEnteredInitials(initials);
                                // Give a tiny moment for keyboard/focus to clear before unmounting
                                setTimeout(() => setScreen('landing'), 50);
                            }}
                        />
                    </div>
                )}

                {screen === 'landing' && (
                    <div key="landing-wrapper" className="absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col z-0">
                        <PrototypeLandingScreen
                            initials={enteredInitials}
                            expectedInitials={expectedInitials}
                            firstName={expectedFirstName}
                        />
                    </div>
                )}
            </AnimatePresence>

            {/* Debug / Controller Toolbar - Fixed positioned so it stays out of flow */}
            <div className="fixed top-4 left-4 z-50 flex gap-2">
                <Button
                    variant="default"
                    className="shadow-md"
                    onClick={() => {
                        setScreen('initials');
                        setEnteredInitials('');
                    }}
                >
                    <RefreshCw className="w-4 h-4 mr-2" /> Reset Prototype
                </Button>
            </div>
        </div>
    );
}
