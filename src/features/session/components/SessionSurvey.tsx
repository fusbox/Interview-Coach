import { useState } from "react";
import { captureFeedbackAction } from "@/app/actions/feedback";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

export interface SessionSurveyProps {
    sessionId?: string;
}

const EMOJI_SCALE = [
    { val: 1, emoji: "🙁" },
    { val: 2, emoji: "😐" },
    { val: 3, emoji: "🙂" },
    { val: 4, emoji: "😊" },
    { val: 5, emoji: "🤩" }
];

export function SessionSurvey({ sessionId }: SessionSurveyProps) {
    const [survey, setSurvey] = useState<Record<string, string | number>>({});
    const [submitError, setSubmitError] = useState<Record<string, boolean>>({});
    const [justSaved, setJustSaved] = useState<Record<string, boolean>>({});

    const handleSurveySelect = async (key: string, val: string | number) => {
        setSurvey(prev => ({ ...prev, [key]: val }));
        setSubmitError(prev => ({ ...prev, [key]: false }));
        setJustSaved(prev => ({ ...prev, [key]: false }));

        try {
            await captureFeedbackAction({
                sessionId,
                type: `session_completion_${key}`,
                rating: typeof val === 'number' ? val : undefined,
                comment: typeof val === 'string' ? val : undefined,
                metadata: { question: key }
            });
            setJustSaved(prev => ({ ...prev, [key]: true }));
            // Auto-hide success after 2s
            setTimeout(() => {
                setJustSaved(prev => ({ ...prev, [key]: false }));
            }, 2000);
        } catch (err) {
            console.error(`[SessionSurvey] FAILED to capture ${key}:`, err);
            setSubmitError(prev => ({ ...prev, [key]: true }));
            setSurvey(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const SuccessBadge = ({ isVisible }: { isVisible: boolean }) => (
        <div className="relative h-0 w-0">
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: -25 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                    >
                        <div className="bg-green-600 text-white rounded-full px-2.5 py-1 shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                            <Check size={12} strokeWidth={4} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Saved</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    return (
        <div className="bg-transparent rounded-2xl p-0 md:px-2 space-y-12">

            {/* 1. Confidence Delta */}
            <div className="space-y-4">
                <div className="flex flex-col items-center justify-center gap-1">
                    <p className="text-lg font-bold text-text-primary text-center">
                        I feel more prepared after this session.
                    </p>
                    <SuccessBadge isVisible={justSaved['confidence_delta']} />
                </div>
                <div className="flex justify-center gap-2">
                    {EMOJI_SCALE.map(({ val, emoji }) => (
                        <button
                            key={val}
                            onClick={() => handleSurveySelect('confidence_delta', val)}
                            className={cn(
                                "flex-1 md:flex-none w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-3xl transition-all duration-300",
                                survey.confidence_delta === val
                                    ? "bg-white dark:bg-blue-900/20 border-primary/50 shadow-lg scale-110 saturate-100 opacity-100"
                                    : "bg-transparent border-border text-text-muted hover:border-primary/30 hover:scale-105 saturate-80 opacity-80 hover:saturate-100 hover:opacity-100"
                            )}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
                {submitError['confidence_delta'] && (
                    <p className="text-destructive text-sm font-medium text-center animate-in fade-in slide-in-from-top-1">
                        Could not save feedback. Please try again.
                    </p>
                )}
            </div>

            {/* 2. Psychological Safety */}
            <div className="space-y-4">
                <div className="flex flex-col items-center justify-center gap-1">
                    <p className="text-lg font-bold text-text-primary text-center">
                        I felt safe to focus on my growth during this session.
                    </p>
                    <SuccessBadge isVisible={justSaved['psychological_safety']} />
                </div>
                <div className="flex justify-center gap-2">
                    {EMOJI_SCALE.map(({ val, emoji }) => (
                        <button
                            key={val}
                            onClick={() => handleSurveySelect('psychological_safety', val)}
                            className={cn(
                                "flex-1 md:flex-none w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-3xl transition-all duration-300",
                                survey.psychological_safety === val
                                    ? "bg-white dark:bg-blue-900/20 border-primary/50 shadow-lg scale-110 saturate-100 opacity-100"
                                    : "bg-transparent border-border text-text-muted hover:border-primary/30 hover:scale-105 saturate-80 opacity-80 hover:saturate-100 hover:opacity-100"
                            )}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
                {submitError['psychological_safety'] && (
                    <p className="text-destructive text-sm font-medium text-center animate-in fade-in slide-in-from-top-1">
                        Could not save feedback. Please try again.
                    </p>
                )}
            </div>

            {/* 3. Repeat Intent */}
            <div className="space-y-6">
                <div className="flex flex-col items-center justify-center gap-1">
                    <p className="text-lg font-bold text-text-primary text-center">
                        I would use this again to prepare for a different role.
                    </p>
                    <SuccessBadge isVisible={justSaved['repeat_intent']} />
                </div>
                <div className="flex justify-center gap-4">
                    <button
                        onClick={() => handleSurveySelect('repeat_intent', 'yes')}
                        className={cn(
                            "flex-1 md:flex-none px-8 py-4 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all duration-300",
                            survey.repeat_intent === 'yes'
                                ? "bg-green-600 border-green-600 text-white shadow-lg scale-105"
                                : "bg-white dark:bg-surface-subtle border-border text-text-secondary hover:border-green-300 hover:text-green-600"
                        )}
                    >
                        <ThumbsUp size={18} /> Yes
                    </button>
                    <button
                        onClick={() => handleSurveySelect('repeat_intent', 'no')}
                        className={cn(
                            "flex-1 md:flex-none px-8 py-4 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all duration-300",
                            survey.repeat_intent === 'no'
                                ? "bg-slate-800 border-slate-800 text-white shadow-lg scale-105"
                                : "bg-white dark:bg-surface-subtle border-border text-text-secondary hover:border-slate-300 hover:text-slate-800"
                        )}
                    >
                        <ThumbsDown size={18} /> No
                    </button>
                </div>
                {submitError['repeat_intent'] && (
                    <p className="text-destructive text-sm font-medium text-center animate-in fade-in slide-in-from-top-1">
                        Could not save feedback. Please try again.
                    </p>
                )}
            </div>

        </div>
    );
}
