import { useState } from "react";
import { captureFeedbackAction } from "@/app/actions/feedback";
import { ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
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
    const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
    const [submitError, setSubmitError] = useState<Record<string, boolean>>({});

    const handleSurveySelect = async (key: string, val: string | number) => {
        setSurvey(prev => ({ ...prev, [key]: val }));
        setSubmitError(prev => ({ ...prev, [key]: false }));

        try {
            await captureFeedbackAction({
                sessionId,
                type: `session_completion_${key}`,
                rating: typeof val === 'number' ? val : undefined,
                comment: typeof val === 'string' ? val : undefined,
                metadata: { question: key }
            });
            setSubmitted(prev => ({ ...prev, [key]: true }));
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

    return (
        <div className="bg-transparent rounded-2xl p-0 md:px-2 space-y-12">

            {/* 1. Confidence Delta */}
            <div className="space-y-4">
                <p className="text-lg font-bold text-text-primary text-center">
                    I feel more prepared after this session.
                </p>
                <div className="flex justify-center gap-2">
                    {EMOJI_SCALE.map(({ val, emoji }) => (
                        <button
                            key={val}
                            onClick={() => handleSurveySelect('confidence_delta', val)}
                            className={cn(
                                "flex-1 md:flex-none w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-3xl transition-all duration-300",
                                survey.confidence_delta === val
                                    ? "bg-transparent border-primary/30 shadow-lg scale-110 grayscale-0 opacity-100"
                                    : "bg-transparent border-transparent text-text-muted hover:border-primary/10 hover:scale-105 grayscale opacity-60 hover:grayscale-0 hover:opacity-100"
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
                {submitted['confidence_delta'] && !submitError['confidence_delta'] && (
                    <p className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                        <CheckCircle2 className="w-4 h-4" /> Feedback captured
                    </p>
                )}
            </div>

            {/* 2. Psychological Safety */}
            <div className="space-y-4">
                <p className="text-lg font-bold text-text-primary text-center">
                    I felt safe to focus on my growth during this session.
                </p>
                <div className="flex justify-center gap-2">
                    {EMOJI_SCALE.map(({ val, emoji }) => (
                        <button
                            key={val}
                            onClick={() => handleSurveySelect('psychological_safety', val)}
                            className={cn(
                                "flex-1 md:flex-none w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-3xl transition-all duration-300",
                                survey.psychological_safety === val
                                    ? "bg-transparent border-primary/30 shadow-lg scale-110 grayscale-0 opacity-100"
                                    : "bg-transparent border-transparent text-text-muted hover:border-primary/10 hover:scale-105 grayscale opacity-60 hover:grayscale-0 hover:opacity-100"
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
                {submitted['psychological_safety'] && !submitError['psychological_safety'] && (
                    <p className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                        <CheckCircle2 className="w-4 h-4" /> Feedback captured
                    </p>
                )}
            </div>

            {/* 3. Repeat Intent */}
            <div className="space-y-4">
                <p className="text-lg font-bold text-text-primary text-center">
                    I would use this again to prepare for a different role.
                </p>
                <div className="flex justify-center gap-4">
                    <button
                        onClick={() => handleSurveySelect('repeat_intent', 'yes')}
                        className={cn(
                            "flex-1 md:flex-none px-8 py-3 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all duration-300",
                            survey.repeat_intent === 'yes'
                                ? "bg-green-600 border-green-600 text-white shadow-lg"
                                : "bg-transparent border-border text-text-secondary hover:border-green-300 hover:text-green-600 hover:bg-green-50/50 dark:hover:bg-green-900/20"
                        )}
                    >
                        <ThumbsUp size={18} /> Yes
                    </button>
                    <button
                        onClick={() => handleSurveySelect('repeat_intent', 'no')}
                        className={cn(
                            "flex-1 md:flex-none px-8 py-3 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all duration-300",
                            survey.repeat_intent === 'no'
                                ? "bg-text-primary border-text-primary text-text-inverse shadow-lg"
                                : "bg-transparent border-border text-text-secondary hover:border-text-primary hover:text-text-primary hover:bg-surface-elevated/50"
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
                {submitted['repeat_intent'] && !submitError['repeat_intent'] && (
                    <p className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                        <CheckCircle2 className="w-4 h-4" /> Response recorded
                    </p>
                )}
            </div>

        </div>
    );
}
