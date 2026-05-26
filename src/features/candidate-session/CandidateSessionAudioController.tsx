"use client";

import { useEffect } from "react";

import { useTextToSpeech } from "@/features/audio/hooks/useTextToSpeech";

type CandidateSessionAudioControllerProps = {
    sessionId: string;
    currentQuestion: {
        id: string;
        text: string;
    } | null;
    nextQuestion?: {
        id: string;
        text: string;
    } | null;
    shouldAutoPlayCurrent?: boolean;
};

export function CandidateSessionAudioController({
    sessionId,
    currentQuestion,
    nextQuestion,
    shouldAutoPlayCurrent = false,
}: CandidateSessionAudioControllerProps) {
    const { prefetch, speak } = useTextToSpeech();

    useEffect(() => {
        if (!currentQuestion) {
            return;
        }

        const auth = { sessionId };
        prefetch(currentQuestion.id, currentQuestion.text, auth);

        if (shouldAutoPlayCurrent) {
            speak(currentQuestion.text, currentQuestion.id, auth);
        }
    }, [currentQuestion, prefetch, sessionId, shouldAutoPlayCurrent, speak]);

    useEffect(() => {
        if (!nextQuestion) {
            return;
        }

        prefetch(nextQuestion.id, nextQuestion.text, { sessionId });
    }, [nextQuestion, prefetch, sessionId]);

    return null;
}
