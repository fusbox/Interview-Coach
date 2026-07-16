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
    CandidateAnswerDrafts,
    CandidateAnswerSubmissions,
} from "./candidate-answer-lifecycle";
import { createCandidateAnswerCoachingFacts } from "./candidate-coaching-facts";
import { CandidateStagedFeedback } from "./CandidateStagedFeedback";
import {
    createCandidateFeedbackInteraction,
    type CandidateFeedbackActionEvent,
} from "./candidate-feedback-interaction";
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
    saveCandidateProvisionalSessionAnswerDraft,
    saveCandidateProvisionalSessionFeedbackActionEvent,
    saveCandidateProvisionalSessionProgress,
    type CandidateAnswerAnalysisSnapshots,
    type CandidateFeedbackActionEvents,
    type CandidateProvisionalSessionProgress,
    type CandidateProvisionalSessionRecord,
} from "./candidate-provisional-session-store";
import {
    createFixtureCandidateQuestionWordingResult,
    parseCandidateQuestionWordingResult,
} from "./candidate-question-wording";
import { useCandidateTypedAnswerMutations } from "./useCandidateTypedAnswerMutations";
import type { CandidateAnswerAnalysisRecovery } from "./candidate-answer-analysis-recovery";
import type { SessionAnswerMutationPhase } from "@/features/interview-session-v2/session-answer-mutation-contract";

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
    const [feedbackActionEvents, setFeedbackActionEvents] = useState<CandidateFeedbackActionEvents>(
        initialSession?.feedbackActionEvents ?? {},
    );
    const [feedbackRetrySources, setFeedbackRetrySources] = useState<Record<string, string>>(() => (
        createRecoveredFeedbackRetrySources(initialSession)
    ));
    const feedbackRetrySourcesRef = useRef(feedbackRetrySources);
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
    const handleAnswerSubmissionSaved = useCallback((slotId: string) => {
        const nextSources = { ...feedbackRetrySourcesRef.current };
        delete nextSources[slotId];
        feedbackRetrySourcesRef.current = nextSources;
        setFeedbackRetrySources((currentSources) => {
            if (!(slotId in currentSources)) {
                return currentSources;
            }

            const nextStateSources = { ...currentSources };
            delete nextStateSources[slotId];
            return nextStateSources;
        });
    }, []);
    const {
        answerMutationPhases,
        flushAnswerDraft,
        retryAnswerAnalysis,
        submitAnswerDraft,
        updateAnswerDraft,
    } = useCandidateTypedAnswerMutations({
        sessionId,
        hasDurableSession: Boolean(initialSession),
        setAnswerDrafts,
        setAnswerSubmissions,
        setAnswerAnalysisSnapshots,
        saveBrowserDraft: (draft) => {
            saveCandidateProvisionalSessionAnswerDraft(window.sessionStorage, sessionId, draft);
        },
        onAnswerSubmissionSaved: handleAnswerSubmissionSaved,
    });

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
            setFeedbackActionEvents(initialSession.feedbackActionEvents ?? {});
            const recoveredRetrySources = createRecoveredFeedbackRetrySources(initialSession);
            feedbackRetrySourcesRef.current = recoveredRetrySources;
            setFeedbackRetrySources(recoveredRetrySources);
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
        setFeedbackActionEvents(storedSession?.feedbackActionEvents ?? {});
        const recoveredRetrySources = createRecoveredFeedbackRetrySources(storedSession);
        feedbackRetrySourcesRef.current = recoveredRetrySources;
        setFeedbackRetrySources(recoveredRetrySources);
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
                const analysisSnapshot = feedbackRetrySources[question.slotId]
                    ? null
                    : getCurrentAnswerAnalysisSnapshot(
                        answerSubmission,
                        answerAnalysisSnapshots[question.slotId],
                    );

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
        feedbackRetrySources,
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
    const completionTransition = isCompletingSession ? (
        <CandidatePracticeEntryTransitionOverlay isReleasing={false} mode="completion" />
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
        const activeAnswerSubmission = answerSubmissions[activeQuestion.slotId] ?? null;
        const activeAnalysisRecovery = session.answerAnalysisRecoveries?.[activeQuestion.slotId] ?? null;
        const activeDraftText = answerDrafts[activeQuestion.slotId]?.text ?? activeAnswerSubmission?.text ?? "";
        const activeRetrySource = feedbackRetrySources[activeQuestion.slotId] ?? null;
        const activeAnalysisSnapshot = activeRetrySource
            ? null
            : getCurrentAnswerAnalysisSnapshot(
                activeAnswerSubmission,
                answerAnalysisSnapshots[activeQuestion.slotId],
            );
        const activeAnswerMutationPhase = answerMutationPhases[activeQuestion.slotId]
            ?? (activeRetrySource
                ? "draft_saved"
                : activeAnalysisSnapshot
                ? "analysis_ready"
                : activeAnswerSubmission
                    ? activeAnalysisRecovery
                        ? toRecoveredAnswerMutationPhase(activeAnalysisRecovery)
                        : "analysis_failed"
                    : activeDraftText
                        ? "draft_saved"
                        : "idle");
        const isLastQuestion = activeQuestionIndex >= questionWordingPreview.questions.length - 1;
        const feedbackInteraction = activeAnalysisSnapshot
            ? createCandidateFeedbackInteraction({
                analysisSnapshot: activeAnalysisSnapshot,
                isLastQuestion,
            })
            : null;
        const feedbackContent = activeAnalysisSnapshot ? (
            <CandidateStagedFeedback
                key={`${activeQuestion.slotId}:${activeAnalysisSnapshot.answer.answerAttemptId ?? activeAnalysisSnapshot.analyzedAt}`}
                interaction={feedbackInteraction!}
                savedActionEvent={feedbackActionEvents[activeQuestion.slotId]}
                isCompletingSession={isCompletingSession}
                completionMessage={sessionCompletionMessage}
                onPersistAction={persistFeedbackAction}
                onAdvanceQuestion={() => updateProgress({
                    status: "live_question",
                    currentQuestionIndex: activeQuestionIndex + 1,
                })}
                onFinishSession={finishSession}
                onRetryAnswer={(sourceAnswerAttemptId) => {
                    const nextRetrySources = {
                        ...feedbackRetrySourcesRef.current,
                        [activeQuestion.slotId]: sourceAnswerAttemptId,
                    };
                    feedbackRetrySourcesRef.current = nextRetrySources;
                    setFeedbackRetrySources(nextRetrySources);
                    updateAnswerDraft({
                        slotId: activeQuestion.slotId,
                        questionIndex: activeQuestion.index,
                        text: activeAnswerSubmission?.text ?? activeDraftText,
                    });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }}
            />
        ) : null;

        return (
            <>
                <SharedLivePracticeShell
                    facts={runtimeFacts}
                    answerMode="text"
                    draftText={activeDraftText}
                    answerMutationPhase={activeAnswerMutationPhase}
                    feedbackContent={feedbackContent}
                    onDraftChange={(text) => updateAnswerDraft({
                        slotId: activeQuestion.slotId,
                        questionIndex: activeQuestion.index,
                        text,
                    })}
                    onDraftBlur={() => flushAnswerDraft({
                        slotId: activeQuestion.slotId,
                        questionIndex: activeQuestion.index,
                        text: activeDraftText,
                        retrySourceAnswerAttemptId: activeRetrySource,
                    })}
                    onRetryDraftSave={() => flushAnswerDraft({
                        slotId: activeQuestion.slotId,
                        questionIndex: activeQuestion.index,
                        text: activeDraftText,
                    })}
                    onRetryAnalysis={() => retryAnswerAnalysis(activeQuestion.slotId)}
                    onContinueWithoutCoaching={() => {
                        if (isLastQuestion) {
                            void finishSession();
                            return;
                        }
                        updateProgress({
                            status: "live_question",
                            currentQuestionIndex: activeQuestionIndex + 1,
                        });
                    }}
                    continueWithoutCoachingLabel={isLastQuestion
                        ? "Finish without coaching"
                        : "Continue without coaching"}
                    isContinuingWithoutCoaching={isLastQuestion && isCompletingSession}
                    continueWithoutCoachingError={isLastQuestion ? sessionCompletionMessage : null}
                    onSubmit={() => submitAnswerDraft({
                        slotId: activeQuestion.slotId,
                        questionIndex: activeQuestion.index,
                        text: activeDraftText,
                        retrySourceAnswerAttemptId: feedbackRetrySourcesRef.current[activeQuestion.slotId]
                            ?? activeRetrySource,
                    })}
                />
                {entryTransition}
                {completionTransition}
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

    async function persistFeedbackAction(feedbackActionEvent: CandidateFeedbackActionEvent) {
        if (!initialSession) {
            const savedSession = saveCandidateProvisionalSessionFeedbackActionEvent(
                window.sessionStorage,
                sessionId,
                feedbackActionEvent,
            );
            if (!savedSession) {
                return false;
            }
            setFeedbackActionEvents(savedSession.feedbackActionEvents ?? {});
            return true;
        }

        try {
            const response = await fetch(`/candidate/session/${encodeURIComponent(sessionId)}/feedback-actions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(feedbackActionEvent),
            });
            const result = await response.json().catch(() => null) as {
                status?: string;
                feedbackActionEvents?: CandidateFeedbackActionEvents;
            } | null;
            if (!response.ok || result?.status !== "feedback_action_saved" || !result.feedbackActionEvents) {
                return false;
            }

            setFeedbackActionEvents(result.feedbackActionEvents);
            return true;
        } catch {
            return false;
        }
    }

    async function finishSession() {
        if (isCompletingSession) {
            return;
        }

        setIsCompletingSession(true);
        setSessionCompletionMessage(null);

        let navigationStarted = false;
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
                navigationStarted = true;
                window.location.assign(result.nextRoute ?? dashboardHref);
                return;
            }

            setSessionCompletionMessage(result?.error ?? "I could not finish this session yet. Try again.");
        } catch {
            setSessionCompletionMessage("I could not finish this session yet. Try again.");
        } finally {
            if (!navigationStarted) {
                setIsCompletingSession(false);
            }
        }
    }
}

function toRecoveredAnswerMutationPhase(
    recovery: CandidateAnswerAnalysisRecovery,
): SessionAnswerMutationPhase {
    switch (recovery.state) {
        case "pending":
            return "analysis_pending";
        case "recoverable":
            return "analysis_recoverable";
        case "unavailable":
            return "analysis_unavailable";
        case "retryable":
        default:
            return "analysis_failed";
    }
}

function getStageLabel(stageId: CandidateSetupStageId) {
    return candidateSetupStageOptions.find((stage) => stage.id === stageId)?.label ?? "First interview";
}

function getCurrentAnswerAnalysisSnapshot(
    answerSubmission: CandidateAnswerSubmissions[string] | null | undefined,
    analysisSnapshot: CandidateAnswerAnalysisSnapshots[string] | null | undefined,
) {
    if (!answerSubmission || !analysisSnapshot) {
        return null;
    }

    if (analysisSnapshot.answer.answerAttemptId) {
        return analysisSnapshot.answer.answerAttemptId === answerSubmission.answerAttemptId
            ? analysisSnapshot
            : null;
    }

    return !answerSubmission.attemptNumber || answerSubmission.attemptNumber === 1
        ? analysisSnapshot
        : null;
}

function createRecoveredFeedbackRetrySources(
    session: CandidateProvisionalSessionRecord | null | undefined,
) {
    if (!session) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(session.feedbackActionEvents ?? {}).flatMap(([slotId, event]) => {
            const sourceAttemptId = event.answer.answerAttemptId;
            const answerSubmission = session.answerSubmissions?.[slotId];
            const analysisSnapshot = session.answerAnalysisSnapshots?.[slotId];
            return event.actionKind === "retry_answer"
                && event.transition === "retry_current_question"
                && sourceAttemptId
                && answerSubmission?.answerAttemptId === sourceAttemptId
                && analysisSnapshot?.answer.answerAttemptId === sourceAttemptId
                ? [[slotId, sourceAttemptId] as const]
                : [];
        }),
    );
}
