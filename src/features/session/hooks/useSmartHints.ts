import { useState, useEffect, useCallback, useRef } from 'react';
import { Question, Blueprint, QuestionTips } from '@/lib/domain/types';
import { Logger } from '@/lib/logger';

// Caching Key Prefix
const CACHE_KEY_PREFIX = 'smart_hints_';

export interface SmartHintsState {
    hints: QuestionTips | null;
    isLoading: boolean;
    error: string | null;
}

export function useSmartHints(
    question: Question,
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
    const cacheKey = `${CACHE_KEY_PREFIX}${question.id}`;

    const fetchHints = useCallback(async () => {
        if (isFetchingRef.current) return;

        // If already cached, don't fetch.
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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

            // Cache it
            sessionStorage.setItem(cacheKey, JSON.stringify(data));

            setState({ hints: data, isLoading: false, error: null });

        } catch (err) {
            Logger.error("Error fetching hints", err);
            setState({ hints: null, isLoading: false, error: (err as Error).message });
        } finally {
            isFetchingRef.current = false;
        }
    }, [question, role, blueprint, resumeText, cacheKey]);

    // Reset state explicitly when question changes to prevent content flashing from the prior question
    useEffect(() => {
        isFetchingRef.current = false;
        setState({ hints: null, isLoading: false, error: null });
    }, [question.id]);

    // Load from cache on mount or question change + Auto-fetch
    useEffect(() => {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setState({ hints: parsed, isLoading: false, error: null });
            } catch (e) {
                console.error("Failed to parse cached hints", e);
                sessionStorage.removeItem(cacheKey);
                fetchHints(); // Fetch if cache corrupted
            }
        } else {
            // Proactively fetch if not cached
            fetchHints();
        }
    }, [question.id, cacheKey, fetchHints]);

    return {
        ...state,
        fetchHints
    };
}
