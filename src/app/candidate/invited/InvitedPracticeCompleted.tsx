"use client";

import { CheckCircle2, ChevronDown, RotateCcw, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { InvitedPracticeDebrief } from "@/features/recruiter-invites-v2/invited-practice-debrief";

export function InvitedPracticeCompleted({ debrief }: { debrief: InvitedPracticeDebrief }) {
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState("");

    async function handlePracticeAgain() {
        if (isStarting) return;
        setIsStarting(true);
        setError("");
        try {
            const response = await fetch("/candidate/invited/practice-again", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: debrief.sessionId }),
            });
            const result = await response.json().catch(() => null) as { nextRoute?: string; error?: string } | null;
            if (!response.ok || !result?.nextRoute) {
                throw new Error(result?.error || "I couldn't start another practice round.");
            }
            window.location.replace(result.nextRoute);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "I couldn't start another practice round.");
            setIsStarting(false);
        }
    }

    return (
        <main className="invited-practice-complete candidate-app-shell">
            <header className="candidate-pre-session__brand" aria-label="TalentArbor">
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

            <section className="invited-practice-complete__hero" aria-labelledby="invited-practice-completed-title">
                <span className="invited-practice-complete__icon" aria-hidden="true">
                    <CheckCircle2 size={24} />
                </span>
                <div>
                    <p className="type-eyebrow">Round {debrief.sessionAttemptNumber} complete</p>
                    <h1 id="invited-practice-completed-title">Your {debrief.targetRole} practice is complete.</h1>
                    <p>Your answers and coaching are saved here for review.</p>
                </div>
                <dl className="invited-practice-complete__facts" aria-label="Practice round summary">
                    <div>
                        <dt>Questions</dt>
                        <dd>{debrief.questionCount}</dd>
                    </div>
                    <div>
                        <dt>Answered</dt>
                        <dd>{debrief.answeredCount}</dd>
                    </div>
                    <div>
                        <dt>Coaching ready</dt>
                        <dd>{debrief.coachedCount}</dd>
                    </div>
                </dl>
            </section>

            <section className="invited-practice-complete__review" aria-labelledby="invited-practice-review-title">
                <div className="invited-practice-complete__section-heading">
                    <p className="type-eyebrow">Your practice review</p>
                    <h2 id="invited-practice-review-title">Revisit each answer and the coaching you received.</h2>
                </div>
                <div className="invited-practice-complete__questions">
                    {debrief.questions.map((question, index) => (
                        <details key={question.slotId} open={index === 0}>
                            <summary>
                                <span className="invited-practice-complete__question-number">Q{question.questionNumber}</span>
                                <span>
                                    <span className="type-eyebrow">{question.categoryLabel}</span>
                                    <strong>{question.questionText}</strong>
                                </span>
                                <ChevronDown size={20} aria-hidden="true" />
                            </summary>
                            <div className="invited-practice-complete__question-body">
                                <article>
                                    <h3>Your answer</h3>
                                    <p>{question.answerText ?? "No answer was submitted for this question."}</p>
                                </article>
                                <article className="invited-practice-complete__coaching">
                                    <h3>Coach feedback</h3>
                                    {question.coaching ? (
                                        <>
                                            <p className="invited-practice-complete__acknowledgement">
                                                {question.coaching.acknowledgement}
                                            </p>
                                            <p>{question.coaching.observation}</p>
                                            <p><strong>Try next:</strong> {question.coaching.nextPracticeFocus}</p>
                                        </>
                                    ) : (
                                        <p>Your answer is saved, but coaching was not available for this question.</p>
                                    )}
                                </article>
                            </div>
                        </details>
                    ))}
                </div>
            </section>

            <section className="invited-practice-complete__actions" aria-label="Practice completion actions">
                <div>
                    <h2>Want another run at these questions?</h2>
                    <p>Practice the same recruiter-selected round again. Your earlier work stays saved.</p>
                </div>
                <div className="invited-practice-complete__action-buttons">
                    <button
                        type="button"
                        className="candidate-button candidate-button--primary"
                        onClick={handlePracticeAgain}
                        disabled={isStarting}
                    >
                        <RotateCcw size={18} aria-hidden="true" />
                        {isStarting ? "Preparing your round..." : "Practice again"}
                    </button>
                    <button
                        type="button"
                        className="candidate-button candidate-button--secondary"
                        onClick={() => window.close()}
                    >
                        <X size={18} aria-hidden="true" />
                        Close this window
                    </button>
                </div>
                {error ? <p className="invited-practice-entry__error" role="alert">{error}</p> : null}
            </section>
        </main>
    );
}
