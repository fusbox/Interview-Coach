'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
    ChevronDown,
    ArrowRight
} from 'lucide-react';
import { FeedbackPill } from '@/components/patterns/FeedbackPill';
import { cn } from '@/lib/cn';
import { captureFeedbackAction } from '@/app/actions/feedback';
import { useSession } from '../context/SessionContext';
import { SectionHeader } from '@/components/patterns/SectionHeader';

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
                            onClick={() => {
                                console.log("[TranscriptPanel] Listen button clicked", { isPlaying });
                                togglePlayback();
                            }}
                            className={cn(
                                'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-xs font-black uppercase tracking-tight',
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
                        <button
                            onClick={() => onSelect(opt.val)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 border flex items-center gap-2",
                                currentVal === opt.val
                                    ? "bg-primary border-primary text-primary-foreground shadow-md scale-105"
                                    : "bg-surface-base border-border text-text-secondary hover:border-primary/30"
                            )}
                        >
                            <span>{opt.icon}</span>
                            <span>{opt.label}</span>
                        </button>
                        <FeedbackPill isVisible={!!showSaved && currentVal === opt.val} text="Saved" />
                    </div>
                ))}
            </div>
        </div>
    );
};

const ProgressDots: React.FC<{
    sections: { id: SectionKey; label: string }[];
    activeSection: SectionKey;
    onDotClick: (id: SectionKey) => void;
    isBranded?: boolean;
}> = ({ sections, activeSection, onDotClick, isBranded }) => {
    return (
        <div className="hidden md:flex absolute left-6 md:left-8 top-1/2 -translate-y-1/2 z-40 flex-col gap-4">
            {sections.map((s) => (
                <button
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
                            "w-2 h-2 rounded-full transition-colors duration-300",
                            activeSection === s.id
                                ? "bg-primary"
                                : isBranded
                                    ? "bg-surface-subtle"
                                    : "bg-border group-hover:bg-border/80"
                        )}
                    />
                    <div className="absolute left-6 px-2 py-1 rounded bg-surface-overlay text-text-inverse text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-floating">
                        {s.label}
                    </div>
                </button>
            ))}
        </div>
    );
};

