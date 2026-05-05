import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDomainSession } from './useDomainSession';
import { InterviewSession } from '@/lib/domain/types';

const FIXED_NOW = 1_710_000_000_000;

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
};
global.localStorage = mockLocalStorage as unknown as Storage;

describe('useDomainSession', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    });

    it('should initialize with undefined session', () => {
        const { result } = renderHook(() => useDomainSession());
        expect(result.current.session).toBeUndefined();
    });

    // Reproduction Test for Race Condition
    it('should prevent multiple concurrent submissions (Race Condition Repro)', async () => {
        // 1. Setup Session
        const mockSession: InterviewSession = {
            id: '123',
            status: 'IN_SESSION',
            role: 'PM',
            currentQuestionIndex: 0,
            questions: [{ id: 'q1', text: 'Q1', index: 0, category: 'Tech' }],
            answers: {},
            initialsRequired: false,
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockSession,
        });

        const { result } = renderHook(() => useDomainSession('123'));

        // Wait for init
        await waitFor(() => expect(result.current.session).toBeDefined());

        // 2. Mock Slow Submit Response
        mockFetch.mockImplementation(async (url) => {
            if (url.includes('/submit')) {
                await new Promise(res => setTimeout(res, 100)); // Delay
                return {
                    ok: true,
                    json: async () => ({
                        ...mockSession,
                        status: 'AWAITING_EVALUATION',
                        answers: { q1: { questionId: 'q1', transcript: 'A1', submittedAt: FIXED_NOW } }
                    })
                };
            }
            if (url.includes('/analysis')) {
                return {
                    ok: true,
                    json: async () => ({
                        ...mockSession,
                        status: 'REVIEWING',
                        answers: {
                            q1: {
                                questionId: 'q1',
                                transcript: 'A1',
                                submittedAt: FIXED_NOW,
                                analysis: { ack: 'ok' }
                            }
                        }
                    })
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        // 3. Trigger Submit Twice Rapidly
        await act(async () => {
            const p1 = result.current.actions.submit('Answer 1');
            const p2 = result.current.actions.submit('Answer 2');
            await Promise.all([p1, p2]);
        });

        // 4. Expectation: guarded by isSubmittingRef
        expect(mockFetch).toHaveBeenCalledTimes(3); // 1 for init, 1 for first submit, 1 for follow-up analysis.
        const analysisCall = mockFetch.mock.calls.find(([url]) => String(url).includes('/analysis'));
        expect(analysisCall?.[1]?.headers).toMatchObject({
            'Idempotency-Key': expect.stringContaining('analysis:123:q1:')
        });
    });

    // Verification Test for Cross-Action Race Class
    it('should prevent concurrent submit and next requests (Mutex Fix Verification)', async () => {
        // 1. Setup Session
        const mockSession: InterviewSession = {
            id: '123',
            status: 'IN_SESSION',
            role: 'PM',
            currentQuestionIndex: 0,
            questions: [{ id: 'q1', text: 'Q1', index: 0, category: 'Tech' }],
            answers: {},
            initialsRequired: false,
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockSession,
        });

        const { result } = renderHook(() => useDomainSession('123'));
        await waitFor(() => expect(result.current.session).toBeDefined());

        // 2. Clear previous fetch calls (from init)
        mockFetch.mockClear();

        // 3. Mock logic
        // Slow submit
        // Fast next
        mockFetch.mockImplementation(async (url) => {
            if (url.includes('/submit')) {
                await new Promise(res => setTimeout(res, 100));
                return {
                    ok: true,
                    json: async () => ({
                        ...mockSession,
                        status: 'AWAITING_EVALUATION',
                        answers: { q1: { questionId: 'q1', transcript: 'A1', submittedAt: FIXED_NOW } }
                    })
                };
            }
            if (url.includes('/analysis')) {
                return {
                    ok: true,
                    json: async () => ({
                        ...mockSession,
                        status: 'REVIEWING',
                        answers: {
                            q1: {
                                questionId: 'q1',
                                transcript: 'A1',
                                submittedAt: FIXED_NOW,
                                analysis: { ack: 'ok' }
                            }
                        }
                    })
                };
            }
            if (url.includes('/session/123')) { // PATCH for next
                return { ok: true, json: async () => ({ ...mockSession, currentQuestionIndex: 1 }) };
            }
            return { ok: true, json: async () => ({}) };
        });

        // 4. Trigger Submit and Next concurrently
        await act(async () => {
            const p1 = result.current.actions.submit('Answer 1');
            const p2 = result.current.actions.next();
            await Promise.all([p1, p2]);
        });

        // 5. Expectation: The second call should be BLOCKED by the mutex.
        expect(mockFetch).toHaveBeenCalledTimes(2); // submit + follow-up analysis; next remains blocked.
    });

    it('should ignore retry while a submit command is already in flight', async () => {
        const mockSession: InterviewSession = {
            id: '123',
            status: 'IN_SESSION',
            role: 'PM',
            currentQuestionIndex: 0,
            questions: [{ id: 'q1', text: 'Q1', index: 0, category: 'Tech' }],
            answers: {
                q1: {
                    questionId: 'q1',
                    draft: 'Draft answer'
                }
            },
            initialsRequired: false,
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockSession,
        });

        const { result } = renderHook(() => useDomainSession('123'));
        await waitFor(() => expect(result.current.session).toBeDefined());

        mockFetch.mockClear();

        mockFetch.mockImplementation(async (url) => {
            if (url.includes('/submit')) {
                await new Promise(res => setTimeout(res, 100));
                return {
                    ok: true,
                    json: async () => ({
                        ...mockSession,
                        status: 'AWAITING_EVALUATION',
                        answers: { q1: { questionId: 'q1', transcript: 'A1', submittedAt: FIXED_NOW } }
                    })
                };
            }
            if (url.includes('/analysis')) {
                return {
                    ok: true,
                    json: async () => ({
                        ...mockSession,
                        status: 'REVIEWING',
                        answers: {
                            q1: {
                                questionId: 'q1',
                                transcript: 'A1',
                                submittedAt: FIXED_NOW,
                                analysis: { ack: 'ok' }
                            }
                        }
                    })
                };
            }
            if (url.includes('/retry')) {
                return { ok: true, json: async () => ({ ...mockSession, status: 'IN_SESSION' }) };
            }
            return { ok: true, json: async () => ({}) };
        });

        await act(async () => {
            const p1 = result.current.actions.submit('Answer 1');
            const p2 = result.current.actions.retry({ trigger: 'user' });
            await Promise.all([p1, p2]);
        });

        expect(mockFetch).toHaveBeenCalledTimes(2); // submit + follow-up analysis; retry remains ignored.
    });
});
