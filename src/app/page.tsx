'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { motion } from 'framer-motion';
import BrandLogo from '@/components/brand/BrandLogo';


export default function Home() {
    return (
        <div className="flex flex-col items-center justify-between min-h-[100dvh] bg-background font-sans p-6 md:p-12">
            <div className="flex-1" />

            <div className="w-full max-w-2xl flex flex-col items-center text-center space-y-12">
                <div className="flex flex-col items-center gap-1">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="relative w-24 h-24 mb-6"
                    >
                        <Image
                            src="/r2w-logo.webp"
                            alt="Ready2Work Logo"
                            fill
                            className="object-contain"
                            priority
                            unoptimized
                        />
                    </motion.div>

                    <BrandLogo />
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2.8, duration: 0.8 }}
                        className="flex flex-row items-center justify-center gap-[0.4rem] text-lg md:text-xl text-muted-foreground font-medium tracking-wide whitespace-nowrap"
                    >
                        <span className="uppercase text-micro sm:text-xs md:text-base tracking-widest translate-y-px">
                            Workforce Readiness Powered By
                        </span>
                        <div className="relative h-4 w-16 sm:h-5 sm:w-20 md:h-6 md:w-24 flex-shrink-0">
                            <Image
                                src="/rangam-logo.webp"
                                alt="Rangam"
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        </div>
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.8, duration: 0.8, ease: "easeOut" }}
                    className="w-full max-w-sm space-y-8"
                >
                    <Link href="/recruiter/create" className="w-full block">
                        <Button className="w-full h-14 text-lg rounded-full shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 hover:-translate-y-0.5 transition-all" size="lg">
                            Continue as Recruiter
                        </Button>
                    </Link>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-widest text-muted-foreground w-full">
                            <span className="h-px bg-border flex-1" />
                            <span>Candidate Access</span>
                            <span className="h-px bg-border flex-1" />
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                            Candidates must use the unique invitation link sent to their email.
                        </p>
                    </div>
                </motion.div>
            </div>

            <div className="flex-1" />
        </div>
    );
}
