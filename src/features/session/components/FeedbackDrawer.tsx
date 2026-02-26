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
    ChevronDown,
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

const SIDEBAR_SECTIONS: { key: SectionKey; label: string }[] = [
    { key: 'start', label: 'Start' },
    { key: 'delivery', label: 'Delivery' },
    { key: 'content', label: 'Content' },
    { key: 'next', label: 'Next' },
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
}> = ({ transcript, audioBlob, isPlaying, togglePlayback, onClose, showClose }) => (
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
            <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed font-medium">
                {transcript || 'No transcript available.'}
            </p>
        </div>
    </div>
);

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

    // ── Card variant ────────────────────────────────────────────────────────

    const getCardVariant = useCallback(
        (dim: Dimension) => {
            const data = analysis?.scores?.[dim];
            if (!data) return { state: 'strength' as const, label: 'Strength' };
            const score = data.score;
            const isPolish = score === 3 && analysis?.meta?.readinessLevel === 'RL1';
            if (score >= 4) return { state: 'strength' as const, label: 'Strength' };
            if (isPolish) return { state: 'polish' as const, label: 'Polish' };
            return { state: 'focus' as const, label: 'Focus Area' };
        },
        [analysis]
    );

    // Existing filter logic preserved: may produce fewer than max cards
    const getVisibleDims = useCallback(
        (pool: DimensionDef[]) => {
            const withVariants = pool.map((d) => ({ ...d, ...getCardVariant(d.id) }));
            const focuses = withVariants.filter((v) => v.state === 'focus');

            if (focuses.length > 0) {
                const foundationalOrder = ['focus_relevance', 'structural_clarity', 'confidence'];
                const topFocus = focuses.sort((a, b) => {
                    const aIdx = foundationalOrder.indexOf(a.id);
                    const bIdx = foundationalOrder.indexOf(b.id);
                    if (aIdx === -1) return 1;
                    if (bIdx === -1) return -1;
                    return aIdx - bIdx;
                })[0];
                return withVariants.filter((v) => v.state !== 'focus' || v.id === topFocus.id);
            }
            return withVariants;
        },
        [getCardVariant]
    );

    const visibleDelivery = getVisibleDims(DELIVERY_DIMS);
    const visibleContent = getVisibleDims(CONTENT_DIMS);

    // CTA logic
    const allDims = [...DELIVERY_DIMS, ...CONTENT_DIMS];
    const hasFocusOrPolish = allDims.some((d) => {
        const v = getCardVariant(d.id);
        return v.state === 'focus' || v.state === 'polish';
    });

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
        const sectionFirstCardKey =
            section === 'start'
                ? 'start'
                : section === 'delivery'
                    ? `delivery-${visibleDelivery[0]?.id}`
                    : section === 'content'
                        ? `content-${visibleContent[0]?.id}`
                        : 'next';
        const el = cardRefs.current.get(sectionFirstCardKey);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // ── Variant helpers ─────────────────────────────────────────────────────

    const variantBadgeClass = (state: 'strength' | 'polish' | 'focus') =>
        state === 'focus'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            : state === 'polish'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';

    const variantIconClass = (state: 'strength' | 'polish' | 'focus') =>
        state === 'focus'
            ? 'text-amber-500'
            : state === 'polish'
                ? 'text-blue-400'
                : 'text-emerald-500';

    // ── Register card ref ───────────────────────────────────────────────────

    const setCardRef = (key: string) => (el: HTMLDivElement | null) => {
        if (el) cardRefs.current.set(key, el);
        else cardRefs.current.delete(key);
    };

    // ── Shared card wrapper ─────────────────────────────────────────────────

    const cardBase =
        'scroll-snap-align-start flex-shrink-0 w-full h-full flex flex-col justify-start px-8 md:px-12 pt-10 pb-8';

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4">
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
                    className="relative w-full max-w-[1400px] h-[95dvh] md:h-[640px] rounded-[2rem] shadow-2xl border border-slate-200 dark:border-white/5 bg-gradient-to-br from-[#e8f1fd] to-[#d1e3fa] dark:from-slate-900 dark:to-slate-800 flex overflow-hidden"
                >
                    {/* ── Main Layout (Vertical Split: Header + Content) ─────────────────── */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* ── Desktop Horizontal Top Header ─────────────────────────── */}
                        <header className="hidden md:flex items-center justify-between h-20 px-4 md:px-8 border-b border-slate-200/60 dark:border-white/5 shrink-0">
                            {SIDEBAR_SECTIONS.map((s) => {
                                const isActive = activeSection === s.key;
                                return (
                                    <button
                                        key={s.key}
                                        onClick={() => scrollToSection(s.key)}
                                        className={cn(
                                            'relative flex items-center justify-center h-12 px-8 rounded-full text-base font-bold tracking-tight transition-all duration-200 group overflow-hidden',
                                            isActive
                                                ? 'text-blue-600 dark:text-blue-400'
                                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        )}
                                    >
                                        <AnimatePresence>
                                            {isActive && (
                                                <motion.div
                                                    layoutId="nav-bg"
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.8 }}
                                                    className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded-full -z-10"
                                                />
                                            )}
                                        </AnimatePresence>
                                        {s.label}
                                    </button>
                                );
                            })}
                        </header>

                        {/* ── Scroll-Snap Cards ───────────────────────────────────────── */}
                        <div
                            ref={scrollContainerRef}
                            className="flex-1 min-w-0 overflow-y-scroll scroll-snap-y-mandatory custom-scrollbar"
                            style={{ scrollSnapType: 'y mandatory' }}
                        >
                            {/* Card 0: Start / Ack */}
                            <div
                                ref={setCardRef('start')}
                                data-section="start"
                                className={cn(cardBase, 'items-center text-center max-w-4xl mx-auto')}
                                style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                            >
                                <div className="flex-1 w-full flex flex-col overflow-y-auto custom-scrollbar px-4">
                                    <div className="my-auto py-8 flex flex-col items-center">
                                        <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white leading-[1.1] font-display">
                                            {analysis?.ack || 'Reviewing your answer…'}
                                        </h2>
                                        <div className="mt-8 space-y-6">
                                            <p className="text-slate-500 dark:text-slate-400 text-lg md:text-xl max-w-xl mx-auto font-medium">
                                                Scroll through to review your delivery and content, or
                                            </p>

                                            <Button
                                                onClick={onNext}
                                                className="h-12 rounded-2xl px-10 bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all font-bold"
                                            >
                                                Skip and Continue to Next Question
                                            </Button>
                                        </div>

                                        {/* Scroll Cue (Option A: Classic Bouncing Chevron) */}
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 1, duration: 0.5 }}
                                            className="mt-12 flex flex-col items-center gap-2"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 dark:text-blue-400">
                                                See Feedback
                                            </span>
                                            <div className="animate-bounce">
                                                <ChevronDown className="text-blue-500 dark:text-blue-400" size={24} />
                                            </div>
                                        </motion.div>
                                    </div>
                                </div>
                            </div>

                            {/* Cards 1–4: Delivery */}
                            {visibleDelivery.map((card) => {
                                const key = `delivery-${card.id}`;
                                const obs = analysis?.taggedObservations?.find(
                                    (o) => o.dimension === card.id
                                )?.text;
                                return (
                                    <div
                                        key={key}
                                        ref={setCardRef(key)}
                                        data-section="delivery"
                                        style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                                        className={cn(cardBase)}
                                    >
                                        {/* Dynamic Card Header (Icon + Title) */}
                                        <div className="shrink-0 flex items-start gap-6 pb-6 border-b border-slate-200/40 dark:border-white/5">
                                            <div
                                                className={cn(
                                                    'w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm border border-white/50 dark:border-white/10 bg-white dark:bg-slate-800',
                                                    variantIconClass(card.state)
                                                )}
                                            >
                                                <card.icon size={32} strokeWidth={2} />
                                            </div>
                                            <div className="flex-1 pt-1">
                                                <div className="flex items-center gap-4 mb-2">
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">
                                                        Delivery
                                                    </h4>
                                                    <span
                                                        className={cn(
                                                            'px-2 py-0.5 rounded text-xs font-black uppercase tracking-tighter',
                                                            variantBadgeClass(card.state)
                                                        )}
                                                    >
                                                        {card.state}
                                                    </span>
                                                </div>
                                                <h3 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white leading-none tracking-tight">
                                                    {card.title}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Scrollable Content Area */}
                                        <div className="flex-1 overflow-y-auto min-h-0 pt-10 px-1 -mx-1 custom-scrollbar">
                                            <div className="p-0">
                                                <p className="text-xl md:text-2xl text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                                    {obs ||
                                                        'Your delivery was consistent and effective across this dimension.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Cards 5–9: Content */}
                            {visibleContent.map((card) => {
                                const key = `content-${card.id}`;
                                const observations = analysis?.taggedObservations?.filter(
                                    (o) => o.dimension === card.id
                                );
                                return (
                                    <div
                                        key={key}
                                        ref={setCardRef(key)}
                                        data-section="content"
                                        style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                                        className={cn(cardBase)}
                                    >
                                        {/* Dynamic Card Header (Icon + Title) */}
                                        <div className="shrink-0 flex items-start gap-6 pb-6 border-b border-slate-200/40 dark:border-white/5">
                                            <div
                                                className={cn(
                                                    'w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm border border-white/50 dark:border-white/10 bg-white dark:bg-slate-800',
                                                    variantIconClass(card.state)
                                                )}
                                            >
                                                <card.icon size={32} strokeWidth={2} />
                                            </div>
                                            <div className="flex-1 pt-1">
                                                <div className="flex items-center gap-4 mb-2">
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">
                                                        Answer Content
                                                    </h4>
                                                    <span
                                                        className={cn(
                                                            'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter',
                                                            variantBadgeClass(card.state)
                                                        )}
                                                    >
                                                        {card.state}
                                                    </span>
                                                </div>
                                                <h3 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white leading-none tracking-tight">
                                                    {card.title}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Scrollable Content Area */}
                                        <div className="flex-1 overflow-y-auto min-h-0 pt-10 px-1 -mx-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
                                            <div className="p-0 space-y-8">
                                                {observations && observations.length > 0 ? (
                                                    observations.map((obs, idx) => (
                                                        <p
                                                            key={idx}
                                                            className="text-xl md:text-2xl text-slate-700 dark:text-slate-200 leading-relaxed font-medium"
                                                        >
                                                            {obs.text}
                                                        </p>
                                                    ))
                                                ) : (
                                                    <p className="text-xl md:text-2xl text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                                        Excellent performance in this competency area.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Card 10: Next / CTA */}
                            <div
                                ref={setCardRef('next')}
                                data-section="next"
                                style={{ scrollSnapAlign: 'start', minHeight: '100%' }}
                                className={cn(cardBase, 'items-start text-left')}
                            >
                                <div className="flex-1 w-full flex flex-col min-h-0">
                                    {/* Recommendation content (scrollable if needed) */}
                                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4">
                                        <div className="my-auto py-12 space-y-6 max-w-2xl">
                                            <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                                The Next Step
                                            </p>
                                            <h3 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                                                {analysis?.primaryFocus?.headline || 'Ready to Continue?'}
                                            </h3>
                                            <div className="pt-8">
                                                <p className="text-xl md:text-3xl text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                                    {analysis?.primaryFocus?.body ||
                                                        "You've addressed the core of this question effectively."}
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

                    {/* ── Desktop Transcript Column ────────────────────────────────── */}
                    <aside className="hidden md:flex flex-col w-[320px] shrink-0 border-l border-slate-200/60 dark:border-white/5 p-6 pt-10 min-h-0">
                        <TranscriptPanel
                            transcript={transcript}
                            audioBlob={audioBlob}
                            isPlaying={isPlaying}
                            togglePlayback={togglePlayback}
                        />
                    </aside>

                    {/* ── Mobile: Transcript Toggle FAB ───────────────────────────── */}
                    {/* Always rendered on mobile so it's never covered — lives at bottom of modal */}
                    <div className="absolute bottom-5 right-5 z-20 md:hidden">
                        <button
                            onClick={() => setIsTranscriptOpen(true)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg font-bold text-sm transition-all',
                                isTranscriptOpen
                                    ? 'opacity-0 pointer-events-none'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10'
                            )}
                            aria-label="View transcript"
                        >
                            <FileText size={16} />
                            Transcript
                            {isPlaying && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            )}
                        </button>
                    </div>

                    {/* ── Mobile: Transcript Slide-over Panel ─────────────────────── */}
                    <AnimatePresence>
                        {isTranscriptOpen && (
                            <motion.div
                                key="transcript-panel"
                                initial={{ y: '100%', opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: '100%', opacity: 0 }}
                                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                                className="absolute inset-x-0 bottom-0 z-10 h-[78%] md:hidden bg-transparent rounded-t-[2rem] border-t border-slate-200 dark:border-white/10 p-6 flex flex-col shadow-2xl backdrop-blur-xl"
                            >
                                {/* Close button pinned at top-right of panel */}
                                <div className="absolute top-4 right-5 z-20">
                                    <button
                                        onClick={() => setIsTranscriptOpen(false)}
                                        className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm"
                                        aria-label="Close transcript"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="pt-2 flex-1 min-h-0">
                                    <TranscriptPanel
                                        transcript={transcript}
                                        audioBlob={audioBlob}
                                        isPlaying={isPlaying}
                                        togglePlayback={togglePlayback}
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
