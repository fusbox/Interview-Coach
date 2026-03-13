"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FeedbackPillProps {
    isVisible: boolean;
    text: string;
    className?: string;
    icon?: React.ReactNode;
}

/**
 * FeedbackPill is a localized, animated pill used to show temporal success states
 * like "Copied" or "Saved" near the triggering element.
 */
export const FeedbackPill: React.FC<FeedbackPillProps> = ({
    isVisible,
    text,
    className,
    icon = <Check size={10} strokeWidth={4} />
}) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 10, x: "-50%" }}
                    animate={{ opacity: 1, scale: 1, y: -20, x: "-50%" }}
                    exit={{ opacity: 0, scale: 0.8, x: "-50%" }}
                    className={cn(
                        "absolute bottom-full left-1/2 z-20 pointer-events-none pb-2",
                        className
                    )}
                >
                    <div className={cn(
                        "bg-state-success text-text-inverse rounded-full shadow-lg flex items-center justify-center whitespace-nowrap",
                        text ? "px-2 py-0.5 gap-1" : "p-1.5"
                    )}>
                        {icon}
                        {text && <span className="text-[10px] font-black uppercase tracking-widest">{text}</span>}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
