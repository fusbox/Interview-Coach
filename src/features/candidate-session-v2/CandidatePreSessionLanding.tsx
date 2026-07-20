"use client";

import { ArrowLeft, Clock3, LockKeyhole, Play, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
    toSessionQuestionAudioTarget,
    type SessionQuestionAudioLifecycle,
} from "@/features/interview-session-v2/session-question-audio-contract";

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
    resumeIncluded: boolean;
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
    resumeIncluded,
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
    const transitionTimerRef = useRef<number | null>(null);
    const isFollowUp = variant === "follow_up";
    const isInvited = variant === "invited";
    const canStart = Boolean(startActionUrl || onStart);
    const questionLabel = questionCount === 1 ? "1 question" : `${questionCount} questions`;
    const normalizedStage = stageLabel.trim().toLowerCase();
    const stageContext = normalizedStage === "not sure yet"
        ? "based on the role details you shared"
        : `for your ${normalizedStage}`;
    const heading = isFollowUp
        ? "Your focused practice is ready."
        : isInvited
            ? `${candidateFirstName ? `Hi ${candidateFirstName}. ` : ""}Ready to practice?`
            : "Your practice is ready.";

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

    return (
        <>
        <main
            className="candidate-pre-session candidate-app-shell"
            inert={isPreparing ? true : undefined}
            aria-hidden={isPreparing || undefined}
        >
            <header className="candidate-pre-session__brand app-grid" aria-label="TalentArbor">
                <Image
                    src="/TA-logo.webp"
                    alt="TalentArbor"
                    width={300}
                    height={70}
                    className="candidate-pre-session__brand-mark"
                    priority
                    unoptimized
                />
            </header>
            <div className="candidate-pre-session__layout app-grid">
                <section className="candidate-pre-session__intro" aria-labelledby="candidate-pre-session-title">
                    <h1 id="candidate-pre-session-title">{heading}</h1>
                    <p className="candidate-pre-session__lede">
                        {isFollowUp
                            ? `${questionLabel} from your Coach Plan ${questionCount === 1 ? "is" : "are"} ready. I'll keep this round focused on the practice you chose.`
                            : isInvited
                                ? `You've been invited to work through ${questionLabel} for the ${targetRole} role. After each answer, your coach will help you strengthen your response.`
                            : `You'll work through ${questionLabel} ${stageContext}. After each answer, I'll help you see what's working and what to try next.`}
                    </p>
                </section>

                <section className="candidate-pre-session__summary" aria-label="Practice round details">
                    <header className="candidate-pre-session__summary-label">
                        <h2>{targetRole}</h2>
                    </header>
                    <dl
                        className={
                            isInvited
                                ? "candidate-pre-session__facts candidate-pre-session__facts--two"
                                : "candidate-pre-session__facts candidate-pre-session__facts--three"
                        }
                    >
                        <div>
                            <dt>Stage</dt>
                            <dd>{stageLabel}</dd>
                        </div>
                        <div>
                            <dt>Questions</dt>
                            <dd>{questionCount}</dd>
                        </div>
                        {!isInvited ? (
                            <div>
                                <dt>Resume</dt>
                                <dd>{resumeIncluded ? "Included" : "Not included"}</dd>
                            </div>
                        ) : null}
                    </dl>
                </section>

                {questions.length > 0 ? (
                    <section className="candidate-pre-session__questions" aria-labelledby="selected-practice-title">
                        <div>
                            <p className="type-eyebrow">Selected practice</p>
                            <h2 id="selected-practice-title">What you&apos;ll work through</h2>
                        </div>
                        <ol aria-label="Selected practice questions">
                            {questions.map((question) => (
                                <li key={question.id}>
                                    <span>Q{question.number}</span>
                                    <div>
                                        <p className="type-eyebrow">{question.category}</p>
                                        <p>{question.questionText}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>
                ) : null}

                <section className="candidate-pre-session__reassurance" aria-label="Before you begin">
                    <article>
                        <Clock3 size={20} aria-hidden="true" />
                        <div>
                            <h2>Practice at your pace.</h2>
                            <p>
                                {isInvited
                                    ? "Take the time you need. If you step away, use your original invitation link to return."
                                    : "Your progress is saved as you go, so you can pause and return when you're ready."}
                            </p>
                        </div>
                    </article>
                    <article>
                        <LockKeyhole size={20} aria-hidden="true" />
                        <div>
                            <h2>{isInvited ? "Know what is shared." : "For preparation, not hiring decisions."}</h2>
                            {isInvited ? (
                                <p>
                                    The recruiting team may review your answers to support your preparation. Your AI coaching is visible only to you, and the coach does not score you or make hiring decisions.
                                </p>
                            ) : (
                                <p>This candidate-led practice is for preparation and is not used to make hiring decisions.</p>
                            )}
                        </div>
                    </article>
                </section>

                <section className="candidate-pre-session__actions" aria-label="Practice actions">
                    {startActionUrl ? (
                        <form
                            aria-label="Start follow-up practice"
                            action={startActionUrl}
                            method="post"
                        >
                            <button className="candidate-button candidate-button--primary" type="submit">
                                <Play size={16} aria-hidden="true" />
                                Start practice
                            </button>
                        </form>
                    ) : (
                        <button
                            className="candidate-button candidate-button--primary"
                            type="button"
                            disabled={!canStart}
                            onClick={() => beginPreparing(onStart)}
                        >
                            <Play size={16} aria-hidden="true" />
                            Start practice
                        </button>
                    )}

                    {!canStart ? (
                        <p className="candidate-pre-session__start-error" role="status">
                            I could not prepare the questions for this round. Return to setup and try again.
                        </p>
                    ) : null}

                    {returnHref ? (
                        <Link className="candidate-button candidate-button--secondary" href={returnHref}>
                            <ArrowLeft size={16} aria-hidden="true" />
                            Return to Coach Plan
                        </Link>
                    ) : null}
                </section>

                {process.env.NODE_ENV !== "production" && onOpenDevelopmentPreview ? (
                    <details className="candidate-pre-session__development">
                        <summary>Development tools</summary>
                        <button type="button" onClick={onOpenDevelopmentPreview}>
                            Open first question preview
                        </button>
                    </details>
                ) : null}
            </div>
        </main>
        {isPreparing ? <CandidatePracticeEntryTransitionOverlay isReleasing={false} /> : null}
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

export function CandidatePracticeEntryTransitionOverlay({
    isReleasing,
    mode = "entry",
}: {
    isReleasing: boolean;
    mode?: "entry" | "coach_plan" | "summary";
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
    mode: "entry" | "coach_plan" | "summary";
}) {
    const isCompletion = mode !== "entry";
    const isSummary = mode === "summary";
    return (
        <section className="candidate-pre-session__transition">
            <span className="candidate-pre-session__loader" aria-hidden="true">
                <Sparkles size={24} />
            </span>
            <p className="type-eyebrow">{isCompletion ? "Practice complete" : "Practice round"}</p>
            <h1>
                {isSummary
                    ? "Preparing your summary"
                    : isCompletion
                        ? "Preparing your Coach Plan"
                        : "Entering practice space"}
            </h1>
            <p>
                {isSummary
                    ? <>I&apos;m bringing together your answers and coaching from this round.</>
                    : isCompletion
                    ? <>I&apos;m connecting this round to your latest coaching and next practice steps.</>
                    : <>Your first question is ready. You&apos;ll begin in a moment.</>}
            </p>
        </section>
    );
}
