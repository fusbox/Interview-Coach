"use client";

import { ArrowLeft, ArrowRight, Clock3, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import {
    toSessionQuestionAudioTarget,
    type SessionQuestionAudioLifecycle,
} from "@/features/interview-session-v2/session-question-audio-contract";
import { CandidateBrandHeader } from "@/features/candidate-v2/CandidateBrandHeader";
import { CandidateThemeSwitcher } from "@/features/candidate-v2/CandidateThemeSwitcher";
import {
    candidateQuestionPlanCategoryDetails,
    type CandidateQuestionPlanCategory,
} from "./candidate-question-plan";

import styles from "./CandidatePreSessionLanding.module.css";

export type CandidatePreSessionQuestion = {
    id: string;
    number: number;
    category: string;
    questionText: string;
};

type CandidatePreSessionLandingProps = {
    variant: "initial" | "follow_up" | "invited";
    targetRole: string;
    stageLabel: string;
    questionCount: number;
    planQuestionCount?: number;
    resumeIncluded: boolean;
    resumeLabel?: string | null;
    candidateFirstName?: string;
    questions?: CandidatePreSessionQuestion[];
    sessionId?: string;
    firstQuestion?: CandidatePreSessionQuestion;
    questionAudio?: SessionQuestionAudioLifecycle;
    startActionUrl?: string;
    onStart?: () => void;
    returnHref?: string;
    onOpenDevelopmentPreview?: () => void;
    manageTransitionExternally?: boolean;
};

export const CANDIDATE_PRACTICE_ENTRY_HOLD_MS = 1_250;
export const CANDIDATE_PRACTICE_ENTRY_FADE_MS = 420;

export function CandidatePreSessionLanding({
    variant,
    targetRole,
    stageLabel,
    questionCount,
    planQuestionCount = questionCount,
    resumeIncluded,
    resumeLabel,
    candidateFirstName,
    questions = [],
    sessionId,
    firstQuestion,
    questionAudio,
    startActionUrl,
    onStart,
    returnHref,
    onOpenDevelopmentPreview,
    manageTransitionExternally = false,
}: CandidatePreSessionLandingProps) {
    const [isPreparing, setIsPreparing] = useState(false);
    const pageRef = useRef<HTMLElement | null>(null);
    const transitionTimerRef = useRef<number | null>(null);
    const routedStartSubmittedRef = useRef(false);
    const isFollowUp = variant === "follow_up";
    const isInvited = variant === "invited";
    const canStart = Boolean(startActionUrl || onStart);
    const showEntryOverlay = isPreparing && !startActionUrl;
    const questionLabel = questionCount === 1 ? "1 question" : `${questionCount} questions`;
    const normalizedStage = stageLabel.trim().toLowerCase();
    const stageContext = normalizedStage === "not sure yet"
        ? "based on the role details you shared"
        : `for your ${normalizedStage}`;
    const statusLead = isFollowUp
        ? "Your focused practice is ready."
        : isInvited
            ? `${candidateFirstName ? `Hi ${candidateFirstName}. ` : ""}Ready to practice?`
            : "Your practice is ready.";
    const statusDetail = isFollowUp
        ? `I'll keep this round focused on the ${questionCount === 1 ? "question" : "questions"} you chose.`
        : isInvited
            ? `You've been invited to work through ${questionLabel}. After each answer, your coach will help you strengthen your response.`
            : planQuestionCount > questionCount
                ? `You'll work through up to ${questionLabel} from your ${planQuestionCount}-question plan ${stageContext}. After each answer, I'll help you see what's working and what to try next.`
                : `You'll work through ${questionLabel} ${stageContext}. After each answer, I'll help you see what's working and what to try next.`;

    useEffect(() => () => {
        if (transitionTimerRef.current !== null) {
            window.clearTimeout(transitionTimerRef.current);
        }
    }, []);

    useEffect(() => {
        if (!questionAudio || !sessionId || !firstQuestion) {
            return;
        }

        questionAudio.prefetch(toSessionQuestionAudioTarget({
            sessionId,
            question: {
                questionKey: firstQuestion.id,
                questionText: firstQuestion.questionText,
            },
        }));
    }, [firstQuestion, questionAudio, sessionId]);

    useLayoutEffect(() => {
        const page = pageRef.current;
        if (!page) {
            return;
        }

        if (showEntryOverlay) {
            page.setAttribute("inert", "");
            return () => page.removeAttribute("inert");
        }

        page.removeAttribute("inert");
    }, [showEntryOverlay]);

    return (
        <>
        <main
            ref={pageRef}
            className={`${styles.page} candidate-app-shell`}
            aria-hidden={showEntryOverlay || undefined}
        >
            <CandidateBrandHeader actions={<CandidateThemeSwitcher />} frame="focused" />
            <div className={`${styles.layout} app-grid app-grid--focused`}>
                <section
                    className={`${styles.spotlight} surface-spotlight`}
                    aria-labelledby="candidate-pre-session-title"
                >
                    <p className={`${styles.stageLabel} label-micro`}>{stageLabel}</p>
                    <h1 id="candidate-pre-session-title" className={styles.roleHeading}>{targetRole}</h1>
                    <p className={styles.statusCopy}>
                        <strong>{statusLead}</strong>{" "}
                        {statusDetail}
                    </p>
                    <dl
                        className={
                            isInvited
                                ? `${styles.facts} ${styles.factsTwo} on-color-glass`
                                : `${styles.facts} ${styles.factsThree} on-color-glass`
                        }
                        aria-label="Practice round details"
                    >
                        <div>
                            <dt>Stage</dt>
                            <dd>{stageLabel}</dd>
                        </div>
                        <div>
                            <dt>{planQuestionCount > questionCount ? "This visit" : "Questions"}</dt>
                            <dd>{questionCount}</dd>
                        </div>
                        {!isInvited ? (
                            <div>
                                <dt>Resume</dt>
                                <dd
                                    className={styles.resumeFact}
                                    title={resumeIncluded ? resumeLabel?.trim() || "Included" : undefined}
                                >
                                    {resumeIncluded ? resumeLabel?.trim() || "Included" : "Not included"}
                                </dd>
                            </div>
                        ) : null}
                    </dl>
                </section>

                {questions.length > 0 ? (
                    <section className={styles.questions} aria-labelledby="selected-practice-title">
                        <h2 id="selected-practice-title" className="label-micro">Question plan</h2>
                        <ol aria-label="Selected practice questions">
                            {questions.map((question) => (
                                <li key={question.id}>
                                    <span aria-hidden="true">{question.number}</span>
                                    <div>
                                        <p className={`${styles.questionCategory} label-micro`}>
                                            {formatPreSessionCategory(question.category)}
                                        </p>
                                        <CandidatePreSessionQuestionText questionText={question.questionText} />
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>
                ) : null}

                <div className={styles.closing}>
                    <section className={styles.reassurance} aria-label="Before you begin">
                        <article>
                            <Clock3 size={17} aria-hidden="true" />
                            <p>
                                <strong>{isInvited ? "Take your time." : "Practice at your pace."}</strong>{" "}
                                {isInvited
                                    ? "If you step away, use your original invitation link to return."
                                    : "Your progress saves automatically, so you can pause and return when you're ready."}
                            </p>
                        </article>
                        <article>
                            <LockKeyhole size={17} aria-hidden="true" />
                            {isInvited ? (
                                <p>
                                    <strong>Know what is shared.</strong>{" "}
                                    The recruiting team may review your answers. Your AI coaching is visible only to you and is not used to make hiring decisions.
                                </p>
                            ) : (
                                <p>
                                    <strong>For preparation only.</strong>{" "}
                                    This candidate-led practice is not used to make hiring decisions.
                                </p>
                            )}
                        </article>
                    </section>

                    <section className={styles.actions} aria-label="Practice actions">
                        {startActionUrl ? (
                            <form
                                className={styles.primaryAction}
                                aria-label="Start follow-up practice"
                                aria-busy={isPreparing || undefined}
                                action={startActionUrl}
                                method="post"
                                onSubmit={(event) => {
                                    if (routedStartSubmittedRef.current) {
                                        event.preventDefault();
                                        return;
                                    }

                                    routedStartSubmittedRef.current = true;
                                    void questionAudio?.unlock();
                                    setIsPreparing(true);
                                }}
                            >
                                <button
                                    className={`ui-button candidate-button candidate-button--primary ${styles.actionButton}`}
                                    type="submit"
                                    disabled={isPreparing}
                                    aria-busy={isPreparing || undefined}
                                    data-state={isPreparing ? "loading" : undefined}
                                >
                                    <span className="ui-button__content">
                                        Start practice
                                        <ArrowRight size={16} aria-hidden="true" />
                                    </span>
                                    {isPreparing ? <Loader2 className="ui-button__spinner" aria-hidden="true" /> : null}
                                </button>
                                {isPreparing ? <span className="sr-only" role="status">Starting practice</span> : null}
                            </form>
                        ) : (
                            <button
                                className={`candidate-button candidate-button--primary ${styles.actionButton} ${styles.primaryAction}`}
                                type="button"
                                disabled={!canStart}
                                onClick={() => beginPreparing(onStart)}
                            >
                                Start practice
                                <ArrowRight size={16} aria-hidden="true" />
                            </button>
                        )}

                        {!canStart ? (
                            <p className={styles.startError} role="status">
                                I could not prepare the questions for this round. Return to setup and try again.
                            </p>
                        ) : null}

                        {returnHref ? (
                            <Link
                                className={`candidate-button candidate-button--secondary ${styles.actionButton} ${styles.secondaryAction}`}
                                href={returnHref}
                            >
                                <ArrowLeft size={16} aria-hidden="true" />
                                Return to Coach Plan
                            </Link>
                        ) : null}
                    </section>

                    {process.env.NODE_ENV !== "production" && onOpenDevelopmentPreview ? (
                        <details className={styles.development}>
                            <summary>Development tools</summary>
                            <button type="button" onClick={onOpenDevelopmentPreview}>
                                Open first question preview
                            </button>
                        </details>
                    ) : null}
                </div>
            </div>
        </main>
        {showEntryOverlay ? <CandidatePracticeEntryTransitionOverlay isReleasing={false} /> : null}
        </>
    );

    function beginPreparing(continueToPractice?: () => void) {
        if (isPreparing || !continueToPractice) {
            return;
        }

        void questionAudio?.unlock();
        if (manageTransitionExternally) {
            continueToPractice();
            return;
        }

        setIsPreparing(true);
        transitionTimerRef.current = window.setTimeout(continueToPractice, CANDIDATE_PRACTICE_ENTRY_HOLD_MS);
    }
}

function formatPreSessionCategory(category: string) {
    if (category in candidateQuestionPlanCategoryDetails) {
        return candidateQuestionPlanCategoryDetails[category as CandidateQuestionPlanCategory].label;
    }
    return category;
}

function CandidatePreSessionQuestionText({ questionText }: { questionText: string }) {
    const contentId = useId();
    const textRef = useRef<HTMLParagraphElement | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [canToggle, setCanToggle] = useState(false);

    useLayoutEffect(() => {
        if (isExpanded) {
            return;
        }

        const element = textRef.current;
        if (!element) {
            return;
        }

        const measure = () => {
            setCanToggle(element.scrollHeight > element.clientHeight + 1);
        };

        measure();

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(measure);
            observer.observe(element);
            return () => observer.disconnect();
        }

        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [isExpanded, questionText]);

    return (
        <>
            <p
                ref={textRef}
                id={contentId}
                className={`${styles.questionText}${isExpanded ? "" : ` ${styles.questionTextCollapsed}`}`}
            >
                {questionText}
            </p>
            {canToggle ? (
                <button
                    className={styles.questionToggle}
                    type="button"
                    aria-controls={contentId}
                    aria-expanded={isExpanded}
                    onClick={() => setIsExpanded((current) => !current)}
                >
                    {isExpanded ? "Show less" : "Show more"}
                </button>
            ) : null}
        </>
    );
}

export function CandidatePracticeEntryTransitionOverlay({
    isReleasing,
    mode = "entry",
}: {
    isReleasing: boolean;
    mode?: "entry" | "coach_plan" | "summary" | "dashboard";
}) {
    return (
        <div
            className={`candidate-practice-entry-overlay${isReleasing ? " is-releasing" : ""}`}
            aria-live="polite"
            aria-busy={!isReleasing}
        >
            <CandidatePracticeEntryTransitionContent mode={mode} />
        </div>
    );
}

function CandidatePracticeEntryTransitionContent({ mode }: {
    mode: "entry" | "coach_plan" | "summary" | "dashboard";
}) {
    const isCompletion = mode === "coach_plan" || mode === "summary";
    const isSummary = mode === "summary";
    const isDashboardReturn = mode === "dashboard";
    return (
        <section className="candidate-pre-session__transition">
            <span className="candidate-pre-session__loader" aria-hidden="true">
                <Sparkles size={24} />
            </span>
            <p className="type-eyebrow">
                {isDashboardReturn ? "Practice visit" : isCompletion ? "Practice complete" : "Practice round"}
            </p>
            <h1>
                {isDashboardReturn
                    ? "Returning to your dashboard"
                    : isSummary
                    ? "Preparing your summary"
                    : isCompletion
                        ? "Preparing your Coach Plan"
                        : "Entering practice space"}
            </h1>
            <p>
                {isDashboardReturn
                    ? <>Your answer is saved. Continue your plan whenever you&apos;re ready.</>
                    : isSummary
                    ? <>I&apos;m bringing together your answers and coaching from this round.</>
                    : isCompletion
                    ? <>I&apos;m connecting this round to your latest coaching and next practice steps.</>
                    : <>Your first question is ready. You&apos;ll begin in a moment.</>}
            </p>
        </section>
    );
}
