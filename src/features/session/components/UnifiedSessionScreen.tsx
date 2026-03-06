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
    Sparkles,
    X,
    Volume2,
    VolumeX
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { motion, AnimatePresence } from 'framer-motion';
import { CategoryTooltip } from './CategoryTooltip';
import { EngagementDebugOverlay } from '@/components/debug/EngagementDebugOverlay';

export default function UnifiedSessionScreen() {
    const {
        session,
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

    // Input States
    const [mode, setMode] = useState<'voice' | 'text'>('voice');
    const [answerText, setAnswerText] = useState('');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [hintOpen, setHintOpen] = useState(false);
    const [strongResponseOpen, setStrongResponseOpen] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Multistep Loader State
    const [showLoader, setShowLoader] = useState(false);

    // Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mobilePanelRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Mobile Panel Auto-Scroll
    useEffect(() => {
        if (hintOpen || strongResponseOpen) {
            mobilePanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [hintOpen, strongResponseOpen]);

    // Hooks
    const resumeText = session?.candidate?.resumeText;
    const { hints, isLoading: isHintLoading, fetchHints } = useSmartHints(
        currentQuestion!,
        session?.role || "Product Manager",
        undefined,
        resumeText
    );
    const { data: strongResponseData, isLoading: isStrongResponseLoading, fetchStrongResponse } = useStrongResponse(
        currentQuestionId!,
        currentQuestion?.text ?? "",
        session?.role || "Product Manager",
        resumeText
    );
    const { transcript, resetTranscript, startListening, stopListening } = useSpeechToText();
    const {
        isRecording,
        isInitializing: isRecordingInitializing,
        startRecording,
        stopRecording,
        warmUp,
        resetAudio,
        mediaStream,
        audioBlob
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
        }
    }, [isThinking]);

    useEffect(() => {
        // Recovery / Transition logic for Reviewing
        if (isReviewing && analysis) {
            // If we load into REVIEWING state with analysis, skip loader and open drawer
            setIsDrawerOpen(true);
            setShowLoader(false);
        }
    }, [isReviewing, analysis]);

    // Reset Dropdown States on Question Change
    useEffect(() => {
        setHintOpen(false);
        setStrongResponseOpen(false);
    }, [currentQuestionId]);

    // Mic Warm-up Optimization
    useEffect(() => {
        if (mode === 'voice' && !isRecording && !hasSubmitted) {
            warmUp();
        }
        return () => {
            // Cleanup on mode switch or unmount if not recording
            if (mode !== 'voice' || hasSubmitted) {
                stopListening();
                resetAudio();
            }
        };
    }, [mode, isRecording, warmUp, hasSubmitted, resetAudio, stopListening]);

    // Auto-play question audio on entry
    useEffect(() => {
        if (currentQuestion && !hasSubmitted) {
            speak(currentQuestion.text, currentQuestion.id);
        }
        // Prefetch next question audio
        if (session?.questions) {
            const nextIdx = currentQuestionIndex + 1;
            if (nextIdx < session.questions.length) {
                const nextQ = session.questions[nextIdx];
                prefetch(nextQ.id, nextQ.text);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentQuestionIndex, currentQuestion?.id]);

    // Handlers
    const handleTogglePlayback = async () => {
        if (!currentQuestion) return;

        // Ensure AudioContext is unlocked on user gesture
        audioEngine.unlock();

        if (isPlaying) {
            stopSpeaking();
            trackEvent('tier2', 'playback_stop');
        } else {
            speak(currentQuestion.text, currentQuestion.id);
            trackEvent('tier2', 'playback_start');
        }
    };

    const handleToggleRecording = async () => {
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

        // Detailed logging for production debugging via console
        console.log("[UnifiedSessionScreen] handleSubmit triggered", {
            mode,
            hasTranscript: !!transcript.trim(),
            hasAudio: !!audioBlob,
            currentQuestionId
        });

        if (!finalAnswer.trim() && !canSubmitAudio) {
            trackEvent('tier2', 'submit_blocked_empty');
            // Show a simple alert if in voice mode and transcript is missing
            if (mode === 'voice') {
                alert("We couldn't hear your response clearly. Please try speaking again or use Text Mode.");
            }
            return;
        }

        setIsSubmitting(true);
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

            // Cleanup local states
            if (mode === 'voice') {
                stopListening();
                resetTranscript();
            } else {
                setAnswerText('');
            }
        } catch (err) {
            console.error("[UnifiedSessionScreen] Submission error:", err);
            alert("There was an error submitting your answer. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRetry = () => {
        setIsDrawerOpen(false);
        setAnswerText('');
        resetTranscript();
        resetAudio();
        retryQuestion({ trigger: 'user' });
        trackEvent('tier2', 'session_retry_question');
    };

    const handleNext = () => {
        setIsDrawerOpen(false);
        setAnswerText('');
        resetTranscript();
        resetAudio();
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

            <main className="flex-1 w-full flex flex-row overflow-hidden relative">
                {/* LEFT: Main Workspace */}
                <div className="flex-1 flex flex-col items-center transition-all duration-700 ease-in-out overflow-y-auto custom-scrollbar">
                    <div className="w-full max-w-4xl flex flex-col">
                        {/* 1. TOP: Question Card Area */}
                        <div
                            className={cn(
                                "grow-0 shrink-0 p-4 md:p-6 lg:p-10 w-full transition-all duration-500 ease-in-out cursor-default",
                                isReviewing ? "opacity-30 scale-[0.98] pointer-events-none blur-sm" : "opacity-100 scale-100"
                            )}>
                            <div className="glass-card text-text-primary rounded-3xl p-6 md:p-10 w-full relative transition-all duration-300 ring-1 ring-border/50 bg-gradient-to-br from-brand-glass-start to-brand-glass-end overflow-hidden">
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-200 to-blue-600" />

                                <div className="flex justify-start mb-6">
                                    <CategoryTooltip category={currentQuestion.category}>
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-deep text-micro font-bold uppercase tracking-wider text-white cursor-help transition-colors">
                                            {currentQuestion.category.toUpperCase()}
                                        </span>
                                    </CategoryTooltip>
                                </div>

                                <SectionHeader
                                    title={currentQuestion.text}
                                    className="mb-10"
                                />

                                <div className="flex items-center gap-2 md:gap-4 min-h-12 md:min-h-10 w-auto pt-4 md:pt-6 pb-4 md:pb-10 -mx-6 md:-mx-10 -mb-6 md:-mb-10 px-6 md:px-10 border-t-2 border-border/50 bg-surface-platinum/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
                                    <div className="flex-1 flex justify-start gap-4">
                                        {!hasSubmitted && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        if (hintOpen) {
                                                            setHintOpen(false);
                                                        } else {
                                                            setHintOpen(true);
                                                            setStrongResponseOpen(false);
                                                            trackEvent('tier2', 'view_hint');
                                                            if (!hints) fetchHints();
                                                        }
                                                    }}
                                                    className={cn(
                                                        "inline-flex items-center justify-center gap-2 px-3 md:px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0",
                                                        hintOpen
                                                            ? "bg-blue-600 text-white shadow-lg"
                                                            : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                                                    )}
                                                    title="Interview Hints"
                                                >
                                                    <Lightbulb size={18} /> <span className="hidden sm:inline">Hints</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (strongResponseOpen) {
                                                            setStrongResponseOpen(false);
                                                        } else {
                                                            setStrongResponseOpen(true);
                                                            setHintOpen(false);
                                                            trackEvent('tier2', 'view_example');
                                                            if (!strongResponseData) fetchStrongResponse();
                                                        }
                                                    }}
                                                    className={cn(
                                                        "inline-flex items-center justify-center gap-2 px-3 md:px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0",
                                                        strongResponseOpen
                                                            ? "bg-purple-600 text-white shadow-lg"
                                                            : "bg-purple-50 dark:bg-purple-900/20 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                                                    )}
                                                    title="Example Response"
                                                >
                                                    <Sparkles size={18} /> <span className="hidden sm:inline">Example</span>
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex-none flex justify-center items-center gap-2 md:gap-3">
                                        {!isReviewing && !hasSubmitted && (
                                            <div className="bg-blue-50/50 p-1 rounded-full flex gap-1 shadow-md border border-border">
                                                <button
                                                    onClick={() => {
                                                        setMode('voice');
                                                        setAnswerText('');
                                                        trackEvent('tier2', 'mode_voice');
                                                    }}
                                                    className={cn(
                                                        "p-2 px-3 rounded-full transition-all flex items-center justify-center gap-2",
                                                        mode === 'voice'
                                                            ? "bg-blue-600 text-white shadow-md ring-1 ring-blue-600 border-none outline-none"
                                                            : "text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200"
                                                    )}
                                                    title="Voice Mode"
                                                >
                                                    <Mic size={18} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setMode('text');
                                                        stopListening();
                                                        resetTranscript();
                                                        resetAudio();
                                                        trackEvent('tier2', 'mode_text');
                                                    }}
                                                    className={cn(
                                                        "p-2 px-3 rounded-full transition-all flex items-center justify-center gap-2",
                                                        mode === 'text'
                                                            ? "bg-blue-600 text-white shadow-md ring-1 ring-blue-600 border-none outline-none"
                                                            : "text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200"
                                                    )}
                                                    title="Text Mode"
                                                >
                                                    <Keyboard size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 flex justify-end">
                                        <button
                                            onClick={handleTogglePlayback}
                                            disabled={isTTSLoading}
                                            className={cn(
                                                "p-2.5 rounded-full transition-all duration-300 shadow-sm border flex items-center justify-center",
                                                isPlaying
                                                    ? "bg-blue-600 text-white border-blue-600 scale-105 shadow-blue-500/20"
                                                    : "bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 border-blue-100/50 dark:border-blue-800/50 hover:bg-blue-100/80 hover:scale-105"
                                            )}
                                            aria-label={isPlaying ? "Stop reading" : "Read question"}
                                        >
                                            {isPlaying ? (
                                                <VolumeX size={18} className="animate-pulse" />
                                            ) : (
                                                <Volume2 size={18} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
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
                                        <CoachLensDropdown
                                            mode={hintOpen ? 'hints' : 'example'}
                                            tips={hints}
                                            strongResponse={strongResponseData}
                                            isLoading={hintOpen ? isHintLoading : isStrongResponseLoading}
                                        />
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
                                                                    ? "bg-red-50 dark:bg-red-900/20 text-red-500 border-4 border-red-100 dark:border-red-900/40"
                                                                    : "bg-blue-600 text-white hover:bg-blue-700 hover:scale-105"
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
                                                                onClick={() => { resetTranscript(); resetAudio(); }}
                                                                variant="outline"
                                                                className="px-8 h-14 rounded-2xl bg-surface-base border-border text-text-secondary hover:bg-surface-subtle"
                                                            >
                                                                Retry
                                                            </Button>
                                                            <Button
                                                                onClick={handleSubmit}
                                                                disabled={isSubmitting}
                                                                className="px-10 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg font-bold min-w-40"
                                                            >
                                                                {isSubmitting ? (
                                                                    <>
                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                        Submitting...
                                                                    </>
                                                                ) : (
                                                                    transcript ? "Submit Answer" : "Submit Recording"
                                                                )}
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Transcript Preview */}
                                                {(transcript || isRecording) && (
                                                    <div className="w-full max-w-2xl px-6 py-4 bg-surface-subtle rounded-2xl border border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                        <p className={cn(
                                                            "text-base md:text-lg leading-relaxed text-center italic",
                                                            isRecording ? "text-text-primary" : "text-text-primary font-medium"
                                                        )}>
                                                            {transcript ? `"${transcript}"` : isRecording ? "Start speaking..." : ""}
                                                        </p>
                                                    </div>
                                                )}

                                                <p className="text-sm font-semibold text-text-secondary tracking-wide">
                                                    {isRecording ? "Listening..." : transcript ? "Ready to submit" : audioBlob ? "Audio Captured" : "Tap to Speak"}
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
                                            className="flex-1 w-full bg-surface-base/50 border border-border rounded-3xl p-6 md:p-10 resize-none outline-none text-lg md:text-xl text-text-primary placeholder:text-text-muted font-medium shadow-sm min-h-72 backdrop-blur-sm focus:ring-2 focus:ring-ring transition-all"
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
                                            className="px-8 h-16 text-lg bg-blue-600 hover:bg-blue-700 shadow-xl rounded-2xl font-bold"
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
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 250 }}
                            className="lg:hidden fixed bottom-0 left-0 right-0 glass-overlay border-t border-border z-[60] flex flex-col max-h-[85dvh] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)]"
                        >
                            {/* Drag Indicator */}
                            <div className="w-12 h-1.5 bg-border rounded-full mx-auto my-3 shrink-0" />

                            {/* Fixed Header */}
                            <div className="px-6 pb-4 flex items-center justify-between shrink-0 border-b border-border">
                                <span className="font-black text-sm uppercase tracking-[0.2em] text-text-muted">
                                    {hintOpen ? "Coach's Lens" : "Example Response"}
                                </span>
                                <button
                                    onClick={() => { setHintOpen(false); setStrongResponseOpen(false); }}
                                    className="p-2 bg-surface-subtle rounded-full text-text-secondary hover:bg-surface-raised transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div
                                ref={mobilePanelRef}
                                className="flex-1 overflow-y-auto p-6 pt-4 custom-scrollbar"
                            >
                                <CoachLensDropdown
                                    mode={hintOpen ? 'hints' : 'example'}
                                    tips={hints}
                                    strongResponse={strongResponseData}
                                    isLoading={hintOpen ? isHintLoading : isStrongResponseLoading}
                                />
                                {/* Bottom padding for mobile browser bars */}
                                <div className="h-8 shrink-0" />
                            </div>
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
                            { text: 'Coach is analyzing your answer...' },
                            { text: 'Generating feedback...' },
                            { text: 'Noting your speaking delivery...' },
                            { text: 'Finalizing review...' },
                        ]
                        : [
                            { text: 'Coach is analyzing your answer...' },
                            { text: 'Generating feedback...' },
                            { text: 'Finalizing review...' },
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
                audioBlob={answerData?.transcript ? audioBlob : null}
            />

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
        </div>
    );
}
