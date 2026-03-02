'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AnalysisResult, Dimension } from '@/lib/domain/types';
import {
    LucideIcon,
    ArrowRight,
    Play,
    Pause,
    RotateCcw,
    Sparkles,
    ShieldCheck,
    GitBranch,
    Box,
    Volume2,
    Gauge,
    Zap,
    Type,
    Target,
    FileText,
    X,
} from 'lucide-react';
import { cn } from '@/lib/cn';

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

interface DimensionDef {
    id: Dimension;
    title: string;
    icon: LucideIcon;
}

// ─────────────────────────────────────────────
// Static Dimension Definitions
// ─────────────────────────────────────────────

const DELIVERY_DIMS: DimensionDef[] = [
    { id: 'confidence', title: 'Confidence', icon: ShieldCheck },
    { id: 'pace', title: 'Pace', icon: Gauge },
    { id: 'clarity', title: 'Clarity', icon: Type },
    { id: 'energy', title: 'Tone & Energy', icon: Zap },
];

const CONTENT_DIMS: DimensionDef[] = [
    { id: 'focus_relevance', title: 'Relevance', icon: Target },
    { id: 'structural_clarity', title: 'Structure', icon: GitBranch },
    { id: 'specificity_concreteness', title: 'Specificity', icon: Box },
    { id: 'outcome_explicitness', title: 'Impact', icon: Volume2 },
    { id: 'decision_rationale', title: 'Strategy', icon: Sparkles },
];



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
                <mark className="bg-purple-500/10 text-purple-900 dark:text-purple-200 rounded px-1 -mx-1 transition-colors border border-purple-500/10 dark:border-purple-400/20">
                    {matchText}
                </mark>
                {textAfter}
            </>
        );
    };

    return (
        <div className="flex flex-col h-full min-h-0 gap-4">
            <div className="flex items-center justify-between px-1 shrink-0 h-8">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    Your Answer
                </h4>
                <div className="flex items-center gap-2">
                    {audioBlob && (
                        <button
                            onClick={togglePlayback}
                            className={cn(
                                'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-xs font-black uppercase tracking-tight',
                                isPlaying
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'
                            )}
                        >
                            {isPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                            <span>{isPlaying ? 'Pause' : 'Listen'}</span>
                        </button>
                    )}
                    {showClose && onClose && (
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                            aria-label="Close transcript"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 relative bg-transparent p-6 overflow-y-auto custom-scrollbar min-h-0">
                <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed font-medium whitespace-pre-wrap">
                    {renderTranscript()}
                </p>
            </div>
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
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeSection, setActiveSection] = useState<SectionKey>('start');
    const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
    const [hasExplored, setHasExplored] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // ── Audio playback ──────────────────────────────────────────────────────

    const togglePlayback = useCallback(() => {
        if (!audioBlob) return;

        if (!audioRef.current) {
            const url = URL.createObjectURL(audioBlob);
            audioRef.current = new Audio(url);
            audioRef.current.onended = () => setIsPlaying(false);
        }

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play();
            setIsPlaying(true);
        }
    }, [audioBlob, isPlaying]);

    // Reset on close; cleanup on unmount
    useEffect(() => {
        if (!isOpen) {
            setActiveSection('start');
            setIsTranscriptOpen(false);
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
        }
    }, [isOpen]);

    useEffect(() => {
        if (audioRef.current) {
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

    // CTA logic
    const hasFocusOrPolish = !!analysis?.contentPulse || !!analysis?.deliveryPulse;

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
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            'scroll-snap-align-start flex-shrink-0 w-full min-h-full md:h-full flex flex-col justify-start px-6 md:px-[56px] pb-8',
            isElevated ? 'pt-8 md:pt-[56px]' : 'pt-8 md:pt-[48px]'
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
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                />

                {/* Modal shell */}
                <motion.div
                    key="modal"
                    initial={{ opacity: 0, scale: 0.97, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 16 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className={cn(
                        "relative w-full max-w-[960px] min-w-[720px] h-[100dvh] md:h-[640px] rounded-none md:rounded-[20px] border-0 md:border border-slate-200 dark:border-white/5 bg-[#ffffff] dark:bg-slate-900 flex overflow-hidden transition-shadow duration-300",
                        isElevatedMode ? "md:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.12)]" : "md:shadow-lg"
                    )}
                >
                    {/* ── Main Layout (Vertical Split: Header + Content) ─────────────────── */}
                    <div className="flex-1 flex flex-col min-w-0 bg-transparent">
                        {/* ── Scroll-Snap Cards ───────────────────────────────────────── */}
                        <div
                            ref={scrollContainerRef}
                            className={cn('flex-1 min-w-0 scroll-snap-y-mandatory custom-scrollbar', hasExplored ? 'overflow-y-scroll' : 'overflow-hidden')}
                            style={{ scrollSnapType: 'y mandatory' }}
                        >
                            {/* Card 0: Start / Ack */}
                            <div
                                ref={setCardRef('start')}
                                data-section="start"
                                className={cn(getCardClasses('start'), 'items-center justify-center text-center max-w-4xl mx-auto')}
                                style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                            >
                                <div className="w-full flex flex-col items-center my-auto py-8">
                                    <h2 className="text-4xl md:text-5xl lg:text-[40px] font-black text-slate-900 dark:text-white leading-[1.1] font-display">
                                        {analysis?.ack || 'Reviewing your answer…'}
                                    </h2>
                                    <div className="mt-12 flex flex-col md:flex-row items-center gap-4 justify-center w-full">
                                        <Button
                                            onClick={() => {
                                                setHasExplored(true);
                                                setTimeout(() => scrollToSection(analysis?.deliveryPulse ? 'delivery' : 'content'), 50);
                                            }}
                                            className="h-14 w-full md:w-auto rounded-full px-10 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 transition-all font-bold text-base"
                                        >
                                            Explore Feedback
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={onNext}
                                            className="h-14 w-full md:w-auto rounded-full px-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-white/5 dark:hover:text-white transition-all font-bold text-base"
                                        >
                                            {isLastQuestion ? 'Skip and Finish Session' : 'Skip and Continue to Next Question'}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Card: Delivery Pulse */}
                            {analysis?.deliveryPulse && (() => {
                                const cardDef = DELIVERY_DIMS.find(d => d.id === analysis.deliveryPulse?.dimension) || DELIVERY_DIMS[0];
                                return (
                                    <div
                                        ref={setCardRef('delivery')}
                                        data-section="delivery"
                                        style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                                        className={cn(getCardClasses('delivery'))}
                                    >
                                        <div className="shrink-0 flex items-start gap-6 pb-6 border-b border-slate-200/40 dark:border-white/5">
                                            <div
                                                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-white/10 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300"
                                            >
                                                <cardDef.icon size={32} strokeWidth={2} />
                                            </div>
                                            <div className="flex-1 pt-1 pr-12 md:pr-48">
                                                <div className="flex items-center gap-4 mb-2">
                                                    <h4 className="text-[13px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                        Delivery Insight
                                                    </h4>
                                                </div>
                                                <h3 className="text-2xl md:text-[32px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">
                                                    {analysis.deliveryPulse.headline}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-visible md:overflow-y-auto md:min-h-0 pt-8 md:pt-10 px-1 -mx-1 custom-scrollbar">
                                            <div className="p-0 space-y-6">
                                                <p className="text-xl md:text-2xl text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                                    {analysis.deliveryPulse.body}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Card: Content Pulse */}
                            {analysis?.contentPulse && (() => {
                                const cardDef = CONTENT_DIMS.find(d => d.id === analysis.contentPulse?.dimension) || CONTENT_DIMS[0];
                                return (
                                    <div
                                        ref={setCardRef('content')}
                                        data-section="content"
                                        style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                                        className={cn(getCardClasses('content'))}
                                    >
                                        <div className="shrink-0 flex items-start gap-6 pb-6 border-b border-slate-200/40 dark:border-white/5">
                                            <div
                                                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-white/10 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-300"
                                            >
                                                <cardDef.icon size={32} strokeWidth={2} />
                                            </div>
                                            <div className="flex-1 pt-1 pr-12 md:pr-48">
                                                <div className="flex items-center gap-4 mb-2">
                                                    <h4 className="text-[13px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                        Content Insight
                                                    </h4>
                                                </div>
                                                <h3 className="text-2xl md:text-[32px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">
                                                    {analysis.contentPulse.headline}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-visible md:overflow-y-auto md:min-h-0 pt-8 md:pt-10 px-1 -mx-1 custom-scrollbar">
                                            <div className="p-0 space-y-6">
                                                <p className="text-xl md:text-2xl text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                                    {analysis.contentPulse.body}
                                                </p>
                                                {analysis.contentPulse.quote && (
                                                    <blockquote className="border-l-2 border-indigo-400 dark:border-indigo-500 bg-slate-900/[0.03] dark:bg-white/[0.03] rounded-r-lg p-5">
                                                        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 italic font-medium leading-relaxed">
                                                            &quot;{analysis.contentPulse.quote}&quot;
                                                        </p>
                                                    </blockquote>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Card 10: Next / CTA */}
                            <div
                                ref={setCardRef('next')}
                                data-section="next"
                                style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                                className={cn(getCardClasses('next'), 'items-start text-left')}
                            >
                                <div className="flex-1 w-full flex flex-col min-h-0">
                                    {/* Recommendation content (scrollable if needed) */}
                                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4">
                                        <div className="my-auto py-12 space-y-6 max-w-2xl">
                                            <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                                The Next Step
                                            </p>
                                            <h3 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                                                Ready to Continue?
                                            </h3>
                                            <div className="pt-8">
                                                <p className="text-xl md:text-3xl text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                                    You&apos;ve addressed the core of this question effectively. Let&apos;s move on or try again to improve your delivery.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pinned Footer Actions */}
                                    <div className="shrink-0 pt-6 pb-8 flex flex-col items-start gap-4 w-full">
                                        {hasFocusOrPolish ? (
                                            <>
                                                <Button
                                                    onClick={onRetry}
                                                    className="w-full h-14 rounded-2xl bg-blue-600 text-white font-bold text-base shadow-lg hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all"
                                                >
                                                    <RotateCcw size={18} className="mr-2" />
                                                    Retry My Answer
                                                </Button>
                                                <button
                                                    onClick={onNext}
                                                    className="flex items-center gap-2 text-slate-400 hover:text-blue-600 font-bold text-sm transition-colors group mb-4"
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
                                                    onClick={onNext}
                                                    className="w-full h-14 rounded-2xl bg-blue-600 text-white font-bold text-base shadow-lg hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all"
                                                >
                                                    {isLastQuestion ? 'Finish Session' : 'Continue to Next Question'}
                                                    <ArrowRight size={18} className="ml-2" />
                                                </Button>
                                                <button
                                                    onClick={onRetry}
                                                    className="flex items-center gap-2 text-slate-400 hover:text-blue-600 font-bold text-sm transition-colors group mb-4"
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
                        {(activeSection === 'content' || activeSection === 'delivery') && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="absolute top-5 right-5 z-20"
                            >
                                <button
                                    onClick={() => setIsTranscriptOpen(true)}
                                    className={cn(
                                        'flex items-center gap-2 px-5 py-3 rounded-full shadow-lg font-bold text-sm transition-all hover:scale-105 active:scale-95',
                                        isTranscriptOpen
                                            ? 'opacity-0 pointer-events-none'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-white/10'
                                    )}
                                    aria-label="Compare to your answer"
                                >
                                    <FileText size={16} className="text-slate-400" />
                                    Compare to your answer
                                    {isPlaying && (
                                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse ml-1" />
                                    )}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Transcript Slide-over Panel (Universal) ─────────────────────── */}
                    <AnimatePresence>
                        {isTranscriptOpen && (
                            <motion.div
                                key="transcript-panel"
                                initial={{ y: '100%', opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: '100%', opacity: 0 }}
                                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                                className="absolute inset-x-0 md:left-auto md:right-0 bottom-0 md:top-0 h-[78%] md:h-full md:w-[400px] z-30 bg-white/90 dark:bg-slate-900/90 rounded-t-[2rem] md:rounded-none md:border-l border-t md:border-t-0 border-slate-200 dark:border-white/10 p-6 flex flex-col shadow-2xl backdrop-blur-xl"
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
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
