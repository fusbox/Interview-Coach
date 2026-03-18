import { useState, useEffect, useCallback, useRef } from 'react';

// Basic type definitions for Web Speech API
interface SpeechRecognitionEvent {
    results: {
        length: number;
        [index: number]: {
            [index: number]: {
                transcript: string;
            };
        };
    };
}

interface SpeechRecognitionErrorEvent {
    error: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onstart: () => void;
    onend: () => void;
}

// Minimal window extension
interface WindowWithSpeech extends Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
}

export const useSpeechToText = () => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const acceptResultsRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Check for browser support
        const SpeechRecognition =
            (window as unknown as WindowWithSpeech).SpeechRecognition ||
            (window as unknown as WindowWithSpeech).webkitSpeechRecognition;

        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onstart = () => {
                console.log("[STT] Speech Recognition Started");
                setIsListening(true);
            };

            recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
                if (!acceptResultsRef.current) {
                    return;
                }

                let currentTranscript = '';
                for (let i = 0; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                }
                console.log(`[STT] Result received: "${currentTranscript.slice(0, 20)}..."`);
                setTranscript(currentTranscript);
            };

            recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error('[STT] Recognition error:', event.error);
                if (event.error === 'no-speech') {
                    return;
                }
                if (event.error !== 'aborted') {
                    setError(`Speech recognition error: ${event.error}`);
                }

                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    setIsListening(false);
                }
            };

            recognitionRef.current.onend = () => {
                console.log("[STT] Speech Recognition Ended");
                setIsListening(false);
                acceptResultsRef.current = false;
            };
        } else {
            console.warn('[STT] Browser does not support speech recognition');
            setError('Browser does not support speech recognition');
        }

        return () => {
            if (recognitionRef.current) {
                acceptResultsRef.current = false;
                recognitionRef.current.abort();
            }
        };
    }, []);

    const startListening = useCallback(() => {
        if (!recognitionRef.current) {
            setError('Speech recognition not supported');
            return;
        }

        console.log("[STT] Requesting Start");
        setError(null);
        setTranscript('');
        acceptResultsRef.current = true;

        try {
            recognitionRef.current.start();
        } catch (err) {
            console.error('[STT] Failed to start:', err);
        }
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            console.log("[STT] Requesting Stop");
            recognitionRef.current.stop();
        }
    }, []);

    const abortListening = useCallback((options?: { resetTranscript?: boolean }) => {
        acceptResultsRef.current = false;
        if (options?.resetTranscript) {
            setTranscript('');
        }

        if (recognitionRef.current) {
            console.log("[STT] Requesting Abort");
            recognitionRef.current.abort();
        }

        setIsListening(false);
    }, []);

    return {
        isListening,
        transcript,
        startListening,
        stopListening,
        abortListening,
        error,
        isSupported: !!recognitionRef.current
    };
};
