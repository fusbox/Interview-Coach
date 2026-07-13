"use client";

import {
    ArrowLeft,
    Camera,
    Keyboard,
    Mic,
    Play,
    SendHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
    candidateSetupStageOptions,
    type CandidateSetupStageId,
} from "@/features/candidate-setup-v2/candidate-setup-contract";
import type {
    CandidateAnswerDraft,
    CandidateAnswerDrafts,
} from "./candidate-answer-lifecycle";
import {
    createCandidateQuestionPlan,
} from "./candidate-question-plan";
import { CandidatePreSessionLanding } from "./CandidatePreSessionLanding";
import {
    readCandidateProvisionalSession,
    saveCandidateProvisionalSessionProgress,
    type CandidateAnswerAnalysisSnapshots,
    type CandidateProvisionalSessionProgress,
    type CandidateProvisionalSessionRecord,
} from "./candidate-provisional-session-store";
import {
    createFixtureCandidateQuestionWordingResult,
    parseCandidateQuestionWordingResult,
} from "./candidate-question-wording";

type CandidatePlannedSessionExperienceProps = {
    sessionId: string;
    dashboardHref: string;
    initialSession?: CandidateProvisionalSessionRecord | null;
};

export function CandidatePlannedSessionExperience({
    sessionId,
    dashboardHref,
    initialSession = null,
}: CandidatePlannedSessionExperienceProps) {
    const [session, setSession] = useState<CandidateProvisionalSessionRecord | null>(initialSession);
    const [hasCheckedStorage, setHasCheckedStorage] = useState(Boolean(initialSession));
    const [progress, setProgress] = useState<CandidateProvisionalSessionProgress>({
        status: initialSession?.progress?.status ?? "planned",
        currentQuestionIndex: initialSession?.progress?.currentQuestionIndex ?? 0,
    });
    const [answerDrafts, setAnswerDrafts] = useState<CandidateAnswerDrafts>(initialSession?.answerDrafts ?? {});
    const [answerAnalysisSnapshots, setAnswerAnalysisSnapshots] = useState<CandidateAnswerAnalysisSnapshots>(
        initialSession?.answerAnalysisSnapshots ?? {},
    );
    const [answerSubmitMessage, setAnswerSubmitMessage] = useState<string | null>(null);
    const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
    const [sessionCompletionMessage, setSessionCompletionMessage] = useState<string | null>(null);
    const [isCompletingSession, setIsCompletingSession] = useState(false);
    const loadedSessionIdRef = useRef<string | null>(initialSession ? sessionId : null);

    useEffect(() => {
        if (loadedSessionIdRef.current === sessionId) {
            setHasCheckedStorage(true);
            window.scrollTo({ top: 0 });
            return;
        }

        loadedSessionIdRef.current = sessionId;

        if (initialSession) {
            setSession(initialSession);
            setHasCheckedStorage(true);
            setProgress(initialSession.progress ?? {
                status: "planned",
                currentQuestionIndex: 0,
            });
            setAnswerDrafts(initialSession.answerDrafts ?? {});
            setAnswerAnalysisSnapshots(initialSession.answerAnalysisSnapshots ?? {});
            window.scrollTo({ top: 0 });
            return;
        }

        const storedSession = readCandidateProvisionalSession(window.sessionStorage, sessionId);
        setSession(storedSession);
        setHasCheckedStorage(true);
        setProgress(storedSession?.progress ?? {
            status: "planned",
            currentQuestionIndex: 0,
        });
        setAnswerDrafts(storedSession?.answerDrafts ?? {});
        setAnswerAnalysisSnapshots(storedSession?.answerAnalysisSnapshots ?? {});
        window.scrollTo({ top: 0 });
    }, [initialSession, sessionId]);

    const stageLabel = useMemo(
        () => session ? getStageLabel(session.setupSnapshot.interviewStage) : "",
        [session],
    );
    const questionPlan = useMemo(() => {
        if (!session) {
            return null;
        }

        return session.questionPlanSnapshot ?? createCandidateQuestionPlan({
            interviewStage: session.setupSnapshot.interviewStage,
            questionCount: session.setupSnapshot.questionCount,
        });
    }, [session]);
    const questionWordingPreview = useMemo(() => {
        if (!session || !questionPlan) {
            return null;
        }

        try {
            if (session.questionWordingSnapshot) {
                return parseCandidateQuestionWordingResult(session.questionWordingSnapshot, questionPlan);
            }

            return createFixtureCandidateQuestionWordingResult({
                setupSnapshot: session.setupSnapshot,
                questionPlanSnapshot: questionPlan,
            });
        } catch {
            return null;
        }
    }, [questionPlan, session]);

    if (!hasCheckedStorage) {
        return (
            <main className="candidate-design-system planned-session-page">
                <section className="planned-session-card" aria-live="polite">
                    <p className="type-eyebrow">Practice session</p>
                    <h1>Loading your practice plan.</h1>
                </section>
            </main>
        );
    }

    if (!session) {
        return (
            <main className="candidate-design-system planned-session-page">
                <section className="planned-session-card planned-session-card--missing">
                    <p className="type-eyebrow">Practice session</p>
                    <h1>I need the setup details for this practice round.</h1>
                    <p>
                        Start from Practice Setup again so I can prepare the round from the role, job description,
                        interview stage, and question count.
                    </p>
                    <a className="planned-session-action" href="/candidate/setup">
                        <ArrowLeft size={16} aria-hidden="true" />
                        Back to setup
                    </a>
                </section>
            </main>
        );
    }

    if ((progress.status === "question_preview" || progress.status === "live_question") && questionWordingPreview) {
        const activeQuestionIndex = Math.min(
            progress.currentQuestionIndex,
            Math.max(questionWordingPreview.questions.length - 1, 0),
        );
        const activeQuestion = questionWordingPreview.questions[activeQuestionIndex];
        const activeSlot = questionPlan?.slots[activeQuestion.index] ?? null;
        const isLiveQuestion = progress.status === "live_question";
        const activeDraftText = answerDrafts[activeQuestion.slotId]?.text ?? "";
        const activeAnalysisSnapshot = answerAnalysisSnapshots[activeQuestion.slotId] ?? null;
        const isLastQuestion = activeQuestionIndex >= questionWordingPreview.questions.length - 1;

        return (
            <main className="candidate-design-system planned-session-page">
                <section className="planned-live-question app-grid" aria-labelledby="planned-live-question-title">
                    <div className="planned-question-plan__header">
                        <p className="type-eyebrow">{isLiveQuestion ? "Practice question" : "Question preview"}</p>
                        <h1 id="planned-live-question-title">
                            Question {activeQuestion.index + 1} of {questionWordingPreview.questions.length}
                        </h1>
                        {isLiveQuestion ? (
                            <p>
                                Live practice has started. Answer this question, review the coaching, then continue
                                when you are ready.
                            </p>
                        ) : (
                            <p>
                                This is a read-only question preview from the carried wording snapshot. Answer
                                submission and coaching start when you enter live practice.
                            </p>
                        )}
                    </div>

                    <article className="planned-live-question__card">
                        <p className="type-eyebrow">{activeSlot?.label ?? "Question"}</p>
                        <h2>{activeQuestion.questionText}</h2>
                        {isLiveQuestion ? (
                            <p>
                                This started state preserves the question position for pause and resume.
                            </p>
                        ) : (
                            <p>
                                When the live runtime lands, this surface will collect your answer and guide the next
                                step. For now, it only proves the question handoff.
                            </p>
                        )}
                    </article>

                    <section className="answer-draft-shell" aria-labelledby="answer-draft-title">
                        <div className="answer-draft-shell__header">
                            <div>
                                <p className="type-eyebrow">Answer draft</p>
                                <h2 id="answer-draft-title">Try your answer here.</h2>
                            </div>
                            <div className="answer-draft-shell__modes" aria-label="Answer mode">
                                <button type="button" aria-pressed="true">
                                    <Keyboard size={16} aria-hidden="true" />
                                    Type answer
                                </button>
                                <button type="button" disabled>
                                    <Mic size={16} aria-hidden="true" />
                                    Record answer
                                </button>
                                <button type="button" disabled>
                                    <Camera size={16} aria-hidden="true" />
                                    Add photo notes
                                </button>
                            </div>
                        </div>

                        <label className="answer-draft-shell__field">
                            <span>Draft answer</span>
                            <textarea
                                value={activeDraftText}
                                onChange={(event) => updateAnswerDraft({
                                    slotId: activeQuestion.slotId,
                                    questionIndex: activeQuestion.index,
                                    text: event.target.value,
                                })}
                                rows={7}
                                placeholder="Write your answer here."
                            />
                        </label>

                        <div className="answer-draft-shell__footer">
                            <p>
                                {answerSubmitMessage
                                    ?? "Drafts save as you write. Submit when you are ready for coaching."}
                            </p>
                            <button
                                className="planned-session-action"
                                type="button"
                                disabled={!isLiveQuestion || !activeDraftText.trim() || isSubmittingAnswer}
                                onClick={() => submitAnswerDraft({
                                    slotId: activeQuestion.slotId,
                                    questionIndex: activeQuestion.index,
                                    text: activeDraftText,
                                })}
                            >
                                <SendHorizontal size={16} aria-hidden="true" />
                                Submit answer
                            </button>
                        </div>
                    </section>

                    {activeAnalysisSnapshot ? (
                        <section className="answer-draft-shell" aria-labelledby="coach-feedback-title">
                            <div className="answer-draft-shell__header">
                                <div>
                                    <p className="type-eyebrow">Coaching</p>
                                    <h2 id="coach-feedback-title">Coach feedback</h2>
                                </div>
                            </div>
                            <dl className="planned-session-summary">
                                <div>
                                    <dt>What worked</dt>
                                    <dd>{activeAnalysisSnapshot.coachFeedback.acknowledgement}</dd>
                                </div>
                                <div>
                                    <dt>What to strengthen</dt>
                                    <dd>{activeAnalysisSnapshot.coachFeedback.observation}</dd>
                                </div>
                                <div>
                                    <dt>Practice next</dt>
                                    <dd>{activeAnalysisSnapshot.coachFeedback.nextPracticeFocus}</dd>
                                </div>
                            </dl>
                            <div className="answer-draft-shell__footer">
                                <p>
                                    {isLastQuestion
                                        ? "You have reached the end of this round."
                                        : "Keep going when you are ready for the next question."}
                                </p>
                                {isLastQuestion ? (
                                    <button
                                        className="planned-session-action"
                                        type="button"
                                        disabled={isCompletingSession}
                                        onClick={finishSession}
                                    >
                                        {isCompletingSession ? "Finishing..." : "Finish session"}
                                    </button>
                                ) : (
                                    <button
                                        className="planned-session-action"
                                        type="button"
                                        onClick={() => updateProgress({
                                            status: "live_question",
                                            currentQuestionIndex: activeQuestionIndex + 1,
                                        })}
                                    >
                                        Continue to next question
                                    </button>
                                )}
                            </div>
                            {sessionCompletionMessage ? (
                                <p className="planned-session-status" role="alert">
                                    {sessionCompletionMessage}
                                </p>
                            ) : null}
                        </section>
                    ) : null}
                </section>

                <section className="planned-session-footer app-grid" aria-label="Question preview actions">
                    <button
                        className="planned-session-secondary"
                        type="button"
                        onClick={() => updateProgress({
                            status: "planned",
                            currentQuestionIndex: activeQuestionIndex,
                        })}
                    >
                        Back to plan
                    </button>
                    {isLiveQuestion ? null : (
                        <>
                            <button
                                className="planned-session-secondary"
                                type="button"
                                disabled={activeQuestionIndex === 0}
                                onClick={() => updateProgress({
                                    status: progress.status,
                                    currentQuestionIndex: Math.max(activeQuestionIndex - 1, 0),
                                })}
                            >
                                Previous question preview
                            </button>
                            <button
                                className="planned-session-secondary"
                                type="button"
                                disabled={activeQuestionIndex >= questionWordingPreview.questions.length - 1}
                                onClick={() => updateProgress({
                                    status: progress.status,
                                    currentQuestionIndex: Math.min(
                                        activeQuestionIndex + 1,
                                        questionWordingPreview.questions.length - 1,
                                    ),
                                })}
                            >
                                Next question preview
                            </button>
                        </>
                    )}
                    {isLiveQuestion ? null : (
                        <button
                            className="planned-session-action"
                            type="button"
                            onClick={() => updateProgress({
                                status: "live_question",
                                currentQuestionIndex: activeQuestionIndex,
                            })}
                        >
                            <Play size={16} aria-hidden="true" />
                            Start questions
                        </button>
                    )}
                </section>
            </main>
        );
    }

    return (
        <CandidatePreSessionLanding
            variant="initial"
            targetRole={session.setupSnapshot.targetRole}
            stageLabel={stageLabel}
            questionCount={session.setupSnapshot.questionCount}
            resumeIncluded={Boolean(session.setupSnapshot.resumeText)}
            onStart={questionWordingPreview ? () => updateProgress({
                status: "live_question",
                currentQuestionIndex: 0,
            }) : undefined}
            onOpenDevelopmentPreview={questionWordingPreview ? () => updateProgress({
                status: "question_preview",
                currentQuestionIndex: 0,
            }) : undefined}
        />
    );

    function updateProgress(nextProgress: CandidateProvisionalSessionProgress) {
        setProgress(nextProgress);
        saveCandidateProvisionalSessionProgress(window.sessionStorage, sessionId, nextProgress);

        if (!initialSession) {
            return;
        }

        void fetch(`/candidate/session/${encodeURIComponent(sessionId)}/progress`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(nextProgress),
        });
    }

    function updateAnswerDraft({
        slotId,
        questionIndex,
        text,
    }: {
        slotId: string;
        questionIndex: number;
        text: string;
    }) {
        const draft: CandidateAnswerDraft = {
            slotId,
            questionIndex,
            mode: "text",
            text,
            updatedAt: new Date().toISOString(),
        };

        setAnswerDrafts((currentDrafts) => ({
            ...currentDrafts,
            [slotId]: draft,
        }));

        if (!initialSession) {
            return;
        }

        void fetch(`/candidate/session/${encodeURIComponent(sessionId)}/answer-drafts`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                slotId,
                questionIndex,
                mode: "text",
                text,
            }),
        });
    }

    async function submitAnswerDraft({
        slotId,
        questionIndex,
        text,
    }: {
        slotId: string;
        questionIndex: number;
        text: string;
    }) {
        if (!text.trim()) {
            setAnswerSubmitMessage("Enter an answer before submitting.");
            return;
        }

        setIsSubmittingAnswer(true);
        setAnswerSubmitMessage(null);

        try {
            const response = await fetch(`/candidate/session/${encodeURIComponent(sessionId)}/answers`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    slotId,
                    questionIndex,
                    mode: "text",
                    text,
                }),
            });
            const result = await response.json().catch(() => null) as { status?: string } | null;
            if (result?.status === "answer_submit_saved") {
                await requestAnswerAnalysis({
                    slotId,
                });
                return;
            }

            if (result?.status === "answer_submit_unavailable") {
                setAnswerSubmitMessage("Answer submission is not connected yet. Your draft is still saved.");
                return;
            }

            if (!response.ok) {
                setAnswerSubmitMessage("Answer submission is not available yet. Your draft is still saved.");
            }
        } catch {
            setAnswerSubmitMessage("Answer submission is not available yet. Your draft is still saved.");
        } finally {
            setIsSubmittingAnswer(false);
        }
    }

    async function requestAnswerAnalysis({
        slotId,
    }: {
        slotId: string;
    }) {
        try {
            const response = await fetch(
                `/candidate/session/${encodeURIComponent(sessionId)}/answers/${encodeURIComponent(slotId)}/analysis`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );
            const result = await response.json().catch(() => null) as {
                status?: string;
                reason?: string;
                analysisSnapshot?: CandidateAnswerAnalysisSnapshots[string];
            } | null;
            if (result?.status === "answer_analysis_saved" && result.analysisSnapshot) {
                setAnswerAnalysisSnapshots((currentSnapshots) => ({
                    ...currentSnapshots,
                    [result.analysisSnapshot!.answer.slotId]: result.analysisSnapshot!,
                }));
                setAnswerSubmitMessage("Answer saved. Coaching is ready to review.");
                return;
            }

            if (result?.status === "answer_analysis_unavailable" && result.reason === "provider_not_configured") {
                setAnswerSubmitMessage("Answer saved. Coaching is still being connected.");
                return;
            }

            if (!response.ok) {
                setAnswerSubmitMessage("Answer saved. Coaching is not connected yet.");
            }
        } catch {
            setAnswerSubmitMessage("Answer saved. Coaching is not connected yet.");
        }
    }

    async function finishSession() {
        if (isCompletingSession) {
            return;
        }

        setIsCompletingSession(true);
        setSessionCompletionMessage(null);

        try {
            const response = await fetch(`/candidate/session/${encodeURIComponent(sessionId)}/complete`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            const result = await response.json().catch(() => null) as {
                status?: string;
                nextRoute?: string;
                error?: string;
            } | null;

            if (response.ok && result?.status === "candidate_session_completed") {
                window.location.assign(result.nextRoute ?? dashboardHref);
                return;
            }

            setSessionCompletionMessage(result?.error ?? "I could not finish this session yet. Try again.");
        } catch {
            setSessionCompletionMessage("I could not finish this session yet. Try again.");
        } finally {
            setIsCompletingSession(false);
        }
    }
}

function getStageLabel(stageId: CandidateSetupStageId) {
    return candidateSetupStageOptions.find((stage) => stage.id === stageId)?.label ?? "First interview";
}
