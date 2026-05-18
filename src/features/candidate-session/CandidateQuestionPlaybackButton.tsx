"use client";

import { Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { audioEngine } from "@/features/audio/audio-engine";
import { useTextToSpeech } from "@/features/audio/hooks/useTextToSpeech";

type CandidateQuestionPlaybackButtonProps = {
    sessionId: string;
    question: {
        id: string;
        text: string;
    };
};

export function CandidateQuestionPlaybackButton({
    sessionId,
    question,
}: CandidateQuestionPlaybackButtonProps) {
    const { isPlaying, isLoading, speak, stop } = useTextToSpeech();

    return (
        <Button
            type="button"
            onClick={() => {
                void audioEngine.unlock().then(() => {
                    if (isPlaying) {
                        stop();
                        return;
                    }

                    void speak(question.text, question.id, { sessionId });
                });
            }}
            disabled={isLoading}
            size="icon"
            shape="pill"
            className={cn(
                isPlaying
                    ? "scale-105 border-brand-deep bg-brand-deep text-text-inverse shadow-floating"
                    : "border-border/50 bg-surface-subtle/50 text-state-info hover:scale-105 hover:bg-surface-subtle/80",
            )}
            aria-label={isPlaying ? "Stop reading" : "Read question"}
        >
            {isPlaying ? <Pause size={18} className="animate-pulse" /> : <Play size={18} />}
        </Button>
    );
}
