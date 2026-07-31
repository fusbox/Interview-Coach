"use client";

import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SharedLivePracticeShell } from "@/features/interview-session-v2/SharedLivePracticeShell";
import { SessionVoiceAnswerCapture } from "@/features/interview-session-v2/SessionVoiceAnswerCapture";
import { createSessionRuntimeFacts } from "@/features/interview-session-v2/session-runtime-facts";
import type { SessionCompletionBehavior } from "@/features/interview-session-v2/session-runtime-contract";
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
import { InvitedPracticePause } from "./InvitedPracticePause";
import type { CandidateAnswerAnalysisRecovery } from "./candidate-answer-analysis-recovery";
import type { SessionAnswerMutationPhase } from "@/features/interview-session-v2/session-answer-mutation-contract";
import { useSessionQuestionAudio } from "@/features/interview-session-v2/session-question-audio-browser";
import { toSessionQuestionAudioTarget } from "@/features/interview-session-v2/session-question-audio-contract";
import { isVoiceTranscriptDraftResolvedByAnswer } from "@/features/interview-session-v2/voice-answer-transcription";

type CandidatePlannedSessionExperienceProps = {
    sessionId: string;
    dashboardHref: string;
    initialSession?: CandidateProvisionalSessionRecord | null;
    entryTransitionRequested?: boolean;
    entryTransitionStartsPractice?: boolean;
    mutationBasePath?: string;
    completionBehavior?: SessionCompletionBehavior;
    exitHref?: string;
    exitLabel?: string;
    invitedPauseEnabled?: boolean;
    questionAudioEnabled?: boolean;
    voiceAnswerEnabled?: boolean;
};

