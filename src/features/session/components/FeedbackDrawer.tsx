'use client';

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AnalysisResult } from '@/lib/domain/types';
import { audioEngine } from '@/features/audio/audio-engine';
import {
    Mic2,
    Keyboard,
    Play,
    Pause,
    RotateCcw,
    Target,
    FileText,
    X,
    ArrowRight
} from 'lucide-react';
import { FeedbackPill } from '@/components/patterns/FeedbackPill';
import { cn } from '@/lib/cn';
import { captureFeedbackAction } from '@/app/actions/feedback';
import { SectionHeader } from '@/components/patterns/SectionHeader';
import { AlertPanel } from '@/components/patterns/AlertPanel';
import { FeedbackChoiceButton } from '@/components/patterns/FeedbackChoiceButton';
import { useAccessibleDialog } from '@/lib/hooks/use-accessible-dialog';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface FeedbackOverlayProps {
    isOpen: boolean;
    analysis?: AnalysisResult;
    isThinking?: boolean;
    onNext: () => void;
    onRetry: () => void;
    onStop?: () => void;
    isLastQuestion?: boolean;
    transcript?: string;
    audioBlob?: Blob | null;
    sessionId?: string;
}

type SectionKey = 'start' | 'delivery' | 'content' | 'next';

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

const TranscriptPanel: React.FC<{
    transcript?: string;
    audioBlob?: Blob | null;
    isPlaying: boolean;
    togglePlayback: () => void;
    onClose?: () => void;
    showClose?: boolean;
    highlightQuote?: string;
}> = ({ transcript, audioBlob, isPlaying, togglePlayback, onClose, showClose, highlightQuote }) => {

    const renderTranscript = () => {
        if (!transcript) return 'No transcript available.';
        if (!highlightQuote) return transcript;

        // Exact case-insensitive match for the quote fragment
        const index = transcript.toLowerCase().indexOf(highlightQuote.toLowerCase());
        if (index === -1) return transcript;

        const textBefore = transcript.substring(0, index);
        const matchText = transcript.substring(index, index + highlightQuote.length);
        const textAfter = transcript.substring(index + highlightQuote.length);

        return (
            <>
                {textBefore}
                <mark className="bg-primary/10 text-primary dark:text-primary-foreground rounded px-1 -mx-1 transition-colors border border-primary/10 dark:border-primary/20">
                    {matchText}
                </mark>
                {textAfter}
            </>
        );
    };

    return (
        <div className="flex flex-col h-full min-h-0 gap-4">
            <div className="flex items-center justify-between px-1 shrink-0 h-8">
                <h4 className="text-micro font-black text-text-muted uppercase tracking-widest leading-none">
                    Your Answer
                </h4>
                <div className="flex items-center gap-2">
                    {audioBlob && (
                        <button
                            type="button"
                            onClick={togglePlayback}
                            className={cn(
                                'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-xs font-black uppercase',
                                isPlaying
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                            )}
                        >
                            {isPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                            <span>{isPlaying ? 'Pause' : 'Listen'}</span>
                        </button>
                    )}
                    {showClose && onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-surface-subtle flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                            aria-label="Close transcript"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 relative bg-transparent p-6 overflow-y-auto custom-scrollbar min-h-0">
                <p className="text-text-secondary text-base leading-relaxed font-medium whitespace-pre-wrap">
                    {renderTranscript()}
                </p>
            </div>
        </div>
    );
};

const HelpfulRating: React.FC<{
    onSelect: (val: string) => void;
    currentVal: string | null;
    showSaved?: boolean;
}> = ({ onSelect, currentVal, showSaved }) => {
    const options = [
        { label: 'Yes', icon: '👍', val: 'yes' },
        { label: 'Somewhat', icon: '🤔', val: 'somewhat' },
        { label: 'Not really', icon: '👎', val: 'no' },
    ];

    return (
        <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 relative">
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest leading-none">
                    Was this helpful?
                </span>
            </div>
            <div className="flex items-center gap-2">
                {options.map((opt) => (
                    <div key={opt.val} className="relative">
                        <FeedbackChoiceButton
                            onClick={() => onSelect(opt.val)}
                            aria-pressed={currentVal === opt.val}
                            kind="compact"
                            tone="primary"
                            selected={currentVal === opt.val}
                        >
                            <span>{opt.icon}</span>
                            <span>{opt.label}</span>
                        </FeedbackChoiceButton>
                        <FeedbackPill isVisible={!!showSaved && currentVal === opt.val} text="" />
                    </div>
                ))}
            </div>
        </div>
    );
};

const FeedbackNavButtons: React.FC<{
    onPrimary: () => void;
    onSkip: () => void;
    primaryLabel?: string;
    skipLabel: string;
}> = ({ onPrimary, onSkip, primaryLabel = "Next", skipLabel }) => {
    return (
        <div className="mt-10 flex flex-col md:flex-row items-center gap-4 w-full">
            <Button
                type="button"
                onClick={onPrimary}
                emphasis="primary"
                density="hero"
                shape="app"
                label="strong"
                className="w-full md:w-auto"
            >
                {primaryLabel}
            </Button>
            <Button
                type="button"
                onClick={onSkip}
                variant="ghost"
                density="hero"
                shape="app"
                label="strong"
                className="w-full md:w-auto bg-transparent text-text-muted shadow-none hover:bg-transparent hover:text-text-primary"
            >
                {skipLabel}
            </Button>
        </div>
    );
};

const ProgressDots: React.FC<{
    sections: { id: SectionKey; label: string }[];
    activeSection: SectionKey;
    onDotClick: (id: SectionKey) => void;
}> = ({ sections, activeSection, onDotClick }) => {
    return (
        <div className="hidden md:flex absolute left-6 md:left-8 top-1/2 -translate-y-1/2 z-40 flex-col gap-4">
            {sections.map((s) => (
                <button
                    type="button"
                    key={s.id}
                    onClick={() => onDotClick(s.id)}
                    className="group relative flex items-center h-4"
                    aria-label={`Go to ${s.label}`}
                >
                    <motion.div
                        animate={{
                            scale: activeSection === s.id ? 1.5 : 1,
                        }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className={cn(
                            "w-2 h-2 rounded-full transition-colors duration-300 ring-0 group-hover:ring-1 ring-primary/20",
                            activeSection === s.id
                                ? "bg-primary"
                                : "bg-primary/30 border border-primary/10"
                        )}
                    />
                    <div className="absolute left-6 rounded border border-border/50 bg-surface-base px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-text-primary opacity-0 shadow-floating transition-opacity pointer-events-none whitespace-nowrap group-hover:opacity-100">
                        {s.label}
                    </div>
                </button>
            ))}
        </div>
    );
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export const FeedbackDrawer: React.FC<FeedbackOverlayProps> = ({
    isOpen,
    analysis,
    onNext,
    onRetry,
    isLastQuestion,
    transcript,
    audioBlob,
    sessionId,
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<SectionKey>('start');
    const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
    const [, setHasExplored] = useState(false);
    const [hasScrolled, setHasScrolled] = useState(false);
    const isProgrammaticScroll = useRef(false);
    const [helpfulness, setHelpfulness] = useState<Record<string, string>>({});
    const [savedTypes, setSavedTypes] = useState<Record<string, boolean>>({});
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const drawerRef = useRef<HTMLDivElement>(null);
    const transcriptPanelRef = useRef<HTMLDivElement>(null);
    const transcriptCloseButtonRef = useRef<HTMLButtonElement>(null);
    const dialogTitleId = useId();
    const dialogDescriptionId = useId();
    const transcriptTitleId = useId();

    const sections: { id: SectionKey; label: string }[] = [
        { id: 'start', label: 'Summary' },
        ...(analysis?.deliveryPulse ? [{ id: 'delivery' as SectionKey, label: 'Delivery' }] : []),
        ...(analysis?.contentPulse ? [{ id: 'content' as SectionKey, label: 'Content' }] : []),
        { id: 'next', label: 'Next' }
    ];

    // ── Audio playback ──────────────────────────────────────────────────────

    const togglePlayback = useCallback(() => {
        // Prime the audio engine on user gesture
        audioEngine.unlock();

        if (!audioBlob) {
            return;
        }

        if (!audioRef.current) {
            try {
                const url = URL.createObjectURL(audioBlob);
                audioRef.current = new Audio(url);
                audioRef.current.onended = () => {
                    setIsPlaying(false);
                };
                audioRef.current.onerror = () => {
                    setErrorMessage("We couldn't play back your recorded answer.");
                    setIsPlaying(false);
                };
            } catch (err) {
                console.error("[Audio] Failed to create Audio object:", err);
                setErrorMessage("We couldn't prepare your recorded answer for playback.");
                return;
            }
        }

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play()
                .then(() => {
                    setErrorMessage(null);
                    setIsPlaying(true);
                })
                .catch(err => {
                    console.error("[Audio] Playback failed:", err);
                    setErrorMessage("We couldn't play back your recorded answer.");
                    setIsPlaying(false);
                });
        }
    }, [audioBlob, isPlaying]);

    const handleHelpfulnessSelect = async (type: 'delivery' | 'content', val: string) => {
        // Prime the audio engine on user gesture
        audioEngine.unlock();
        setHelpfulness(prev => ({ ...prev, [type]: val }));
        setSavedTypes(prev => ({ ...prev, [type]: false }));
        setErrorMessage(null);
        try {
            await captureFeedbackAction({
                sessionId,
                type: `helpfulness_${type}`,
                comment: val, // yes, somewhat, no
                metadata: {
                    dimension: type === 'delivery' ? analysis?.deliveryPulse?.dimension : analysis?.contentPulse?.dimension,
                    headline: type === 'delivery' ? analysis?.deliveryPulse?.headline : analysis?.contentPulse?.headline
                }
            });
            setSavedTypes(prev => ({ ...prev, [type]: true }));
            setTimeout(() => {
                setSavedTypes(prev => ({ ...prev, [type]: false }));
            }, 2000);
        } catch (err) {
            console.error('Failed to capture helpfulness', err);
            setErrorMessage("We couldn't save that feedback right now. Please try again.");
        }
    };

    useAccessibleDialog({
        isOpen,
        containerRef: drawerRef,
    });

    useAccessibleDialog({
        isOpen: isTranscriptOpen,
        containerRef: transcriptPanelRef,
        initialFocusRef: transcriptCloseButtonRef,
        onClose: () => setIsTranscriptOpen(false),
    });

    // Reset on close; cleanup on unmount
    useEffect(() => {
        if (!isOpen) {
            setActiveSection('start');
            setIsTranscriptOpen(false);
            setHelpfulness({});
            setErrorMessage(null);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
                setIsPlaying(false);
            }
            // Scroll snap container back to top
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0;
            }
            setHasExplored(false);
            setHasScrolled(false);
            isProgrammaticScroll.current = false;
        }
    }, [isOpen]);

    useEffect(() => {
        if (!audioBlob && audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
            setIsPlaying(false);
        }
    }, [audioBlob]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    // ── Variant helpers removed (delegated to pulse architecture) ──────────

    // CTA logic: The AI explicitly recommends the next action.
    const shouldRetry = analysis?.nextAction?.actionType === 'redo_answer';

    // ── Intersection Observer for sidebar ───────────────────────────────────

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        if (typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Find the section that covers the center of the viewport
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

                if (visible.length === 0) return;
                const topCard = visible[0].target as HTMLElement;
                const section = topCard.dataset.section as SectionKey;
                if (section) setActiveSection(section);
            },
            {
                root: container,
                threshold: [0, 0.25, 0.5, 0.75, 1],
                rootMargin: '-40% 0px -40% 0px',
            }
        );

        cardRefs.current.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [isOpen]);

    // ── Sidebar scroll-to ───────────────────────────────────────────────────

    const scrollToSection = (section: SectionKey) => {
        const sectionFirstCardKey = section; // Simple mapping now
        const el = cardRefs.current.get(sectionFirstCardKey);
        isProgrammaticScroll.current = true;
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Reset the flag after the smooth scroll finishes (roughly)
        setTimeout(() => { isProgrammaticScroll.current = false; }, 1000);
    };

    // Styles removed ─────────────────────────────────────────────────────

    // ── Register card ref ───────────────────────────────────────────────────

    const setCardRef = (key: string) => (el: HTMLDivElement | null) => {
        if (el) cardRefs.current.set(key, el);
        else cardRefs.current.delete(key);
    };

    // ── Shared card wrapper ─────────────────────────────────────────────────

    const isElevatedMode = activeSection === 'start' || activeSection === 'next';

    const getCardClasses = (sectionKey: SectionKey) => {
        const isElevated = sectionKey === 'start' || sectionKey === 'next';
        return cn(
            'scroll-snap-align-start flex h-full min-h-0 w-full flex-shrink-0 flex-col justify-start px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] md:h-full md:px-0 md:pb-8 md:pl-20 md:pr-14',
            isElevated ? 'pt-8 md:pt-14' : 'pt-20 md:pt-12'
        );
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
                {/* Backdrop */}
                <motion.div
                    key="backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-surface-overlay/40 backdrop-blur-md"
                />

                {/* Modal shell */}
                <motion.div
                    key="modal"
                    ref={drawerRef}
                    initial={{ opacity: 0, scale: 0.97, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 16 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className={cn(
                        "relative w-full max-w-4xl md:min-w-[45rem] h-[100dvh] md:h-[40rem] rounded-none md:rounded-3xl border-0 md:border border-border flex overflow-hidden transition-all duration-300",
                        isElevatedMode
                            ? "bg-gradient-to-br from-brand-glass-start to-brand-glass-end md:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.12)]"
                            : "bg-surface-base md:shadow-lg"
                    )}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={dialogTitleId}
                    aria-describedby={dialogDescriptionId}
                    tabIndex={-1}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape' && isTranscriptOpen) {
                            setIsTranscriptOpen(false);
                        }
                    }}
                >
                    <div id={dialogDescriptionId} className="sr-only">
                        Review your coach feedback, then choose an action to continue. This step remains open until you continue, retry, or finish the session.
                    </div>
                    {errorMessage && (
                        <AlertPanel tone="critical" className="absolute top-4 left-4 right-4 z-50 md:left-8 md:right-8">
                            {errorMessage}
                        </AlertPanel>
                    )}
                    {/* ── Main Layout (Vertical Split: Header + Content) ─────────────────── */}
                    <div className="relative flex flex-1 min-h-0 min-w-0 flex-col bg-transparent">
                        {/* Progress Nav */}
                        <ProgressDots
                            sections={sections}
                            activeSection={activeSection}
                            onDotClick={scrollToSection}
                        />

                        {/* ── Scroll-Snap Cards ───────────────────────────────────────── */}
                        <div
                            ref={scrollContainerRef}
                            onScroll={() => {
                                if (!isProgrammaticScroll.current && !hasScrolled) {
                                    setHasScrolled(true);
                                }
                            }}
                            className={cn('flex-1 min-h-0 min-w-0 overflow-hidden overscroll-none scroll-snap-y-mandatory custom-scrollbar bg-transparent')}
                            style={{ scrollSnapType: 'y mandatory' }}
                        >
                            {/* Card 0: Start / Ack */}
                            <div
                                ref={setCardRef('start')}
                                data-section="start"
                                className={cn(getCardClasses('start'), 'items-center justify-center text-center max-w-4xl mx-auto relative overflow-y-auto overscroll-y-contain')}
                                style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                            >
                                <div className="w-full flex flex-col items-center my-auto py-8">
                                    <h2 id={dialogTitleId} className="text-3xl md:text-4xl lg:text-4xl font-bold text-text-primary leading-[1.1]">
                                        {analysis?.ack || 'Reviewing your answer…'}
                                    </h2>
                                    <div className="mt-12 flex flex-col md:flex-row items-center gap-4 justify-center w-full">
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                audioEngine.unlock();
                                                setHasExplored(true);
                                                setTimeout(() => scrollToSection(analysis?.deliveryPulse ? 'delivery' : 'content'), 50);
                                            }}
                                            emphasis="primary"
                                            density="hero"
                                            shape="app"
                                            label="strong"
                                            className="w-full md:w-auto"
                                        >
                                            Explore Feedback
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                audioEngine.unlock();
                                                onNext();
                                            }}
                                            variant="ghost"
                                            density="hero"
                                            shape="app"
                                            label="strong"
                                            className="w-full md:w-auto bg-transparent text-text-muted shadow-none hover:bg-transparent hover:text-text-primary"
                                        >
                                            {isLastQuestion ? 'Skip and Finish Session' : 'Skip and Continue to Next Question'}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Card: Delivery Pulse */}
                            {analysis?.deliveryPulse && (() => {
                                const isVoice = analysis?.meta?.modality === 'voice';
                                return (
                                    <div
                                        ref={setCardRef('delivery')}
                                        data-section="delivery"
                                        style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                                        className={cn(getCardClasses('delivery'))}
                                    >
                                        <div className="shrink-0 flex items-start gap-6 pb-6 border-b border-border/40">
                                            <div
                                                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-flat border border-border/30 bg-surface-base text-primary"
                                            >
                                                {isVoice ? <Mic2 size={32} strokeWidth={2} /> : <Keyboard size={32} strokeWidth={2} />}
                                            </div>
                                            <div className="flex-1 pt-1 pr-12 md:pr-48">
                                                <SectionHeader
                                                    title={analysis.deliveryPulse.headline}
                                                    description={<span className="text-sm font-black text-text-muted uppercase tracking-widest leading-none mb-2 block">Your Answer Delivery</span>}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pt-8 md:pt-10 px-1 -mx-1 custom-scrollbar">
                                            <div className="p-0 space-y-6">
                                                <p className="text-xl md:text-2xl text-text-secondary leading-relaxed font-medium">
                                                    {analysis.deliveryPulse.body}
                                                </p>
                                                <HelpfulRating
                                                    onSelect={(val) => handleHelpfulnessSelect('delivery', val)}
                                                    currentVal={helpfulness.delivery || null}
                                                    showSaved={savedTypes.delivery}
                                                />
                                                <FeedbackNavButtons
                                                    onPrimary={() => scrollToSection(analysis.contentPulse ? 'content' : 'next')}
                                                    onSkip={() => {
                                                        audioEngine.unlock();
                                                        onNext();
                                                    }}
                                                    skipLabel={isLastQuestion ? 'Skip and Finish Session' : 'Skip and Continue to Next Question'}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Card: Content Pulse */}
                            {analysis?.contentPulse && (
                                <div
                                    ref={setCardRef('content')}
                                    data-section="content"
                                    style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                                    className={cn(getCardClasses('content'))}
                                >
                                    <div className="shrink-0 flex items-start gap-6 pb-6 border-b border-border/40">
                                        <div
                                            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-flat border border-border/30 bg-surface-base text-emerald-800 dark:text-emerald-200"
                                        >
                                            <Target size={32} strokeWidth={2} />
                                        </div>
                                        <div className="flex-1 pt-1 pr-12 md:pr-48">
                                            <SectionHeader
                                                title={analysis.contentPulse.headline}
                                                description={<span className="text-sm font-black text-text-muted uppercase tracking-widest leading-none mb-2 block">Your Answer Content</span>}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pt-8 md:pt-10 px-1 -mx-1 custom-scrollbar">
                                            <div className="p-0 space-y-6">
                                                <p className="text-xl md:text-2xl text-text-secondary leading-relaxed font-medium">
                                                    {analysis.contentPulse.body}
                                                </p>
                                                <HelpfulRating
                                                    onSelect={(val) => handleHelpfulnessSelect('content', val)}
                                                    currentVal={helpfulness.content || null}
                                                    showSaved={savedTypes.content}
                                                />
                                            <FeedbackNavButtons
                                                onPrimary={() => scrollToSection('next')}
                                                onSkip={() => {
                                                    audioEngine.unlock();
                                                    onNext();
                                                }}
                                                skipLabel={isLastQuestion ? 'Skip and Finish Session' : 'Skip and Continue to Next Question'}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Card 10: Next / CTA */}
                            <div
                                ref={setCardRef('next')}
                                data-section="next"
                                style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                                className={cn(getCardClasses('next'), 'items-start text-left relative overflow-y-auto overscroll-y-contain')}
                            >
                                <div className="flex-1 w-full flex flex-col min-h-0">
                                    {/* Recommendation content (scrollable if needed) */}
                                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain custom-scrollbar px-4">
                                        <div className="my-auto py-12 space-y-6 max-w-2xl">
                                            <p className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">
                                                The Next Step
                                            </p>
                                            <h3 className="text-4xl md:text-6xl font-bold text-text-primary leading-tight">
                                                Ready to Continue?
                                            </h3>
                                            <div className="pt-8">
                                                <p className="text-xl md:text-3xl text-text-secondary leading-relaxed font-medium">
                                                    {analysis?.recommendation || (shouldRetry
                                                        ? "You might have missed a key signal that the interviewer is looking for. Let's try again to ensure your expertise really shines through."
                                                        : "You've addressed the core of this question effectively. Let's move on or try again to improve your delivery.")
                                                    }
                                                </p>
                                            </div>
                                            {analysis?.oneBigUpgrade && (
                                                <div className="rounded-3xl border border-primary/15 bg-surface-base/80 p-5 shadow-flat">
                                                    <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">
                                                        One Big Upgrade
                                                    </p>
                                                    <div className="mt-3 space-y-3">
                                                        <h4 className="text-xl font-bold text-text-primary">
                                                            {analysis.oneBigUpgrade.focus}
                                                        </h4>
                                                        <p className="text-base font-medium leading-relaxed text-text-secondary">
                                                            {analysis.oneBigUpgrade.rationale}
                                                        </p>
                                                        {analysis.oneBigUpgrade.targetMoment && (
                                                            <p className="rounded-2xl border border-border/40 bg-surface-subtle/70 px-4 py-3 text-sm font-medium leading-relaxed text-text-muted">
                                                                {analysis.oneBigUpgrade.targetMoment}
                                                            </p>
                                                        )}
                                                        <div className="rounded-2xl bg-primary/5 px-4 py-3">
                                                            <p className="text-micro font-black uppercase tracking-widest text-primary">
                                                                Try saying this
                                                            </p>
                                                            <p className="mt-2 text-base font-semibold leading-relaxed text-text-primary">
                                                                {analysis.oneBigUpgrade.trySayingThis}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Pinned Footer Actions */}
                                    <div className="shrink-0 pt-6 pb-8 flex flex-col items-start gap-4 w-full">
                                        {shouldRetry ? (
                                            <>
                                                <Button
                                                    type="button"
                                                    onClick={() => {
                                                        audioEngine.unlock();
                                                        onRetry();
                                                    }}
                                                    emphasis="primary"
                                                    density="hero"
                                                    shape="app"
                                                    label="strong"
                                                    className="w-full"
                                                >
                                                    <RotateCcw size={18} className="mr-2" />
                                                    Retry My Answer
                                                </Button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        audioEngine.unlock();
                                                        onNext();
                                                    }}
                                                    className="flex items-center gap-2 text-text-muted hover:text-primary font-bold text-sm transition-colors group mb-4"
                                                >
                                                    {isLastQuestion ? 'Finish Session' : 'Continue to Next Question'}
                                                    <ArrowRight
                                                        size={16}
                                                        className="group-hover:translate-x-0.5 transition-transform"
                                                    />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    type="button"
                                                    onClick={() => {
                                                        audioEngine.unlock();
                                                        onNext();
                                                    }}
                                                    emphasis="primary"
                                                    density="hero"
                                                    shape="app"
                                                    label="strong"
                                                    className="w-full"
                                                >
                                                    {isLastQuestion ? 'Finish Session' : 'Continue to Next Question'}
                                                    <ArrowRight size={18} className="ml-2" />
                                                </Button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        audioEngine.unlock();
                                                        onRetry();
                                                    }}
                                                    className="flex items-center gap-2 text-text-muted hover:text-primary font-bold text-sm transition-colors group mb-4"
                                                >
                                                    <RotateCcw
                                                        size={16}
                                                        className="group-hover:rotate-[-45deg] transition-transform"
                                                    />
                                                    Retry My Answer
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Universal Sticky Transcript FAB (Only visible in Stage 2 Feedback) ───────────────────────────── */}
                    <AnimatePresence>
                        {(activeSection === 'content' || activeSection === 'delivery') && !isTranscriptOpen && (
                            <div className="absolute top-4 right-4 z-40">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="pointer-events-auto"
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            audioEngine.unlock();
                                            setIsTranscriptOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-5 py-3 rounded-full shadow-lg font-bold text-sm transition-all hover:scale-105 active:scale-95 bg-surface-base border border-border/50 text-primary"
                                        aria-label="View your answer"
                                    >
                                        <FileText size={16} className="text-primary" />
                                        View your answer
                                        {isPlaying && (
                                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse ml-1" />
                                        )}
                                    </button>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* ── Transcript Slide-over Panel (Universal) ─────────────────────── */}
                    <AnimatePresence>
                        {isTranscriptOpen && (
                            <>
                                <motion.div
                                    key="transcript-backdrop"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setIsTranscriptOpen(false)}
                                    className="absolute inset-0 z-40 bg-surface-overlay/10 backdrop-blur-sm cursor-pointer rounded-none md:rounded-3xl"
                                />
                                <motion.div
                                    key="transcript-panel"
                                    initial={{ y: '-100%', opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: '-100%', opacity: 0 }}
                                    transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                                    ref={transcriptPanelRef}
                                    className="absolute inset-x-0 md:left-auto md:right-0 top-0 h-[78%] md:h-full md:w-96 z-50 bg-surface-base/90 rounded-b-[2rem] md:rounded-none md:border-l border-b md:border-b-0 border-border p-6 flex flex-col shadow-2xl backdrop-blur-xl"
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby={transcriptTitleId}
                                    tabIndex={-1}
                                >
                                    <div id={transcriptTitleId} className="sr-only">
                                        Transcript panel
                                    </div>
                                    <button
                                        type="button"
                                        ref={transcriptCloseButtonRef}
                                        onClick={() => setIsTranscriptOpen(false)}
                                        className="sr-only"
                                    >
                                        Close transcript panel
                                    </button>
                                    <div className="pt-2 flex-1 min-h-0">
                                        <TranscriptPanel
                                            transcript={transcript}
                                            audioBlob={audioBlob}
                                            isPlaying={isPlaying}
                                            togglePlayback={togglePlayback}
                                            showClose={true}
                                            onClose={() => setIsTranscriptOpen(false)}
                                            highlightQuote={analysis?.contentPulse?.quote}
                                        />
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
