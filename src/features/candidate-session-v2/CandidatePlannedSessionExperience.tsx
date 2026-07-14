"use client";

import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SharedLivePracticeShell } from "@/features/interview-session-v2/SharedLivePracticeShell";
import { createSessionRuntimeFacts } from "@/features/interview-session-v2/session-runtime-facts";
import {
    candidateSetupStageOptions,
    type CandidateSetupStageId,
} from "@/features/candidate-setup-v2/candidate-setup-contract";
import type {
    CandidateAnswerDraft,
    CandidateAnswerDrafts,
    CandidateAnswerSubmissions,
} from "./candidate-answer-lifecycle";
import { createCandidateAnswerCoachingFacts } from "./candidate-coaching-facts";
import {
    createCandidateQuestionPlan,
} from "./candidate-question-plan";
import {
    CANDIDATE_PRACTICE_ENTRY_FADE_MS,
    CANDIDATE_PRACTICE_ENTRY_HOLD_MS,
    CandidatePracticeEntryTransitionOverlay,
    CandidatePreSessionLanding,
} from "./CandidatePreSessionLanding";
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
    entryTransitionRequested?: boolean;
};

export function CandidatePlannedSessionExperience({
    sessionId,
    dashboardHref,
    initialSession = null,
    entryTransitionRequested = false,
}: CandidatePlannedSessionExperienceProps) {
    const [session, setSession] = useState<CandidateProvisionalSessionRecord | null>(initialSession);
    const [hasCheckedStorage, setHasCheckedStorage] = useState(Boolean(initialSession));
    const [progress, setProgress] = useState<CandidateProvisionalSessionProgress>({
        status: initialSession?.progress?.status ?? "planned",
        currentQuestionIndex: initialSession?.progress?.currentQuestionIndex ?? 0,
    });
    const [answerDrafts, setAnswerDrafts] = useState<CandidateAnswerDrafts>(initialSession?.answerDrafts ?? {});
    const [answerSubmissions, setAnswerSubmissions] = useState<CandidateAnswerSubmissions>(
        initialSession?.answerSubmissions ?? {},
    );
    const [answerAnalysisSnapshots, setAnswerAnalysisSnapshots] = useState<CandidateAnswerAnalysisSnapshots>(
        initialSession?.answerAnalysisSnapshots ?? {},
    );
    const [answerSubmitMessage, setAnswerSubmitMessage] = useState<string | null>(null);
    const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
    const [sessionCompletionMessage, setSessionCompletionMessage] = useState<string | null>(null);
    const [isCompletingSession, setIsCompletingSession] = useState(false);
    const [entryTransitionPhase, setEntryTransitionPhase] = useState<"entering" | "releasing" | null>(
        entryTransitionRequested ? "entering" : null,
    );
    const loadedSessionIdRef = useRef<string | null>(initialSession ? sessionId : null);
    const routedEntryTransitionRef = useRef(entryTransitionRequested);
    const entryHoldTimerRef = useRef<number | null>(null);
    const entryReleaseTimerRef = useRef<number | null>(null);
    const entryFrameOneRef = useRef<number | null>(null);
    const entryFrameTwoRef = useRef<number | null>(null);

    const releasePracticeEntryTransition = useCallback(() => {
        entryFrameOneRef.current = window.requestAnimationFrame(() => {
            entryFrameTwoRef.current = window.requestAnimationFrame(() => {
                setEntryTransitionPhase("releasing");
                entryReleaseTimerRef.current = window.setTimeout(() => {
                    setEntryTransitionPhase(null);
                }, CANDIDATE_PRACTICE_ENTRY_FADE_MS);
            });
        });
    }, []);

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
            setAnswerSubmissions(initialSession.answerSubmissions ?? {});
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
        setAnswerSubmissions(storedSession?.answerSubmissions ?? {});
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
    const runtimeFacts = useMemo(() => {
        if (!session || !questionWordingPreview) {
            return null;
        }

        return createSessionRuntimeFacts({
            audience: "candidate_led",
            sessionId,
            targetRole: session.setupSnapshot.targetRole,
            interviewStage: session.setupSnapshot.interviewStage,
            questionCount: questionWordingPreview.questions.length,
            currentQuestionIndex: progress.currentQuestionIndex,
            questions: questionWordingPreview.questions.map((question) => {
                const answerSubmission = answerSubmissions[question.slotId];
                const analysisSnapshot = answerAnalysisSnapshots[question.slotId];

                return {
                    questionKey: question.slotId,
                    questionIndex: question.index,
                    category: question.category,
                    questionText: question.questionText,
                    ...(answerSubmission ? {
                        answer: {
                            mode: answerSubmission.mode,
                            text: answerSubmission.text,
                            submittedAt: answerSubmission.submittedAt,
                            lifecycleStatus: analysisSnapshot ? "analysis_saved" as const : "pending_analysis" as const,
                        },
                    } : {}),
                    ...(analysisSnapshot ? {
                        coachingFacts: createCandidateAnswerCoachingFacts(analysisSnapshot),
                    } : {}),
                };
            }),
            completionBehavior: {
                kind: "candidate_dashboard",
                dashboardHref,
            },
        });
    }, [
        answerAnalysisSnapshots,
        answerSubmissions,
        dashboardHref,
        progress.currentQuestionIndex,
        questionWordingPreview,
        session,
        sessionId,
    ]);

    useEffect(() => {
        if (progress.status !== "question_preview") {
            return;
        }

        const nextProgress: CandidateProvisionalSessionProgress = {
            status: "live_question",
            currentQuestionIndex: progress.currentQuestionIndex,
        };
        setProgress(nextProgress);
        saveCandidateProvisionalSessionProgress(window.sessionStorage, sessionId, nextProgress);

        if (initialSession) {
            void fetch(`/candidate/session/${encodeURIComponent(sessionId)}/progress`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(nextProgress),
            }).catch(() => undefined);
        }
    }, [initialSession, progress.currentQuestionIndex, progress.status, sessionId]);

    useEffect(() => {
        setAnswerSubmitMessage(null);
        setSessionCompletionMessage(null);
    }, [progress.currentQuestionIndex]);

    useEffect(() => {
        if (!routedEntryTransitionRef.current) {
            return;
        }

        routedEntryTransitionRef.current = false;
        const url = new URL(window.location.href);
        url.searchParams.delete("entry");
        window.history.replaceState(
            window.history.state,
            "",
            `${url.pathname}${url.search}${url.hash}`,
        );

        entryHoldTimerRef.current = window.setTimeout(
            releasePracticeEntryTransition,
            CANDIDATE_PRACTICE_ENTRY_HOLD_MS,
        );
    }, [releasePracticeEntryTransition]);

    useEffect(() => () => {
        if (entryHoldTimerRef.current !== null) {
            window.clearTimeout(entryHoldTimerRef.current);
        }
        if (entryReleaseTimerRef.current !== null) {
            window.clearTimeout(entryReleaseTimerRef.current);
        }
        if (entryFrameOneRef.current !== null) {
            window.cancelAnimationFrame(entryFrameOneRef.current);
        }
        if (entryFrameTwoRef.current !== null) {
            window.cancelAnimationFrame(entryFrameTwoRef.current);
        }
    }, []);

    const entryTransition = entryTransitionPhase ? (
        <CandidatePracticeEntryTransitionOverlay isReleasing={entryTransitionPhase === "releasing"} />
    ) : null;

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

    if (
        (progress.status === "question_preview" || progress.status === "live_question")
        && questionWordingPreview
        && runtimeFacts
    ) {
        const activeQuestionIndex = runtimeFacts.currentQuestionIndex;
        const activeQuestion = questionWordingPreview.questions[activeQuestionIndex];
        const activeDraftText = answerDrafts[activeQuestion.slotId]?.text ?? "";
        const activeAnalysisSnapshot = answerAnalysisSnapshots[activeQuestion.slotId] ?? null;
        const isLastQuestion = activeQuestionIndex >= questionWordingPreview.questions.length - 1;
        const feedbackContent = activeAnalysisSnapshot ? (
            <section className="candidate-live-feedback" aria-labelledby="coach-feedback-title">
                <header>
                    <p className="type-eyebrow">Coaching</p>
                    <h2 id="coach-feedback-title">Coach feedback</h2>
                </header>
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
                <footer>
                    <p>
                        {isLastQuestion
                            ? "You have reached the end of this round."
                            : "Keep going when you are ready for the next question."}
                    </p>
                    {isLastQuestion ? (
                        <button
                            className="candidate-button candidate-button--primary"
                            type="button"
                            disabled={isCompletingSession}
                            onClick={finishSession}
                        >
                            {isCompletingSession ? "Finishing..." : "Finish session"}
                        </button>
                    ) : (
                        <button
                            className="candidate-button candidate-button--primary"
                            type="button"
                            onClick={() => updateProgress({
                                status: "live_question",
                                currentQuestionIndex: activeQuestionIndex + 1,
                            })}
                        >
                            Continue to next question
                        </button>
                    )}
                </footer>
                {sessionCompletionMessage ? (
                    <p className="planned-session-status" role="alert">
                        {sessionCompletionMessage}
                    </p>
                ) : null}
            </section>
        ) : null;

        return (
            <>
                <SharedLivePracticeShell
                    facts={runtimeFacts}
                    answerMode="text"
                    draftText={activeDraftText}
                    isSubmitting={isSubmittingAnswer}
                    statusMessage={answerSubmitMessage}
                    feedbackContent={feedbackContent}
                    onDraftChange={(text) => updateAnswerDraft({
                        slotId: activeQuestion.slotId,
                        questionIndex: activeQuestion.index,
                        text,
                    })}
                    onSubmit={() => submitAnswerDraft({
                        slotId: activeQuestion.slotId,
                        questionIndex: activeQuestion.index,
                        text: activeDraftText,
                    })}
                />
                {entryTransition}
            </>
        );
    }

    return (
        <>
            <CandidatePreSessionLanding
                variant="initial"
                targetRole={session.setupSnapshot.targetRole}
                stageLabel={stageLabel}
                questionCount={session.setupSnapshot.questionCount}
                resumeIncluded={Boolean(session.setupSnapshot.resumeText)}
                sessionId={sessionId}
                firstQuestion={questionWordingPreview?.questions[0] ? {
                    id: questionWordingPreview.questions[0].slotId,
                    number: 1,
                    category: questionWordingPreview.questions[0].category,
                    questionText: questionWordingPreview.questions[0].questionText,
                } : undefined}
                manageTransitionExternally
                onStart={questionWordingPreview ? beginPracticeEntryTransition : undefined}
            />
            {entryTransition}
        </>
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

    function beginPracticeEntryTransition() {
        if (entryTransitionPhase) {
            return;
        }

        setEntryTransitionPhase("entering");
        entryHoldTimerRef.current = window.setTimeout(() => {
            updateProgress({
                status: "live_question",
                currentQuestionIndex: 0,
            });
            releasePracticeEntryTransition();
        }, CANDIDATE_PRACTICE_ENTRY_HOLD_MS);
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
            const result = await response.json().catch(() => null) as {
                status?: string;
                answerSubmissions?: CandidateAnswerSubmissions;
            } | null;
            if (result?.status === "answer_submit_saved") {
                if (result.answerSubmissions) {
                    setAnswerSubmissions(result.answerSubmissions);
                }
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
