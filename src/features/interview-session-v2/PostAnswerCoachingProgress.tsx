"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import { CandidateCoachAvatar } from "@/features/candidate-v2/CandidateCoachAvatar";

import type { SessionAnswerMutationPhase } from "./session-answer-mutation-contract";
import styles from "./PostAnswerCoachingProgress.module.css";

const TEXT_PROGRESS_STEPS = [
    "Taking a look...",
    "Reviewing answer content...",
    "Creating feedback...",
] as const;

const VOICE_PROGRESS_STEPS = [
    "Taking a look...",
    "Reviewing answer content...",
    "Noting your speaking delivery...",
    "Creating feedback...",
] as const;

type PostAnswerCoachingProgressProps = {
    phase: SessionAnswerMutationPhase;
    answerMode: "text" | "voice";
    isVoiceSubmitPreparing?: boolean;
};

export function PostAnswerCoachingProgress({
    phase,
    answerMode,
    isVoiceSubmitPreparing = false,
}: PostAnswerCoachingProgressProps) {
    const [mounted, setMounted] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const reduceMotion = useReducedMotion();
    const isVisible = isVoiceSubmitPreparing
        || phase === "submitting"
        || phase === "analyzing";
    const progressSteps = answerMode === "voice"
        ? VOICE_PROGRESS_STEPS
        : TEXT_PROGRESS_STEPS;
    const stepDurationMs = answerMode === "voice" ? 2_500 : 3_000;

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isVisible) {
            setCurrentStep(0);
            return;
        }
        if (currentStep >= progressSteps.length - 1) return;

        const timer = window.setTimeout(() => {
            setCurrentStep((step) => Math.min(step + 1, progressSteps.length - 1));
        }, stepDurationMs);
        return () => window.clearTimeout(timer);
    }, [currentStep, isVisible, progressSteps.length, stepDurationMs]);

    useEffect(() => {
        if (!isVisible) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isVisible]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isVisible ? (
                <motion.div
                    className={styles.backdrop}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18 }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="post-answer-progress-title"
                    aria-describedby="post-answer-progress-status"
                >
                    <motion.section
                        className={styles.panel}
                        initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
                        transition={{
                            duration: reduceMotion ? 0 : 0.2,
                            ease: [0.22, 1, 0.36, 1],
                        }}
                    >
                        <header className={styles.header}>
                            <CandidateCoachAvatar
                                variant="surface"
                                className={styles.avatar}
                            />
                            <div>
                                <p>Interview Coach</p>
                                <h2 id="post-answer-progress-title">Reviewing your response</h2>
                            </div>
                        </header>

                        <ol className={styles.steps} aria-label="Coaching progress">
                            {progressSteps.map((step, index) => {
                                const state = index < currentStep
                                    ? "complete"
                                    : index === currentStep
                                        ? "current"
                                        : "upcoming";

                                return (
                                    <motion.li
                                        key={step}
                                        data-state={state}
                                        initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                                        animate={{
                                            opacity: state === "upcoming" ? 0.48 : 1,
                                            x: 0,
                                        }}
                                        transition={{
                                            duration: reduceMotion ? 0 : 0.18,
                                            delay: reduceMotion ? 0 : index * 0.04,
                                        }}
                                    >
                                        <span aria-hidden="true">
                                            <CheckCircle2 size={21} />
                                        </span>
                                        <strong>{step}</strong>
                                    </motion.li>
                                );
                            })}
                        </ol>

                        <p
                            id="post-answer-progress-status"
                            className="sr-only"
                            aria-live="polite"
                        >
                            {progressSteps[currentStep]}
                        </p>

                        <div
                            className={styles.progress}
                            role="progressbar"
                            aria-label="Preparing coaching"
                            aria-valuemin={1}
                            aria-valuemax={progressSteps.length}
                            aria-valuenow={currentStep + 1}
                            aria-valuetext={progressSteps[currentStep]}
                        >
                            <motion.span
                                initial={false}
                                animate={{
                                    width: `${((currentStep + 1) / progressSteps.length) * 100}%`,
                                }}
                                transition={{
                                    duration: reduceMotion ? 0 : 0.2,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                            />
                        </div>
                    </motion.section>
                </motion.div>
            ) : null}
        </AnimatePresence>,
        document.body,
    );
}
