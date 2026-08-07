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
    candidateQuestionPlanCategoryDetails,
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
import { CandidateBrandHeader } from "@/features/candidate-v2/CandidateBrandHeader";
import { CandidateThemeSwitcher } from "@/features/candidate-v2/CandidateThemeSwitcher";
import type { CandidateEngagementSessionSummary } from "@/features/candidate-engagement-v2/candidate-engagement-contract";
import {
    CandidateEngagementRuntime,
    type CandidateEngagementActions,
} from "@/features/candidate-engagement-v2/CandidateEngagementRuntime";
import {
    resolveCandidateFocusedUnansweredQuestionIndex,
    resolveCandidateNextUnansweredQuestionIndex,
} from "./candidate-session-question-resolution";

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
    engagementReportingEnabled?: boolean;
    engagementInspectorEnabled?: boolean;
    initialEngagementSummary?: CandidateEngagementSessionSummary | null;
    visitPace?: "setup" | "one";
    focusQuestionKey?: string;
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
    engagementReportingEnabled = false,
    engagementInspectorEnabled = false,
    initialEngagementSummary = null,
    visitPace = "setup",
    focusQuestionKey,
}: CandidatePlannedSessionExperienceProps) {
    const initialProgress = resolveRecoveredCandidateProgress(initialSession, focusQuestionKey);
    const [session, setSession] = useState<CandidateProvisionalSessionRecord | null>(initialSession);
    const [hasCheckedStorage, setHasCheckedStorage] = useState(Boolean(initialSession));
    const [progress, setProgress] = useState<CandidateProvisionalSessionProgress>({
        status: initialProgress.status,
        currentQuestionIndex: initialProgress.currentQuestionIndex,
        ...(initialProgress.answerMode ? { answerMode: initialProgress.answerMode } : {}),
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
    const [isPacedExitPending, setIsPacedExitPending] = useState(false);
    const [isPausingSession, setIsPausingSession] = useState(false);
    const [isSessionPaused, setIsSessionPaused] = useState(false);
    const [answerMode, setAnswerMode] = useState<"text" | "voice">(
        resolveAvailableAnswerMode(initialSession?.progress?.answerMode, voiceAnswerEnabled),
    );
    const [hasUnsafeVoiceWork, setHasUnsafeVoiceWork] = useState(false);
    const [isVoiceAnswerModeLocked, setIsVoiceAnswerModeLocked] = useState(false);
    const [isVoiceInteractionGated, setIsVoiceInteractionGated] = useState(false);
    const [isVoiceSubmitPreparing, setIsVoiceSubmitPreparing] = useState(false);
    const [isVoiceRecording, setIsVoiceRecording] = useState(false);
    const [entryTransitionPhase, setEntryTransitionPhase] = useState<"entering" | "releasing" | null>(
        entryTransitionRequested ? "entering" : null,
    );
    const loadedSessionIdRef = useRef<string | null>(initialSession ? sessionId : null);
    const routedEntryTransitionRef = useRef(entryTransitionRequested);
    const entryHoldTimerRef = useRef<number | null>(null);
    const entryReleaseTimerRef = useRef<number | null>(null);
    const entryFrameOneRef = useRef<number | null>(null);
    const entryFrameTwoRef = useRef<number | null>(null);
    const pacedExitClaimedRef = useRef(false);
    const pacedExitFrameOneRef = useRef<number | null>(null);
    const pacedExitFrameTwoRef = useRef<number | null>(null);
    const engagementActionsRef = useRef<CandidateEngagementActions | null>(null);
    const settledQuestionKeysThisVisitRef = useRef(new Set<string>());
    const engagementTracker = useMemo<CandidateEngagementActions>(() => ({
        trackEvent: (tier, activity) => engagementActionsRef.current?.trackEvent(tier, activity),
        flush: (reason) => engagementActionsRef.current?.flush(reason) ?? Promise.resolve(true),
    }), []);
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

        engagementTracker.trackEvent("tier2", "answer_mode");
        setAnswerMode(nextMode);
        updateProgress({
            ...progress,
            answerMode: nextMode,
        });
    }, [answerMode, engagementTracker, isVoiceAnswerModeLocked, progress, updateProgress]);

    useEffect(() => {
        if (loadedSessionIdRef.current === sessionId) {
            setHasCheckedStorage(true);
            window.scrollTo({ top: 0 });
            return;
        }

        loadedSessionIdRef.current = sessionId;

        if (initialSession) {
            const recoveredProgress = resolveRecoveredCandidateProgress(initialSession, focusQuestionKey);
            setSession(initialSession);
            setHasCheckedStorage(true);
            setProgress(recoveredProgress);
            settledQuestionKeysThisVisitRef.current = new Set();
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
        const recoveredProgress = resolveRecoveredCandidateProgress(storedSession, focusQuestionKey);
        setSession(storedSession);
        setHasCheckedStorage(true);
        setProgress(recoveredProgress);
        settledQuestionKeysThisVisitRef.current = new Set();
        setAnswerMode(resolveAvailableAnswerMode(storedSession?.progress?.answerMode, voiceAnswerEnabled));
        setAnswerDrafts(storedSession?.answerDrafts ?? {});
        setAnswerSubmissions(storedSession?.answerSubmissions ?? {});
        setAnswerAnalysisSnapshots(storedSession?.answerAnalysisSnapshots ?? {});
        setFeedbackActionEvents(storedSession?.feedbackActionEvents ?? {});
        const recoveredRetrySources = createRecoveredFeedbackRetrySources(storedSession);
        feedbackRetrySourcesRef.current = recoveredRetrySources;
        setFeedbackRetrySources(recoveredRetrySources);
        window.scrollTo({ top: 0 });
    }, [focusQuestionKey, initialSession, sessionId, voiceAnswerEnabled]);

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
        if (pacedExitFrameOneRef.current !== null) {
            window.cancelAnimationFrame(pacedExitFrameOneRef.current);
        }
        if (pacedExitFrameTwoRef.current !== null) {
            window.cancelAnimationFrame(pacedExitFrameTwoRef.current);
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
    const pacedExitTransition = isPacedExitPending ? (
        <CandidatePracticeEntryTransitionOverlay isReleasing={false} mode="dashboard" />
    ) : null;

    if (!hasCheckedStorage) {
        return (
            <>
                <CandidateBrandHeader actions={<CandidateThemeSwitcher />} frame="focused" />
                <main className="planned-session-page">
                    <section className="planned-session-card" aria-live="polite">
                        <p className="type-eyebrow">Practice session</p>
                        <h1>Loading your practice plan.</h1>
                    </section>
                </main>
            </>
        );
    }

    if (!session) {
        return (
            <>
                <CandidateBrandHeader actions={<CandidateThemeSwitcher />} frame="focused" />
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
            </>
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
        const isLastQuestion = resolveCandidateNextUnansweredQuestionIndex({
            questions: questionWordingPreview.questions,
            answerSubmissions,
            afterQuestionIndex: activeQuestionIndex,
        }) === null;
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
                question={{
                    number: activeQuestionIndex + 1,
                    count: runtimeFacts.questionCount,
                    categoryLabel: candidateQuestionPlanCategoryDetails[activeQuestion.category].label,
                    text: activeQuestion.questionText,
                }}
                answerText={activeSubmittedAnswerText}
                savedActionEvent={feedbackActionEvents[activeQuestion.slotId]}
                isCompletingSession={isCompletingSession}
                completionMessage={sessionCompletionMessage}
                onPersistAction={persistFeedbackAction}
                onAdvanceQuestion={() => {
                    engagementTracker.trackEvent("tier3", "question_advance");
                    void engagementTracker.flush("session_transition");
                    advanceAfterSettledQuestion(activeQuestionIndex);
                }}
                onFinishSession={finishSession}
                onRetryAnswer={(sourceAnswerAttemptId) => {
                    engagementTracker.trackEvent("tier3", "feedback_action");
                    void engagementTracker.flush("session_transition");
                    setSessionCompletionMessage(null);
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
            void engagementTracker.flush("page_exit");
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
                            onQuickSubmitTranscript={(draft) => {
                                engagementTracker.trackEvent("tier3", "answer_submit");
                                void engagementTracker.flush("session_transition");
                                return submitVoiceTranscript({
                                    draft,
                                    transcriptText: draft.transcriptText,
                                    retrySourceAnswerAttemptId: feedbackRetrySourcesRef.current[activeQuestion.slotId]
                                        ?? activeRetrySource,
                                });
                            }}
                            onReviewedSubmitTranscript={({ draft, transcriptText }) => {
                                engagementTracker.trackEvent("tier3", "answer_submit");
                                void engagementTracker.flush("session_transition");
                                return submitVoiceTranscript({
                                    draft,
                                    transcriptText,
                                    retrySourceAnswerAttemptId: feedbackRetrySourcesRef.current[activeQuestion.slotId]
                                        ?? activeRetrySource,
                                });
                            }}
                            onSwitchToText={() => handleAnswerModeChange("text")}
                            onUnsafeLocalWorkChange={setHasUnsafeVoiceWork}
                            onAnswerModeLockChange={setIsVoiceAnswerModeLocked}
                            onInteractionGateChange={setIsVoiceInteractionGated}
                            onSubmitProgressChange={setIsVoiceSubmitPreparing}
                            onRecordingChange={setIsVoiceRecording}
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
                        engagementTracker.trackEvent("tier3", "question_advance");
                        void engagementTracker.flush("session_transition");
                        advanceAfterSettledQuestion(activeQuestionIndex);
                    }}
                    continueWithoutCoachingLabel={isLastQuestion
                        ? "Finish without coaching"
                        : "Continue without coaching"}
                    isContinuingWithoutCoaching={isLastQuestion && isCompletingSession}
                    continueWithoutCoachingError={isLastQuestion ? sessionCompletionMessage : null}
                    onSubmit={() => {
                        engagementTracker.trackEvent("tier3", "answer_submit");
                        void engagementTracker.flush("session_transition");
                        void submitAnswerDraft({
                            slotId: activeQuestion.slotId,
                            questionIndex: activeQuestion.index,
                            text: activeTextDraft,
                            retrySourceAnswerAttemptId: feedbackRetrySourcesRef.current[activeQuestion.slotId]
                                ?? activeRetrySource,
                        });
                    }}
                />
                <CandidateEngagementRuntime
                    ref={engagementActionsRef}
                    enabled={engagementReportingEnabled && Boolean(initialSession)}
                    inspectorEnabled={engagementInspectorEnabled}
                    sessionId={sessionId}
                    endpoint={`${mutationBasePath}/engagement`}
                    initialSummary={initialEngagementSummary ?? undefined}
                    isContinuousActive={isVoiceRecording}
                />
                {entryTransition}
                {completionTransition}
                {pacedExitTransition}
            </>
        );
    }

    const landingQuestion = questionWordingPreview?.questions[progress.currentQuestionIndex]
        ?? questionWordingPreview?.questions[0];

    return (
        <>
            <CandidatePreSessionLanding
                variant="initial"
                targetRole={session.setupSnapshot.targetRole}
                stageLabel={stageLabel}
                questionCount={readCandidateSessionPaceSize(session)}
                planQuestionCount={questionPlan?.questionCount
                    ?? questionWordingPreview?.questions.length
                    ?? session.setupSnapshot.questionCount}
                resumeIncluded={Boolean(session.setupSnapshot.resumeText)}
                resumeLabel={session.setupSnapshot.resumeArtifact?.candidateLabel ?? null}
                sessionId={sessionId}
                questions={questionWordingPreview?.questions.map((question, index) => ({
                    id: question.slotId,
                    number: index + 1,
                    category: question.category,
                    questionText: question.questionText,
                }))}
                firstQuestion={landingQuestion ? {
                    id: landingQuestion.slotId,
                    number: landingQuestion.index + 1,
                    category: landingQuestion.category,
                    questionText: landingQuestion.questionText,
                } : undefined}
                questionAudio={questionAudio}
                manageTransitionExternally
                onStart={questionWordingPreview ? beginPracticeEntryTransition : undefined}
                returnHref={dashboardHref}
            />
            <CandidateEngagementRuntime
                ref={engagementActionsRef}
                enabled={engagementReportingEnabled && Boolean(initialSession)}
                inspectorEnabled={engagementInspectorEnabled}
                sessionId={sessionId}
                endpoint={`${mutationBasePath}/engagement`}
                initialSummary={initialEngagementSummary ?? undefined}
                isContinuousActive={isVoiceRecording}
            />
            {entryTransition}
        </>
    );

    function beginPracticeEntryTransition() {
        if (entryTransitionPhase) {
            return;
        }

        engagementTracker.trackEvent("tier3", "practice_start");
        void engagementTracker.flush("session_transition");
        setEntryTransitionPhase("entering");
        entryHoldTimerRef.current = window.setTimeout(() => {
            updateProgress({
                status: "live_question",
                currentQuestionIndex: progress.currentQuestionIndex,
            });
            releasePracticeEntryTransition();
        }, CANDIDATE_PRACTICE_ENTRY_HOLD_MS);
    }

    async function persistFeedbackAction(feedbackActionEvent: CandidateFeedbackActionEvent) {
        engagementTracker.trackEvent("tier3", "feedback_action");
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

    function advanceAfterSettledQuestion(currentQuestionIndex: number) {
        if (!questionWordingPreview) return;
        const settledQuestion = questionWordingPreview.questions.find(
            (question) => question.index === currentQuestionIndex,
        );
        if (settledQuestion) {
            settledQuestionKeysThisVisitRef.current.add(settledQuestion.slotId);
        }
        const nextQuestionIndex = resolveCandidateNextUnansweredQuestionIndex({
            questions: questionWordingPreview.questions,
            answerSubmissions,
            afterQuestionIndex: currentQuestionIndex,
        });
        if (nextQuestionIndex === null) {
            void finishSession();
            return;
        }

        const setupPace = readCandidateSessionPaceSize(session);
        const paceLimit = visitPace === "one" ? 1 : setupPace;
        if (settledQuestionKeysThisVisitRef.current.size >= paceLimit) {
            beginPacedExit();
            return;
        }

        updateProgress({
            status: "live_question",
            currentQuestionIndex: nextQuestionIndex,
        });
    }

    function beginPacedExit() {
        if (pacedExitClaimedRef.current) return;
        pacedExitClaimedRef.current = true;
        setIsPacedExitPending(true);
        void engagementTracker.flush("session_transition");
        pacedExitFrameOneRef.current = window.requestAnimationFrame(() => {
            pacedExitFrameTwoRef.current = window.requestAnimationFrame(() => {
                window.location.assign(dashboardHref);
            });
        });
    }

    async function finishSession() {
        if (isCompletingSession) {
            return;
        }

        setIsCompletingSession(true);
        setSessionCompletionMessage(null);
        engagementTracker.trackEvent("tier3", "session_finish");
        await engagementTracker.flush("session_transition");

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

function resolveRecoveredCandidateProgress(
    session: CandidateProvisionalSessionRecord | null | undefined,
    focusQuestionKey?: string,
): CandidateProvisionalSessionProgress {
    const persisted = session?.progress ?? {
        status: "planned" as const,
        currentQuestionIndex: 0,
    };
    if (!session || persisted.status === "completed") return persisted;

    const questions = session.questionWordingSnapshot?.questions
        ?? session.questionPlanSnapshot?.slots.map((slot) => ({ slotId: slot.id, index: slot.index }))
        ?? [];
    const currentQuestion = questions[persisted.currentQuestionIndex];
    const currentQuestionKey = currentQuestion?.slotId;
    const currentFeedbackEvent = currentQuestionKey
        ? session.feedbackActionEvents?.[currentQuestionKey]
        : null;
    const currentQuestionHasAnswer = Boolean(
        currentQuestionKey && session.answerSubmissions?.[currentQuestionKey],
    );
    const currentQuestionIsSettled = currentFeedbackEvent?.transition === "advance_to_next_question"
        || currentFeedbackEvent?.transition === "finish_session";
    if (currentQuestionHasAnswer && !currentQuestionIsSettled) return persisted;

    const resolvedQuestionIndex = resolveCandidateFocusedUnansweredQuestionIndex({
        questions,
        answerSubmissions: session.answerSubmissions ?? {},
        focusQuestionKey,
        fallbackQuestionIndex: persisted.currentQuestionIndex,
    });
    return {
        ...persisted,
        currentQuestionIndex: resolvedQuestionIndex ?? persisted.currentQuestionIndex,
    };
}

function readCandidateSessionPaceSize(session: CandidateProvisionalSessionRecord | null) {
    const paceSize = session?.setupSnapshot.paceSize;
    if (typeof paceSize === "number" && Number.isInteger(paceSize) && paceSize > 0) {
        return paceSize;
    }
    return Math.max(session?.setupSnapshot.questionCount ?? 1, 1);
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