const ScrollHint: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute inset-x-0 bottom-8 z-10 flex flex-col items-center justify-center gap-2 pointer-events-none"
                >
                    <span className="text-[10px] font-medium text-primary uppercase tracking-[0.2em]">Scroll to Explore</span>
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="text-text-muted"
                    >
                        <ChevronDown size={20} />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
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
}) => {
    const { session } = useSession();
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeSection, setActiveSection] = useState<SectionKey>('start');
    const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
    const [hasExplored, setHasExplored] = useState(false);
    const [hasScrolled, setHasScrolled] = useState(false);
    const isProgrammaticScroll = useRef(false);
    const [helpfulness, setHelpfulness] = useState<Record<string, string>>({});
    const [savedTypes, setSavedTypes] = useState<Record<string, boolean>>({});



    const audioRef = useRef<HTMLAudioElement | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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
                audioRef.current.onerror = (e) => {
                    console.error("[Audio] Playback error:", e);
                    setIsPlaying(false);
                };
            } catch (err) {
                console.error("[Audio] Failed to create Audio object:", err);
                return;
            }
        }

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play()
                .then(() => {
                    setIsPlaying(true);
                })
                .catch(err => {
                    console.error("[Audio] Playback failed:", err);
                    setIsPlaying(false);
                });
        }
    }, [audioBlob, isPlaying]);

    const handleHelpfulnessSelect = async (type: 'delivery' | 'content', val: string) => {
        // Prime the audio engine on user gesture
        audioEngine.unlock();
        setHelpfulness(prev => ({ ...prev, [type]: val }));
        setSavedTypes(prev => ({ ...prev, [type]: false }));
        try {
            await captureFeedbackAction({
                sessionId: session?.id,
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
        }
    };

    // Reset on close; cleanup on unmount
    useEffect(() => {
        if (!isOpen) {
            setActiveSection('start');
            setIsTranscriptOpen(false);
            setHelpfulness({});
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
            console.log("[FeedbackDrawer] Clearing audioRef because audioBlob became null");
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
            'scroll-snap-align-start flex-shrink-0 w-full min-h-full md:h-full flex flex-col justify-start px-6 md:pl-20 md:pr-14 pb-8',
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
                >
                    {/* ── Main Layout (Vertical Split: Header + Content) ─────────────────── */}
                    <div className="flex-1 flex flex-col min-w-0 bg-transparent relative">
                        {/* Progress Nav */}
                        <ProgressDots
                            sections={sections}
                            activeSection={activeSection}
                            onDotClick={scrollToSection}
                            isBranded={isElevatedMode}
                        />

                        <ScrollHint isVisible={hasExplored && !hasScrolled} />

                        {/* ── Scroll-Snap Cards ───────────────────────────────────────── */}
                        <div
                            ref={scrollContainerRef}
                            onScroll={() => {
                                if (!isProgrammaticScroll.current && !hasScrolled) {
                                    setHasScrolled(true);
                                }
                            }}
                            className={cn('flex-1 min-w-0 scroll-snap-y-mandatory custom-scrollbar bg-transparent', hasExplored ? 'overflow-y-scroll' : 'overflow-hidden')}
                            style={{ scrollSnapType: 'y mandatory' }}
                        >
                            {/* Card 0: Start / Ack */}
                            <div
                                ref={setCardRef('start')}
                                data-section="start"
                                className={cn(getCardClasses('start'), 'items-center justify-center text-center max-w-4xl mx-auto relative overflow-hidden')}
                                style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                            >
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-deep/20 to-brand-deep opacity-100" />
                                <div className="w-full flex flex-col items-center my-auto py-8">
                                    <h2 className="text-4xl md:text-5xl lg:text-5xl font-bold text-text-primary leading-[1.1] font-display">
                                        {analysis?.ack || 'Reviewing your answer…'}
                                    </h2>
                                    <div className="mt-12 flex flex-col md:flex-row items-center gap-4 justify-center w-full">
                                        <Button
                                            onClick={() => {
                                                audioEngine.unlock();
                                                setHasExplored(true);
                                                setTimeout(() => scrollToSection(analysis?.deliveryPulse ? 'delivery' : 'content'), 50);
                                            }}
                                            className="h-14 w-full md:w-auto rounded-full px-10 bg-primary hover:bg-primary/90 text-primary-foreground transition-all font-bold text-base"
                                        >
                                            Explore Feedback
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                audioEngine.unlock();
                                                onNext();
                                            }}
                                            className="h-14 w-full md:w-auto rounded-full px-8 text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-all font-bold text-base"
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
                                                    description={<span className="text-sm font-black text-text-muted uppercase tracking-widest leading-none mb-2 block">Delivery Insight</span>}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-visible md:overflow-y-auto md:min-h-0 pt-8 md:pt-10 px-1 -mx-1 custom-scrollbar">
                                            <div className="p-0 space-y-6">
                                                <p className="text-xl md:text-2xl text-text-secondary leading-relaxed font-medium">
                                                    {analysis.deliveryPulse.body}
                                                </p>
                                                <HelpfulRating
                                                    onSelect={(val) => handleHelpfulnessSelect('delivery', val)}
                                                    currentVal={helpfulness.delivery || null}
                                                    showSaved={savedTypes.delivery}
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
                                            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-flat border border-border/30 bg-surface-base text-state-success"
                                        >
                                            <Target size={32} strokeWidth={2} />
                                        </div>
                                        <div className="flex-1 pt-1 pr-12 md:pr-48">
                                            <SectionHeader
                                                title={analysis.contentPulse.headline}
                                                description={<span className="text-sm font-black text-text-muted uppercase tracking-widest leading-none mb-2 block">Content Insight</span>}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-visible md:overflow-y-auto md:min-h-0 pt-8 md:pt-10 px-1 -mx-1 custom-scrollbar">
                                        <div className="p-0 space-y-6">
                                            <p className="text-xl md:text-2xl text-text-secondary leading-relaxed font-medium">
                                                {analysis.contentPulse.body}
                                            </p>
                                            {analysis.contentPulse.quote && (
                                                <blockquote className="border-l-2 border-primary bg-surface-subtle rounded-r-lg p-5">
                                                    <p className="text-lg md:text-xl text-text-secondary italic font-medium leading-relaxed">
                                                        &quot;{analysis.contentPulse.quote}&quot;
                                                    </p>
                                                </blockquote>
                                            )}
                                            <HelpfulRating
                                                onSelect={(val) => handleHelpfulnessSelect('content', val)}
                                                currentVal={helpfulness.content || null}
                                                showSaved={savedTypes.content}
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
                                className={cn(getCardClasses('next'), 'items-start text-left relative overflow-hidden')}
                            >
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-deep/20 to-brand-deep opacity-100" />
                                <div className="flex-1 w-full flex flex-col min-h-0">
                                    {/* Recommendation content (scrollable if needed) */}
                                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4">
                                        <div className="my-auto py-12 space-y-6 max-w-2xl">
                                            <p className="text-xs font-black text-text-muted uppercase tracking-[0.2em]">
                                                The Next Step
                                            </p>
                                            <h3 className="text-4xl md:text-6xl font-bold text-text-primary leading-tight tracking-tight">
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
                                        </div>
                                    </div>

                                    {/* Pinned Footer Actions */}
                                    <div className="shrink-0 pt-6 pb-8 flex flex-col items-start gap-4 w-full">
                                        {shouldRetry ? (
                                            <>
                                                <Button
                                                    onClick={() => {
                                                        audioEngine.unlock();
                                                        onRetry();
                                                    }}
                                                    className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-lg hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all"
                                                >
                                                    <RotateCcw size={18} className="mr-2" />
                                                    Retry My Answer
                                                </Button>
                                                <button
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
                                                    onClick={() => {
                                                        audioEngine.unlock();
                                                        onNext();
                                                    }}
                                                    className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-lg hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all"
                                                >
                                                    {isLastQuestion ? 'Finish Session' : 'Continue to Next Question'}
                                                    <ArrowRight size={18} className="ml-2" />
                                                </Button>
                                                <button
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
                                        onClick={() => {
                                            audioEngine.unlock();
                                            setIsTranscriptOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-5 py-3 rounded-full shadow-lg font-bold text-sm transition-all hover:scale-105 active:scale-95 bg-surface-base border border-border/50 text-primary"
                                        aria-label="View your answer"
                                    >
                                        <FileText size={16} className="text-primary/70" />
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
                                    className="absolute inset-x-0 md:left-auto md:right-0 top-0 h-[78%] md:h-full md:w-96 z-50 bg-surface-base/90 rounded-b-[2rem] md:rounded-none md:border-l border-b md:border-b-0 border-border p-6 flex flex-col shadow-2xl backdrop-blur-xl"
                                >
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
