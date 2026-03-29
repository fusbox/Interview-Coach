import React, { useState, useEffect, useRef } from 'react';
import { audioEngine } from '@/features/audio/audio-engine';
import { useSession } from '../context/SessionContext';
import { useSmartHints } from '../hooks/useSmartHints';
import { useStrongResponse } from '../hooks/useStrongResponse';
import { useSpeechToText } from '@/features/audio/hooks/useSpeechToText';
import { useAudioRecording } from "@/features/audio/hooks/useAudioRecording";
import { useTextToSpeech } from "@/features/audio/hooks/useTextToSpeech";
import { SessionHeader } from './SessionHeader';
import { SectionHeader } from '@/components/patterns/SectionHeader';
import { FeedbackDrawer } from './FeedbackDrawer';
import { MultiStepLoader } from './MultiStepLoader';
import AudioVisualizer from '@/features/audio/components/AudioVisualizer';
import { CoachLensDropdown } from './CoachLensDropdown';
import { Button } from '@/components/ui/button';
import {
    Mic,
    Keyboard,
    ArrowRight,
    Loader2,
    Lightbulb,
    Pause,
    Play,
    Sparkles,
    X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { motion, AnimatePresence } from 'framer-motion';
import { CategoryTooltip } from './CategoryTooltip';
import { EngagementDebugOverlay } from '@/components/debug/EngagementDebugOverlay';
import { TRANSITION_DURATION, AUDIO_BUFFER_MULTIPLIER } from '@/lib/constants';
import { AlertPanel } from '@/components/patterns/AlertPanel';
import { answerTextareaClassName } from '@/components/patterns/FormField';
import { SessionPromptShell } from '@/components/patterns/SessionPromptShell';
import { showDemoTools } from '@/lib/feature-flags';

export default function UnifiedSessionScreen() {
    const canShowDebugTools = showDemoTools();
    const {
        session,
        candidateToken,
        saveAnswer,
        nextQuestion,
        retryQuestion,
        trackEvent,
        totalEngagedSeconds,
        isEngagementWindowOpen,
        engagementDebugEvents,
        engagementWindowTimeRemaining,
        clearDebugEvents,
        flushEngagement,
        updateSession
    } = useSession();

    // Derived State from context
    const currentQuestionIndex = session?.currentQuestionIndex ?? 0;
    const isReviewing = session?.status === 'REVIEWING';
    const isThinking = session?.status === 'AWAITING_EVALUATION';
    const currentQuestionId = session?.questions[currentQuestionIndex]?.id;
    const analysis = currentQuestionId ? session?.answers[currentQuestionId]?.analysis : undefined;
    const hasSubmitted = currentQuestionId ? !!session?.answers[currentQuestionId]?.submittedAt : false;
    const currentQuestion = session?.questions[currentQuestionIndex];
    const currentQuestionText = currentQuestion?.text ?? '';

    // Input States
    const [mode, setMode] = useState<'voice' | 'text'>('voice');
    const [answerText, setAnswerText] = useState('');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [hintOpen, setHintOpen] = useState(false);
    const [strongResponseOpen, setStrongResponseOpen] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [liveMessage, setLiveMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Multistep Loader State
    const [showLoader, setShowLoader] = useState(false);

    // Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mobilePanelRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const coachLensControlsRef = useRef<HTMLDivElement>(null);
    const questionRegionRef = useRef<HTMLDivElement>(null);

    // Mobile Panel Auto-Scroll
    useEffect(() => {
        if (hintOpen || strongResponseOpen) {
            mobilePanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [hintOpen, strongResponseOpen]);

    useEffect(() => {
        if (!hintOpen && !strongResponseOpen) {
            return;
        }

        const handlePointerAway = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) {
                return;
            }

            if (dropdownRef.current?.contains(target)) {
                return;
            }

            if (mobilePanelRef.current?.contains(target)) {
                return;
            }

            if (coachLensControlsRef.current?.contains(target)) {
                return;
            }

            setHintOpen(false);
            setStrongResponseOpen(false);
        };

        document.addEventListener('mousedown', handlePointerAway);
        document.addEventListener('touchstart', handlePointerAway);

        return () => {
            document.removeEventListener('mousedown', handlePointerAway);
            document.removeEventListener('touchstart', handlePointerAway);
        };
    }, [hintOpen, strongResponseOpen]);

    // Hooks
    const resumeText = session?.candidate?.resumeText;
    const { hints, isLoading: isHintLoading, fetchHints } = useSmartHints(
        currentQuestion!,
        session?.id,
        candidateToken,
        session?.role || "Product Manager",
        undefined,
        resumeText
    );
    const { data: strongResponseData, isLoading: isStrongResponseLoading, fetchStrongResponse } = useStrongResponse(
        currentQuestionId!,
        currentQuestion?.text ?? "",
        session?.id,
        candidateToken,
        session?.role || "Product Manager",
        resumeText
    );
    const { transcript, startListening, stopListening, abortListening, error: speechError } = useSpeechToText();
    const {
        isRecording,
        isInitializing: isRecordingInitializing,
        startRecording,
        stopRecording,
        warmUp,
        resetAudio,
        mediaStream,
        audioBlob,
        permissionError,
        permissionMessage
    } = useAudioRecording();

    const {
        isPlaying,
        isLoading: isTTSLoading,
        speak,
        stop: stopSpeaking,
        prefetch
    } = useTextToSpeech();

    // Effects
    useEffect(() => {
        if (isThinking) {
            setShowLoader(true);
            setIsDrawerOpen(false);
            setLiveMessage('Answer submitted. Coach analysis is in progress.');
        }
    }, [isThinking]);

    useEffect(() => {
        // Recovery / Transition logic for Reviewing
        if (isReviewing && analysis) {
            // If we load into REVIEWING state with analysis, skip loader and open drawer
            setIsDrawerOpen(true);
            setShowLoader(false);
            setLiveMessage('Coach feedback is ready.');
        }
    }, [isReviewing, analysis]);


    // Reset Dropdown States on Question Change
    useEffect(() => {
        setHintOpen(false);
        setStrongResponseOpen(false);
    }, [currentQuestionId]);

    useEffect(() => {
        abortListening({ resetTranscript: true });
        setAnswerText('');
        setErrorMessage(null);
        if (currentQuestionText) {
            setLiveMessage(`Question ${currentQuestionIndex + 1} loaded.`);
            questionRegionRef.current?.focus();
        }
    }, [currentQuestionId, currentQuestionText, currentQuestionIndex, abortListening]);

    useEffect(() => {
        if (permissionError && permissionMessage) {
            setErrorMessage(permissionMessage);
            setLiveMessage(permissionMessage);
        }
    }, [permissionError, permissionMessage]);

    useEffect(() => {
        if (speechError) {
            setErrorMessage(speechError);
            setLiveMessage(speechError);
        }
    }, [speechError]);

    // Mic Warm-up Optimization
    useEffect(() => {
        if (mode === 'voice' && !isRecording && !hasSubmitted) {
            warmUp();
        }
        return () => {
            // Reset audio and speech-to-text when switching modes
            if (mode !== 'voice') {
                abortListening({ resetTranscript: true });
                resetAudio();
            }
        };
    }, [mode, isRecording, warmUp, hasSubmitted, resetAudio, abortListening]);

    // Auto-play question audio on entry
    useEffect(() => {
        if (!currentQuestionId || !currentQuestionText || hasSubmitted) return;

        // Mask latency: prefetch immediately in the background
        prefetch(currentQuestionId, currentQuestionText, { candidateToken, sessionId: session?.id });

        const isFirstEntry = currentQuestionIndex === 0;
        if (isFirstEntry) {
            const lagMs = TRANSITION_DURATION * AUDIO_BUFFER_MULTIPLIER * 1000;
            const timer = setTimeout(() => {
                speak(currentQuestionText, currentQuestionId, { candidateToken, sessionId: session?.id });
            }, lagMs);
            return () => clearTimeout(timer);
        } else {
            speak(currentQuestionText, currentQuestionId, { candidateToken, sessionId: session?.id });
        }
    }, [currentQuestionIndex, currentQuestionId, currentQuestionText, hasSubmitted, prefetch, speak, candidateToken, session?.id]);

    // Prefetch next question audio
    useEffect(() => {
        const questions = session?.questions || [];
        const nextIdx = currentQuestionIndex + 1;
        if (nextIdx < questions.length) {
            const nextQ = questions[nextIdx];
            prefetch(nextQ.id, nextQ.text, { candidateToken, sessionId: session?.id });
        }
    }, [currentQuestionIndex, session?.questions, prefetch, candidateToken, session?.id]);

    // Handlers
    const handleTogglePlayback = async () => {
        if (!currentQuestion) return;

        // Ensure AudioContext is unlocked on user gesture
        audioEngine.unlock();

        if (isPlaying) {
            stopSpeaking();
            trackEvent('tier2', 'playback_stop');
        } else {
            speak(currentQuestion.text, currentQuestion.id, { candidateToken, sessionId: session?.id });
            trackEvent('tier2', 'playback_start');
        }
    };

    const handleToggleRecording = async () => {
        // Prime the audio engine on user gesture
        audioEngine.unlock();

        if (isRecording) {
            await stopRecording();
            stopListening();
            trackEvent('tier2', 'mic_stop');
        } else {
            await startRecording();
            startListening();
            trackEvent('tier2', 'mic_start');
        }
    };

    const handleSubmit = async () => {
        const finalAnswer = mode === 'voice' ? transcript : answerText;
        const canSubmitAudio = mode === 'voice' && audioBlob;


        if (!finalAnswer.trim() && !canSubmitAudio) {
            trackEvent('tier2', 'submit_blocked_empty');
            const message = mode === 'voice'
                ? "We couldn't hear your response clearly. Please try speaking again or switch to text mode."
                : "Enter an answer before submitting.";
            setErrorMessage(message);
            setLiveMessage(message);
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);
        setLiveMessage('Submitting your answer.');
        trackEvent('tier3', 'answer_submit');

        try {
            if (currentQuestionId) {
                await saveAnswer(currentQuestionId, {
                    text: finalAnswer,
                    analysis: null,
                    transcript: mode === 'voice' ? finalAnswer : undefined,
                    audioBlob: mode === 'voice' ? (audioBlob || undefined) : undefined
                });
            }

            // Reset local state buffers
            if (mode === 'voice') {
                abortListening({ resetTranscript: true });
            } else {
                setAnswerText('');
            }
        } catch (err) {
            console.error("[UnifiedSessionScreen] Submission error:", err);
            const message = "There was an error submitting your answer. Please try again.";
            setErrorMessage(message);
            setLiveMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRetry = () => {
        setIsDrawerOpen(false);
        setAnswerText('');
        abortListening({ resetTranscript: true });
        resetAudio();
        setErrorMessage(null);
        setLiveMessage('Retrying the current question.');
        retryQuestion({ trigger: 'user' });
        trackEvent('tier2', 'session_retry_question');
    };

    const handleNext = () => {
        setIsDrawerOpen(false);
        setAnswerText('');
        abortListening({ resetTranscript: true });
        resetAudio();
        setErrorMessage(null);
        setLiveMessage('Moving to the next question.');
        nextQuestion();
    };

    const handleStop = async () => {
        if (window.confirm("Are you sure you want to stop? Your progress is saved.")) {
            trackEvent('tier2', 'session_stop_early');
            if (session?.id) {
                await updateSession(session.id, { status: 'PAUSED' });
            }
        }
    };

    const handleTextareaFocus = () => {
        setTimeout(() => {
            textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    if (!session || !currentQuestion) return null;

    // Derived State for Answer Review
    const answerData = session.answers[currentQuestion.id] || {};

    return (
        <div className="flex flex-col h-screen bg-background relative">
            <SessionHeader />
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {liveMessage}
            </div>
            <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
                {errorMessage || ''}
            </div>

            <main className="flex-1 w-full flex flex-row overflow-hidden relative">
                {/* LEFT: Main Workspace */}
                <div className="flex-1 flex flex-col items-center transition-all duration-700 ease-in-out overflow-y-auto custom-scrollbar">
                    <div className="w-full max-w-4xl flex flex-col">
                        {/* 1. TOP: Question Card Area */}
                        <div
                            ref={questionRegionRef}
                            className={cn(
                                "grow-0 shrink-0 p-4 md:p-6 lg:p-10 w-full transition-all duration-500 ease-in-out cursor-default",
                                isReviewing ? "opacity-30 scale-[0.98] pointer-events-none blur-sm" : "opacity-100 scale-100"
                            )}
                            tabIndex={-1}
                        >
                            <SessionPromptShell
                                footer={
                                    <div className="flex min-h-12 w-auto items-center gap-2 md:min-h-10 md:gap-4">
                                        <div ref={coachLensControlsRef} className="flex flex-1 justify-start gap-4">
                                            {!hasSubmitted && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        onClick={() => {
                                                            audioEngine.unlock();
                                                            if (hintOpen) {
                                                                setHintOpen(false);
                                                            } else {
                                                                setHintOpen(true);
                                                                setStrongResponseOpen(false);
                                                                trackEvent('tier2', 'view_hint');
                                                                if (!hints) fetchHints();
                                                            }
                                                        }}
                                                        density="compact"
                                                        shape="square"
                                                        label="strong"
                                                        className={cn(
                                                            "shrink-0 gap-2 border",
                                                            hintOpen
                                                                ? "border-brand-deep bg-brand-deep text-text-inverse shadow-lg hover:bg-brand-deep hover:text-text-inverse"
                                                                : "border-state-info/20 bg-state-info/10 text-state-info hover:bg-state-info/20"
                                                        )}
                                                        title="Interview Hints"
                                                    >
                                                        <Lightbulb size={18} /> <span className="hidden sm:inline">Hints</span>
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        onClick={() => {
                                                            audioEngine.unlock();
                                                            if (strongResponseOpen) {
                                                                setStrongResponseOpen(false);
                                                            } else {
                                                                setStrongResponseOpen(true);
                                                                setHintOpen(false);
                                                                trackEvent('tier2', 'view_example');
                                                                if (!strongResponseData) fetchStrongResponse();
                                                            }
                                                        }}
                                                        density="compact"
                                                        shape="square"
                                                        label="strong"
                                                        className={cn(
                                                            "shrink-0 gap-2 border",
                                                            strongResponseOpen
                                                                ? "border-accent-alt bg-accent-alt text-text-inverse shadow-lg hover:bg-accent-alt hover:text-text-inverse"
                                                                : "border-accent-alt/20 bg-accent-alt/10 text-accent-alt hover:bg-accent-alt/20"
                                                        )}
                                                        title="Example Response"
                                                    >
                                                        <Sparkles size={18} /> <span className="hidden sm:inline">Example</span>
                                                    </Button>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex flex-none items-center justify-center gap-2 md:gap-3">
                                            {!isReviewing && !hasSubmitted && (
                                                <div className="flex gap-1 rounded-full border border-border bg-surface-subtle/50 p-1 shadow-flat">
                                                    <Button
                                                        type="button"
                                                        onClick={() => {
                                                            audioEngine.unlock();
                                                            setMode('voice');
                                                            setAnswerText('');
                                                            trackEvent('tier2', 'mode_voice');
                                                        }}
                                                        density="compact"
                                                        shape="pill"
                                                        className={cn(
                                                            "px-3",
                                                            mode === 'voice'
                                                                ? "bg-brand-deep text-text-inverse shadow-md ring-1 ring-brand-deep hover:bg-brand-deep hover:text-text-inverse"
                                                                : "bg-surface-base text-state-info shadow-sm hover:bg-state-info hover:text-primary-foreground"
                                                        )}
                                                        title="Voice Mode"
                                                    >
                                                        <Mic size={18} />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        onClick={() => {
                                                            audioEngine.unlock();
                                                            setMode('text');
                                                            abortListening({ resetTranscript: true });
                                                            resetAudio();
                                                            trackEvent('tier2', 'mode_text');
                                                        }}
                                                        density="compact"
                                                        shape="pill"
                                                        className={cn(
                                                            "px-3",
                                                            mode === 'text'
                                                                ? "bg-brand-deep text-text-inverse shadow-md ring-1 ring-brand-deep hover:bg-brand-deep hover:text-text-inverse"
                                                                : "bg-surface-base text-state-info shadow-sm hover:bg-state-info hover:text-primary-foreground"
                                                        )}
                                                        title="Text Mode"
                                                    >
                                                        <Keyboard size={18} />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-1 justify-end">
                                            <Button
                                                type="button"
                                                onClick={handleTogglePlayback}
                                                disabled={isTTSLoading}
                                                size="icon"
                                                shape="pill"
                                                className={cn(
                                                    isPlaying
                                                        ? "bg-brand-deep text-text-inverse border-brand-deep scale-105 shadow-floating"
                                                        : "bg-surface-subtle/50 text-state-info border-border/50 hover:bg-surface-subtle/80 hover:scale-105"
                                                )}
                                                aria-label={isPlaying ? "Stop reading" : "Read question"}
                                            >
                                                {isPlaying ? (
                                                    <Pause size={18} className="animate-pulse" />
                                                ) : (
                                                    <Play size={18} />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                }
                            >
                                <div className="flex justify-start mb-6">
                                    <CategoryTooltip category={currentQuestion.category}>
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-deep text-micro font-bold uppercase tracking-wider text-text-inverse cursor-help transition-colors">
                                            {currentQuestion.category.toUpperCase()}
                                        </span>
                                    </CategoryTooltip>
                                </div>

                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentQuestion.id}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.5 }}
                                    >
                                        <SectionHeader
                                            title={<span className="tracking-normal">{currentQuestion.text}</span>}
                                            className="mb-10"
                                        />
                                    </motion.div>
                                </AnimatePresence>

                                {errorMessage && (
                                    <AlertPanel tone="critical" weight="semibold" className="mb-6 bg-state-critical/10" role="alert">
                                        {errorMessage}
                                    </AlertPanel>
                                )}
                            </SessionPromptShell>
                        </div>

                        {/* COACH'S LENS INLINE DROPDOWN (desktop only) */}
                        <AnimatePresence initial={false}>
                            {(hintOpen || strongResponseOpen) && (
                                <motion.div
                                    ref={dropdownRef}
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                                    className="hidden lg:block overflow-hidden px-4 md:px-6 lg:px-10 w-full"
                                >
                                    <div className="py-2">
                                        <AnimatePresence mode="wait" initial={false}>
                                            <motion.div
                                                key={hintOpen ? 'hints' : 'example'}
                                                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -8, scale: 0.985 }}
                                                transition={{ duration: 0.22, ease: 'easeOut' }}
                                            >
                                                <CoachLensDropdown
                                                    mode={hintOpen ? 'hints' : 'example'}
                                                    tips={hints}
                                                    strongResponse={strongResponseData}
                                                    isLoading={hintOpen ? isHintLoading : isStrongResponseLoading}
                                                />
                                            </motion.div>
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* 2. BOTTOM: Interaction Area */}
                        <div className={cn(
                            "flex-1 flex flex-col items-center p-4 md:p-6 lg:p-10 py-1 md:py-2 w-full min-h-0 relative",
                            mode === 'voice' ? "justify-start" : "justify-center"
                        )}>
                            {!isReviewing && !hasSubmitted && (
                                <div className={cn(
                                    "w-full flex flex-col items-center",
                                    mode === 'voice' ? "pt-2 md:pt-4" : "h-full justify-center"
                                )}>
                                    {mode === 'voice' ? (
                                        <div className="w-full flex flex-col items-center gap-8">
                                            {/* Voice Action Buttons shifted up */}
                                            <div className="flex flex-col items-center justify-center gap-6">
                                                <div className="relative flex justify-center items-center">
                                                    {(!audioBlob || isRecording) && (
                                                        <button
                                                            onClick={handleToggleRecording}
                                                            disabled={isRecordingInitializing}
                                                            className={cn(
                                                                "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl",
                                                                isRecording
                                                                    ? "bg-rose-50 text-rose-800 border-4 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-400/30"
                                                                    : "bg-brand-deep text-text-inverse hover:bg-brand-deep/90 hover:scale-105"
                                                            )}
                                                        >
                                                            {isRecordingInitializing ? (
                                                                <Loader2 className="animate-spin w-8 h-8" />
                                                            ) : (
                                                                <Mic size={32} className={cn(isRecording && "animate-pulse")} />
                                                            )}
                                                        </button>
                                                    )}

                                                    {!isRecording && audioBlob && (
                                                        <div className="flex gap-4 items-center animate-in fade-in zoom-in duration-300">
                                                            <Button
                                                                onClick={() => { abortListening({ resetTranscript: true }); resetAudio(); }}
                                                                emphasis="secondary"
                                                                density="hero"
                                                                shape="app"
                                                                label="strong"
                                                                className="h-14 px-8 text-base"
                                                            >
                                                                Retry
                                                            </Button>
                                                            <Button
                                                                onClick={handleSubmit}
                                                                disabled={isSubmitting}
                                                                emphasis="primary"
                                                                density="hero"
                                                                shape="app"
                                                                label="strong"
                                                                className="h-14 min-w-40 px-10 text-base shadow-lg"
                                                            >
                                                                {isSubmitting ? (
                                                                    <>
                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                        Submitting...
                                                                    </>
                                                                ) : "Submit Recording"}
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                <p className="text-sm font-semibold text-text-secondary tracking-wide">
                                                    {isRecording ? "Listening..." : audioBlob ? "Audio Captured" : "Tap to record; tap again to stop"}
                                                </p>
                                            </div>

                                            {/* Visualizer below buttons or overlapping */}
                                            <div className="h-48 w-full flex items-center justify-center">
                                                {isRecording && (
                                                    <AudioVisualizer
                                                        stream={mediaStream}
                                                        isRecording={isRecording}
                                                        className="w-full h-full"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <textarea
                                            ref={textareaRef}
                                            id="session-answer-text"
                                            name="sessionAnswer"
                                            className={answerTextareaClassName}
                                            placeholder="Type your answer here..."
                                            value={answerText}
                                            onChange={(e) => {
                                                setAnswerText(e.target.value);
                                                trackEvent('tier2', 'typing');
                                            }}
                                            onFocus={handleTextareaFocus}
                                            autoFocus
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer: Inside main column so it squeezes with sidebar */}
                        <footer className={cn(
                            "shrink-0 bg-surface-base/40 backdrop-blur-md border-t border-border",
                            mode === 'voice' && "hidden md:flex opacity-0 h-0 pointer-events-none" // Hide footer in voice mode unless it's for spacing
                        )}>
                            <div className="w-full px-4 md:px-6 lg:px-10 py-2 md:py-3 pb-4 md:pb-6">
                                {!isReviewing && !hasSubmitted && mode === 'text' && (
                                    <div className="flex justify-end">
                                        <Button
                                            onClick={handleSubmit}
                                            disabled={!answerText.trim()}
                                            emphasis="primary"
                                            density="hero"
                                            shape="app"
                                            label="strong"
                                            className="h-16 px-8 text-lg shadow-xl"
                                        >
                                            Submit Answer <ArrowRight className="ml-2 w-5 h-5" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </footer>
                    </div>
                </div>

                {/* Desktop side panel removed — Coach's Lens dropdown now renders inline after question card */}

                {/* Mobile Overlay */}
                <AnimatePresence>
                    {(hintOpen || strongResponseOpen) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="pointer-events-none lg:hidden fixed inset-0 z-[60] bg-background/20"
                        >
                            <motion.div
                                ref={mobilePanelRef}
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 30, stiffness: 250 }}
                                className="pointer-events-auto absolute bottom-0 left-0 right-0 glass-overlay border-t border-border flex flex-col max-h-[85dvh] rounded-t-3xl shadow-floating"
                            >
                                {/* Drag Indicator */}
                                <div className="w-12 h-1.5 bg-border rounded-full mx-auto my-3 shrink-0" />

                                {/* Fixed Header */}
                                <div className="px-6 pb-4 flex items-center justify-between shrink-0 border-b border-border">
                                    <span className="font-black text-sm uppercase tracking-[0.2em] text-text-muted">
                                        {hintOpen ? "Coach's Lens" : "Example Response"}
                                    </span>
                                    <Button
                                        type="button"
                                        onClick={() => { setHintOpen(false); setStrongResponseOpen(false); }}
                                        variant="ghost"
                                        size="icon"
                                        shape="pill"
                                        className="bg-surface-subtle text-text-secondary hover:bg-surface-raised"
                                    >
                                        <X size={18} />
                                    </Button>
                                </div>

                                {/* Scrollable Content */}
                                <div className="flex-1 overflow-y-auto p-6 pt-4 custom-scrollbar">
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.div
                                            key={hintOpen ? 'hints' : 'example'}
                                            initial={{ opacity: 0, y: 14, scale: 0.985 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.985 }}
                                            transition={{ duration: 0.22, ease: 'easeOut' }}
                                        >
                                            <CoachLensDropdown
                                                mode={hintOpen ? 'hints' : 'example'}
                                                tips={hints}
                                                strongResponse={strongResponseData}
                                                isLoading={hintOpen ? isHintLoading : isStrongResponseLoading}
                                            />
                                        </motion.div>
                                    </AnimatePresence>
                                    {/* Bottom padding for mobile browser bars */}
                                    <div className="h-8 shrink-0" />
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <MultiStepLoader
                loading={showLoader}
                duration={mode === 'voice' ? 2500 : 3000}
                onComplete={() => { }}
                loadingStates={
                    mode === 'voice'
                        ? [
                            { text: 'Taking a look...' },
                            { text: 'Reviewing answer content...' },
                            { text: 'Noting your speaking delivery...' },
                            { text: 'Creating feedback...' },
                        ]
                        : [
                            { text: 'Taking a look...' },
                            { text: 'Reviewing answer content...' },
                            { text: 'Creating feedback...' },
                        ]
                }
            />

            <FeedbackDrawer
                isOpen={isDrawerOpen}
                analysis={analysis}
                isThinking={isThinking}
                onNext={handleNext}
                onRetry={handleRetry}
                onStop={handleStop}
                isLastQuestion={currentQuestionIndex === (session?.questions.length ?? 0) - 1}
                transcript={answerData?.transcript || (mode === 'voice' ? transcript : answerText)}
                audioBlob={audioBlob}
            />

            {canShowDebugTools && (
                <>
                    <EngagementDebugOverlay
                        isVisible={showDebug}
                        onClose={() => setShowDebug(false)}
                        tracker={{
                            totalEngagedSeconds: totalEngagedSeconds,
                            isWindowOpen: isEngagementWindowOpen,
                            trackEvent,
                            flush: flushEngagement,
                            debugEvents: engagementDebugEvents,
                            windowTimeRemaining: engagementWindowTimeRemaining,
                            clearDebugEvents: clearDebugEvents
                        }}
                        aiContexts={{
                            tipsPrompt: hints?.__debugPrompt,
                            strongResponsePrompt: strongResponseData?.__debugPrompt,
                            analysisPrompt: analysis?.__debugPrompt
                        }}
                    />

                    <button
                        onClick={() => setShowDebug(true)}
                        className="fixed bottom-0 left-0 w-16 h-16 opacity-0 z-50 cursor-default"
                        aria-hidden="true"
                        title="Debug"
                    />
                </>
            )}
        </div>
    );
}
