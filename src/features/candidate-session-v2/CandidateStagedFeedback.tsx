"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, RotateCcw } from "lucide-react";
import { createPortal } from "react-dom";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CandidateCoachAvatar } from "@/features/candidate-v2/CandidateCoachAvatar";

import {
    createCandidateFeedbackActionEvent,
    type CandidateFeedbackAction,
    type CandidateFeedbackActionEvent,
    type CandidateFeedbackInteraction,
    type CandidateFeedbackInteractionStageId,
} from "./candidate-feedback-interaction";

type CandidateStagedFeedbackProps = {
    interaction: CandidateFeedbackInteraction;
    practiceVisitId?: string;
    question: {
        number: number;
        count: number;
        categoryLabel: string;
        text: string;
    };
    answerText: string;
    savedActionEvent?: CandidateFeedbackActionEvent | null;
    isCompletingSession: boolean;
    completionMessage?: string | null;
    onPersistAction: (event: CandidateFeedbackActionEvent) => Promise<boolean>;
    onAdvanceQuestion: () => void;
    onFinishSession: () => void;
    onRetryAnswer: (sourceAnswerAttemptId: string) => void;
};

export function CandidateStagedFeedback({
    interaction,
    practiceVisitId,
    question,
    answerText,
    savedActionEvent = null,
    isCompletingSession,
    completionMessage = null,
    onPersistAction,
    onAdvanceQuestion,
    onFinishSession,
    onRetryAnswer,
}: CandidateStagedFeedbackProps) {
    const [activeStageId, setActiveStageId] = useState<CandidateFeedbackInteractionStageId>(() => (
        resolveRecoveredStageId(interaction, savedActionEvent)
    ));
    const [mounted, setMounted] = useState(false);
    const [pendingActionKind, setPendingActionKind] = useState<CandidateFeedbackAction["kind"] | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const dialogRef = useRef<HTMLElement>(null);
    const dialogHeadingRef = useRef<HTMLHeadingElement>(null);
    const activeStageHeadingRef = useRef<HTMLHeadingElement>(null);
    const previousStageIdRef = useRef(activeStageId);
    const recoveredActionEventRef = useRef(savedActionEvent);
    const hasAppliedRecoveredTransitionRef = useRef(false);
    const activeStage = useMemo(
        () => interaction.stages.find((stage) => stage.id === activeStageId) ?? interaction.stages[0],
        [activeStageId, interaction.stages],
    );
    const stageIndex = interaction.stages.findIndex((stage) => stage.id === activeStage.id);
    const visibleStages = interaction.stages.slice(0, stageIndex + 1);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (previousStageIdRef.current === activeStageId) return;
        previousStageIdRef.current = activeStageId;
        activeStageHeadingRef.current?.focus();
    }, [activeStageId]);

    useEffect(() => {
        if (!mounted) return;
        dialogHeadingRef.current?.focus();

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [mounted]);

    useEffect(() => {
        if (hasAppliedRecoveredTransitionRef.current) return;
        hasAppliedRecoveredTransitionRef.current = true;
        const recoveredEvent = recoveredActionEventRef.current;
        if (!recoveredEvent || !isSameAnalyzedAnswer(interaction, recoveredEvent)) return;

        if (recoveredEvent.transition === "advance_to_next_question") {
            onAdvanceQuestion();
        } else if (recoveredEvent.transition === "finish_session") {
            onFinishSession();
        }
    }, [interaction, onAdvanceQuestion, onFinishSession]);

    if (!mounted) return null;

    return createPortal(
        <div className="candidate-staged-feedback__backdrop">
            <motion.section
                ref={dialogRef}
                className="candidate-staged-feedback"
                role="dialog"
                aria-modal="true"
                aria-labelledby="coach-feedback-title"
                aria-describedby="coach-feedback-step coach-feedback-body"
                onKeyDown={trapDialogFocus}
                initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.99 }}
                transition={{
                    duration: reduceMotion ? 0 : 0.2,
                    ease: [0.22, 1, 0.36, 1],
                }}
            >
                <header className="candidate-staged-feedback__header">
                    <div className="candidate-staged-feedback__identity">
                        <CandidateCoachAvatar
                            variant="surface"
                            frame="surface"
                            className="candidate-staged-feedback__mark"
                        />
                        <h2
                            id="coach-feedback-title"
                            ref={dialogHeadingRef}
                            className="sr-only"
                            tabIndex={-1}
                        >
                            Your coaching
                        </h2>
                        <p id="coach-feedback-step" className="sr-only" aria-live="polite">
                            Feedback step {stageIndex + 1} of {interaction.stages.length}: {activeStage.label}
                        </p>
                    </div>
                    <div className="candidate-staged-feedback__progress">
                        <span className="sr-only">
                            Feedback step {stageIndex + 1} of {interaction.stages.length}
                        </span>
                        <div aria-hidden="true">
                            {interaction.stages.map((stage, index) => (
                                <span
                                    key={stage.id}
                                    data-state={index < stageIndex
                                        ? "complete"
                                        : index === stageIndex
                                            ? "current"
                                            : "upcoming"}
                                />
                            ))}
                        </div>
                    </div>
                </header>

                <div className="candidate-staged-feedback__viewport">
                    <details className="candidate-staged-feedback__reference">
                        <summary>
                            <span>
                                <strong>Question {question.number} of {question.count}</strong>
                                <span>{question.categoryLabel}</span>
                            </span>
                            <span>
                                Review question and answer
                                <ChevronDown size={17} aria-hidden="true" />
                            </span>
                        </summary>
                        <div className="candidate-staged-feedback__reference-body">
                            <section>
                                <h3>Question</h3>
                                <p>{question.text}</p>
                            </section>
                            <section>
                                <h3>Your answer</h3>
                                <p>{answerText}</p>
                            </section>
                        </div>
                    </details>

                    <div className="candidate-staged-feedback__thread">
                        <AnimatePresence initial={false}>
                            {visibleStages.map((stage, index) => {
                                const isCurrent = index === stageIndex;
                                return (
                                    <motion.article
                                        key={stage.id}
                                        className="candidate-staged-feedback__stage"
                                        data-state={isCurrent ? "current" : "complete"}
                                        aria-current={isCurrent ? "step" : undefined}
                                        initial={reduceMotion || index < stageIndex
                                            ? false
                                            : { opacity: 0, y: 18 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: reduceMotion ? 0 : 0.22,
                                            ease: [0.22, 1, 0.36, 1],
                                        }}
                                    >
                                        <span className="candidate-staged-feedback__stage-marker" aria-hidden="true">
                                            {isCurrent ? null : <Check size={14} />}
                                        </span>
                                        <div className="candidate-staged-feedback__stage-content">
                                            <h3
                                                ref={isCurrent ? activeStageHeadingRef : undefined}
                                                className="sr-only"
                                                tabIndex={isCurrent ? -1 : undefined}
                                            >
                                                {stage.title}
                                            </h3>
                                            <p
                                                id={isCurrent ? "coach-feedback-body" : undefined}
                                                className="candidate-staged-feedback__body"
                                            >
                                                {stage.body}
                                            </p>

                                            {stage.guidance?.length ? (
                                                <div className="candidate-staged-feedback__guidance">
                                                    {stage.guidance.map((item) => (
                                                        <section
                                                            key={`${item.label}:${item.body}`}
                                                            data-kind={item.steps?.length ? "pattern" : "guidance"}
                                                        >
                                                            {item.steps?.length ? null : <p>{item.body}</p>}
                                                            {item.steps?.length ? (
                                                                <ol>
                                                                    {item.steps.map((step, stepIndex) => (
                                                                        <li key={step}>
                                                                            <span aria-hidden="true">{stepIndex + 1}</span>
                                                                            <span>{step}</span>
                                                                        </li>
                                                                    ))}
                                                                </ol>
                                                            ) : null}
                                                        </section>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    </motion.article>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </div>

                <footer className="candidate-staged-feedback__actions">
                    {actionError ? <p className="planned-session-status" role="alert">{actionError}</p> : null}
                    {completionMessage
                        ? <p className="planned-session-status" role="alert">{completionMessage}</p>
                        : null}
                    {activeStage.actions.map((action) => (
                        <button
                            className={action.emphasis === "primary"
                                ? "candidate-button candidate-button--primary"
                                : "candidate-button candidate-button--secondary"}
                            type="button"
                            key={`${activeStage.id}:${action.kind}`}
                            disabled={Boolean(pendingActionKind) || isCompletingSession}
                            onClick={() => selectAction(action)}
                        >
                            {action.kind === "retry_answer" ? <RotateCcw size={16} aria-hidden="true" /> : null}
                            {pendingActionKind === action.kind ? "Saving..." : action.label}
                            {action.kind !== "retry_answer" ? <ArrowRight size={16} aria-hidden="true" /> : null}
                        </button>
                    ))}
                </footer>
            </motion.section>
        </div>,
        document.body,
    );

    function trapDialogFocus(event: KeyboardEvent<HTMLElement>) {
        if (event.key !== "Tab") return;

        const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
                "button:not([disabled]), a[href], summary, [tabindex]:not([tabindex='-1'])",
            ) ?? [],
        ).filter((element) => !element.hasAttribute("hidden"));
        if (focusable.length === 0) {
            event.preventDefault();
            dialogHeadingRef.current?.focus();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    async function selectAction(action: CandidateFeedbackAction) {
        setPendingActionKind(action.kind);
        setActionError(null);
        const event = createCandidateFeedbackActionEvent({
            interaction,
            practiceVisitId,
            stageId: activeStage.id,
            action,
            selectedAt: new Date().toISOString(),
        });
        const persisted = await onPersistAction(event);
        setPendingActionKind(null);

        if (!persisted) {
            setActionError("I could not save that choice. Try again.");
            return;
        }

        switch (action.transition) {
            case "show_feedback_stage":
                if (action.targetStageId) {
                    setActiveStageId(action.targetStageId);
                }
                break;
            case "advance_to_next_question":
                onAdvanceQuestion();
                break;
            case "finish_session":
                onFinishSession();
                break;
            case "retry_current_question":
                if (interaction.answer.answerAttemptId) {
                    onRetryAnswer(interaction.answer.answerAttemptId);
                }
                break;
            case "pause_session":
                break;
        }
    }
}

function resolveRecoveredStageId(
    interaction: CandidateFeedbackInteraction,
    event: CandidateFeedbackActionEvent | null | undefined,
) {
    if (!event || !isSameAnalyzedAnswer(interaction, event)) {
        return interaction.stages[0].id;
    }

    if (
        event.transition === "show_feedback_stage"
        && event.targetStageId
    ) {
        if (interaction.stages.some((stage) => stage.id === event.targetStageId)) {
            return event.targetStageId;
        }

        const sourceStageIndex = interaction.stages.findIndex((stage) => stage.id === event.stageId);
        if (sourceStageIndex >= 0) {
            const nextSurvivingStage = interaction.stages[sourceStageIndex + 1];
            if (nextSurvivingStage) {
                return nextSurvivingStage.id;
            }
        }
    }

    return interaction.stages.some((stage) => stage.id === event.stageId)
        ? event.stageId
        : interaction.stages[0].id;
}

function isSameAnalyzedAnswer(
    interaction: CandidateFeedbackInteraction,
    event: CandidateFeedbackActionEvent,
) {
    return event.answer.slotId === interaction.answer.slotId
        && event.answer.questionIndex === interaction.answer.questionIndex
        && event.answer.answerAttemptId === interaction.answer.answerAttemptId;
}
