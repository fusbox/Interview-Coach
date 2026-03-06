"use client";

import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { InterviewSession, AnalysisResult } from '@/lib/domain/types';
import { NowState, ScreenId } from '@/lib/state/now.types';
import { useDomainSession } from '../hooks/useDomainSession';
import { useEngagementTracker, TrackerEvent, EngagementTier } from '@/features/analytics/hooks/useEngagementTracker';

// --- Types (Stubs or Imports) ---
export interface OnboardingIntakeV1 {
    [key: string]: unknown;
}

export interface SessionContextType {
    // Legacy State (Mapped to Core where possible)
    session?: InterviewSession | null;
    startSession: (
        role: string,
        jobDescription?: string,
        intakeData?: OnboardingIntakeV1
    ) => Promise<void>;
    submitInitials: (initials: string) => Promise<void>;
    saveDraft: (text: string) => Promise<void>;
    nextQuestion: () => void;
    retryQuestion: (context?: { trigger: 'user' | 'coach'; focus?: string }) => void;
    goToQuestion: (index: number) => void;
    isLoading: boolean;

    // Stubs for legacy signature compatibility
    loadTipsForQuestion: (questionId: string) => Promise<void>;
    saveAnswer: (
        questionId: string,
        answer: { audioBlob?: Blob; text?: string; transcript?: string; analysis: AnalysisResult | null }
    ) => void;
    clearAnswer: (questionId: string) => void;
    updateAnswerAnalysis: (questionId: string, partialAnalysis: Partial<AnalysisResult>) => void;
    finishSession: () => Promise<void>;
    resetSession: () => void;
    analyzeCurrentQuestion: () => Promise<void>;
    audioUrls: Record<string, string>;
    cacheAudioUrl: (questionId: string, url: string) => void;
    updateSession: (sessionId: string, updates: Partial<InterviewSession>) => Promise<void>;
    refresh: () => Promise<void>;

    // Headless Core State (The New Truth)
    now: NowState;
    screen: ScreenId;

    // Engagement State (Hoisted)
    totalEngagedSeconds: number;
    trackEvent: (tier: EngagementTier, eventType?: string, durationSeconds?: number) => void;
    engagementDebugEvents: TrackerEvent[];
    isEngagementWindowOpen: boolean;
    engagementWindowTimeRemaining: number;
    clearDebugEvents: () => void;
    flushEngagement: () => void;
    recordEngagement: (deltaSeconds: number) => void;
    createNewSession: (role: string, parentId?: string) => Promise<{ sessionId: string; candidateToken: string } | null>;
}

export const SessionContext = createContext<SessionContextType | undefined>(undefined);

export interface SessionProviderProps {
    children: ReactNode;
    sessionId?: string;
    candidateToken?: string;
    initialConfig?: {
        role: string;
        jobDescription?: string;
        candidate?: {
            firstName: string;
            lastName: string;
            email: string;
        };
    };
}

export const SessionProvider: React.FC<SessionProviderProps> = ({
    children,
    sessionId,
    candidateToken: initialCandidateToken,
    initialConfig
}) => {
    // Local state for candidateToken to allow updates on session creation
    const [candidateToken, setCandidateToken] = useState<string | undefined>(initialCandidateToken);

    // Sync with prop changes (e.g., when navigating to a new session)
    useEffect(() => {
        setCandidateToken(initialCandidateToken);
    }, [initialCandidateToken]);

    // The Core Hook manages the state
    const { session, now, actions } = useDomainSession(sessionId, candidateToken);
    // Bootstrap on mount
    useEffect(() => {
        if (!now.isLoaded && !sessionId) {
            // Only auto-init new session if we aren't loading an existing one (e.g. via Invite)
            const role = initialConfig?.role || "Product Manager";
            actions.init(role);
        }
    }, [now.isLoaded, actions, initialConfig, sessionId]);

    // Adapter Logic
    const startSession = async (role: string, jobDescription?: string, intakeData?: OnboardingIntakeV1) => {
        // Log for debugging (and to satisfy linter about unused vars)
        console.log("SessionContext: startSession called", { role, jobDescription, intakeData });
        // Transition to IN_SESSION
        actions.start();
    };

    const submitInitials = async (initials: string) => {
        actions.submitInitials(initials);
    };

    const saveDraft = async (text: string) => {
        actions.saveDraft(text);
    };

    const nextQuestion = () => {
        tracker.flush();
        actions.next();
    };

    const retryQuestion = (context?: { trigger: 'user' | 'coach'; focus?: string }) => {
        tracker.flush();
        actions.retry(context);
    };

    const saveAnswer = async (_qid: string, ans: { audioBlob?: Blob; text?: string; transcript?: string; analysis: AnalysisResult | null }) => {
        if (ans.text || ans.audioBlob) {
            tracker.flush();
            await actions.submit(ans.text || "", ans.audioBlob);
        }
    };

    const goToQuestion = (index: number) => {
        tracker.flush();
        actions.goToQuestion(index);
    };

    const loadTipsForQuestion = async () => console.log("loadTips not impl in V1");
    const clearAnswer = () => console.log("clearAnswer not impl");
    const updateAnswerAnalysis = () => console.log("updateAnswerAnalysis not impl");
    const finishSession = async () => console.log("finishSession handled by Orchestrator");
    const cacheAudioUrl = () => { };
    const updateSession = async (sessionId: string, updates: Partial<InterviewSession>) => {
        if (sessionId !== session?.id) console.warn("Context updateSession ID mismatch - updating current anyway");
        await actions.updateSession(updates);
    };

    const tracker = useEngagementTracker({
        isEnabled: session?.status !== 'COMPLETED',
        initialSeconds: session?.engagedTimeSeconds || 0,
        onUpdate: (seconds) => {
            actions.recordEngagement(seconds);
        },
    });

    const createNewSession = async (role: string, parentId?: string) => {
        const result = await actions.init(role, parentId);
        if (!result?.sessionId || !result?.candidateToken) {
            console.error("SessionContext: createNewSession failed - invalid result", result);
            return null;
        }
        // Update the local candidateToken state to match the new session
        setCandidateToken(result.candidateToken);
        return result as { sessionId: string; candidateToken: string };
    };

    const contextValue: SessionContextType = {
        session,
        now,
        screen: now.screen,
        startSession,
        submitInitials,
        saveDraft,
        nextQuestion,
        retryQuestion,
        goToQuestion,
        isLoading: !now.isLoaded,
        loadTipsForQuestion,
        saveAnswer,
        clearAnswer,
        updateAnswerAnalysis,
        finishSession,
        resetSession: actions.reset,
        analyzeCurrentQuestion: actions.analyzeCurrentQuestion,
        audioUrls: {}, // No audio in V1
        cacheAudioUrl,
        updateSession,
        refresh: actions.refresh,
        // Engagement
        totalEngagedSeconds: tracker.totalEngagedSeconds,
        trackEvent: tracker.trackEvent,
        engagementDebugEvents: tracker.debugEvents,
        isEngagementWindowOpen: tracker.isWindowOpen,
        engagementWindowTimeRemaining: tracker.windowTimeRemaining,
        clearDebugEvents: tracker.clearDebugEvents,
        flushEngagement: tracker.flush,
        recordEngagement: actions.recordEngagement,
        createNewSession
    };

    return (
        <SessionContext.Provider value={contextValue}>
            {children}
        </SessionContext.Provider>
    );
};

export const useSession = () => {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};
