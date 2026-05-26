"use client";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { audioEngine } from "@/features/audio/audio-engine";

type CandidateSessionStartButtonProps = {
    sessionId: string;
    firstQuestion: {
        id: string;
        text: string;
    } | null;
};

export function CandidateSessionStartButton({
    sessionId,
    firstQuestion,
}: CandidateSessionStartButtonProps) {
    return (
        <Button
            type="button"
            size="lg"
            className="h-auto w-full rounded-2xl bg-primary py-6 text-lg font-bold text-primary-foreground shadow-floating transition-all hover:-translate-y-0.5 hover:bg-primary/90"
            onClick={(event) => {
                void audioEngine.unlock().then(() => {
                    if (firstQuestion) {
                        audioEngine.prefetch(firstQuestion.id, firstQuestion.text, { sessionId });
                    }
                });
                event.currentTarget.form?.requestSubmit();
            }}
        >
            Begin First Question
            <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
    );
}
