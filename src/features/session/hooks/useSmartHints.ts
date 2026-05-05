import { useState, useEffect, useCallback, useRef } from 'react';
import { Question, Blueprint, QuestionTips } from '@/lib/domain/types';
import { Logger } from '@/lib/logger';

const CACHE_KEY_PREFIX = 'smart_hints:';
const inFlightHintRequests = new Map<string, Promise<QuestionTips>>();

function buildCacheKey(sessionId: string | undefined | null, questionId: string | undefined | null) {
    return sessionId && questionId ? `${CACHE_KEY_PREFIX}${sessionId}:${questionId}` : '';
}

function readCachedHints(cacheKey: string) {
    const cached = sessionStorage.getItem(cacheKey);
    if (!cached) return null;

    try {
        return JSON.parse(cached) as QuestionTips;
    } catch (error) {
        Logger.error("Failed to parse cached hints", error);
        sessionStorage.removeItem(cacheKey);
        return null;
    }
}

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
    const cacheKey = buildCacheKey(sessionId, question?.id);

    const fetchHints = useCallback(async () => {
        if (!question || !sessionId || !candidateToken || !cacheKey || isFetchingRef.current) return;

        const cached = readCachedHints(cacheKey);
        if (cached) {
            setState(prev => ({ ...prev, hints: cached, isLoading: false, error: null }));
            return;
        }

        isFetchingRef.current = true;
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            let request = inFlightHintRequests.get(cacheKey);

            if (!request) {
                request = fetch('/api/tips/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-candidate-token': candidateToken,
                        'Idempotency-Key': cacheKey,
                    },
                    body: JSON.stringify({
                        sessionId,
                        question: question.text,
                        role: role,
                        competency: question.competencyId ? { name: question.competencyId } : undefined,
                        blueprint: blueprint,
                        resumeText: resumeText || undefined
                    })
                }).then(async (response) => {
                    if (!response.ok) {
                        throw new Error('Failed to fetch hints');
                    }

                    const data = await response.json() as QuestionTips;
                    sessionStorage.setItem(cacheKey, JSON.stringify(data));
                    return data;
                }).finally(() => {
                    inFlightHintRequests.delete(cacheKey);
                });

                inFlightHintRequests.set(cacheKey, request);
            }

            const data = await request;
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
    }, [cacheKey]);

    useEffect(() => {
        if (!question || !cacheKey) return;
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
