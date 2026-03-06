"use client";

import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";

const CheckIcon = ({ className }: { className?: string }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={cn("w-6 h-6", className)}
        >
            <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    );
};

const CheckFilled = ({ className }: { className?: string }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={cn("w-6 h-6", className)}
        >
            <path
                fillRule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                clipRule="evenodd"
            />
        </svg>
    );
};

type LoadingState = {
    text: string;
};

const LoaderCore = ({
    loadingStates,
    value = 0,
}: {
    loadingStates: LoadingState[];
    value?: number;
}) => {
    return (
        <div className="flex relative justify-center flex-col w-full max-w-xs mx-auto">
            {loadingStates.map((loadingState, index) => {
                const isCompleted = index < value;
                const isCurrent = index === value;
                const isFuture = index > value;

                return (
                    <motion.div
                        key={index}
                        className={cn("text-left flex gap-3 mb-6 items-center last:mb-0")}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{
                            opacity: isFuture ? 0.3 : 1,
                            x: 0,
                            scale: isCurrent ? 1.05 : 1,
                        }}
                        transition={{ duration: 0.4 }}
                    >
                        <div className="shrink-0 transition-all duration-500">
                            {isFuture && <CheckIcon className="text-text-muted" />}
                            {isCurrent && <CheckFilled className="text-blue-600 dark:text-blue-400 animate-pulse" />}
                            {isCompleted && <CheckFilled className="text-emerald-500" />}
                        </div>
                        <span
                            className={cn(
                                "text-lg transition-all duration-500 font-medium",
                                isFuture && "text-text-muted",
                                isCurrent && "text-blue-700 dark:text-blue-400 font-bold",
                                isCompleted && "text-emerald-700 dark:text-emerald-500"
                            )}
                        >
                            {loadingState.text}
                        </span>
                    </motion.div>
                );
            })}
        </div>
    );
};

export const MultiStepLoader = ({
    loadingStates,
    loading,
    duration = 2000,
    loop = false,
    onComplete,
}: {
    loadingStates: LoadingState[];
    loading?: boolean;
    duration?: number;
    loop?: boolean;
    onComplete?: () => void;
}) => {
    const [currentState, setCurrentState] = useState(0);

    // Reset state when loading becomes false (cleanup)
    useEffect(() => {
        if (!loading) {
            setCurrentState(0);
        }
    }, [loading]);

    // Timer logic
    useEffect(() => {
        if (!loading) return;

        const timeout = setTimeout(() => {
            setCurrentState((prevState) => {
                const nextState = loop
                    ? prevState === loadingStates.length - 1
                        ? 0
                        : prevState + 1
                    : Math.min(prevState + 1, loadingStates.length - 1);

                return nextState;
            });
        }, duration);

        return () => clearTimeout(timeout);
    }, [currentState, loading, loop, loadingStates.length, duration]);

    // Completion callback
    useEffect(() => {
        if (!loop && currentState === loadingStates.length - 1 && loading) {
            const timer = setTimeout(() => {
                if (onComplete) onComplete();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentState, loading, loop, loadingStates.length, onComplete]);

    return (
        <AnimatePresence mode="wait">
            {loading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl"
                >
                    {/* Premium Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-md bg-surface-base border border-border shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] rounded-[2.5rem] flex flex-col items-center justify-center p-10 overflow-hidden"
                    >

                        <div className="relative z-10 w-full">
                            <h3 className="text-center text-sm font-bold text-text-muted mb-10">
                                Reviewing your response...
                            </h3>
                            <LoaderCore value={currentState} loadingStates={loadingStates} />
                        </div>

                        {/* Progress Pulse */}
                        <div className="absolute bottom-0 inset-x-0 h-1 bg-surface-subtle overflow-hidden">
                            <motion.div
                                className="h-full bg-blue-600 dark:bg-blue-400"
                                initial={{ width: "0%" }}
                                animate={{ width: `${((currentState + 1) / loadingStates.length) * 100}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
