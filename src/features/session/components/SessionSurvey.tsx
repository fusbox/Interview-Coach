"use client";

import { useState } from "react";
import { captureFeedbackAction } from "@/app/actions/feedback";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { FeedbackPill } from "@/components/patterns/FeedbackPill";
import { AlertPanel } from "@/components/patterns/AlertPanel";
import { EMOJI_SCALE, FeedbackChoiceButton } from "@/components/patterns/FeedbackChoiceButton";

export interface SessionSurveyProps {
    sessionId?: string;
}

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
                rating: typeof val === "number" ? val : undefined,
                comment: typeof val === "string" ? val : undefined,
                metadata: { question: key },
            });
            setJustSaved(prev => ({ ...prev, [key]: true }));
            setTimeout(() => {
                setJustSaved(prev => ({ ...prev, [key]: false }));
            }, 2000);
        } catch {
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
            <div className="space-y-4">
                <div className="flex flex-col items-center justify-center gap-1">
                    <p className="text-lg font-bold text-text-primary text-center">
                        I feel more prepared after this session.
                    </p>
                </div>
                <div className="flex justify-center gap-2">
                    {EMOJI_SCALE.map(({ val, emoji }) => (
                        <div key={val} className="relative">
                            <FeedbackChoiceButton
                                onClick={() => handleSurveySelect("confidence_delta", val)}
                                kind="emoji"
                                tone="primary"
                                selected={survey.confidence_delta === val}
                            >
                                {emoji}
                            </FeedbackChoiceButton>
                            <FeedbackPill isVisible={justSaved.confidence_delta && survey.confidence_delta === val} text="" />
                        </div>
                    ))}
                </div>
                {submitError.confidence_delta && (
                    <AlertPanel tone="critical" size="sm" className="animate-in fade-in slide-in-from-top-1 justify-center">
                        Could not save feedback. Please try again.
                    </AlertPanel>
                )}
            </div>

            <div className="space-y-4">
                <div className="flex flex-col items-center justify-center gap-1">
                    <p className="text-lg font-bold text-text-primary text-center">
                        I felt safe to focus on my growth during this session.
                    </p>
                </div>
                <div className="flex justify-center gap-2">
                    {EMOJI_SCALE.map(({ val, emoji }) => (
                        <div key={val} className="relative">
                            <FeedbackChoiceButton
                                onClick={() => handleSurveySelect("psychological_safety", val)}
                                kind="emoji"
                                tone="primary"
                                selected={survey.psychological_safety === val}
                            >
                                {emoji}
                            </FeedbackChoiceButton>
                            <FeedbackPill
                                isVisible={justSaved.psychological_safety && survey.psychological_safety === val}
                                text=""
                            />
                        </div>
                    ))}
                </div>
                {submitError.psychological_safety && (
                    <AlertPanel tone="critical" size="sm" className="animate-in fade-in slide-in-from-top-1 justify-center">
                        Could not save feedback. Please try again.
                    </AlertPanel>
                )}
            </div>

            <div className="space-y-6">
                <div className="flex flex-col items-center justify-center gap-1">
                    <p className="text-lg font-bold text-text-primary text-center">
                        I would use this again to prepare for a different role.
                    </p>
                </div>
                <div className="flex justify-center gap-4">
                    <div className="relative">
                        <FeedbackChoiceButton
                            onClick={() => handleSurveySelect("repeat_intent", "yes")}
                            kind="chip"
                            tone="success"
                            selected={survey.repeat_intent === "yes"}
                        >
                            <ThumbsUp size={18} /> Yes
                        </FeedbackChoiceButton>
                        <FeedbackPill isVisible={justSaved.repeat_intent && survey.repeat_intent === "yes"} text="" />
                    </div>
                    <div className="relative">
                        <FeedbackChoiceButton
                            onClick={() => handleSurveySelect("repeat_intent", "no")}
                            kind="chip"
                            tone="neutral"
                            selected={survey.repeat_intent === "no"}
                        >
                            <ThumbsDown size={18} /> No
                        </FeedbackChoiceButton>
                        <FeedbackPill isVisible={justSaved.repeat_intent && survey.repeat_intent === "no"} text="" />
                    </div>
                </div>
                {submitError.repeat_intent && (
                    <AlertPanel tone="critical" size="sm" className="animate-in fade-in slide-in-from-top-1 justify-center">
                        Could not save feedback. Please try again.
                    </AlertPanel>
                )}
            </div>
        </div>
    );
}