export function CandidatePlannedSessionExperience({
    sessionId,
    dashboardHref,
    initialSession = null,
    entryTransitionRequested = false,
    entryTransitionStartsPractice = false,
    mutationBasePath = `/candidate/session/${encodeURIComponent(sessionId)}`,
    completionBehavior,
    exitHref,
    exitLabel,
    invitedPauseEnabled = false,
    questionAudioEnabled = false,
    voiceAnswerEnabled = false,
}: CandidatePlannedSessionExperienceProps) {
    const [session, setSession] = useState<CandidateProvisionalSessionRecord | null>(initialSession);
    const [hasCheckedStorage, setHasCheckedStorage] = useState(Boolean(initialSession));
    const [progress, setProgress] = useState<CandidateProvisionalSessionProgress>({
        status: initialSession?.progress?.status ?? "planned",
        currentQuestionIndex: initialSession?.progress?.currentQuestionIndex ?? 0,
        ...(initialSession?.progress?.answerMode ? { answerMode: initialSession.progress.answerMode } : {}),
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
    const [isPausingSession, setIsPausingSession] = useState(false);
    const [isSessionPaused, setIsSessionPaused] = useState(false);
    const [answerMode, setAnswerMode] = useState<"text" | "voice">(
        resolveAvailableAnswerMode(initialSession?.progress?.answerMode, voiceAnswerEnabled),
    );
    const [hasUnsafeVoiceWork, setHasUnsafeVoiceWork] = useState(false);
    const [isVoiceAnswerModeLocked, setIsVoiceAnswerModeLocked] = useState(false);
    const [isVoiceInteractionGated, setIsVoiceInteractionGated] = useState(false);
    const [isVoiceSubmitPreparing, setIsVoiceSubmitPreparing] = useState(false);
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
        submitVoiceTranscript,
        updateAnswerDraft,
    } = useCandidateTypedAnswerMutations({
        sessionId,
        mutationBasePath,
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

    const updateProgress = useCallback((nextProgress: CandidateProvisionalSessionProgress) => {
        const nextProgressWithAnswerMode = {
            ...nextProgress,
            ...(nextProgress.answerMode ?? progress.answerMode
                ? { answerMode: nextProgress.answerMode ?? progress.answerMode }
                : {}),
        };
        setProgress(nextProgressWithAnswerMode);
        saveCandidateProvisionalSessionProgress(window.sessionStorage, sessionId, nextProgressWithAnswerMode);

        if (!initialSession) {
            return;
        }

        void fetch(`${mutationBasePath}/progress`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(nextProgressWithAnswerMode),
        });
    }, [initialSession, mutationBasePath, progress.answerMode, sessionId]);

    const handleAnswerModeChange = useCallback((nextMode: "text" | "voice") => {
        if (nextMode === answerMode) return;
        if (isVoiceAnswerModeLocked) return;

        setAnswerMode(nextMode);
        updateProgress({
            ...progress,
            answerMode: nextMode,
        });
    }, [answerMode, isVoiceAnswerModeLocked, progress, updateProgress]);

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
            setAnswerMode(resolveAvailableAnswerMode(initialSession.progress?.answerMode, voiceAnswerEnabled));
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
        setAnswerMode(resolveAvailableAnswerMode(storedSession?.progress?.answerMode, voiceAnswerEnabled));
        setAnswerDrafts(storedSession?.answerDrafts ?? {});
        setAnswerSubmissions(storedSession?.answerSubmissions ?? {});
        setAnswerAnalysisSnapshots(storedSession?.answerAnalysisSnapshots ?? {});
        setFeedbackActionEvents(storedSession?.feedbackActionEvents ?? {});
        const recoveredRetrySources = createRecoveredFeedbackRetrySources(storedSession);
        feedbackRetrySourcesRef.current = recoveredRetrySources;
        setFeedbackRetrySources(recoveredRetrySources);
        window.scrollTo({ top: 0 });
    }, [initialSession, sessionId, voiceAnswerEnabled]);

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

        const resolvedCompletionBehavior = completionBehavior ?? {
            kind: "candidate_dashboard" as const,
            dashboardHref,
        };
        return createSessionRuntimeFacts({
            audience: resolvedCompletionBehavior.kind === "invited_debrief"
                ? "invited_candidate"
                : "candidate_led",
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
            completionBehavior: resolvedCompletionBehavior,
        });
    }, [
        answerAnalysisSnapshots,
        answerSubmissions,
        completionBehavior,
        dashboardHref,
        feedbackRetrySources,
        progress.currentQuestionIndex,
        questionWordingPreview,
        session,
        sessionId,
    ]);
    const activeAudioQuestion = runtimeFacts?.questions[runtimeFacts.currentQuestionIndex] ?? null;
    const activeAudioTarget = activeAudioQuestion
        ? toSessionQuestionAudioTarget({ sessionId, question: activeAudioQuestion })
        : null;
    const { questionAudio, questionPlaybackControl } = useSessionQuestionAudio({
        enabled: questionAudioEnabled,
        requestPath: `${mutationBasePath}/question-audio`,
        activeTarget: activeAudioTarget,
    });

    useEffect(() => {
        if (progress.status !== "question_preview") {
            return;
        }

        const nextProgress: CandidateProvisionalSessionProgress = {
            status: "live_question",
            currentQuestionIndex: progress.currentQuestionIndex,
            ...(progress.answerMode ? { answerMode: progress.answerMode } : {}),
        };
        setProgress(nextProgress);
        saveCandidateProvisionalSessionProgress(window.sessionStorage, sessionId, nextProgress);

        if (initialSession) {
            void fetch(`${mutationBasePath}/progress`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(nextProgress),
            }).catch(() => undefined);
        }
    }, [initialSession, mutationBasePath, progress.answerMode, progress.currentQuestionIndex, progress.status, sessionId]);

    useEffect(() => {
        setSessionCompletionMessage(null);
    }, [progress.currentQuestionIndex]);

    useEffect(() => {
        if (!routedEntryTransitionRef.current) {
            return;
        }

        const url = new URL(window.location.href);
        url.searchParams.delete("entry");
        window.history.replaceState(
            window.history.state,
            "",
            `${url.pathname}${url.search}${url.hash}`,
        );

        entryHoldTimerRef.current = window.setTimeout(() => {
            routedEntryTransitionRef.current = false;
            entryHoldTimerRef.current = null;
            if (entryTransitionStartsPractice && progress.status === "planned") {
                updateProgress({
                    status: "live_question",
                    currentQuestionIndex: 0,
                });
            }
            releasePracticeEntryTransition();
        }, CANDIDATE_PRACTICE_ENTRY_HOLD_MS);

        return () => {
            if (entryHoldTimerRef.current !== null) {
                window.clearTimeout(entryHoldTimerRef.current);
                entryHoldTimerRef.current = null;
            }
        };
    }, [entryTransitionStartsPractice, progress.status, releasePracticeEntryTransition, updateProgress]);

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
        <CandidatePracticeEntryTransitionOverlay
            isReleasing={false}
            mode={completionBehavior?.kind === "invited_debrief" ? "summary" : "coach_plan"}
        />
    ) : null;

    if (!hasCheckedStorage) {
        return (
            <main className="planned-session-page">
                <section className="planned-session-card" aria-live="polite">
                    <p className="type-eyebrow">Practice session</p>
                    <h1>Loading your practice plan.</h1>
                </section>
            </main>
        );
    }

    if (!session) {
        return (
            <main className="planned-session-page">
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
        const activeRetrySource = feedbackRetrySources[activeQuestion.slotId] ?? null;
        const activeTextDraft = activeRetrySource
            ? answerDrafts[activeQuestion.slotId]?.text ?? activeAnswerSubmission?.text ?? ""
            : answerDrafts[activeQuestion.slotId]?.text ?? "";
        const activeSubmittedAnswerText = activeAnswerSubmission?.text
            ?? (answerMode === "text" ? activeTextDraft : "");
        const currentVoiceTranscriptDraft = session.voiceTranscriptDrafts?.[activeQuestion.slotId] ?? null;
        const initialVoiceTranscriptDraft = isVoiceTranscriptDraftResolvedByAnswer(
            currentVoiceTranscriptDraft,
            activeAnswerSubmission,
        )
            ? null
            : currentVoiceTranscriptDraft;
        const canUseVoiceAnswers = voiceAnswerEnabled && Boolean(initialSession);
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
                    : activeTextDraft
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
                        text: activeAnswerSubmission?.text ?? activeTextDraft,
                    });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }}
            />
        ) : null;

        if (isSessionPaused) {
            return (
                <InvitedPracticePause
                    targetRole={runtimeFacts.targetRole}
                    onResume={() => setIsSessionPaused(false)}
                />
            );
        }

        const pauseInvitedSession = async () => {
            if (!invitedPauseEnabled || isPausingSession) {
                return;
            }

            if (hasUnsafeVoiceWork && !window.confirm(
                "This recording has not been transcribed yet. Pause now and this recording will be discarded?",
            )) {
                return;
            }

            setIsPausingSession(true);
            try {
                const draftSaved = activeAnswerSubmission || answerMode === "voice"
                    ? true
                    : await flushAnswerDraft({
                        slotId: activeQuestion.slotId,
                        questionIndex: activeQuestion.index,
                        text: activeTextDraft,
                    });
                if (draftSaved) {
                    setIsSessionPaused(true);
                }
            } finally {
                setIsPausingSession(false);
            }
        };

        const exitCandidateSession = () => {
            if (hasUnsafeVoiceWork && !window.confirm(
                "This recording has not been transcribed yet. Leave now and this recording will be discarded?",
            )) {
                return;
            }
            window.location.assign(exitHref ?? dashboardHref);
        };

        return (
            <>
                <SharedLivePracticeShell
                    facts={runtimeFacts}
                    exitHref={exitHref}
                    exitLabel={exitLabel}
                    isExitPending={isPausingSession}
                    onExit={invitedPauseEnabled
                        ? () => void pauseInvitedSession()
                        : canUseVoiceAnswers
                            ? exitCandidateSession
                            : undefined}
                    answerMode={answerMode}
                    availableAnswerModes={canUseVoiceAnswers ? ["text", "voice"] : ["text"]}
                    answerModeChangeDisabled={isVoiceAnswerModeLocked}
                    interactionGateActive={isVoiceInteractionGated}
                    isVoiceSubmitPreparing={isVoiceSubmitPreparing}
                    onAnswerModeChange={handleAnswerModeChange}
                    draftText={activeTextDraft}
                    submittedAnswerText={activeSubmittedAnswerText}
                    answerMutationPhase={activeAnswerMutationPhase}
                    feedbackContent={feedbackContent}
                    questionAudio={questionAudio}
                    questionPlaybackControl={questionPlaybackControl}
                    voiceAnswerContent={canUseVoiceAnswers ? (
                        <SessionVoiceAnswerCapture
                            key={`${activeQuestion.slotId}:${activeRetrySource ?? "initial"}`}
                            mutationBasePath={mutationBasePath}
                            questionSlotId={activeQuestion.slotId}
                            questionIndex={activeQuestion.index}
                            initialTranscriptDraft={initialVoiceTranscriptDraft}
                            onQuickSubmitTranscript={(draft) => submitVoiceTranscript({
                                draft,
                                transcriptText: draft.transcriptText,
                                retrySourceAnswerAttemptId: feedbackRetrySourcesRef.current[activeQuestion.slotId]
                                    ?? activeRetrySource,
                            })}
                            onReviewedSubmitTranscript={({ draft, transcriptText }) => submitVoiceTranscript({
                                draft,
                                transcriptText,
                                retrySourceAnswerAttemptId: feedbackRetrySourcesRef.current[activeQuestion.slotId]
                                    ?? activeRetrySource,
                            })}
                            onSwitchToText={() => handleAnswerModeChange("text")}
                            onUnsafeLocalWorkChange={setHasUnsafeVoiceWork}
                            onAnswerModeLockChange={setIsVoiceAnswerModeLocked}
                            onInteractionGateChange={setIsVoiceInteractionGated}
                            onSubmitProgressChange={setIsVoiceSubmitPreparing}
                        />
                    ) : undefined}
                    onDraftChange={(text) => updateAnswerDraft({
                        slotId: activeQuestion.slotId,
                        questionIndex: activeQuestion.index,
                        text,
                    })}
                    onDraftBlur={() => flushAnswerDraft({
                        slotId: activeQuestion.slotId,
                        questionIndex: activeQuestion.index,
                        text: activeTextDraft,
                        retrySourceAnswerAttemptId: activeRetrySource,
                    })}
                    onRetryDraftSave={() => flushAnswerDraft({
                        slotId: activeQuestion.slotId,
                        questionIndex: activeQuestion.index,
                        text: activeTextDraft,
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
                        text: activeTextDraft,
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
                resumeLabel={session.setupSnapshot.resumeArtifact?.candidateLabel ?? null}
                sessionId={sessionId}
                questions={questionWordingPreview?.questions.map((question, index) => ({
                    id: question.slotId,
                    number: index + 1,
                    category: question.category,
                    questionText: question.questionText,
                }))}
                firstQuestion={questionWordingPreview?.questions[0] ? {
                    id: questionWordingPreview.questions[0].slotId,
                    number: 1,
                    category: questionWordingPreview.questions[0].category,
                    questionText: questionWordingPreview.questions[0].questionText,
                } : undefined}
                questionAudio={questionAudio}
                manageTransitionExternally
                onStart={questionWordingPreview ? beginPracticeEntryTransition : undefined}
                returnHref={dashboardHref}
            />
            {entryTransition}
        </>
    );

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
            const response = await fetch(`${mutationBasePath}/feedback-actions`, {
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
            const response = await fetch(`${mutationBasePath}/complete`, {
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

            if (
                response.ok
                && (
                    result?.status === "candidate_session_completed"
                    || result?.status === "invited_session_completed"
                )
            ) {
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

function resolveAvailableAnswerMode(
    persistedMode: CandidateProvisionalSessionProgress["answerMode"],
    voiceAnswerEnabled: boolean,
): "text" | "voice" {
    if (!voiceAnswerEnabled) return "text";
    return persistedMode === "text" ? "text" : "voice";
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
