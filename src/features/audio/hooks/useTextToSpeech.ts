import { useState, useCallback, useEffect } from 'react';
import { audioEngine } from '../audio-engine';

export const useTextToSpeech = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Subscribe to AudioEngine state changes
    useEffect(() => {
        const unsubscribe = audioEngine.subscribe(() => {
            setIsPlaying(audioEngine.isPlaying);
            setIsLoading(audioEngine.isLoading);
        });
        return unsubscribe;
    }, []);

    const speak = useCallback(async (text: string, id?: string, auth?: { candidateToken?: string; sessionId?: string }) => {
        if (!text) return;
        // Use text hash as fallback ID if none provided
        const audioId = id || text.slice(0, 50);
        await audioEngine.play(audioId, text, auth);
    }, []);

    const stop = useCallback(() => {
        audioEngine.stop();
    }, []);

    const prefetch = useCallback((id: string, text: string, auth?: { candidateToken?: string; sessionId?: string }) => {
        audioEngine.prefetch(id, text, auth);
    }, []);

    return {
        speak,
        stop,
        isPlaying,
        isLoading,
        prefetch
    };
};
