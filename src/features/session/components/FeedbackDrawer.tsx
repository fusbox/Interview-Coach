import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AnalysisResult, Dimension } from '@/lib/domain/types';
import {
    LucideIcon,
    ArrowRight,
    ArrowLeft,
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
    Target
} from 'lucide-react';
import { cn } from '@/lib/cn';

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

export const FeedbackDrawer: React.FC<FeedbackOverlayProps> = ({
    isOpen,
    analysis,
    onNext,
    onRetry,
    isLastQuestion,
    transcript,
    audioBlob
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const SLIDES = 4;

    const togglePlayback = () => {
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
    };

    useEffect(() => {
        if (isOpen) {
            setCurrentSlide(0);
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

    // --- Dimensional Logic (V2.5 Quantified) ---
    const getCardVariant = (dimension: Dimension) => {
        const data = analysis?.scores?.[dimension];
        if (!data) return { state: 'strength', label: 'Strength' };

        const score = data.score;
        const isPolish = score === 3 && analysis?.meta?.readinessLevel === 'RL1';

        if (score >= 4) return { state: 'strength' as const, label: 'Strength' };
        if (isPolish) return { state: 'polish' as const, label: 'Polish' };
        return { state: 'focus' as const, label: 'Focus Area' };
    };

    // Dimension Definitions
    const deliveryDimensions: Array<{ id: Dimension; title: string; icon: LucideIcon }> = [
        { id: 'confidence', title: 'Confidence', icon: ShieldCheck },
        { id: 'pace', title: 'Pace', icon: Gauge },
        { id: 'clarity', title: 'Clarity', icon: Type },
        { id: 'energy', title: 'Tone', icon: Zap }
    ];

    const contentDimensions: Array<{ id: Dimension; title: string; icon: LucideIcon }> = [
        { id: 'focus_relevance', title: 'Relevance', icon: Target },
        { id: 'structural_clarity', title: 'Structure', icon: GitBranch },
        { id: 'specificity_concreteness', title: 'Detail', icon: Box },
        { id: 'outcome_explicitness', title: 'Impact', icon: Volume2 },
        { id: 'decision_rationale', title: 'Strategy', icon: Sparkles }
    ];

    // Foundational Filter: Only show the lowest-ranked foundational focus card
    const getVisibleCards = (pool: Array<{ id: Dimension; title: string; icon: LucideIcon }>) => {
        const variants = pool.map(d => ({ ...d, ...getCardVariant(d.id as Dimension) }));
        const focuses = variants.filter(v => v.state === 'focus');

        if (focuses.length > 0) {
            // Foundational hierarchy: relevance > structure > others
            const foundationalOrder = ['focus_relevance', 'structural_clarity', 'confidence'];
            const topFocus = focuses.sort((a, b) => {
                const aIdx = foundationalOrder.indexOf(a.id);
                const bIdx = foundationalOrder.indexOf(b.id);
                if (aIdx === -1) return 1;
                if (bIdx === -1) return -1;
                return aIdx - bIdx;
            })[0];

            return variants.filter(v => v.state !== 'focus' || v.id === topFocus.id);
        }
        return variants;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={cn(
                            "relative w-full max-w-[1334px] h-[750px] max-h-[95dvh] rounded-[2.5rem] shadow-2xl border flex flex-col overflow-hidden transition-colors duration-500",
                            currentSlide === 3
                                ? "bg-gradient-to-br from-blue-600 to-blue-700 md:from-[#e8f1fd] md:to-[#d1e3fa] dark:from-blue-900 dark:to-slate-950 border-blue-500/20 md:border-slate-200"
                                : "bg-gradient-to-br from-[#e8f1fd] to-[#d1e3fa] dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-white/5"
                        )}
                    >
                        {/* Header: Slide Progress Indicator */}
                        <div className="px-10 pt-8 pb-0 flex items-center justify-between">
                            <div className="flex gap-2">
                                {Array.from({ length: SLIDES }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "h-1.5 rounded-full transition-all duration-300",
                                            i === currentSlide ? "w-8 bg-blue-600" : "w-2 bg-slate-200 dark:bg-white/10"
                                        )}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-3">
                                {currentSlide > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setCurrentSlide(prev => prev - 1)}
                                        className="rounded-full h-8 px-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                    >
                                        <ArrowLeft size={16} className="mr-2" />
                                        Back
                                    </Button>
                                )}
                                {currentSlide < SLIDES - 1 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setCurrentSlide(prev => prev + 1)}
                                        className="rounded-full h-8 px-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 font-bold"
                                    >
                                        Next
                                        <ArrowRight size={16} className="ml-2" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Carousel Content */}
                        <div className="flex-1 overflow-hidden relative">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentSlide}
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -20, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                    className="absolute inset-0 p-10 md:p-12"
                                >
                                    {/* SLIDE 0: ACKNOWLEDGMENT */}
                                    {currentSlide === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-center max-w-3xl mx-auto space-y-6">
                                            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white leading-[1.1] font-display">
                                                {analysis?.ack || "Thinking..."}
                                            </h2>
                                            <p className="text-slate-500 dark:text-slate-400 text-lg md:text-xl">
                                                Let&apos;s dive into how you did across delivery and content.
                                            </p>
                                        </div>
                                    )}

                                    {/* SLIDE 1: DELIVERY DEEP-DIVE */}
                                    {currentSlide === 1 && (
                                        <div className="h-full flex flex-col md:grid md:grid-rows-[1.618fr,1fr] gap-6 overflow-y-auto md:overflow-hidden custom-scrollbar">
                                            <div className="space-y-4 flex flex-col min-h-0">
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <Volume2 size={24} className="text-blue-500" />
                                                    <h3 className="text-2xl font-bold dark:text-white">Delivery</h3>
                                                </div>
                                                <div className={cn(
                                                    "grid gap-4 flex-1 min-h-0",
                                                    getVisibleCards(deliveryDimensions).length <= 3
                                                        ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-center"
                                                        : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-start"
                                                )}>
                                                    {getVisibleCards(deliveryDimensions).map((card) => {
                                                        const variant = getCardVariant(card.id as Dimension);
                                                        const observation = analysis?.taggedObservations?.find(obs => obs.dimension === card.id)?.text;

                                                        return (
                                                            <div key={card.id} className="p-6 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg transition-all flex flex-col items-center justify-start text-center space-y-4 h-full min-h-0">
                                                                <div className="flex items-center gap-3 shrink-0 pt-2">
                                                                    <div className={cn(
                                                                        "w-10 h-10 rounded-2xl flex items-center justify-center bg-white/10 shrink-0",
                                                                        variant.state === 'strength' ? "text-emerald-300" :
                                                                            variant.state === 'polish' ? "text-blue-200" :
                                                                                "text-amber-300"
                                                                    )}>
                                                                        <card.icon size={20} />
                                                                    </div>
                                                                    <span className="font-bold text-sm tracking-wide">{card.title}</span>
                                                                </div>
                                                                {observation && (
                                                                    <p className="text-[12px] text-blue-50/90 leading-relaxed italic line-clamp-4">
                                                                        &quot;{observation}&quot;
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="min-h-0 md:overflow-hidden shrink-0">
                                                <TranscriptPanel transcript={transcript} audioBlob={audioBlob} isPlaying={isPlaying} togglePlayback={togglePlayback} />
                                            </div>
                                        </div>
                                    )}

                                    {/* SLIDE 2: CONTENT DEEP-DIVE */}
                                    {currentSlide === 2 && (
                                        <div className="h-full flex flex-col md:grid md:grid-rows-[1.618fr,1fr] gap-6 overflow-y-auto md:overflow-hidden custom-scrollbar">
                                            <div className="space-y-4 flex flex-col min-h-0">
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <Target size={24} className="text-blue-500" />
                                                    <h3 className="text-2xl font-bold dark:text-white">Answer Content</h3>
                                                </div>
                                                <div className={cn(
                                                    "grid gap-4 flex-1 min-h-0",
                                                    getVisibleCards(contentDimensions).length <= 3
                                                        ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-center"
                                                        : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-start"
                                                )}>
                                                    {getVisibleCards(contentDimensions).map((card) => {
                                                        const variant = getCardVariant(card.id as Dimension);
                                                        const docObservations = analysis?.taggedObservations?.filter(obs => obs.dimension === card.id);

                                                        return (
                                                            <div key={card.id} className="p-5 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg transition-all flex flex-col items-center justify-start text-center space-y-3 h-full min-h-0">
                                                                <div className="flex items-center gap-3 shrink-0 pt-1">
                                                                    <div className={cn(
                                                                        "w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 shrink-0",
                                                                        variant.state === 'strength' ? "text-emerald-300" :
                                                                            variant.state === 'polish' ? "text-blue-200" :
                                                                                "text-amber-300"
                                                                    )}>
                                                                        <card.icon size={18} />
                                                                    </div>
                                                                    <span className="font-bold text-sm tracking-wide">{card.title}</span>
                                                                </div>
                                                                <div className="flex-1 space-y-1 overflow-hidden flex flex-col justify-start">
                                                                    {docObservations && docObservations.length > 0 && (
                                                                        <ul className="space-y-1">
                                                                            {docObservations.slice(0, 2).map((obs, idx) => (
                                                                                <li key={idx} className="text-[11px] text-blue-50/90 leading-tight italic line-clamp-3">
                                                                                    &quot;{obs.text}&quot;
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="min-h-0 md:overflow-hidden shrink-0">
                                                <TranscriptPanel transcript={transcript} audioBlob={audioBlob} isPlaying={isPlaying} togglePlayback={togglePlayback} />
                                            </div>
                                        </div>
                                    )}

                                    {/* SLIDE 3 (Actual Slide 4): RECOMMENDATION & CTA */}
                                    {currentSlide === 3 && (() => {
                                        const allDims = [...deliveryDimensions, ...contentDimensions];
                                        const hasFocusOrPolish = allDims.some(d => {
                                            const variant = getCardVariant(d.id as Dimension);
                                            return variant.state === 'focus' || variant.state === 'polish';
                                        });

                                        const nextLabel = isLastQuestion
                                            ? "Finish Session"
                                            : (<><span className="hidden md:inline">Continue to Next Question</span><span className="inline md:hidden">Next Question</span></>);

                                        const primaryBtn = hasFocusOrPolish ? (
                                            <Button
                                                onClick={onRetry}
                                                className="h-14 md:h-16 px-6 md:px-10 rounded-2xl bg-white text-blue-600 font-bold text-lg shadow-xl hover:bg-blue-50 hover:scale-[1.02] active:scale-95 transition-all w-full md:w-auto"
                                            >
                                                <RotateCcw size={18} className="mr-2" />
                                                Retry My Answer
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={onNext}
                                                className="h-14 md:h-16 px-6 md:px-10 rounded-2xl bg-white text-blue-600 font-bold text-lg shadow-xl hover:bg-blue-50 hover:scale-[1.02] active:scale-95 transition-all w-full md:w-auto"
                                            >
                                                {nextLabel}
                                                <ArrowRight size={20} className="ml-2" />
                                            </Button>
                                        );

                                        const secondaryBtn = hasFocusOrPolish ? (
                                            <button
                                                onClick={onNext}
                                                className="flex items-center gap-2 text-blue-100 hover:text-white md:text-slate-500 md:hover:text-blue-600 font-bold transition-all group"
                                            >
                                                {nextLabel}
                                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={onRetry}
                                                className="flex items-center gap-2 text-blue-100 hover:text-white md:text-slate-500 md:hover:text-blue-600 font-bold transition-all group"
                                            >
                                                <RotateCcw size={18} className="group-hover:rotate-[-45deg] transition-transform" />
                                                <span>Retry My Answer</span>
                                            </button>
                                        );

                                        return (
                                            <div className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto space-y-6 md:space-y-8 px-6 md:px-0">
                                                <div className="w-full space-y-6">
                                                    <h3 className="text-[10px] font-black text-blue-200 dark:text-blue-300 md:text-slate-400 md:dark:text-slate-500 uppercase tracking-[0.2em] text-center">The Next Step</h3>
                                                    <div className="p-0 md:p-12 md:bg-gradient-to-br md:from-blue-600 md:to-blue-700 md:rounded-[3rem] text-white md:shadow-2xl relative overflow-hidden group">
                                                        <div className="hidden md:block absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                                            <RotateCcw size={120} />
                                                        </div>
                                                        <div className="relative z-10 text-center space-y-6">
                                                            <h4 className="text-3xl md:text-4xl font-bold">{analysis?.primaryFocus?.headline || "Ready to Proceed?"}</h4>
                                                            <p className="text-blue-100 md:text-blue-50 text-lg md:text-xl leading-relaxed max-w-xl mx-auto">
                                                                {analysis?.primaryFocus?.body || "You've addressed the core of this question effectively."}
                                                            </p>
                                                            <div className="pt-4 md:pt-6">
                                                                {primaryBtn}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Secondary Button Below Card, Right-Justified */}
                                                <div className="w-full flex justify-end pb-12 md:pb-8">
                                                    {secondaryBtn}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

// Sub-component for reuse across slides
const TranscriptPanel: React.FC<{
    transcript?: string;
    audioBlob: Blob | null | undefined;
    isPlaying: boolean;
    togglePlayback: () => void
}> = ({ transcript, audioBlob, isPlaying, togglePlayback }) => (
    <div className="flex flex-col space-y-4 overflow-hidden h-full">
        <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Your Answer</h4>
            {audioBlob && (
                <button
                    onClick={togglePlayback}
                    className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-xs font-black uppercase tracking-tight",
                        isPlaying
                            ? "bg-blue-600 text-white"
                            : "bg-blue-50 dark:bg-blue-900/30 text-blue-600"
                    )}
                >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                    <span>{isPlaying ? "Pause" : "Listen"}</span>
                </button>
            )}
        </div>
        <div className="flex-1 relative bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-slate-100 dark:border-white/5 p-8 overflow-y-auto italic custom-scrollbar">
            <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
                &quot;{transcript || "No transcript available."}&quot;
            </p>
        </div>
    </div>
);
