'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, type Variants } from 'framer-motion';
import { BarChart3, ClipboardList, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: 'easeOut' },
    },
};

const recruiterValuePoints = [
    {
        title: 'Standardize role prep',
        body: 'Build interview practice around the req, the job description, and the exact question set you want candidates to prepare for.',
        outcome: 'Supports more consistent screening and fewer avoidable misses in live interviews.',
        icon: ClipboardList,
    },
    {
        title: 'Drive candidate follow-through',
        body: 'Send structured practice invites in a guided flow that is easy to launch and easy for candidates to complete.',
        outcome: 'Helps improve readiness before recruiter screens and hiring manager loops.',
        icon: Users,
    },
    {
        title: 'Track accountability clearly',
        body: 'See starts, completions, and invite progress in one recruiter workspace instead of managing follow-up through scattered notes.',
        outcome: 'Makes pipeline movement and recruiter-owned activity easier to review against team goals.',
        icon: BarChart3,
    },
];

export default function Home() {
    return (
        <div className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-brand-glass-start via-background to-brand-glass-end text-foreground">
            <div className="absolute inset-0 bg-surface-base/50 backdrop-blur-md" />
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/60 to-transparent dark:from-white/5" />

            <motion.main
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: { opacity: 0 },
                    visible: {
                        opacity: 1,
                        transition: { staggerChildren: 0.12 },
                    },
                }}
                className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-6 py-6 md:px-10 md:py-8"
            >
                <motion.div variants={fadeUp} className="flex items-center">
                    <Image
                        src="/rangam-logo.webp"
                        alt="Rangam"
                        width={180}
                        height={40}
                        className="h-10 w-auto object-contain"
                        priority
                        unoptimized
                    />
                </motion.div>

                <div className="flex flex-1 flex-col justify-center py-10 md:py-14">
                    <div className="space-y-8">
                        <motion.section variants={fadeUp} className="space-y-7">
                            <div className="space-y-4">
                                <p className="text-micro font-bold uppercase tracking-[0.24em] text-text-muted">
                                    Interview Coach
                                </p>
                                <h1 className="text-4xl font-bold leading-tight text-text-primary font-display md:text-5xl">
                                    Structured interview practice that{' '}
                                    <span className="text-primary">supports hiring outcomes.</span>
                                </h1>
                            </div>

                            <div className="rounded-3xl border border-border/50 bg-surface-base/85 p-6 shadow-raised-1">
                                <div className="grid gap-5 sm:grid-cols-3">
                                    <div>
                                        <p className="text-micro font-bold uppercase tracking-[0.18em] text-text-muted">
                                            Team Objective
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-text-primary">
                                            Improve candidate preparedness before live interviews.
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-micro font-bold uppercase tracking-[0.18em] text-text-muted">
                                            Recruiter Metric
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-text-primary">
                                            Raise invite completion and reduce manual follow-up churn.
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-micro font-bold uppercase tracking-[0.18em] text-text-muted">
                                            Operating Benefit
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-text-primary">
                                            Keep role setup, invite progress, and candidate movement in one flow.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.section>

                        <motion.section
                            variants={fadeUp}
                            className="rounded-[2rem] border border-border/50 bg-surface-base/80 p-6 shadow-floating md:p-7"
                        >
                            <div className="space-y-5">
                                <div className="grid gap-5 lg:grid-cols-3">
                                    {recruiterValuePoints.map(({ title, body, outcome, icon: Icon }) => (
                                        <div key={title}>
                                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-state-info/20 bg-state-info/10">
                                                <Icon className="h-5 w-5 text-state-info" />
                                            </div>
                                            <div className="space-y-2">
                                                <h2 className="text-base font-bold text-text-primary">{title}</h2>
                                                <p className="text-sm leading-6 text-text-secondary">{body}</p>
                                                <p className="text-sm leading-6 text-text-primary">{outcome}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <Link href="/recruiter/create" className="block pt-1">
                                    <Button
                                        className="h-14 w-full rounded-full text-lg shadow-lg shadow-blue-900/20 transition-all hover:-translate-y-0.5 hover:shadow-blue-900/40"
                                        size="lg"
                                    >
                                        Continue as Recruiter
                                    </Button>
                                </Link>
                            </div>
                        </motion.section>
                    </div>
                </div>
            </motion.main>
        </div>
    );
}
