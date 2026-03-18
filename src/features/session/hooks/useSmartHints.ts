import { useState, useEffect, useCallback, useRef } from 'react';
import { Question, Blueprint, QuestionTips } from '@/lib/domain/types';
import { Logger } from '@/lib/logger';

const CACHE_KEY_PREFIX = 'smart_hints_';

export interface SmartHintsState {
    hints: QuestionTips | null;
    isLoading: boolean;
    error: string | null;
}

export function useSmartHints(
    question: Question | undefined | null,
    sessionId: string | undefined | null,
    candidateToken: string | undefined,
    role: string,
    blueprint?: Blueprint,
    resumeText?: string
) {
    const [state, setState] = useState<SmartHintsState>({
        hints: null,
        isLoading: false,
        error: null
    });

    const isFetchingRef = useRef(false);
    const cacheKey = question ? `${CACHE_KEY_PREFIX}${question.id}` : '';

    const fetchHints = useCallback(async () => {
        if (!question || !sessionId || !candidateToken || isFetchingRef.current) return;

        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            setState(prev => ({ ...prev, hints: JSON.parse(cached) }));
            return;
        }

        isFetchingRef.current = true;
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const response = await fetch('/api/tips/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-candidate-token': candidateToken,
                },
                body: JSON.stringify({
                    sessionId,
                    question: question.text,
                    role: role,
                    competency: question.competencyId ? { name: question.competencyId } : undefined,
                    blueprint: blueprint,
                    resumeText: resumeText || undefined
                })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch hints');
            }

            const data = await response.json();

            sessionStorage.setItem(cacheKey, JSON.stringify(data));

            setState({ hints: data, isLoading: false, error: null });

        } catch (err) {
            Logger.error("Error fetching hints", err);
            setState({ hints: null, isLoading: false, error: (err as Error).message });
        } finally {
            isFetchingRef.current = false;
        }
    }, [question, sessionId, candidateToken, role, blueprint, resumeText, cacheKey]);

    useEffect(() => {
        isFetchingRef.current = false;
        setState({ hints: null, isLoading: false, error: null });
    }, [question?.id]);

    useEffect(() => {
        if (!question) return;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setState({ hints: parsed, isLoading: false, error: null });
            } catch (e) {
                console.error("Failed to parse cached hints", e);
                sessionStorage.removeItem(cacheKey);
                fetchHints();
            }
        } else {
            fetchHints();
        }
    }, [question?.id, question, cacheKey, fetchHints]);

    return {
        ...state,
        fetchHints
    };
}
