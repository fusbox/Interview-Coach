"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CategoryTooltipProps {
    category: string;
    children: React.ReactNode;
}

const CATEGORY_DEFINITIONS: Record<string, { title: string, description: string }> = {
    STAR: {
        title: "STAR: Situation, Task, Action, Result",
        description: "AKA Behavioral questions, focuses on past experiences."
    },
    PERMA: {
        title: "PERMA: Positive Emotion, Engagement, Relationships, Meaning, Accomplishment",
        description: "These consider workplace culture and fit."
    },
    TECHNICAL: {
        title: "Technical",
        description: "Assessments of role-specific skills and domain expertise."
    },
    OTHER: {
        title: "General",
        description: "General interview questions and conversation starters."
    }
};

export function CategoryTooltip({ category, children }: CategoryTooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const upperCategory = category.toUpperCase();
    const info = CATEGORY_DEFINITIONS[upperCategory] || CATEGORY_DEFINITIONS.OTHER;

    // Handlers for Desktop Hover
    const onMouseEnter = () => setIsVisible(true);
    const onMouseLeave = () => setIsVisible(false);

    const handleClick = (e: React.MouseEvent) => {
        // Toggle behavior for mobile/touch or explicit click
        e.stopPropagation();
        setIsVisible(!isVisible);
    };

    // Close on click anywhere else
    useEffect(() => {
        if (!isVisible) return;
        const close = () => setIsVisible(false);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [isVisible]);

    return (
        <div
            className="relative inline-block"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            aria-expanded={isVisible}
        >
            {children}

            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        className="absolute left-0 -translate-x-4 md:translate-x-0 top-full mt-3 z-50 min-w-max max-w-[calc(100vw-2rem)] md:max-w-md p-4 bg-text-primary text-text-inverse rounded-xl shadow-2xl border border-white/10"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside tooltip
                    >
                        <h4 className="font-bold text-sm mb-1 text-primary whitespace-nowrap">{info.title}</h4>
                        <p className="text-xs leading-relaxed text-text-inverse/70">
                            {info.description}
                        </p>

                        {/* Tooltip Arrow - Top */}
                        <div className="absolute bottom-full left-8 md:left-6 -mb-px border-8 border-transparent border-b-text-primary" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
